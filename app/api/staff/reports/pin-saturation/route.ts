import { authorizeStaffPortalSectionRequest } from "@/lib/security/staff-portal-auth"
import { withStaffGuard } from "@/lib/security/with-staff-guard"
import { getStudentPinSaturationReport } from "@/lib/security/student-pin-saturation"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function GET(req: Request) {
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:reports:pin-saturation:get", limit: 60, windowMs: 60_000 },
    authorize: () => authorizeStaffPortalSectionRequest("reports"),
  })
  if (!guard.ok) return guard.response

  const report = await getStudentPinSaturationReport()
  return NextResponse.json(report)
}
