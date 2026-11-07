import { NextResponse } from "next/server"
import { withStaffGuard } from "@/lib/security/with-staff-guard"
import { authorizeTerminalCaller, getPendingTerminalCharge } from "@/lib/terminal-charges/service"

export const runtime = "nodejs"

// Polled by /staff/terminal every few seconds; scoped to the cookie's terminal only.
export async function GET(req: Request) {
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:terminal:charges:pending", limit: 120, windowMs: 60_000 },
    authorize: authorizeTerminalCaller,
  })
  if (!guard.ok) return guard.response
  const charge = await getPendingTerminalCharge(guard.auth.terminalId)
  return NextResponse.json({ charge }, { headers: { "Cache-Control": "no-store" } })
}
