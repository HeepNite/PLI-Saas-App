import "server-only"
import type { Prisma, Purchase, StaffTerminalChargeItem as ChargeItem } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { writeStudentDataAudit } from "@/lib/audit/student-data-audit"
import { syncPackagePurchaseFromPaidPurchase } from "@/lib/packages"
import { getDateKeyInTimeZone, getTimeKeyInTimeZone } from "@/lib/class-schedule"
import { asObject, asText } from "@/lib/shared"
import { isOpenPurchase, isUnchargedCardAttempt } from "@/app/api/staff/payments/shared"
import { applyCashSettlementSideEffects } from "@/app/api/staff/payments/cash-settlement-side-effects"
import { TERMINAL_CHARGE_FREE_AMOUNT_COURSE_SLUG, TERMINAL_CHARGE_METADATA } from "@/lib/terminal-charges/contract"

type Tx = Prisma.TransactionClient
type Metadata = Record<string, unknown>

/** staffChargeId of a carrier Purchase, or "" for every other purchase. */
export const readStaffChargeId = (metadata: unknown) => asText(asObject(metadata)[TERMINAL_CHARGE_METADATA.chargeId])

export type TerminalChargeFulfillment = { chargeId: string; settledOutstandingPurchaseIds: string[] }

/**
 * Fans a paid carrier out into the records each line item produces (FR6), inside the webhook's
 * fulfillment transaction. Outstanding purchases are settled in place (same metadata shape as
 * mark_paid, channel card) and returned so the caller runs the shared mark_paid side effects
 * after commit. Idempotent: a charge already paid only hands those purchases back, so a
 * redelivery after a post-commit failure replays their (idempotent) side effects.
 */
