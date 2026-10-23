import type { CardCheckInStatus } from "@/components/front/staff/historyCardAggregates"
import { asObject, asText } from "@/lib/shared"
export { asObject, asText } from "@/lib/shared"
import { PAYMENT_CHANNEL, PURCHASE_SOURCE, PURCHASE_STATUS, SETTLEMENT_STATUS } from "@/lib/payment-constants"

export type SettlementStatus = (typeof SETTLEMENT_STATUS)[keyof typeof SETTLEMENT_STATUS]
export type PaymentChannel = (typeof PAYMENT_CHANNEL)[keyof typeof PAYMENT_CHANNEL]
export type PurchaseCategory = "package" | "dropin" | "other"

export const COMPLETED_PAYMENT_STATUSES = new Set<string>([PURCHASE_STATUS.SUCCEEDED, PURCHASE_STATUS.PAID, PURCHASE_STATUS.COMPLETED])

export const normalizeSettlementStatus = (value: unknown): SettlementStatus => {
  if (typeof value !== "string") return SETTLEMENT_STATUS.PENDING
  return value.toLowerCase() === "paid" ? SETTLEMENT_STATUS.PAID : SETTLEMENT_STATUS.PENDING
}

export const isCompletedPaymentStatus = (status: unknown) => COMPLETED_PAYMENT_STATUSES.has(asText(status).toLowerCase())

export const normalizePaymentChannel = (input: {
  metadata: unknown
  status: string | null | undefined
  stripePaymentIntentId: string | null
  stripeCheckoutSessionId: string | null
}): PaymentChannel => {
  const metadata = asObject(input.metadata)
  const paymentChannelRaw = asText(metadata.paymentChannel || metadata.payment_channel).toLowerCase()
  const hasStripeEvidence = Boolean(input.stripePaymentIntentId || input.stripeCheckoutSessionId)

  if (paymentChannelRaw === "package_credit") return PAYMENT_CHANNEL.PACKAGE_CREDIT
  if (paymentChannelRaw === "cash") return PAYMENT_CHANNEL.CASH
  if (paymentChannelRaw === "card" || paymentChannelRaw === "stripe") return PAYMENT_CHANNEL.CARD
  if (hasStripeEvidence) return PAYMENT_CHANNEL.CARD

  const methodRaw = asText(metadata.paymentMethod || metadata.payment_method || metadata.paymentMode).toLowerCase()
  const sourceRaw = asText(metadata.source).toLowerCase()
  if (
    methodRaw.includes("cash") ||
    methodRaw.includes("onsite") ||
    methodRaw.includes("on_site") ||
    sourceRaw === "cash_checkout" ||
    sourceRaw === "on_site_checkout"
  ) {
    return PAYMENT_CHANNEL.CASH
  }

  const normalizedStatus = asText(input.status).toLowerCase()
  if (isCompletedPaymentStatus(normalizedStatus)) return PAYMENT_CHANNEL.CARD
  if (normalizedStatus.includes("cash") || normalizedStatus.includes("onsite") || normalizedStatus.includes("on_site")) return PAYMENT_CHANNEL.CASH
  return PAYMENT_CHANNEL.UNKNOWN
}

export type PurchaseSource = (typeof PURCHASE_SOURCE)[keyof typeof PURCHASE_SOURCE]

export const normalizePurchaseSource = (metadata: unknown): PurchaseSource => {
  const meta = asObject(metadata)
  const explicit = asText(meta.purchaseSource).toLowerCase()
  if (explicit === PURCHASE_SOURCE.WEB) return PURCHASE_SOURCE.WEB
  if (explicit === PURCHASE_SOURCE.KIOSK) return PURCHASE_SOURCE.KIOSK
  if (explicit === PURCHASE_SOURCE.FRONT_DESK) return PURCHASE_SOURCE.FRONT_DESK
  if (explicit === PURCHASE_SOURCE.ADMIN) return PURCHASE_SOURCE.ADMIN

  const source = asText(meta.source).toLowerCase()
  if (source.includes("kiosk") || source.includes("terminal")) return PURCHASE_SOURCE.KIOSK
  if (source === "staff_created_student") return PURCHASE_SOURCE.FRONT_DESK
  if (source.includes("stripe_webhook") || source === "cash_checkout") return PURCHASE_SOURCE.WEB
  return PURCHASE_SOURCE.UNKNOWN
}

export const normalizePurchaseCategory = (input: { packageId: string | null | undefined; serviceId: string | null | undefined }): PurchaseCategory => {
  if (asText(input.packageId)) return "package"
  if (asText(input.serviceId)) return "dropin"
  return "other"
}

