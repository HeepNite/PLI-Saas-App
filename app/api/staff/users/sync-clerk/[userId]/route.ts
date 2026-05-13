import { NextResponse } from "next/server"
import { clerkClient } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { authorizeOwnerOrAdminRequest } from "@/lib/security/staff-portal-auth"
import { syncDbUserFromClerkUser } from "@/lib/clerk-user-sync"

export const runtime = "nodejs"

const jsonError = (error: string, status: number) => NextResponse.json({ error }, { status })

const resolveUserId = async (context: { params: Promise<{ userId: string }> }) => {
  const { userId } = await context.params
  return typeof userId === "string" && userId.length > 0 ? userId : null
}

/**
 * Sync one DB user's name + email from Clerk.
 * NEVER updates phone — phone is locked by product policy.
 */
export async function POST(_req: Request, context: { params: Promise<{ userId: string }> }) {
  const authResult = await authorizeOwnerOrAdminRequest()
  if (!authResult.ok) {
    return jsonError(authResult.error, authResult.status)
  }

  const userId = await resolveUserId(context)
  if (!userId) {
    return jsonError("Missing userId", 400)
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, clerkId: true, name: true, email: true, phone: true },
  })
  if (!dbUser) {
    return jsonError("User not found", 404)
  }
  if (!dbUser.clerkId) {
    return jsonError("User has no Clerk linkage", 409)
  }

  let clerkUser
  try {
    const client = await clerkClient()
    clerkUser = await client.users.getUser(dbUser.clerkId)
  } catch (error) {
    console.error("staff.users.sync_clerk.user.fetch_failed", { userId, clerkId: dbUser.clerkId, error })
    return jsonError("Unable to fetch user from Clerk", 502)
  }

  try {
    // skipPhone: true → DB phone is preserved (product policy: phone never changes via sync)
    const updated = await syncDbUserFromClerkUser(clerkUser, { skipPhone: true })
    if (!updated) {
      return jsonError("Sync produced no update", 500)
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone, // unchanged from DB
      },
    })
  } catch (error) {
    console.error("staff.users.sync_clerk.user.failed", { userId, clerkId: dbUser.clerkId, error })
    return jsonError("Sync failed", 500)
  }
}
