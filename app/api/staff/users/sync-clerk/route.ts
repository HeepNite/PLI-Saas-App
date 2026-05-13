import { NextResponse } from "next/server"
import { authorizeOwnerOrAdminRequest } from "@/lib/security/staff-portal-auth"
import { syncDbUserFromClerkUser } from "@/lib/clerk-user-sync"
import { findMissingClerkUsers, listAllClerkUsers, primaryEmail, type ClerkListUser } from "./shared"

export const runtime = "nodejs"

type SyncDiagnostic = {
  clerkId: string
  email: string | null
  reason: string
}

const summarizeMissingUsers = async (clerkUsers: ClerkListUser[]) => {
  const missingUsers = await findMissingClerkUsers(clerkUsers)
  return missingUsers.map((user) => ({ ...user, reason: "missing after sync" }))
}

export async function POST() {
  const authResult = await authorizeOwnerOrAdminRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const clerkUsers = await listAllClerkUsers()
  const skipped: SyncDiagnostic[] = []
  const failed: SyncDiagnostic[] = []
  let synced = 0

  for (const user of clerkUsers) {
    try {
      const dbUser = await syncDbUserFromClerkUser(user)
      if (!dbUser) {
        skipped.push({ clerkId: user.id, email: primaryEmail(user), reason: "sync returned no db user" })
        continue
      }
      synced += 1
    } catch (error) {
      console.error("staff.users.sync_clerk.user_failed", { clerkId: user.id, error })
      failed.push({ clerkId: user.id, email: primaryEmail(user), reason: "sync failed" })
    }
  }

  const missingAfterSync = await summarizeMissingUsers(clerkUsers)

  return NextResponse.json({
    totalClerkUsers: clerkUsers.length,
    synced,
    skipped: skipped.length,
    failed: failed.length,
    missingAfterSync: missingAfterSync.length,
    skippedUsers: skipped,
    failedUsers: failed,
    missingUsers: missingAfterSync,
  })
}
