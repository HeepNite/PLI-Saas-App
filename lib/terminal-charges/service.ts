import "server-only"
import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { writeStudentDataAudit } from "@/lib/audit/student-data-audit"
import { createOrReuseNativePreparedPurchase } from "@/lib/checkout/native-prepared-purchase"
import { issuePreparedNativePurchase } from "@/lib/stripe/prepared-native-purchase"
import { canCreateTerminalCharge } from "@/lib/security/staff-access"
import { authorizeStaffPortalBaseRequest } from "@/lib/security/staff-portal-auth"
import { authorizeStaffTerminalSession } from "@/lib/security/staff-terminal"
import { asObject } from "@/lib/shared"
import {
  TERMINAL_CHARGE_CARRIER_COURSE_SLUG,
  TERMINAL_CHARGE_METADATA,
  TERMINAL_CHARGE_TTL_MS,
  type TerminalChargeItemKind,
  type TerminalChargeStatus,
  type TerminalChargeView,
} from "@/lib/terminal-charges/contract"
import { priceTerminalChargeItems, TerminalChargeError } from "@/lib/terminal-charges/pricing"
import { isTerminalChargeEnabled, TERMINAL_CHARGE_NOT_ENABLED } from "@/lib/terminal-charges/rollout"

export { TerminalChargeError }

export type Db = Prisma.TransactionClient | typeof prisma
export type StaffActor = { userId: string; staffName?: string | null }

export const ACTIVE_STATUSES = ["pending", "collecting"]
export const notFound = () => new TerminalChargeError(404, "Charge not found")
export const conflict = (message: string) => new TerminalChargeError(409, message)

/** Staff portal auth gated by canCreateTerminalCharge (owner only during the rollout). */
export const authorizeTerminalChargeRequest = async () => {
  const auth = await authorizeStaffPortalBaseRequest()
  if (auth.ok && !canCreateTerminalCharge(auth.role, auth.category)) return { ok: false as const, status: 403, error: "Insufficient role" }
  return auth
}

/** Tablet auth: the terminal session cookie; every tablet route is scoped to its own terminal. */
export const authorizeTerminalCaller = async () => {
  const auth = await authorizeStaffTerminalSession({ touchLastSeen: false })
  if (!auth.ok) return { ok: false as const, status: 401, error: "Terminal session required" }
  return { ok: true as const, terminalId: auth.terminal.id, sessionId: auth.sessionId }
}

/** Rollout gate for the tablet routes: is this terminal's slug in TERMINAL_CHARGE_TERMINALS? */
const chargingEnabled = async (terminalId: string) =>
  isTerminalChargeEnabled((await prisma.staffTerminal.findUnique({ where: { id: terminalId }, select: { slug: true } }))?.slug)

export const assertTerminalChargingEnabled = async (terminalId: string) => {
  if (!(await chargingEnabled(terminalId))) throw conflict(TERMINAL_CHARGE_NOT_ENABLED)
}

/** Maps a known charge error to its JSON response; rethrows anything else. */
export const terminalChargeErrorResponse = (error: unknown) => {
  if (error instanceof TerminalChargeError) {
    return NextResponse.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } })
  }
  throw error
}

const VIEW_INCLUDE = {
  items: true,
  terminal: { select: { name: true } },
  payer: { select: { name: true, email: true } },
} as const

type ChargeRecord = Prisma.StaffTerminalChargeGetPayload<{ include: typeof VIEW_INCLUDE }>

const toView = (charge: ChargeRecord): TerminalChargeView => ({
  id: charge.id,
  terminalId: charge.terminalId,
  terminalName: charge.terminal?.name || "",
  payerUserId: charge.payerUserId,
  payerName: charge.payer?.name || "Customer", // shown on the tablet: never the payer's email
  status: charge.status as TerminalChargeStatus,
  totalCents: charge.totalCents,
  currency: charge.currency,
  expiresAt: charge.expiresAt.toISOString(),
  createdAt: charge.createdAt.toISOString(),
  resolvedAt: charge.resolvedAt ? charge.resolvedAt.toISOString() : null,
  failureReason: charge.failureReason,
  items: charge.items.map((item) => ({
    id: item.id,
    kind: item.kind as TerminalChargeItemKind,
    label: item.description || item.kind,
    amountCents: item.amountCents,
  })),
})

