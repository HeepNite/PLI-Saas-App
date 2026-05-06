import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { syncDbUserFromClerkUser } from "@/lib/clerk-user-sync"
import { updateClerkUserIfMissing } from "@/lib/clerk-users"

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
  const dbUser = await syncDbUserFromClerkUser(clerkUser)

  if (!dbUser) {
    return NextResponse.json({ error: "Unable to sync user" }, { status: 500 })
  }

  return NextResponse.json({ user: dbUser })
}
