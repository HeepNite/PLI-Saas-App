import { NextResponse } from "next/server"
import { authorizeOwnerOrAdminRequest } from "@/lib/security/staff-portal-auth"
import { getClerkCoverage, listAllClerkUsers } from "../shared"

export const runtime = "nodejs"

export async function GET() {
  const authResult = await authorizeOwnerOrAdminRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const clerkUsers = await listAllClerkUsers()
  const coverage = await getClerkCoverage(clerkUsers)

  return NextResponse.json({
    clerkUsers: clerkUsers.length,
    dbUsersWithClerkId: coverage.dbUsersWithClerkId,
    missingCount: coverage.missingUsers.length,
    missingUsers: coverage.missingUsers,
    mismatchedCount: coverage.mismatchedUsers.length,
    mismatchedUsers: coverage.mismatchedUsers,
  })
}