export const requireChargeView = async (db: Db, where: Prisma.StaffTerminalChargeWhereInput) => {
  const charge = await db.staffTerminalCharge.findFirst({ where, include: VIEW_INCLUDE })
  if (!charge) throw notFound()
  return toView(charge)
}

/**
 * Lazy expiry (D5): a pending charge past expiresAt becomes expired on any read.
 * A collecting charge never expires, so a tap in progress is never cut off.
 */
export const expireStalePendingCharges = (db: Db, scope: Prisma.StaffTerminalChargeWhereInput) => {
  const now = new Date()
  return db.staffTerminalCharge.updateMany({
    where: { ...scope, status: "pending", expiresAt: { lte: now } },
    data: { status: "expired", resolvedAt: now, failureReason: "expired" },
  })
}

const readId = (value: unknown, field: string) => {
  const id = typeof value === "string" ? value.trim() : ""
  if (!id || id.length > 128) throw new TerminalChargeError(400, `${field} is required`)
  return id
}

export const createTerminalCharge = async (input: { staff: StaffActor; body: unknown; ipAddress?: string | null }) => {
  const body = asObject(input.body)
  const terminalId = readId(body.terminalId, "terminalId")
  const payerUserId = readId(body.payerUserId, "payerUserId")
  const [terminal, payer] = await Promise.all([
    prisma.staffTerminal.findUnique({ where: { id: terminalId }, select: { active: true, slug: true } }),
    prisma.user.findUnique({ where: { id: payerUserId }, select: { id: true } }),
  ])
  if (!terminal?.active) throw new TerminalChargeError(404, "Tablet not found")
  if (!payer) throw new TerminalChargeError(404, "Payer not found")
  if (!isTerminalChargeEnabled(terminal.slug)) throw conflict(TERMINAL_CHARGE_NOT_ENABLED)

  const items = await priceTerminalChargeItems(prisma, payerUserId, body.items)
  const totalCents = items.reduce((sum, item) => sum + item.amountCents, 0)

  return prisma.$transaction(async (tx) => {
    // Serialize all creates so two staff cannot both pass the one-active-charge or same-debt checks.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('staff-terminal-charge:create'))`
    await expireStalePendingCharges(tx, { terminalId })
    const active = await tx.staffTerminalCharge.findFirst({ where: { terminalId, status: { in: ACTIVE_STATUSES } }, select: { id: true } })
    if (active) throw conflict("This tablet already has a charge in progress")
    const debts = items.flatMap<Prisma.StaffTerminalChargeItemWhereInput>(({ outstandingPurchaseId: p, outstandingAttendanceId: a }) =>
      p ? [{ outstandingPurchaseId: p }] : a ? [{ outstandingAttendanceId: a }] : [])
    if (debts.length) {
      const chargeIds = (await tx.staffTerminalChargeItem.findMany({ where: { OR: debts }, select: { chargeId: true } })).map((item) => item.chargeId)
      await expireStalePendingCharges(tx, { id: { in: chargeIds } })
      const holder = await tx.staffTerminalCharge.findFirst({ where: { id: { in: chargeIds }, status: { in: ACTIVE_STATUSES } }, select: { id: true } })
      if (holder) throw conflict("That debt is already in another charge")
    }

    const charge = await tx.staffTerminalCharge.create({
      data: {
        terminalId,
        payerUserId,
        createdByUserId: input.staff.userId,
        status: "pending",
        totalCents,
        currency: "usd",
        expiresAt: new Date(Date.now() + TERMINAL_CHARGE_TTL_MS),
        items: { create: items },
      },
      include: VIEW_INCLUDE,
    })
    await writeStudentDataAudit({
      targetUserId: payerUserId,
      staffClerkId: input.staff.userId,
      staffName: input.staff.staffName,
      entity: "payment",
      entityId: charge.id,
      field: "terminal_charge_create",
      valueAfter: { terminalId, totalCents, items: items.map(({ kind, amountCents, description }) => ({ kind, amountCents, description })) },
      reason: "Staff sent a card charge to a tablet",
      ipAddress: input.ipAddress,
    }, tx)
    return toView(charge)
  })
}

