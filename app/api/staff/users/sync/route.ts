import { NextResponse } from "next/server"
import { clerkClient } from "@clerk/nextjs/server"
import { authorizeOwnerOrAdminRequest } from "@/lib/security/staff-portal-auth"
import { prisma } from "@/lib/prisma"
import { syncDbUserFromClerkUser } from "@/lib/clerk-user-sync"

type SyncBody = {
  userId?: string
  clerkId?: string
}

const normalize = (value: string | undefined) => {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : undefined
}

export const runtime = "nodejs"

export async function POST(req: Request) {
  const authResult = await authorizeOwnerOrAdminRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  let body: SyncBody
  try {
    body = (await req.json()) as SyncBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const dbUserId = normalize(body.userId)
  let clerkId = normalize(body.clerkId)

  if (!dbUserId && !clerkId) {
    return NextResponse.json({ error: "Provide userId or clerkId" }, { status: 400 })
  }

  if (!clerkId && dbUserId) {
    const dbUser = await prisma.user.findUnique({
      where: { id: dbUserId },
      select: { clerkId: true },
    })
    clerkId = dbUser?.clerkId || undefined
  }

  if (!clerkId) {
    return NextResponse.json({ error: "No Clerk user identifier found for sync" }, { status: 404 })
  }

  const client = await clerkClient()
  const clerkUser = await client.users.getUser(clerkId)
  const dbUser = await syncDbUserFromClerkUser(clerkUser)

  if (!dbUser) {
    return NextResponse.json({ error: "Unable to sync user" }, { status: 500 })
  }

  return NextResponse.json({
    user: {
      id: dbUser.id,
      clerkId: dbUser.clerkId,
      email: dbUser.email,
      name: dbUser.name,
      phone: dbUser.phone,
    },
  })
}