export type ActivePackageCandidate = {
  id?: string
  userId: string
  packageId: string
  packageLabel: string | null
  totalCredits?: number | null
  remainingCredits: number | null
  isUnlimited: boolean
  expiresAt: Date | null
  lastUsedAt: Date | null
  purchasedAt: Date
  status: string
}

const isUsableActivePackage = (pkg: Pick<ActivePackageCandidate, "remainingCredits" | "isUnlimited">) =>
  pkg.isUnlimited || (pkg.remainingCredits ?? 0) > 0

export const compareActivePackages = <
  TPackage extends Pick<ActivePackageCandidate, "lastUsedAt" | "purchasedAt" | "remainingCredits" | "isUnlimited">
>(a: TPackage, b: TPackage) => {
  const usableDiff = Number(isUsableActivePackage(b)) - Number(isUsableActivePackage(a))
  if (usableDiff !== 0) return usableDiff

  const aUsed = a.lastUsedAt ? a.lastUsedAt.getTime() : 0
  const bUsed = b.lastUsedAt ? b.lastUsedAt.getTime() : 0
  if (aUsed !== bUsed) return bUsed - aUsed
  return b.purchasedAt.getTime() - a.purchasedAt.getTime()
}

export const selectActivePackagesByUser = <TPackage extends ActivePackageCandidate>(packages: TPackage[]) => {
  const selected = new Map<string, TPackage>()

  for (const pkg of [...packages].sort(compareActivePackages)) {
    if (!selected.has(pkg.userId)) {
      selected.set(pkg.userId, pkg)
    }
  }

  return selected
}

/** @deprecated Use attendanceSlotKeyByDatetime for timezone-safe dedup */
export const attendanceSlotKey = (userId: string, courseSlug: string, startsAtMs: number) => `${userId}|${courseSlug}|${startsAtMs}`

/** Timezone-safe dedup key using date + time strings (e.g. "2026-05-13" + "22:00") */
export const attendanceSlotKeyByDatetime = (userId: string, courseSlug: string, date: string, time: string) => `${userId}|${courseSlug}|${date}|${time}`

const CHECK_IN_STATUS_PRIORITY: Record<CardCheckInStatus, number> = {
  checked_in: 4,
  checked_in_no_package: 4,
  checked_out: 3,
  scheduled: 2,
  none: 1,
}

export type TodayCheckInCandidate = {
  userId: string
  status: CardCheckInStatus
  startsAt: string | null
  purchaseCreatedAt: string | null
}

const toTimestamp = (value: string | null | undefined) => {
  if (!value) return Number.NEGATIVE_INFINITY
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY
}

export const compareTodayCheckInCandidates = <TCandidate extends TodayCheckInCandidate>(a: TCandidate, b: TCandidate) => {
  const priorityDiff = CHECK_IN_STATUS_PRIORITY[b.status] - CHECK_IN_STATUS_PRIORITY[a.status]
  if (priorityDiff !== 0) return priorityDiff

  const startsAtDiff = toTimestamp(b.startsAt) - toTimestamp(a.startsAt)
  if (startsAtDiff !== 0) return startsAtDiff

  return toTimestamp(b.purchaseCreatedAt) - toTimestamp(a.purchaseCreatedAt)
}

export const selectTodayCheckInByUser = <TCandidate extends TodayCheckInCandidate>(candidates: TCandidate[]) => {
  const selected = new Map<string, TCandidate>()

  for (const candidate of [...candidates].sort(compareTodayCheckInCandidates)) {
    if (!selected.has(candidate.userId)) {
      selected.set(candidate.userId, candidate)
    }
  }

  return selected
}

export type OutstandingBalancePurchase = {
  userId: string
  amount: number
  metadata: unknown
  status: string | null | undefined
  stripePaymentIntentId: string | null
  stripeCheckoutSessionId: string | null
  courseSlug?: string | null
}

// Stripe/kiosk-terminal statuses for a card attempt that never completed — no money ever moved.
// Both "cancelled" and "canceled" spellings appear in stored purchase data.
const NEVER_COMPLETED_CARD_ATTEMPT_STATUSES = new Set(["expired", "failed", "cancelled", "canceled"])

/** Single source of truth for the never-completed-card-attempt status set; safe to import from client UI code. */
export const isNeverCompletedCardAttemptStatus = (status: unknown) => NEVER_COMPLETED_CARD_ATTEMPT_STATUSES.has(asText(status).toLowerCase())

