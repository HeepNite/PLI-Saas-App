import { NextResponse } from "next/server"
import { clerkClient } from "@clerk/nextjs/server"
import { authorizeOwnerOrAdminRequest } from "@/lib/security/staff-portal-auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

const CLERK_PAGE_SIZE = 100
const CLERK_MAX_USERS = 10000

type ClerkListUser = Awaited<ReturnType<Awaited<ReturnType<typeof clerkClient>>["users"]["getUserList"]>>["data"][number]

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

export async function GET() {
  const authResult = await authorizeOwnerOrAdminRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const clerkUsers = await listAllClerkUsers()
  const clerkIds = clerkUsers.map((user) => user.id)
  const dbUsers = clerkIds.length
    ? await prisma.user.findMany({
        where: { clerkId: { in: clerkIds } },
        select: { clerkId: true },
      })
    : []
  const dbClerkIds = new Set(dbUsers.map((user) => user.clerkId).filter(Boolean))
  const missingUsers = clerkUsers
    .filter((user) => !dbClerkIds.has(user.id))
    .map((user) => ({ clerkId: user.id, email: primaryEmail(user) }))

  return NextResponse.json({
    clerkUsers: clerkUsers.length,
    dbUsersWithClerkId: dbUsers.length,
    missingCount: missingUsers.length,
    missingUsers,
  })
}
