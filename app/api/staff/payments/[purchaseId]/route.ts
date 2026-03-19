import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { syncPackagePurchaseFromPaidPurchase } from "@/lib/packages"
import { authorizeStaffPortalSectionRequest } from "@/lib/security/staff-portal-auth"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"

export const runtime = "nodejs"

type SettlementAction = "mark_paid" | "mark_pending"

const asObject = (value: Prisma.JsonValue | null): Prisma.JsonObject => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Prisma.JsonObject
  }
  return {}
}

const asText = (value: unknown) => (typeof value === "string" ? value.trim() : "")

const isCashPurchase = (input: {
  metadata: Prisma.JsonValue | null
  status: string
  stripePaymentIntentId: string | null
  stripeCheckoutSessionId: string | null
}) => {
  const metadata = asObject(input.metadata)
  const paymentChannel = asText(metadata.paymentChannel || metadata.payment_channel).toLowerCase()
  if (paymentChannel === "cash") return true

  const methodRaw = asText(metadata.paymentMethod || metadata.payment_method || metadata.paymentMode).toLowerCase()
  if (methodRaw.includes("cash") || methodRaw.includes("onsite") || methodRaw.includes("on_site")) return true

  if (input.stripePaymentIntentId || input.stripeCheckoutSessionId) return false
  const statusRaw = (input.status || "").toLowerCase()
  return statusRaw.includes("cash") || statusRaw.includes("onsite") || statusRaw.includes("on_site")
}

export async function PATCH(req: Request, context: { params: Promise<{ purchaseId: string }> }) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:payments:patch", getClientIp(req)),
    limit: 90,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  const authResult = await authorizeStaffPortalSectionRequest("students")
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const { purchaseId } = await context.params
  if (!purchaseId) {
    return NextResponse.json({ error: "Missing purchaseId" }, { status: 400 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const payload = body as Record<string, unknown>
  const action = typeof payload.action === "string" ? (payload.action as SettlementAction) : ""
  if (!["mark_paid", "mark_pending"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }

  const note = typeof payload.note === "string" ? payload.note.trim().slice(0, 300) : ""
  const purchase = await prisma.purchase.findUnique({ where: { id: purchaseId } })
  if (!purchase) {
    return NextResponse.json({ error: "Purchase not found" }, { status: 404 })
  }

  const metadata = asObject(purchase.metadata)
  const settlementStatus = action === "mark_paid" ? "paid" : "pending"
  const previousSettlementNote = typeof metadata.settlementNote === "string" ? metadata.settlementNote : ""
  const nextMetadata: Prisma.InputJsonObject = {
    ...metadata,
    settlementStatus,
    settledAt: settlementStatus === "paid" ? new Date().toISOString() : null,
    settlementUpdatedBy: authResult.userId,
    settlementNote: note || previousSettlementNote,
  }
  const data: Prisma.PurchaseUpdateInput = { metadata: nextMetadata }
  if (isCashPurchase(purchase)) {
    data.status = settlementStatus === "paid" ? "paid" : "pending"
  }

  const updated = await prisma.purchase.update({
    where: { id: purchaseId },
    data,
  })

  let packageSynced = false
  if (action === "mark_paid" && purchase.userId && isCashPurchase(purchase)) {
    const packageId = purchase.packageId || asText(metadata.packageId)
    if (packageId) {
      try {
        const synced = await syncPackagePurchaseFromPaidPurchase({
          userId: purchase.userId,
          purchaseId: purchase.id,
          purchasedAt: purchase.createdAt,
          source: "cash",
          metadata: {
            courseSlug: purchase.courseSlug || asText(metadata.courseSlug),
            packageId,
            packageLabel: asText(metadata.packageLabel),
            packageTotalCredits: asText(metadata.packageTotalCredits),
            packageIsUnlimited: asText(metadata.packageIsUnlimited),
            packageCadence: asText(metadata.packageCadence),
            packageMakeUps: asText(metadata.packageMakeUps),
            packageValidDays: asText(metadata.packageValidDays),
          },
        })
        packageSynced = Boolean(synced)
      } catch (error) {
        console.warn("Unable to sync package purchase after single cash settlement", {
          purchaseId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  return NextResponse.json({
    ok: true,
    purchase: {
      id: updated.id,
      settlementStatus,
      paymentStatus: updated.status,
      packageSynced,
    },
  })
}
