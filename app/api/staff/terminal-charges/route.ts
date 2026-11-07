import { NextResponse } from "next/server"
import { getClientIp } from "@/lib/security/rate-limit"
import { withStaffGuard } from "@/lib/security/with-staff-guard"
import { authorizeTerminalChargeRequest, createTerminalCharge, terminalChargeErrorResponse } from "@/lib/terminal-charges/service"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:terminal-charges:create", limit: 30, windowMs: 60_000 },
    authorize: authorizeTerminalChargeRequest,
  })
  if (!guard.ok) return guard.response
  try {
    const charge = await createTerminalCharge({ staff: guard.auth, body: await req.json().catch(() => null), ipAddress: getClientIp(req) })
    return NextResponse.json({ charge }, { status: 201, headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return terminalChargeErrorResponse(error)
  }
}
