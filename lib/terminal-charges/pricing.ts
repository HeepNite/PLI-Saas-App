import "server-only"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getCatalogCourseBySlug } from "@/lib/catalog-courses"
import { validateCheckoutPayload } from "@/lib/checkout/validation"
import { isOpenPurchase, isUnchargedCardAttempt } from "@/app/api/staff/payments/shared"
import { asObject, asText } from "@/lib/shared"
import {
  TERMINAL_CHARGE_DESCRIPTION_MAX_LENGTH,
  TERMINAL_CHARGE_FREE_AMOUNT_MAX_CENTS,
  TERMINAL_CHARGE_GUEST_NAME_MAX_LENGTH,
  TERMINAL_CHARGE_MAX_ITEMS,
  type TerminalChargeItemKind,
} from "@/lib/terminal-charges/contract"

export class TerminalChargeError extends Error {
  constructor(readonly status: 400 | 403 | 404 | 409, message: string) {
    super(message)
    this.name = "TerminalChargeError"
  }
}

const invalid = (message: string) => new TerminalChargeError(400, message)

type Db = Prisma.TransactionClient | typeof prisma

/** One line item as stored on StaffTerminalChargeItem; `description` holds the line label. */
export type PricedTerminalChargeItem = {
  kind: TerminalChargeItemKind
  beneficiaryUserId: string | null
  courseSlug: string | null
  packageId: string | null
  guestName: string | null
  unitCents: number
  amountCents: number
  outstandingPurchaseId: string | null
  outstandingAttendanceId: string | null
  description: string
}

const readOptionalId = (value: unknown) => {
  const id = typeof value === "string" ? value.trim() : ""
  return id.length <= 128 ? id : ""
}

const toCents = (dollars: number | undefined) => (typeof dollars === "number" && Number.isFinite(dollars) ? Math.round(dollars * 100) : 0)

// Package and drop-in prices come from the same catalog and checkout validation the checkout uses.
const priceCatalogLine = async (courseSlug: unknown, packageId: string) => {
  const course = typeof courseSlug === "string" && courseSlug ? await getCatalogCourseBySlug(courseSlug) : null
  if (!course) throw invalid("Course not found")
  const pkg = packageId ? course.enrollment.packages.find((option) => option.id === packageId) : undefined
  if (packageId && !pkg) throw invalid("Invalid package")
  const expectedCents = toCents(pkg ? pkg.price : course.enrollment.services.find((service) => service.id === "dropin")?.price)
  if (expectedCents <= 0) throw invalid("Item has no catalog price")
  const validation = await validateCheckoutPayload({ courseSlug: course.slug, courseTitle: course.title, amount: expectedCents, serviceId: "dropin", packageId })
  if ("error" in validation) throw invalid(validation.error)
  return { courseSlug: course.slug, cents: validation.amountInt, title: pkg ? `${pkg.label} — ${course.title}` : `Guest class — ${course.title}` }
}

const courseDropInCents =async (db: Db, courseSlug: string) => {
  const course = await db.courseCatalog.findUnique({ where: { slug: courseSlug }, select: { dropInPriceCents: true } })
  return course?.dropInPriceCents && course.dropInPriceCents > 0 ? course.dropInPriceCents : 0
}

const priceOutstandingPurchase = async (db: Db, payerUserId: string, purchaseId: string) => {
  const purchase = await db.purchase.findUnique({ where: { id: purchaseId } })
  if (!purchase || purchase.userId !== payerUserId) throw invalid("Outstanding item not found for this payer")
  // isOpenPurchase already refuses charge carriers.
  if (isUnchargedCardAttempt(purchase) || !isOpenPurchase(purchase).isOpen) throw invalid("Item is no longer outstanding")
  // Zero-amount debts settle at the course drop-in price, as the bulk cash settlement does.
  const cents = purchase.amount > 0 ? purchase.amount : await courseDropInCents(db, purchase.courseSlug)
  return { cents, courseSlug: purchase.courseSlug, title: purchase.courseTitle || purchase.courseSlug }
}

