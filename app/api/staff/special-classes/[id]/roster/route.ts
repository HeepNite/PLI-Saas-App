import { NextResponse } from "next/server"
import { getSpecialClassDetail } from "@/lib/special-classes/read-model"
import { authorizeSpecialClassRosterRequest } from "@/lib/security/staff-portal-auth"
import { withStaffGuard } from "@/lib/security/with-staff-guard"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await withStaffGuard(req, { rateLimit: { scope: "staff:special-class:roster", limit: 120, windowMs: 60_000 }, authorize: authorizeSpecialClassRosterRequest })
  if (!guard.ok) return guard.response
  const detail = await getSpecialClassDetail((await params).id)
  return detail ? NextResponse.json({ metrics: detail.metrics, items: detail.roster }) : NextResponse.json({ error: "Special class not found" }, { status: 404 })
}
