import { clerkClient } from "@clerk/nextjs/server"
import { extractStaffRoleFromUserMetadata, type StaffRole } from "@/lib/security/staff-role"

type ClerkUser = Awaited<ReturnType<Awaited<ReturnType<typeof clerkClient>>["users"]["getUser"]>>

export type KioskCustomerClerkAuth = {
  userId: string | null
  clerkUser: ClerkUser | null
  blocked: boolean
  blockedRole: StaffRole | null
  /**
   * Set when the Clerk lookup for `userId` failed (e.g. a stale/
   * cross-instance clerkId during the dev→prod Clerk instance migration
   * window), as opposed to `userId` being absent to begin with. Callers
   * that gate on `userId` being unresolved (e.g. a 401 short-circuit) MUST
   * check this flag and skip that short-circuit so their own
   * identifier-based fallback lookup can still run instead of surfacing a
   * false 401/500. Only set on the lookup-failure path — never on the
   * no-userId-supplied path, so existing callers that treat `userId: null`
   * as "no authenticated customer" (e.g. lib/checkout.ts) are unaffected.
   */
  lookupFailed?: boolean
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
  let clerkUser: ClerkUser | null = null
  try {
    clerkUser = await client.users.getUser(userId)
  } catch {
    // A stale/cross-instance clerkId (e.g. during the dev→prod Clerk
    // instance migration window) must never surface a 500 to the QR
    // check-in client — degrade to the safe "unresolved" state so the
    // caller falls back to its phone/email identifier path. lookupFailed
    // lets callers that gate on userId (e.g. a 401 short-circuit) skip
    // that gate and proceed to their own identifier fallback.
    return {
      userId: null,
      clerkUser: null,
      blocked: false,
      blockedRole: null,
      lookupFailed: true,
    }
  }
  const blockedRole = extractStaffRoleFromUserMetadata(clerkUser)

  return {
    userId: blockedRole ? null : userId,
    clerkUser,
    blocked: Boolean(blockedRole),
    blockedRole,
  }
}