const priceOutstandingAttendance = async (db: Db, payerUserId: string, attendanceId: string) => {
  const attendance = await db.attendance.findUnique({ where: { id: attendanceId }, include: { session: true, packageUsage: true } })
  if (!attendance || attendance.userId !== payerUserId) throw invalid("Outstanding item not found for this payer")
  if (attendance.packageUsage) throw invalid("Item is no longer outstanding")
  const linkedPurchaseId = asText(asObject(attendance.metadata).purchaseId)
  const linked = linkedPurchaseId ? await db.purchase.findUnique({ where: { id: linkedPurchaseId } }) : null
  if (linked && !isOpenPurchase(linked).isOpen) throw invalid("Item is no longer outstanding")
  const courseSlug = attendance.session.courseSlug
  return { cents: await courseDropInCents(db, courseSlug), courseSlug, title: attendance.session.title || courseSlug }
}

/**
 * Validates the panel's items and prices them on the server (FR2, FR4). Only `free_amount`
 * carries a client amount; every other amount the client sends is ignored.
 */
export const priceTerminalChargeItems = async (db: Db, payerUserId: string, rawItems: unknown): Promise<PricedTerminalChargeItem[]> => {
  if (!Array.isArray(rawItems) || rawItems.length === 0) throw invalid("At least one item is required")
  if (rawItems.length > TERMINAL_CHARGE_MAX_ITEMS) throw invalid("Too many items")

  const seen = new Set<string>()
  const priced: PricedTerminalChargeItem[] = []
  for (const rawItem of rawItems) {
    const raw = asObject(rawItem)
    const empty = { beneficiaryUserId: null, courseSlug: null, packageId: null, guestName: null, outstandingPurchaseId: null, outstandingAttendanceId: null }

    if (raw.kind === "package" || raw.kind === "guest_class") {
      const isPackage = raw.kind === "package"
      const packageId = isPackage ? readOptionalId(raw.packageId) : ""
      const beneficiaryUserId = isPackage ? readOptionalId(raw.beneficiaryUserId) : payerUserId
      if (isPackage && (!packageId || !beneficiaryUserId)) throw invalid("Package item needs a beneficiary and a package")
      if (!(await db.user.findUnique({ where: { id: beneficiaryUserId }, select: { id: true } }))) throw invalid("Beneficiary not found")
      const guestName = !isPackage && typeof raw.guestName === "string" ? raw.guestName.trim() : ""
      if (guestName.length > TERMINAL_CHARGE_GUEST_NAME_MAX_LENGTH) throw invalid("Guest name is too long")
      const line = await priceCatalogLine(raw.courseSlug, packageId)
      // D2: a guest class is recorded under the payer; the optional friend name is only a note.
      priced.push({
        ...empty, kind: raw.kind, beneficiaryUserId, courseSlug: line.courseSlug, packageId: packageId || null,
        guestName: guestName || null, unitCents: line.cents, amountCents: line.cents, description: line.title,
      })
      continue
    }

    if (raw.kind === "free_amount") {
      const amount = raw.amountCents
      if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount <= 0 || amount > TERMINAL_CHARGE_FREE_AMOUNT_MAX_CENTS) {
        throw invalid("Free amount must be a positive whole number of cents within the limit")
      }
      const description = typeof raw.description === "string" ? raw.description.trim() : ""
      if (!description || description.length > TERMINAL_CHARGE_DESCRIPTION_MAX_LENGTH) throw invalid("Free amount requires a description")
      priced.push({ ...empty, kind: "free_amount", unitCents: amount, amountCents: amount, description })
      continue
    }
    if (raw.kind !== "outstanding") throw invalid("Invalid item kind")

    const purchaseId = readOptionalId(raw.outstandingPurchaseId)
    const attendanceId = readOptionalId(raw.outstandingAttendanceId)
    if (Boolean(purchaseId) === Boolean(attendanceId)) throw invalid("Outstanding item needs exactly one reference")
    const ref = purchaseId ? `p:${purchaseId}` : `a:${attendanceId}`
    if (seen.has(ref)) throw invalid("Outstanding item is listed twice")
    seen.add(ref)
    const line = purchaseId
      ? await priceOutstandingPurchase(db, payerUserId, purchaseId)
      : await priceOutstandingAttendance(db, payerUserId, attendanceId)
    if (line.cents <= 0) throw invalid("Outstanding item has no amount")
    priced.push({
      ...empty,
      kind: "outstanding",
      beneficiaryUserId: payerUserId,
      courseSlug: line.courseSlug,
      unitCents: line.cents,
      amountCents: line.cents,
      outstandingPurchaseId: purchaseId || null,
      outstandingAttendanceId: attendanceId || null,
      description: `Outstanding — ${line.title}`,
    })
  }
  return priced
}
