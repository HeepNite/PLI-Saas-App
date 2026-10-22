import "server-only"

import { prisma } from "@/lib/prisma"
import { buildPreparedCheckoutClassSlotKey, findPreparedCheckoutContextForReconciliation } from "@/lib/checkout/prepared-context"

export const NATIVE_ATTEMPT_STATES = ["absent", "pending_without_payment", "payment_unresolved", "paid", "rejected"] as const
export type NativeAttemptState = (typeof NATIVE_ATTEMPT_STATES)[number]

type Selection = { courseSlug: string; courseTitle: string; amount: number; currency: string; packageId: string; serviceId: string; addons: string[]; participants: number; coupon: string; date: string; time: string; durationMinutes: number | null }
type Purchase = { status: string; stripePaymentIntentId: string | null; metadata: unknown }
const metadataContextId = (value: unknown) => {
  if (!value || typeof value !== "object") return null
  const metadata = value as Record<string, unknown>
  return metadata.paymentSurface === "native_m2_prepare" && typeof metadata.preparedContextId === "string" && metadata.preparedContextId.trim() ? metadata.preparedContextId : null
}
const stateFor = ({ status, stripePaymentIntentId }: Purchase): NativeAttemptState => {
  const normalized = status.trim().toLowerCase()
  if (["paid", "succeeded", "completed"].includes(normalized)) return "paid"
  if (["failed", "refunded", "canceled", "cancelled", "rejected"].includes(normalized)) return "rejected"
  return normalized === "pending" ? (stripePaymentIntentId ? "payment_unresolved" : "pending_without_payment") : "payment_unresolved"
}

export const getNativeAttemptState = async ({ userId, terminalId, kioskSessionId, selection }: { userId: string; terminalId: string; kioskSessionId: string; selection: Selection }): Promise<{ state: NativeAttemptState }> => {
  const classSlotKey = buildPreparedCheckoutClassSlotKey(selection)
  const purchases = await prisma.purchase.findMany({
    where: { userId, courseSlug: selection.courseSlug, courseTitle: selection.courseTitle || null, amount: selection.amount, currency: selection.currency.trim().toLowerCase(), packageId: selection.packageId.trim() || null, serviceId: selection.serviceId.trim() || null, addonsCsv: [...selection.addons].sort().join(",") || null, participants: selection.participants, coupon: selection.coupon.trim().toUpperCase() || null },
    select: { status: true, stripePaymentIntentId: true, metadata: true },
  }) as Purchase[]
  const candidates = [] as Purchase[]
  let unresolvedEvidence = false
  for (const purchase of purchases) {
    const id = metadataContextId(purchase.metadata)
    if (!id) {
      unresolvedEvidence = true
      continue
    }
    if (await findPreparedCheckoutContextForReconciliation({ id, terminalId, kioskSessionId, classSlotKey })) {
      candidates.push(purchase)
    } else if (await prisma.preparedCheckoutContext.findUnique({ where: { id }, select: { id: true } })) {
      continue
    } else {
      unresolvedEvidence = true
    }
  }
  return { state: unresolvedEvidence || candidates.length > 1 ? "payment_unresolved" : candidates.length === 0 ? "absent" : stateFor(candidates[0]) }
}
