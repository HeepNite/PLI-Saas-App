import { createHash, timingSafeEqual } from "crypto"
import { clerkClient } from "@clerk/nextjs/server"
import { extractStaffCategoryFromUserMetadata } from "@/lib/security/staff-category"
import { extractStaffRoleFromUserMetadata } from "@/lib/security/staff-role"
import { asObject } from "@/lib/shared"

const STAFF_SCAN_PAGE_SIZE = 100
const STAFF_SCAN_MAX_USERS = 5000

export const isValidPinHash = (pin: string, pinHash: string): boolean => {
  const parts = pinHash.split(":")
  if (parts.length !== 2) return false
  const [salt, expectedHash] = parts
  if (!salt || !expectedHash) return false

  const nextHash = createHash("sha256")
    .update(`${pin}:${salt}:${process.env.CLERK_SECRET_KEY || "staff-pin"}`)
    .digest("hex")

  try {
    const expectedBuffer = Buffer.from(expectedHash, "hex")
    const nextBuffer = Buffer.from(nextHash, "hex")
    if (expectedBuffer.length === 0 || nextBuffer.length === 0) return false
    if (expectedBuffer.length !== nextBuffer.length) return false
    return timingSafeEqual(expectedBuffer, nextBuffer)
  } catch {
    return false
  }
}

export type MatchedStaffUser = {
  user: Awaited<ReturnType<Awaited<ReturnType<typeof clerkClient>>["users"]["getUser"]>>
  role: string
  category: ReturnType<typeof extractStaffCategoryFromUserMetadata>
}

type ResolveStaffUserByPinInput = {
  pin: string
  requestedUserId?: string
  preferredUserId?: string
}

export const resolveStaffUserByPin = async ({
  pin,
  requestedUserId = "",
  preferredUserId = "",
}: ResolveStaffUserByPinInput): Promise<
  { ok: true; staff: MatchedStaffUser } | { ok: false; status: number; error: string }
> => {
  if (!/^\d{4}$/.test(pin)) {
    return { ok: false, status: 400, error: "PIN must be exactly 4 digits." }
  }

  const client = await clerkClient()

  if (requestedUserId) {
    let selectedUser: Awaited<ReturnType<typeof client.users.getUser>> | null = null
    try {
      selectedUser = await client.users.getUser(requestedUserId)
    } catch {
      return { ok: false, status: 404, error: "Selected staff user was not found." }
    }

    const role = extractStaffRoleFromUserMetadata(selectedUser)
    if (!role) {
      return { ok: false, status: 400, error: "Selected user is not a staff member." }
    }

    const privateMetadata = asObject(selectedUser.privateMetadata)
    const pinHash = typeof privateMetadata.staffPinHash === "string" ? privateMetadata.staffPinHash : ""
    if (!pinHash) {
      return { ok: false, status: 400, error: "Selected user has no PIN configured." }
    }

    if (!isValidPinHash(pin, pinHash)) {
      return { ok: false, status: 401, error: "Invalid PIN." }
    }

    const category = extractStaffCategoryFromUserMetadata(selectedUser)
    return { ok: true, staff: { user: selectedUser, role, category } }
  }

  let matchedUser: Awaited<ReturnType<typeof client.users.getUser>> | null = null
  let matchedRole: string | null = null

  if (preferredUserId) {
    try {
      const preferredUser = await client.users.getUser(preferredUserId)
      const preferredRole = extractStaffRoleFromUserMetadata(preferredUser)
      const privateMetadata = asObject(preferredUser.privateMetadata)
      const pinHash = typeof privateMetadata.staffPinHash === "string" ? privateMetadata.staffPinHash : ""
      if (preferredRole && pinHash && isValidPinHash(pin, pinHash)) {
        matchedUser = preferredUser
        matchedRole = preferredRole
      }
    } catch {
      // ignore and fall back to global scan
    }
  }

  if (!matchedUser) {
    const pinMatches: Array<{
      user: Awaited<ReturnType<typeof client.users.getUser>>
      role: string
    }> = []

    for (let offset = 0; offset < STAFF_SCAN_MAX_USERS; offset += STAFF_SCAN_PAGE_SIZE) {
      const page = await client.users.getUserList({
        limit: STAFF_SCAN_PAGE_SIZE,
        offset,
      })

      for (const user of page.data) {
        const role = extractStaffRoleFromUserMetadata(user)
        if (!role) continue

        const privateMetadata = asObject(user.privateMetadata)
        const pinHash = typeof privateMetadata.staffPinHash === "string" ? privateMetadata.staffPinHash : ""
        if (!pinHash) continue

        if (!isValidPinHash(pin, pinHash)) continue
        if (!pinMatches.some((entry) => entry.user.id === user.id)) {
          pinMatches.push({ user, role })
        }
      }

      if (page.data.length < STAFF_SCAN_PAGE_SIZE) break
    }

    if (pinMatches.length === 1) {
      matchedUser = pinMatches[0]!.user
      matchedRole = pinMatches[0]!.role
    } else if (pinMatches.length > 1) {
      return {
        ok: false,
        status: 409,
        error: "This PIN is assigned to multiple staff users. Set unique PINs before using PIN sign-in.",
      }
    }
  }

  if (!matchedUser || !matchedRole) {
    return { ok: false, status: 401, error: "Invalid PIN." }
  }

  const category = extractStaffCategoryFromUserMetadata(matchedUser)
  return { ok: true, staff: { user: matchedUser, role: matchedRole, category } }
}
