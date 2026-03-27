import { NextResponse } from "next/server"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { authorizeStaffPortalSectionRequest } from "@/lib/security/staff-portal-auth"
import { getStudentPinSaturationReport } from "@/lib/security/student-pin-saturation"

export const runtime = "nodejs"

export async function GET(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:reports:pin-saturation:get", getClientIp(req)),
    limit: 60,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  const authResult = await authorizeStaffPortalSectionRequest("reports")
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const report = await getStudentPinSaturationReport()
  return NextResponse.json(report)
}
