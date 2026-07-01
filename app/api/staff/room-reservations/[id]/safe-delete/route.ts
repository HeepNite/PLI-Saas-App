import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { canHardDeletePrivateReservation } from "@/lib/room-availability"
import { authorizeOwnerOrAdminRequest } from "@/lib/security/staff-portal-auth"
import { withStaffGuard } from "@/lib/security/with-staff-guard"

export const runtime = "nodejs"

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:room-reservations:safe-delete:post", limit: 20, windowMs: 60_000 },
    authorize: () => authorizeOwnerOrAdminRequest(),
  })
  if (!guard.ok) return guard.response
  const auth = guard.auth
  const actorRole = auth.role as string

  const body = (await req.json().catch(() => ({}))) as { reason?: unknown }
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 400) : null

  const { id } = await context.params
  if (!id) return NextResponse.json({ error: "Invalid reservation id." }, { status: 400 })

  const reservation = await prisma.roomReservation.findUnique({ where: { id } })
  if (!reservation) return NextResponse.json({ error: "Reservation not found." }, { status: 404 })

  const metadata = reservation.metadata && typeof reservation.metadata === "object"
    ? (reservation.metadata as Record<string, unknown>)
    : null

  const hasOperationalLinks =
    metadata?.hasPaymentLinks === true ||
    metadata?.hasCheckInLinks === true ||
    metadata?.hasAttendanceLinks === true ||
    metadata?.hasHistoricalOperationalLinks === true

  const decision = canHardDeletePrivateReservation({
    actor: { role: auth.role, category: auth.category },
    hasPaymentLinks: metadata?.hasPaymentLinks === true,
    hasCheckInLinks: metadata?.hasCheckInLinks === true,
    hasAttendanceLinks: metadata?.hasAttendanceLinks === true,
    hasHistoricalOperationalLinks: metadata?.hasHistoricalOperationalLinks === true,
  })

  if (!decision.allowed) {
    const status = decision.reasonCode === "FORBIDDEN" ? 403 : 409
    const blockers = hasOperationalLinks ? [{ code: "HAS_OPERATIONAL_LINKS", reservationId: reservation.id }] : []

    await prisma.roomAuditLog.create({
      data: {
        roomId: reservation.roomId,
        roomNameSnapshot: `reservation:${reservation.title}`,
        action: "reservation_safe_delete",
        actorClerkUserId: auth.userId,
        actorRole,
        reason,
        outcome: "denied",
        blockers,
        metadata: { reservationId: reservation.id, reasonCode: decision.reasonCode },
      },
    })

    return NextResponse.json({ error: "Reservation cannot be safely deleted.", reasonCode: decision.reasonCode, blockers }, { status })
  }

  const result = await prisma.$transaction(async (tx) => {
    const audit = await tx.roomAuditLog.create({
      data: {
        roomId: reservation.roomId,
        roomNameSnapshot: `reservation:${reservation.title}`,
        action: "reservation_safe_delete",
        actorClerkUserId: auth.userId,
        actorRole,
        reason,
        outcome: "success",
        metadata: { reservationId: reservation.id },
      },
      select: { id: true },
    })

    await tx.roomReservation.delete({ where: { id: reservation.id } })
    return audit
  })

  return NextResponse.json({ ok: true, deletedReservation: { id: reservation.id, roomId: reservation.roomId }, auditId: result.id })
}