export async function fulfillTerminalChargeCarrierTx(
  tx: Tx,
  { carrier, paymentIntentId }: { carrier: Pick<Purchase, "id" | "userId" | "amount" | "currency" | "metadata">; paymentIntentId: string },
): Promise<TerminalChargeFulfillment> {
  const chargeId = readStaffChargeId(carrier.metadata)
  const charge = await tx.staffTerminalCharge.findUnique({ where: { id: chargeId }, include: { items: true } })
  if (!charge || charge.carrierPurchaseId !== carrier.id || charge.totalCents !== carrier.amount || charge.payerUserId !== carrier.userId) {
    throw new Error("Staff terminal charge binding mismatch")
  }
  if (charge.status === "paid") return { chargeId, settledOutstandingPurchaseIds: await settledInPlacePurchaseIds(tx, charge.id, charge.items) }

  const now = new Date()
  // Money was received, so a charge the tablet reported declined/cancelled still becomes paid.
  const claim = await tx.staffTerminalCharge.updateMany({
    where: { id: charge.id, status: { not: "paid" } },
    data: { status: "paid", resolvedAt: now, failureReason: null },
  })
  if (claim.count !== 1) return { chargeId, settledOutstandingPurchaseIds: [] }

  const settledAt = now.toISOString()
  const settlement = { paymentChannel: "card", settlementStatus: "paid", settledAt, settlementUpdatedBy: charge.createdByUserId, settledPaymentIntentId: paymentIntentId }
  const contactOf = (userId: string) => tx.user.findUnique({ where: { id: userId }, select: { email: true, name: true, phone: true } })
  const payer = await contactOf(charge.payerUserId)

  // Children are recorded under the payer, except a package, which goes to its beneficiary.
  // The board reads a purchase's own contact fields, so they always come from the purchase owner.
  const createChild = async (
    item: ChargeItem,
    courseSlug: string,
    extra: Metadata,
    owner: { userId?: string; packageId?: string; serviceId?: string } = {},
  ) => {
    const ownerContact = owner.userId && owner.userId !== charge.payerUserId ? await contactOf(owner.userId) : payer
    const child = await tx.purchase.create({
      data: {
        userId: charge.payerUserId,
        ...owner,
        courseSlug,
        courseTitle: item.description,
        amount: item.amountCents,
        currency: carrier.currency,
        status: "paid",
        email: ownerContact?.email ?? null,
        name: ownerContact?.name ?? null,
        phone: ownerContact?.phone ?? null,
        participants: 1,
        metadata: {
          [TERMINAL_CHARGE_METADATA.chargeId]: charge.id,
          [TERMINAL_CHARGE_METADATA.lineKind]: item.kind,
          carrierPurchaseId: carrier.id,
          ...settlement,
          purchaseSource: "front_desk",
          source: "staff_terminal_charge",
          terminalId: charge.terminalId,
          ...extra,
        } as Prisma.InputJsonObject,
      },
    })
    return child.id
  }

  // Settles an open purchase in place. The optimistic guard on updatedAt loses to any concurrent
  // write, so it re-reads and retries once; null means it is no longer open (settled elsewhere).
  const settleOpenPurchase = async (purchaseId: string, chargedCents: number) => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const target = await tx.purchase.findUnique({ where: { id: purchaseId } })
      if (!target || isUnchargedCardAttempt(target) || !isOpenPurchase(target).isOpen) return null
      const settled = await tx.purchase.updateMany({
        where: { id: target.id, updatedAt: target.updatedAt },
        data: {
          status: "paid",
          // Same rule as the bulk cash mark_paid: a zero-amount debt is recorded at the price charged.
          ...(target.amount === 0 && chargedCents > 0 ? { amount: chargedCents } : {}),
          metadata: { ...asObject(target.metadata), ...settlement, [TERMINAL_CHARGE_METADATA.chargeId]: charge.id } as Prisma.InputJsonObject,
        },
      })
      if (settled.count === 1) return target.id
    }
    // Still being written concurrently: fail closed so the webhook retries the whole fan-out.
    throw new Error(`Outstanding purchase kept changing during settlement: ${purchaseId}`)
  }

  const settledOutstandingPurchaseIds: string[] = []
  const settleOrRecord = async (item: ChargeItem, purchaseId: string, reference: Metadata) => {
    const settledId = await settleOpenPurchase(purchaseId, item.amountCents)
    if (settledId) settledOutstandingPurchaseIds.push(settledId)
    // Money for an item settled elsewhere meanwhile is still recorded, flagged for review.
    return settledId || createChild(item, item.courseSlug || "", { outstandingAlreadySettled: "true", ...reference })
  }

  const fulfillItem = async (item: ChargeItem): Promise<string> => {
    if (item.kind === "free_amount") {
      // Studio revenue only, never payroll (D7).
      return createChild(item, TERMINAL_CHARGE_FREE_AMOUNT_COURSE_SLUG, { description: item.description || "" })
    }
    if (item.kind === "guest_class" && item.courseSlug) {
      // D2: the friend gets no account, attendance or package; the money stays under the payer.
      return createChild(item, item.courseSlug, { guestItem: "true", ...(item.guestName ? { guestName: item.guestName } : {}) }, { serviceId: "dropin" })
    }
    if (item.kind === "package" && item.beneficiaryUserId && item.packageId && item.courseSlug) {
      // Same package metadata the checkout records, so the shared sync grants the same credits.
      const plan = await tx.packagePlan.findUnique({ where: { key: item.packageId } })
      const packageMetadata = {
        courseSlug: item.courseSlug,
        packageId: item.packageId,
        ...(plan && {
          packageLabel: plan.label,
          packageTotalCredits: plan.totalCredits === null ? "" : String(plan.totalCredits),
          packageIsUnlimited: String(plan.isUnlimited),
          packageCadence: plan.cadence || "",
          packageMakeUps: String(plan.makeUps),
          packageValidDays: String(plan.validDays),
        }),
      }
      const childId = await createChild(item, item.courseSlug, packageMetadata, { userId: item.beneficiaryUserId, packageId: item.packageId })
      // Money was received, so a plan removed since pricing still records the purchase, flagged in the logs.
      if (!plan) console.warn("[staff-terminal-charge:package-plan-missing]", { chargeId: charge.id, itemId: item.id })
      else await syncPackagePurchaseFromPaidPurchase({ tx, packagePlanId: plan.id, userId: item.beneficiaryUserId, purchaseId: childId, purchasedAt: now, source: "stripe_staff_terminal_charge", metadata: packageMetadata })
      return childId
    }
    if (item.kind === "outstanding" && item.outstandingPurchaseId) {
      return settleOrRecord(item, item.outstandingPurchaseId, { outstandingPurchaseId: item.outstandingPurchaseId })
    }
    if (item.kind === "outstanding" && item.outstandingAttendanceId) {
      const attendanceId = item.outstandingAttendanceId
      // Same per-attendance lock the bulk cash settlement takes, so they never both settle it.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${attendanceId}))`
      const attendance = await tx.attendance.findUnique({ where: { id: attendanceId }, include: { session: true, packageUsage: true } })
      const attendanceMetadata = asObject(attendance?.metadata)
      const linkedPurchaseId = asText(attendanceMetadata.purchaseId)
      if (!attendance || linkedPurchaseId || attendance.packageUsage) {
        const reference = { outstandingAttendanceId: attendanceId }
        return linkedPurchaseId && attendance ? settleOrRecord(item, linkedPurchaseId, reference) : createChild(item, item.courseSlug || "", { outstandingAlreadySettled: "true", ...reference })
      }
      const { startsAt, courseSlug, title } = attendance.session
      const childId = await createChild({ ...item, description: title || courseSlug }, courseSlug, {
        attendanceId,
        outstandingAttendanceId: attendanceId,
        date: getDateKeyInTimeZone(startsAt),
        time: getTimeKeyInTimeZone(startsAt),
      })
      await tx.attendance.update({ where: { id: attendanceId }, data: { metadata: { ...attendanceMetadata, purchaseId: childId } as Prisma.InputJsonObject } })
      return childId
    }
    // Unknown or malformed item: fail closed so the webhook retries instead of misrecording money.
    throw new Error(`Staff terminal charge item cannot be fulfilled: ${item.id}`)
  }

  for (const item of charge.items) {
    const resultPurchaseId = await fulfillItem(item)
    await tx.staffTerminalChargeItem.update({ where: { id: item.id }, data: { resultPurchaseId } })
  }

  await writeStudentDataAudit({
    targetUserId: charge.payerUserId,
    staffClerkId: charge.createdByUserId,
    entity: "payment",
    entityId: charge.id,
    field: "terminal_charge_paid",
    valueAfter: { status: "paid", terminalId: charge.terminalId, totalCents: charge.totalCents, paymentIntentId },
    reason: "Card collected on the tablet reader",
  }, tx)

  return { chargeId, settledOutstandingPurchaseIds }
}