const isNeverCompletedCardAttempt = (paymentChannel: PaymentChannel, settlementStatus: SettlementStatus, status: unknown) =>
  paymentChannel === PAYMENT_CHANNEL.CARD
  && settlementStatus !== SETTLEMENT_STATUS.PAID
  && isNeverCompletedCardAttemptStatus(status)

const isRefundedCard = (paymentChannel: PaymentChannel, status: unknown) =>
  paymentChannel === PAYMENT_CHANNEL.CARD && asText(status).toLowerCase() === PURCHASE_STATUS.REFUNDED

/**
 * A card attempt where no money ever moved (expired, failed, cancelled/canceled while unpaid).
 * It does not influence isOpenPurchase; it feeds isVerifyCardAttempt, which keeps the row
 * visible as a "Verify" item and out of the outstanding balance (owner decision D2).
 */
export const isTerminalUnpaidCardAttempt = (purchase: VerifyCandidate) => {
  const paymentChannel = normalizePaymentChannel({
    metadata: purchase.metadata,
    status: purchase.status,
    stripePaymentIntentId: purchase.stripePaymentIntentId,
    stripeCheckoutSessionId: purchase.stripeCheckoutSessionId,
  })
  const settlementStatus = normalizeSettlementStatus(asObject(purchase.metadata).settlementStatus)

  return isNeverCompletedCardAttempt(paymentChannel, settlementStatus, purchase.status)
}

/** A card purchase that was refunded — money moved and then moved back; it is not outstanding debt. */
export const isRefundedCardPurchase = <TPurchase extends OutstandingBalancePurchase>(purchase: TPurchase) => {
  const paymentChannel = normalizePaymentChannel({
    metadata: purchase.metadata,
    status: purchase.status,
    stripePaymentIntentId: purchase.stripePaymentIntentId,
    stripeCheckoutSessionId: purchase.stripeCheckoutSessionId,
  })

  return isRefundedCard(paymentChannel, purchase.status)
}

export const isOpenPurchase = <TPurchase extends OutstandingBalancePurchase>(purchase: TPurchase) => {
  const paymentChannel = normalizePaymentChannel({
    metadata: purchase.metadata,
    status: purchase.status,
    stripePaymentIntentId: purchase.stripePaymentIntentId,
    stripeCheckoutSessionId: purchase.stripeCheckoutSessionId,
  })
  const settlementStatus = normalizeSettlementStatus(asObject(purchase.metadata).settlementStatus)

  return {
    paymentChannel,
    settlementStatus,
    isOpen:
      settlementStatus !== SETTLEMENT_STATUS.PAID
      && !isRefundedCard(paymentChannel, purchase.status)
      && (!isCompletedPaymentStatus(purchase.status) || paymentChannel === PAYMENT_CHANNEL.CASH),
  }
}

export const isPendingProcessablePurchase = <TPurchase extends OutstandingBalancePurchase>(purchase: TPurchase) => {
  const { paymentChannel, isOpen } = isOpenPurchase(purchase)
  if (!isOpen) return false
  if (paymentChannel === PAYMENT_CHANNEL.CASH) return true
  return paymentChannel === "unknown" && !purchase.stripePaymentIntentId && !purchase.stripeCheckoutSessionId
}

const isSettledOrCompleted = (purchase: Pick<OutstandingBalancePurchase, "status" | "metadata">) =>
  isCompletedPaymentStatus(purchase.status) || normalizeSettlementStatus(asObject(purchase.metadata).settlementStatus) === SETTLEMENT_STATUS.PAID

const isNativeM2Preparation = (purchase: Pick<OutstandingBalancePurchase, "metadata">) =>
  asText(asObject(purchase.metadata).paymentSurface) === "native_m2_prepare"

type VerifyCandidate = Pick<OutstandingBalancePurchase, "metadata" | "status" | "stripePaymentIntentId" | "stripeCheckoutSessionId">

/**
 * "Verify" state (owner decisions D1-D3, 2026-10-23): a card process that did not charge —
 * declined, failed, expired, cancelled, or a native M2 preparation that never charged.
 * It stays visible for staff to verify manually and is NEVER outstanding debt.
 * Pending cash is never a verify attempt.
 */
export const isVerifyCardAttempt = (purchase: VerifyCandidate) => {
  if (isSettledOrCompleted(purchase)) return false
  if (isTerminalUnpaidCardAttempt(purchase)) return true
  if (!isNativeM2Preparation(purchase)) return false
  const status = asText(purchase.status).toLowerCase()
  return status === PURCHASE_STATUS.PENDING || isNeverCompletedCardAttemptStatus(status)
}

