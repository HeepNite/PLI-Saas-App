import { NextResponse } from "next/server"
import { normalizePhone } from "@/lib/checkout/validation"
import { invalidateRecoveryDraft, issueRecoveryDraft, normalizeRecoveryCode } from "@/lib/student-recovery"

export const runtime = "nodejs"

const safeOptionalText = (value: unknown, max: number) => {
  if (typeof value !== "string") return undefined
  const text = value.trim().slice(0, max)
  return text || undefined
}

export async function POST(req: Request) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }) }
  const phone = normalizePhone(safeOptionalText(body.phone, 32))
  const email = safeOptionalText(body.email, 254)?.toLowerCase()
  const name = safeOptionalText(body.name, 120)
  const source = body.source === "kiosk_terminal" || body.source === "qr_mobile" ? body.source : null
  if (!phone || !source) return NextResponse.json({ error: "Unable to start assistance." }, { status: 400 })
  const code = await issueRecoveryDraft({ phone, email, name }, source)
  return NextResponse.json({ code }, { status: 201 })
}

export async function DELETE(req: Request) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }) }
  const code = normalizeRecoveryCode(body.code)
  if (!code) return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  await invalidateRecoveryDraft(code)
  return new NextResponse(null, { status: 204 })
}