export const getTerminalCharge = async (id: string) => {
  await expireStalePendingCharges(prisma, { id })
  return requireChargeView(prisma, { id })
}

/** The charge this tablet must show now (pending or collecting), or null. */
export const getPendingTerminalCharge = async (terminalId: string) => {
  if (!(await chargingEnabled(terminalId))) return null
  await expireStalePendingCharges(prisma, { terminalId })
  const charge = await prisma.staffTerminalCharge.findFirst({ where: { terminalId, status: { in: ACTIVE_STATUSES } }, include: VIEW_INCLUDE })
  return charge ? toView(charge) : null
}

/**
 * Starts collection on the tablet: pending -> collecting (guarded on status and expiry), then
 * one carrier Purchase shaped exactly like a native M2 prepared purchase and a single-use
 * prepared reference bound to this terminal session (the kiosk's own prepare response shape).
 */
export const prepareTerminalCharge = async (input: { terminalId: string; sessionId: string; id: string }) => {
  const { terminalId, sessionId } = input
  await assertTerminalChargingEnabled(terminalId)
  await expireStalePendingCharges(prisma, { id: input.id, terminalId })
  const charge = await prisma.staffTerminalCharge.findFirst({
    where: { id: input.id, terminalId },
    include: { payer: { select: { name: true, email: true, phone: true } } },
  })
  if (!charge) throw notFound()

  let claimed = false
  if (charge.status === "pending") {
    const now = new Date()
    const claim = await prisma.staffTerminalCharge.updateMany({
      where: { id: charge.id, terminalId, status: "pending", expiresAt: { gt: now } },
      data: { status: "collecting", collectingAt: now },
    })
    claimed = claim.count === 1
  }
  if (!claimed && charge.status !== "collecting") throw conflict("This charge is no longer available")

  try {
    const carrier = await createOrReuseNativePreparedPurchase({
      preparedContextId: charge.id,
      recipient: { userId: charge.payerUserId, email: charge.payer.email, name: charge.payer.name, phone: charge.payer.phone },
      selection: {
        courseSlug: TERMINAL_CHARGE_CARRIER_COURSE_SLUG,
        courseTitle: "Staff charge",
        amount: charge.totalCents,
        currency: charge.currency,
        packageId: "",
        serviceId: "",
        addons: [],
        participants: 1,
        coupon: "",
      },
      fulfillmentMetadata: {
        [TERMINAL_CHARGE_METADATA.chargeId]: charge.id,
        [TERMINAL_CHARGE_METADATA.lineKind]: "carrier",
        source: "staff_terminal_charge",
        terminalId,
      },
    })
    const bound = await prisma.staffTerminalCharge.updateMany({
      where: { id: charge.id, status: "collecting", OR: [{ carrierPurchaseId: null }, { carrierPurchaseId: carrier.id }] },
      data: { carrierPurchaseId: carrier.id },
    })
    if (bound.count !== 1) throw conflict("This charge is no longer available")
    const preparedPurchaseReference = await issuePreparedNativePurchase({ purchaseId: carrier.id, terminalId, sessionId })
    return { preparedPurchaseReference, state: "prepared" as const }
  } catch (error) {
    // No reference reached the tablet, so no payment can start: hand the charge back.
    if (claimed) {
      await prisma.staffTerminalCharge.updateMany({ where: { id: charge.id, status: "collecting" }, data: { status: "pending", collectingAt: null } })
    }
    if (error instanceof TerminalChargeError) throw error
    throw conflict("Card reader preparation is unavailable")
  }
}