/** Purchases a paid charge settled in place: they carry this charge id but, unlike its children, no carrierPurchaseId. */
async function settledInPlacePurchaseIds(tx: Tx, chargeId: string, items: ChargeItem[]) {
  const ids: string[] = []
  for (const item of items) {
    if (item.kind !== "outstanding" || !item.resultPurchaseId) continue
    const result = await tx.purchase.findUnique({ where: { id: item.resultPurchaseId }, select: { id: true, status: true, metadata: true } })
    const metadata = asObject(result?.metadata)
    if (result?.status === "paid" && readStaffChargeId(metadata) === chargeId && !asText(metadata.carrierPurchaseId)) ids.push(result.id)
  }
  return ids
}

/**
 * A canceled PaymentIntent of a carrier ends its charge if still collecting, so the tablet and
 * panel never stay stuck. payment_failed leaves a card_present PaymentIntent retryable, so it is
 * ignored (the tablet reports its own decline). Idempotent; a paid charge is never touched.
 */
export async function recordTerminalChargeCarrierFailureTx(
  tx: Tx,
  input: { carrier: Pick<Purchase, "id" | "metadata">; status: "failed" | "canceled"; paymentIntentId: string },
) {
  const chargeId = readStaffChargeId(input.carrier.metadata)
  if (input.status !== "canceled" || !chargeId) return
  const charge = await tx.staffTerminalCharge.findUnique({ where: { id: chargeId } })
  if (!charge || charge.carrierPurchaseId !== input.carrier.id) return
  const updated = await tx.staffTerminalCharge.updateMany({
    where: { id: charge.id, status: "collecting" },
    data: { status: "cancelled", resolvedAt: new Date(), failureReason: "payment_canceled" },
  })
  if (updated.count !== 1) return
  await writeStudentDataAudit({
    targetUserId: charge.payerUserId,
    staffClerkId: charge.createdByUserId,
    entity: "payment",
    entityId: charge.id,
    field: "terminal_charge_result",
    valueBefore: { status: "collecting" },
    valueAfter: { status: "cancelled", terminalId: charge.terminalId, paymentIntentId: input.paymentIntentId },
    reason: "Card payment canceled on the tablet reader",
  }, tx)
}

/** Post-commit mark_paid side effects for the outstanding purchases a charge settled. */
export async function applyTerminalChargeOutstandingSideEffects(fulfillment: TerminalChargeFulfillment) {
  for (const purchaseId of fulfillment.settledOutstandingPurchaseIds) {
    const settled = await prisma.purchase.findUnique({ where: { id: purchaseId } })
    if (settled) await applyCashSettlementSideEffects({ purchase: settled, metadata: asObject(settled.metadata) as Prisma.JsonObject, updated: settled, purchaseId })
  }
}
