import { NextResponse } from "next/server"
import { withStaffGuard } from "@/lib/security/with-staff-guard"
import { authorizeTerminalCaller, prepareTerminalCharge, terminalChargeErrorResponse } from "@/lib/terminal-charges/service"

export const runtime = "nodejs"

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:terminal:charges:prepare", limit: 30, windowMs: 60_000 },
    authorize: authorizeTerminalCaller,
  })
  if (!guard.ok) return guard.response
  try {
    const prepared = await prepareTerminalCharge({ ...guard.auth, id: (await context.params).id })
    return NextResponse.json(prepared, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return terminalChargeErrorResponse(error)
  }
}
