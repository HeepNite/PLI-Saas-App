import type { ClerkClient } from "@clerk/backend"
import { clerkClient } from "@clerk/nextjs/server"

export type ClerkUser = Awaited<ReturnType<ClerkClient["users"]["getUser"]>>

// ── Short-lived getUser cache (shared with staff-portal-auth) ────
const CLERK_CACHE_TTL_MS = 5_000
const clerkUserCache = new Map<string, { user: ClerkUser; expiresAt: number }>()

export const getCachedClerkUser = async (userId: string): Promise<ClerkUser> => {
  const now = Date.now()
  const cached = clerkUserCache.get(userId)
  if (cached && cached.expiresAt > now) return cached.user

  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  clerkUserCache.set(userId, { user, expiresAt: now + CLERK_CACHE_TTL_MS })
  return user
}

/**
 * Keeps avatar gating correct before optimizing away full Clerk refreshes.
 */
export function resolveAvatarState(user: ClerkUser | null | undefined): {
  hasAvatar: boolean | null
  needsRefresh: boolean
} {
  if (!user) {
    return { hasAvatar: null, needsRefresh: false }
  }

  if (typeof user.hasImage === "boolean") {
    return { hasAvatar: user.hasImage, needsRefresh: false }
  }

  return { hasAvatar: null, needsRefresh: true }
}

export type EnsureClerkUserInput = {
  clerkId?: string
  email?: string
  firstName?: string
  lastName?: string
  name?: string
  phone?: string
}

const normalize = (value: string | undefined | null) => {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : undefined
}

const splitName = (fullName?: string) => {
  const normalized = normalize(fullName)
  if (!normalized) return { firstName: undefined, lastName: undefined }
  const parts = normalized.split(/\s+/)
  const firstName = parts.shift()
  const lastName = parts.length ? parts.join(" ") : undefined
  return { firstName, lastName }
}

const toE164 = (value?: string) => {
  const normalized = normalize(value)
  if (!normalized || !normalized.startsWith("+")) return undefined
  const digits = normalized.replace(/\D/g, "")
  if (digits.length < 8 || digits.length > 15) return undefined
  return `+${digits}`
}

export async function findClerkUserByIdentifiers(input: { email?: string; phone?: string }) {
  const client = await clerkClient()
  const email = normalize(input.email)?.toLowerCase()
  const phone = toE164(input.phone)

  if (!email && !phone) return null

  // Run both lookups in parallel when both identifiers are present
  const [emailResult, phoneResult] = await Promise.all([
    email
      ? client.users.getUserList({ emailAddress: [email], limit: 1 })
      : null,
    phone
      ? client.users.getUserList({ phoneNumber: [phone], limit: 1 })
      : null,
  ])

  // Prefer email match over phone match
  if (emailResult && emailResult.data.length > 0) return emailResult.data[0]
  if (phoneResult && phoneResult.data.length > 0) return phoneResult.data[0]

  return null
}

export async function ensureClerkUser(input: EnsureClerkUserInput) {
  const client = await clerkClient()
  const clerkId = normalize(input.clerkId)
  if (clerkId) {
    return getCachedClerkUser(clerkId)
  }

  const email = normalize(input.email)?.toLowerCase()
  const phone = toE164(input.phone)
  if (!email && !phone) {
    return null
  }

  const providedFirst = normalize(input.firstName)
  const providedLast = normalize(input.lastName)
  const { firstName: splitFirst, lastName: splitLast } = splitName(input.name)
  const firstName = providedFirst || splitFirst
  const lastName = providedLast || splitLast
  const existing = email
    ? await client.users.getUserList({
        emailAddress: [email],
        limit: 1,
      })
    : await client.users.getUserList({
        phoneNumber: [phone as string],
        limit: 1,
      })

  if (existing.data.length > 0) {
    const existingUser = existing.data[0]
    await updateClerkUserIfMissing(existingUser, input)
    return existingUser
  }

  try {
    return await client.users.createUser({
      emailAddress: email ? [email] : undefined,
      firstName,
      lastName,
      phoneNumber: phone ? [phone] : undefined,
      skipPasswordRequirement: true,
    })
  } catch (err) {
    // If a concurrent request created the user, try to fetch again.
    const fallback = email
      ? await client.users.getUserList({
          emailAddress: [email],
          limit: 1,
        })
      : await client.users.getUserList({
          phoneNumber: [phone as string],
          limit: 1,
        })
    if (fallback.data.length > 0) {
      return fallback.data[0]
    }
    throw err
  }
}

export async function updateClerkUserIfMissing(user: ClerkUser, input: EnsureClerkUserInput) {
  const client = await clerkClient()
  const providedFirst = normalize(input.firstName)
  const providedLast = normalize(input.lastName)
  const { firstName: splitFirst, lastName: splitLast } = splitName(input.name)
  const firstName = providedFirst || splitFirst
  const lastName = providedLast || splitLast
  const phone = toE164(input.phone)

  const updatePayload: { firstName?: string; lastName?: string } = {}
  if (!user.firstName && firstName) updatePayload.firstName = firstName
  if (!user.lastName && lastName) updatePayload.lastName = lastName

  if (Object.keys(updatePayload).length > 0) {
    try {
      await client.users.updateUser(user.id, updatePayload)
    } catch (err) {
      console.warn("Clerk user update failed", err)
    }
  }

  const hasPhone = Boolean(user.primaryPhoneNumberId) || user.phoneNumbers.length > 0
  if (phone && !hasPhone) {
    try {
      await client.phoneNumbers.createPhoneNumber({
        userId: user.id,
        phoneNumber: phone,
        verified: false,
        primary: true,
      })
    } catch (err) {
      console.warn("Clerk phone add failed", err)
    }
  }
}
