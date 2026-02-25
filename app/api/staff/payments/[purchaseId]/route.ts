import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"

export const runtime = "nodejs"

type SettlementAction = "mark_paid" | "mark_pending"

const asObject = (value: Prisma.JsonValue | null): Prisma.JsonObject => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Prisma.JsonObject
  }
  return {}
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

  const authResult = await authorizeStaffPortalRequest()
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

  const updated = await prisma.purchase.update({
    where: { id: purchaseId },
    data: { metadata: nextMetadata },
  })

  return NextResponse.json({
    ok: true,
    purchase: {
      id: updated.id,
      settlementStatus,
    },
  })
}
