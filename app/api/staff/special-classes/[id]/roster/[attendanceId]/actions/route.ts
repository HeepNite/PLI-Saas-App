import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeSpecialClassRosterRequest } from "@/lib/security/staff-portal-auth"
import { withStaffGuard } from "@/lib/security/with-staff-guard"
import { applySpecialClassRosterAction } from "@/lib/special-classes/staff-mutations"

const ACTIONS = new Set(["check_in", "undo_check_in", "cancel"])

export async function POST(req: Request, { params }: { params: Promise<{ id: string; attendanceId: string }> }) {
  const guard = await withStaffGuard(req, { rateLimit: { scope: "staff:special-class:roster-action", limit: 60, windowMs: 60_000 }, authorize: authorizeSpecialClassRosterRequest })
  if (!guard.ok) return guard.response
  const { id, attendanceId } = await params
  let body: Record<string, unknown>
  try { body = await req.json() as Record<string, unknown> } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }) }
  const action = typeof body.action === "string" ? body.action : ""
  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : ""
  const reason = typeof body.reason === "string" ? body.reason.trim() : ""
  if (!ACTIONS.has(action) || !idempotencyKey || idempotencyKey.length > 200 || ((action === "undo_check_in" || action === "cancel") && !reason)) return NextResponse.json({ error: "Invalid roster action" }, { status: 422 })
  const result = await applySpecialClassRosterAction(prisma, {
    specialClassId: id,
    attendanceId,
    action: action as "check_in" | "undo_check_in" | "cancel",
    reason,
    idempotencyKey,
    actorClerkUserId: guard.auth.userId,
    actorRole: guard.auth.role,
  }).catch((error) => {
    if (error instanceof Error && error.message === "IDEMPOTENCY_KEY_REUSED") return "idempotency_conflict" as const
    if (error instanceof Error && error.message === "SPECIAL_CLASS_NOT_FOUND") return "not_found" as const
    throw error
  })
  if (result === "idempotency_conflict") return NextResponse.json({ error: "Idempotency key was already used for a different roster action" }, { status: 409 })
  if (result === "not_found" || result.kind === "not_found") return NextResponse.json({ error: "Roster attendance not found" }, { status: 404 })
  if (result.kind === "class_cancelled") return NextResponse.json({ error: "Cancelled special classes cannot be checked in" }, { status: 409 })
  if (result.kind === "capture_in_progress") return NextResponse.json({ error: "Payment capture is still in progress", retryable: true }, { status: 409 })
  if (result.kind === "replayed") return NextResponse.json({ ok: true, replayed: true })
  return NextResponse.json({ ok: true, attendance: result.attendance })
}
