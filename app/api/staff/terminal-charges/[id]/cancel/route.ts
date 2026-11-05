import { NextResponse } from "next/server"
import { getClientIp } from "@/lib/security/rate-limit"
import { withStaffGuard } from "@/lib/security/with-staff-guard"
import { cancelTerminalCharge } from "@/lib/terminal-charges/cancel"
import { authorizeTerminalChargeRequest, terminalChargeErrorResponse } from "@/lib/terminal-charges/service"

export const runtime = "nodejs"

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:terminal-charges:cancel", limit: 60, windowMs: 60_000 },
    authorize: authorizeTerminalChargeRequest,
  })
  if (!guard.ok) return guard.response
  try {
    const charge = await cancelTerminalCharge({ id: (await context.params).id, staff: guard.auth, ipAddress: getClientIp(req) })
    return NextResponse.json({ charge }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return terminalChargeErrorResponse(error)
  }
}
