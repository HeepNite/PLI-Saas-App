import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeStaffPortalBaseRequest } from "@/lib/security/staff-portal-auth"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { decideReservationLifecycleAction } from "@/lib/room-availability"

export const runtime = "nodejs"

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const rateLimit = consumeRateLimit({ key: buildRateLimitKey("staff:room-reservations:cancel:post", getClientIp(req)), limit: 60, windowMs: 60_000 })
  if (!rateLimit.ok) return NextResponse.json({ error: "Too many requests. Please try again in a moment." }, { status: 429 })

  const auth = await authorizeStaffPortalBaseRequest()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!auth.role) return NextResponse.json({ error: "Insufficient role" }, { status: 403 })

  const body = (await req.json().catch(() => ({}))) as { reason?: unknown }
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 400) : null

  const { id } = await context.params
  const current = await prisma.roomReservation.findUnique({ where: { id } })
  if (!current) return NextResponse.json({ error: "Reservation not found." }, { status: 404 })

  const decision = decideReservationLifecycleAction({ action: "cancel", currentStatus: current.status, roomIsActive: true })
  if (!decision.allowed) return NextResponse.json({ error: "Reservation cannot be cancelled.", reasonCode: decision.reasonCode }, { status: 409 })

  const item = await prisma.$transaction(async (tx) => {
    const updated = await tx.roomReservation.update({
      where: { id },
      data: {
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledByClerkUserId: auth.userId,
        cancellationReason: reason,
      },
    })

    await tx.roomAuditLog.create({
      data: {
        roomId: updated.roomId,
        roomNameSnapshot: `reservation:${updated.title}`,
        action: "reservation_cancel",
        actorClerkUserId: auth.userId,
        actorRole: auth.role,
        outcome: "success",
        reason,
        metadata: { reservationId: updated.id },
      },
    })

    return updated
  })

  return NextResponse.json({ ok: true, item })
}
