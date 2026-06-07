import { clerkClient } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { extractClerkIdentity, resolveCanonicalClerkName } from "@/lib/clerk-user-sync"

const CLERK_PAGE_SIZE = 100
const CLERK_MAX_USERS = 10000

export type ClerkListUser = Awaited<ReturnType<Awaited<ReturnType<typeof clerkClient>>["users"]["getUserList"]>>["data"][number]

export type MissingClerkUser = {
  clerkId: string
  email: string | null
}

export type MismatchedClerkUser = {
  userId: string
  clerkId: string
  email: string | null
  fields: Array<"name" | "email" | "phone">
  clerk: { name: string | null; email: string | null; phone: string | null }
  db: { name: string | null; email: string | null; phone: string | null }
}

type ClerkCoverage = {
  dbUsersWithClerkId: number
  missingUsers: MissingClerkUser[]
  mismatchedUsers: MismatchedClerkUser[]
}

export const primaryEmail = (user: ClerkListUser) =>
  user.primaryEmailAddress?.emailAddress || user.emailAddresses?.find((email) => Boolean(email.emailAddress))?.emailAddress || null

const normalizePhoneDigits = (value: string | null | undefined): string => {
  if (!value) return ""
  return value.replace(/\D/g, "")
}

const normalizeText = (value: string | null | undefined): string => {
  return (value || "").trim().toLowerCase()
}

export const listAllClerkUsers = async () => {
  const client = await clerkClient()
  const users: ClerkListUser[] = []

  for (let offset = 0; offset < CLERK_MAX_USERS; offset += CLERK_PAGE_SIZE) {
    const page = await client.users.getUserList({ limit: CLERK_PAGE_SIZE, offset })
    users.push(...page.data)

    if (page.data.length < CLERK_PAGE_SIZE) break
  }

  return users
}

export const getClerkCoverage = async (clerkUsers: ClerkListUser[]): Promise<ClerkCoverage> => {
  const clerkIds = clerkUsers.map((user) => user.id)
  if (clerkIds.length === 0) {
    return { dbUsersWithClerkId: 0, missingUsers: [], mismatchedUsers: [] }
  }

  const dbUsers = await prisma.user.findMany({
    where: { clerkId: { in: clerkIds } },
    select: { id: true, clerkId: true, name: true, email: true, phone: true },
  })
  const dbByClerkId = new Map(dbUsers.filter((u) => u.clerkId).map((u) => [u.clerkId as string, u]))

  const missingUsers = clerkUsers
    .filter((user) => !dbByClerkId.has(user.id))
    .map((user) => ({ clerkId: user.id, email: primaryEmail(user) }))

  const mismatchedUsers: MismatchedClerkUser[] = []
  for (const clerkUser of clerkUsers) {
    const dbUser = dbByClerkId.get(clerkUser.id)
    if (!dbUser) continue

    const clerkIdentity = extractClerkIdentity(clerkUser)
    const clerkName = clerkIdentity.name || null
    const clerkEmail = clerkIdentity.email || null
    const clerkPhone = clerkIdentity.phone || null

    const fields: Array<"name" | "email" | "phone"> = []
    if (clerkName && normalizeText(clerkName) !== normalizeText(dbUser.name)) fields.push("name")
    if (clerkEmail && normalizeText(clerkEmail) !== normalizeText(dbUser.email)) fields.push("email")
    if (clerkPhone && normalizePhoneDigits(clerkPhone) !== normalizePhoneDigits(dbUser.phone)) fields.push("phone")

    if (fields.length > 0) {
      mismatchedUsers.push({
        userId: dbUser.id,
        clerkId: clerkUser.id,
        email: clerkEmail || dbUser.email || null,
        fields,
        clerk: { name: clerkName, email: clerkEmail, phone: clerkPhone },
        db: { name: dbUser.name, email: dbUser.email, phone: dbUser.phone },
      })
    }
  }

  return {
    dbUsersWithClerkId: dbUsers.length,
    missingUsers,
    mismatchedUsers,
  }
}

export const findMissingClerkUsers = async (clerkUsers: ClerkListUser[]): Promise<MissingClerkUser[]> =>
  (await getClerkCoverage(clerkUsers)).missingUsers

// Re-export so other modules can keep using one entry point
export { resolveCanonicalClerkName }
