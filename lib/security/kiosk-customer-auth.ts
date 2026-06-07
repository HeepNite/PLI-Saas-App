import { clerkClient } from "@clerk/nextjs/server"
import { extractStaffRoleFromUserMetadata, type StaffRole } from "@/lib/security/staff-role"

type ClerkUser = Awaited<ReturnType<Awaited<ReturnType<typeof clerkClient>>["users"]["getUser"]>>

export type KioskCustomerClerkAuth = {
  userId: string | null
  clerkUser: ClerkUser | null
  blocked: boolean
  blockedRole: StaffRole | null
}

export const resolveKioskCustomerClerkAuth = async (
  userId: string | null | undefined
): Promise<KioskCustomerClerkAuth> => {
  if (!userId) {
    return {
      userId: null,
      clerkUser: null,
      blocked: false,
      blockedRole: null,
    }
  }

  const client = await clerkClient()
  const clerkUser = await client.users.getUser(userId)
  const blockedRole = extractStaffRoleFromUserMetadata(clerkUser)

  return {
    userId: blockedRole ? null : userId,
    clerkUser,
    blocked: Boolean(blockedRole),
    blockedRole,
  }
}
