import { NextResponse } from "next/server"
import { authorizeStaffTerminalSession } from "@/lib/security/staff-terminal"
import { listStaffRosterForSchool } from "@/lib/security/staff-roster"

export const runtime = "nodejs"

/**
 * `/api/staff/terminal*` is under the middleware token-auth prefix
 * (middleware.ts — NOT Clerk-authed), so this route MUST self-authorize via
 * `authorizeStaffTerminalSession()`. It must NEVER return an unscoped
 * roster: a terminal with no `schoolId` (backfill pending) is rejected
 * outright rather than falling back to an org-wide list (design v5 ADR 14).
 */
export async function GET() {
  const session = await authorizeStaffTerminalSession()
  if (!session.ok) {
    return NextResponse.json({ error: "Terminal session required." }, { status: 401 })
  }

  if (!session.terminal.schoolId) {
    return NextResponse.json(
      { error: "This terminal is missing a school context. Contact an admin to configure it." },
      { status: 403 }
    )
  }

  const staff = await listStaffRosterForSchool(session.terminal.schoolId)

  return NextResponse.json({ staff })
}
