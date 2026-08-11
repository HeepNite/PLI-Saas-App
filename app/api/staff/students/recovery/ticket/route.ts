import { NextResponse } from "next/server"
import { authorizeStudentOperationalRequest } from "@/lib/security/staff-portal-auth"
import { invalidateRecoveryTicket, issueRecoveryTicket, normalizeRecoveryCode } from "@/lib/student-recovery"

const unavailable = () => NextResponse.json({ error: "Recovery request is unavailable." }, { status: 400 })

export async function POST(req: Request) {
  const auth = await authorizeStudentOperationalRequest()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return unavailable() }
  const draftId = typeof body.draftId === "string" ? body.draftId : ""
  if (!draftId || body.noSmsConfirmed !== true || body.phoneValidated !== true) return unavailable()
  const ticket = await issueRecoveryTicket(draftId, auth.userId)
  if (!ticket) return unavailable()
  return NextResponse.json({ ticket: ticket.token })
}

export async function DELETE(req: Request) {
  const auth = await authorizeStudentOperationalRequest()
  if (!auth.ok) return new NextResponse(null, { status: 204 })
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return new NextResponse(null, { status: 204 }) }
  const ticket = normalizeRecoveryCode(body.ticket)
  if (ticket) await invalidateRecoveryTicket(ticket, auth.userId)
  return new NextResponse(null, { status: 204 })
}
