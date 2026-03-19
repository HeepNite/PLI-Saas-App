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

export async function POST(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:payments:bulk-post", getClientIp(req)),
    limit: 40,
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

  const idsInput = Array.isArray(payload.ids) ? payload.ids : []
  const ids = [...new Set(idsInput.filter((item): item is string => typeof item === "string" && item.trim().length > 0))]
  if (ids.length === 0) {
    return NextResponse.json({ error: "No purchases selected" }, { status: 400 })
  }
  if (ids.length > 500) {
    return NextResponse.json({ error: "Too many purchases in one bulk request" }, { status: 400 })
  }

  const purchases = await prisma.purchase.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      userId: true,
      courseSlug: true,
      packageId: true,
      status: true,
      createdAt: true,
      metadata: true,
      stripePaymentIntentId: true,
      stripeCheckoutSessionId: true,
    },
  })

  if (purchases.length === 0) {
    return NextResponse.json({ ok: true, updatedCount: 0 })
  }

  const settlementStatus = action === "mark_paid" ? "paid" : "pending"
  const settledAt = settlementStatus === "paid" ? new Date().toISOString() : null
  const nextCashPurchaseStatus = settlementStatus === "paid" ? "paid" : "pending"

  await prisma.$transaction(
    purchases.map((purchase) => {
      const metadata = asObject(purchase.metadata)
      const nextMetadata: Prisma.InputJsonObject = {
        ...metadata,
        settlementStatus,
        settledAt,
        settlementUpdatedBy: authResult.userId,
      }
      const data: Prisma.PurchaseUpdateInput = { metadata: nextMetadata }
      if (isCashPurchase(purchase)) {
        data.status = nextCashPurchaseStatus
      }
      return prisma.purchase.update({
        where: { id: purchase.id },
        data,
      })
    })
  )

  let syncedPackageCount = 0
  if (action === "mark_paid") {
    for (const purchase of purchases) {
      if (!purchase.userId || !isCashPurchase(purchase)) continue
      const metadata = asObject(purchase.metadata)
      const packageId = purchase.packageId || asText(metadata.packageId)
      if (!packageId) continue
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
        if (synced) syncedPackageCount += 1
      } catch (error) {
        console.warn("Unable to sync package purchase after cash settlement", {
          purchaseId: purchase.id,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  return NextResponse.json({
    ok: true,
    updatedCount: purchases.length,
    settlementStatus,
    syncedPackageCount,
  })
}