export type VerifyReason = "card_declined" | "payment_failed" | "checkout_expired" | "cancelled" | "attempt_no_charge"

const CANCELLED_ATTEMPT_OUTCOMES = new Set(["cancelled_by_customer", "canceled_by_customer"])
const DECLINED_ATTEMPT_OUTCOMES = new Set(["declined", "card_declined"])

/** Coarse, PII-free label key for a verify attempt; null when the purchase is not in the verify state. */
export const resolveVerifyReason = (purchase: VerifyCandidate): VerifyReason | null => {
  if (!isVerifyCardAttempt(purchase)) return null
  const metadata = asObject(purchase.metadata)
  const failure = asObject(metadata.stripeFailure)
  const error = asObject(failure.error)
  const eventType = asText(failure.eventType)
  const outcome = asText(asObject(metadata.attemptOutcome).code).toLowerCase()
  const status = asText(purchase.status).toLowerCase()

  if (asText(error.code) === "card_declined" || asText(error.declineCode)) return "card_declined"
  if (DECLINED_ATTEMPT_OUTCOMES.has(outcome)) return "card_declined"
  if (status === "cancelled" || status === "canceled" || eventType === "payment_intent.canceled" || CANCELLED_ATTEMPT_OUTCOMES.has(outcome)) return "cancelled"
  if (status === "expired" || eventType === "checkout.session.expired") return "checkout_expired"
  if (status === "failed" || Object.keys(error).length > 0) return "payment_failed"
  return "attempt_no_charge"
}

export const buildOutstandingBalanceByUser = <TPurchase extends OutstandingBalancePurchase>(purchases: TPurchase[]) => {
  const totals = new Map<string, number>()

  for (const purchase of purchases) {
    if (isVerifyCardAttempt(purchase)) continue

    const { isOpen } = isOpenPurchase(purchase)
    if (!isOpen) continue

    totals.set(purchase.userId, (totals.get(purchase.userId) || 0) + purchase.amount)
  }

  return totals
}

/** Per user, the amount that should have been charged by card processes in the verify state. */
export const buildVerifyBalanceByUser = <TPurchase extends OutstandingBalancePurchase>(purchases: TPurchase[]) => {
  const totals = new Map<string, number>()

  for (const purchase of purchases) {
    if (!isVerifyCardAttempt(purchase)) continue
    totals.set(purchase.userId, (totals.get(purchase.userId) || 0) + purchase.amount)
  }

  return totals
}

export type OpenPurchase = OutstandingBalancePurchase & { id: string; userId: string; createdAt: Date | string }

export const buildLatestOpenPurchaseByUser = <TPurchase extends OpenPurchase>(purchases: TPurchase[]) => {
  const latestByUser = new Map<string, TPurchase>()

  for (const purchase of purchases) {
    if (isVerifyCardAttempt(purchase)) continue
    const { isOpen } = isOpenPurchase(purchase)
    if (!isOpen) continue

    const current = latestByUser.get(purchase.userId)
    if (!current) {
      latestByUser.set(purchase.userId, purchase)
      continue
    }
    const currentTime = typeof current.createdAt === "string" ? new Date(current.createdAt).getTime() : current.createdAt.getTime()
    const candidateTime = typeof purchase.createdAt === "string" ? new Date(purchase.createdAt).getTime() : purchase.createdAt.getTime()
    if (candidateTime > currentTime || (candidateTime === currentTime && purchase.id > current.id)) {
      latestByUser.set(purchase.userId, purchase)
    }
  }

  return latestByUser
}

/**
 * Resolve the canonical display name using a fallback chain:
 * 1. Clerk name (firstName + lastName) — most authoritative
 * 2. DB User record (user.name) — second choice
 * 3. Purchase snapshot (purchase.name) — last resort (historical)
 */
export const resolveCanonicalName = (
  clerkName: string | null | undefined,
  dbName: string | null | undefined,
  purchaseName: string | null | undefined,
): string => {
  const clerk = asText(clerkName)
  if (clerk) return clerk

  const db = asText(dbName)
  if (db) return db

  const purchase = asText(purchaseName)
  if (purchase) return purchase

  return "—"
}

/**
 * Build a full display name from Clerk firstName + lastName.
 * Returns empty string if both are missing.
 */
export const buildClerkDisplayName = (
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string => {
  return [asText(firstName), asText(lastName)].filter(Boolean).join(" ")
}
