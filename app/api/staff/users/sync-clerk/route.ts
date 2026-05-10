import { NextResponse } from "next/server"
import { clerkClient } from "@clerk/nextjs/server"
import { authorizeOwnerOrAdminRequest } from "@/lib/security/staff-portal-auth"
import { prisma } from "@/lib/prisma"
import { syncDbUserFromClerkUser } from "@/lib/clerk-user-sync"

export const runtime = "nodejs"

const CLERK_PAGE_SIZE = 100
const CLERK_MAX_USERS = 10000

type ClerkListUser = Awaited<ReturnType<Awaited<ReturnType<typeof clerkClient>>["users"]["getUserList"]>>["data"][number]

type SyncDiagnostic = {
  clerkId: string
  email: string | null
  reason: string
}

const primaryEmail = (user: ClerkListUser) =>
  user.primaryEmailAddress?.emailAddress || user.emailAddresses?.find((email) => Boolean(email.emailAddress))?.emailAddress || null

const listAllClerkUsers = async () => {
  const client = await clerkClient()
  const users: ClerkListUser[] = []

  for (let offset = 0; offset < CLERK_MAX_USERS; offset += CLERK_PAGE_SIZE) {
    const page = await client.users.getUserList({ limit: CLERK_PAGE_SIZE, offset })
    users.push(...page.data)

    if (page.data.length < CLERK_PAGE_SIZE) break
  }

  return users
}

const summarizeMissingUsers = async (clerkUsers: ClerkListUser[]) => {
  const clerkIds = clerkUsers.map((user) => user.id)
  if (clerkIds.length === 0) return []

  const dbUsers = await prisma.user.findMany({
    where: { clerkId: { in: clerkIds } },
    select: { clerkId: true },
  })
  const dbClerkIds = new Set(dbUsers.map((user) => user.clerkId).filter(Boolean))

  return clerkUsers
    .filter((user) => !dbClerkIds.has(user.id))
    .map((user) => ({ clerkId: user.id, email: primaryEmail(user), reason: "missing after sync" }))
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
