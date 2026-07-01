import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"
import { withStaffGuard } from "@/lib/security/with-staff-guard"
import { parseStaffRequestStatus } from "@/lib/security/staff-request"
import { asObject } from "@/lib/shared"

export const runtime = "nodejs"

export async function PATCH(req: Request, context: { params: Promise<{ requestId: string }> }) {
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:requests:patch", limit: 120, windowMs: 60_000 },
    authorize: () => authorizeStaffPortalRequest(),
  })
  if (!guard.ok) return guard.response
  const authResult = guard.auth

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
