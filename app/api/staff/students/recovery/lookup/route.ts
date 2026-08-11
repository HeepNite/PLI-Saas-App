import { NextResponse } from "next/server"
import { authorizeStudentOperationalRequest } from "@/lib/security/staff-portal-auth"
import { lookupRecoveryDraft, normalizeRecoveryCode } from "@/lib/student-recovery"

const unavailable = () => NextResponse.json({ error: "Recovery code is unavailable." }, { status: 404 })

export async function POST(req: Request) {
  const auth = await authorizeStudentOperationalRequest()
  if (!auth.ok) return unavailable()
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return unavailable() }
  const code = normalizeRecoveryCode(body.code)
  if (!code) return unavailable()
  const draft = await lookupRecoveryDraft(code)
  if (!draft) return unavailable()
  return NextResponse.json({ draftId: draft.id, phone: draft.phone, email: draft.email, name: draft.name })
}
