import { NextResponse } from "next/server"
import { withStaffGuard } from "@/lib/security/with-staff-guard"
import { recordTerminalChargeResult } from "@/lib/terminal-charges/cancel"
import { authorizeTerminalCaller, terminalChargeErrorResponse } from "@/lib/terminal-charges/service"

export const runtime = "nodejs"

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:terminal:charges:result", limit: 30, windowMs: 60_000 },
    authorize: authorizeTerminalCaller,
  })
  if (!guard.ok) return guard.response
  try {
    const body = await req.json().catch(() => null)
    const charge = await recordTerminalChargeResult({ terminalId: guard.auth.terminalId, id: (await context.params).id, body })
    return NextResponse.json({ charge }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return terminalChargeErrorResponse(error)
  }
}
