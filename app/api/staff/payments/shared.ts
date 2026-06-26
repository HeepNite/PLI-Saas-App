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
  if (explicit === "web") return PURCHASE_SOURCE.WEB
  if (explicit === "kiosk") return PURCHASE_SOURCE.KIOSK
  if (explicit === "front_desk") return PURCHASE_SOURCE.FRONT_DESK

  const source = asText(meta.source).toLowerCase()
  if (source.includes("kiosk") || source.includes("terminal")) return PURCHASE_SOURCE.KIOSK
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

export const compareActivePackages = <TPackage extends Pick<ActivePackageCandidate, "lastUsedAt" | "purchasedAt">>(a: TPackage, b: TPackage) => {
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
    isOpen: settlementStatus !== "paid" && (!isCompletedPaymentStatus(purchase.status) || paymentChannel === "cash"),
  }
}

export const isPendingProcessablePurchase = <TPurchase extends OutstandingBalancePurchase>(purchase: TPurchase) => {
  const { paymentChannel, isOpen } = isOpenPurchase(purchase)
  if (!isOpen) return false
  if (paymentChannel === "cash") return true
  return paymentChannel === "unknown" && !purchase.stripePaymentIntentId && !purchase.stripeCheckoutSessionId
}

export const buildOutstandingBalanceByUser = <TPurchase extends OutstandingBalancePurchase>(purchases: TPurchase[]) => {
  const totals = new Map<string, number>()

  for (const purchase of purchases) {
    const { isOpen } = isOpenPurchase(purchase)
    if (!isOpen) continue

    totals.set(purchase.userId, (totals.get(purchase.userId) || 0) + purchase.amount)
  }

  return totals
}

export type OpenPurchase = OutstandingBalancePurchase & { id: string; userId: string; createdAt: Date | string }

export const buildLatestOpenPurchaseByUser = <TPurchase extends OpenPurchase>(purchases: TPurchase[]) => {
  const latestByUser = new Map<string, TPurchase>()

  for (const purchase of purchases) {
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
