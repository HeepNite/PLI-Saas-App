import { NextResponse } from "next/server"
import type { ClerkClient } from "@clerk/backend"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { upsertUserByIdentifiers } from "@/lib/users"
import { updateClerkUserIfMissing } from "@/lib/clerk-users"

type ClerkUser = Awaited<ReturnType<ClerkClient["users"]["getUser"]>>

const getDisplayName = (user: ClerkUser) => {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim()
  if (fullName) return fullName
  return user.username || undefined
}

type SyncBody = {
  firstName?: string
  lastName?: string
  name?: string
  phone?: string
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: SyncBody = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const client = await clerkClient()
  let clerkUser = await client.users.getUser(userId)
  await updateClerkUserIfMissing(clerkUser, {
    firstName: body.firstName,
    lastName: body.lastName,
    name: body.name,
    phone: body.phone,
  })

  clerkUser = await client.users.getUser(userId)
  const email = clerkUser.primaryEmailAddress?.emailAddress
  if (!email) {
    return NextResponse.json({ error: "Missing email for user" }, { status: 400 })
  }

  const dbUser = await upsertUserByIdentifiers({
    clerkId: userId,
    email,
    name: getDisplayName(clerkUser),
    phone: clerkUser.primaryPhoneNumber?.phoneNumber || undefined,
  })

  if (!dbUser) {
    return NextResponse.json({ error: "Unable to sync user" }, { status: 500 })
  }

  return NextResponse.json({ user: dbUser })
}
