import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { parseStaffRequestStatus } from "@/lib/security/staff-request"

export const runtime = "nodejs"

const asObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

export async function PATCH(req: Request, context: { params: Promise<{ requestId: string }> }) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:requests:patch", getClientIp(req)),
    limit: 120,
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

  const { requestId } = await context.params
  if (!requestId) {
    return NextResponse.json({ error: "Missing requestId" }, { status: 400 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const payload = body as Record<string, unknown>
  const status = parseStaffRequestStatus(payload.status)
  if (!status) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }
  const note = typeof payload.note === "string" ? payload.note.trim().slice(0, 400) : ""

  const current = await prisma.actionRequest.findUnique({ where: { id: requestId } })
  if (!current) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 })
  }

  const currentMeta = asObject(current.meta)
  const nextMeta = {
    ...currentMeta,
    reviewedBy: authResult.userId,
    reviewNote: note || currentMeta.reviewNote || "",
    reviewedAt: new Date().toISOString(),
  }

  const resolvedAt = status === "APPROVED" || status === "REJECTED" ? new Date() : null

  const updated = await prisma.actionRequest.update({
    where: { id: requestId },
    data: {
      status,
      resolvedAt,
      meta: nextMeta,
    },
  })

  return NextResponse.json({
    ok: true,
    request: {
      id: updated.id,
      status: updated.status,
      resolvedAt: updated.resolvedAt?.toISOString() || null,
    },
  })
}
