import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  buildDeliveredHeritagePinMetadata,
  HERITAGE_PIN_CAMPAIGN_KEY,
  parseHeritagePinEntitlement,
} from "@/lib/campaigns/heritage-pin"
import { writeStudentDataAudit } from "@/lib/audit/student-data-audit"
import { authorizeStudentOperationalRequest } from "@/lib/security/staff-portal-auth"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"

export const runtime = "nodejs"

export async function POST(req: Request, context: { params: Promise<{ userId: string }> }) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:students:heritage-pin:post", getClientIp(req)),
    limit: 30,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } },
    )
  }

  const authResult = await authorizeStudentOperationalRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const { userId } = await context.params
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const purchaseId = body && typeof body === "object" && typeof (body as Record<string, unknown>).purchaseId === "string"
    ? String((body as Record<string, unknown>).purchaseId).trim()
    : ""
  if (!purchaseId) return NextResponse.json({ error: "Missing source purchase" }, { status: 400 })

  const purchase = await prisma.purchase.findFirst({
    where: { id: purchaseId, userId },
    select: { id: true, userId: true, metadata: true, createdAt: true },
  })
  if (!purchase) return NextResponse.json({ error: "Heritage pin source purchase not found." }, { status: 404 })

  const entitlement = parseHeritagePinEntitlement(purchase)
  if (!entitlement) return NextResponse.json({ error: "This purchase has no valid Heritage pin entitlement." }, { status: 409 })
  if (entitlement.status === "delivered") {
    return NextResponse.json({ ok: true, idempotent: true, heritagePin: entitlement })
  }

  const deliveredAt = new Date()
  const nextMetadata = buildDeliveredHeritagePinMetadata(purchase.metadata, {
    deliveredAt,
    deliveredBy: authResult.userId,
  })

  const outcome = await prisma.$transaction(async (tx) => {
    const updated = await tx.purchase.updateMany({
      where: {
        id: purchase.id,
        userId,
        AND: [
          { metadata: { path: ["heritagePinCampaign"], equals: HERITAGE_PIN_CAMPAIGN_KEY } },
          { metadata: { path: ["heritagePinStatus"], equals: "pending" } },
        ],
      },
      data: { metadata: nextMetadata as Prisma.InputJsonValue },
    })

    if (updated.count === 0) return { changed: false as const }

    await writeStudentDataAudit({
      targetUserId: userId,
      staffClerkId: authResult.userId,
      staffName: authResult.staffName,
      entity: "profile",
      entityId: purchase.id,
      field: "heritage_pin_delivery",
      valueBefore: {
        status: "pending",
        countryCode: entitlement.countryCode,
        sourcePurchaseId: purchase.id,
      },
      valueAfter: {
        status: "delivered",
        countryCode: entitlement.countryCode,
        sourcePurchaseId: purchase.id,
        deliveredAt: deliveredAt.toISOString(),
      },
      reason: `Physical ${entitlement.countryName} Heritage pin handed to student.`,
      ipAddress: getClientIp(req),
    }, tx)

    return { changed: true as const }
  })

  const current = await prisma.purchase.findUnique({
    where: { id: purchase.id },
    select: { id: true, userId: true, metadata: true, createdAt: true },
  })
  const currentEntitlement = current ? parseHeritagePinEntitlement(current) : null
  if (!currentEntitlement || currentEntitlement.status !== "delivered") {
    return NextResponse.json({ error: "Heritage pin delivery changed concurrently. Refresh and try again." }, { status: 409 })
  }

  return NextResponse.json({
    ok: true,
    idempotent: !outcome.changed,
    heritagePin: currentEntitlement,
  })
}
