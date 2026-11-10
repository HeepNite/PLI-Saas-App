import { NextResponse } from "next/server"
import { withStaffGuard } from "@/lib/security/with-staff-guard"
import { authorizeTerminalChargeRequest, getTerminalCharge, terminalChargeErrorResponse } from "@/lib/terminal-charges/service"

export const runtime = "nodejs"

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:terminal-charges:get", limit: 240, windowMs: 60_000 },
    authorize: authorizeTerminalChargeRequest,
  })
  if (!guard.ok) return guard.response
  try {
    const charge = await getTerminalCharge((await context.params).id)
    return NextResponse.json({ charge }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return terminalChargeErrorResponse(error)
  }
}
