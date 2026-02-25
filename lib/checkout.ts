import "server-only"

import { auth, clerkClient } from "@clerk/nextjs/server"
import { verifyToken } from "@clerk/backend"
import { ensureClerkUser, findClerkUserByIdentifiers, updateClerkUserIfMissing, type ClerkUser } from "@/lib/clerk-users"
import { prisma } from "@/lib/prisma"
import { isEmail, normalizePhone, type ApiError, type CheckoutBody, type CheckoutValidation } from "@/lib/checkout/validation"

const NEW_STUDENT_SERVICE_IDS = new Set(["new-student"])
const COMPLETED_PURCHASE_STATUSES = ["paid", "succeeded"]

const hasVerifiedPhone = (user: ClerkUser | null) => {
  if (!user) return false
  const primary = user.phoneNumbers.find((p) => p.id === user.primaryPhoneNumberId) || user.phoneNumbers[0]
  return primary?.verification?.status === "verified"
}

export type { ApiError, CheckoutBody, CheckoutValidation }

export const resolveAuthUser = async (
  req: Request,
  input: { firstName?: string; lastName?: string; name?: string; phone?: string }
) => {
  const authResult = await auth()
  let userId = authResult.userId
  if (!userId) {
    const bearer = req.headers.get("authorization")?.replace("Bearer ", "")
    if (bearer && process.env.CLERK_SECRET_KEY) {
      const verified = await verifyToken(bearer, { secretKey: process.env.CLERK_SECRET_KEY })
      if (verified.data?.sub) {
        userId = verified.data.sub
      }
    }
  }

  let clerkUser: ClerkUser | null = null
  if (userId) {
    try {
      const client = await clerkClient()
      clerkUser = await client.users.getUser(userId)
      await updateClerkUserIfMissing(clerkUser, {
        firstName: input.firstName,
        lastName: input.lastName,
        name: input.name,
        phone: input.phone,
      })
    } catch {
      // ignore and fallback
    }
  }

  return { userId, clerkUser }
}

export const resolveContactIdentity = (input: { clerkUser: ClerkUser | null; email?: string; phone?: string }) => {
  const resolvedEmail = input.clerkUser?.primaryEmailAddress?.emailAddress || (isEmail(input.email) ? input.email : undefined)
  const phoneRaw = input.clerkUser?.primaryPhoneNumber?.phoneNumber || input.phone || ""
  const phoneNormalized = normalizePhone(phoneRaw)

  if (!resolvedEmail) {
    return { status: 400, error: "Missing or invalid email" } satisfies ApiError
  }
  if (!phoneNormalized) {
    return { status: 400, error: "Missing or invalid phone" } satisfies ApiError
  }

  return { resolvedEmail, phoneRaw, phoneNormalized }
}

export const ensureGuestClerkUser = async (input: {
  userId?: string
  resolvedEmail: string
  phoneRaw: string
  firstName?: string
  lastName?: string
  name?: string
  phone?: string
}) => {
  if (input.userId) {
    return { ensuredClerkUser: null }
  }

  const existing = await findClerkUserByIdentifiers({
    email: input.resolvedEmail,
    phone: input.phoneRaw || input.phone,
  })
  if (existing) {
    return {
      status: 409,
      error: "Account already exists. Please sign in to continue.",
      code: "ACCOUNT_EXISTS",
    } satisfies ApiError
  }

  try {
    const ensuredClerkUser = await ensureClerkUser({
      email: input.resolvedEmail,
      firstName: input.firstName,
      lastName: input.lastName,
      name: input.name,
      phone: input.phone,
    })
    return { ensuredClerkUser }
  } catch (err) {
    console.warn("Clerk user creation failed", err)
    return { status: 502, error: "Unable to create user" } satisfies ApiError
  }
}

export const enforceNewStudentRules = async (input: {
  serviceId: string
  safeParticipants: number
  clerkUserForVerification: ClerkUser | null
  resolvedUserId?: string
  resolvedEmail: string
  phoneNormalized: string
}) => {
  if (!NEW_STUDENT_SERVICE_IDS.has(input.serviceId)) return null

  if (input.safeParticipants !== 1) {
    return { status: 400, error: "New student price is limited to 1 participant." } satisfies ApiError
  }
  if (!hasVerifiedPhone(input.clerkUserForVerification)) {
    return { status: 409, error: "Phone verification required for new student price." } satisfies ApiError
  }

  const or: Array<Record<string, unknown>> = []
  if (input.resolvedUserId) or.push({ user: { clerkId: input.resolvedUserId } })
  if (input.resolvedEmail) or.push({ email: input.resolvedEmail })
  if (input.phoneNormalized) or.push({ phone: input.phoneNormalized })

  if (or.length === 0) return null

  if (!process.env.DATABASE_URL) {
    return {
      status: 500,
      error: "Database not configured. Set DATABASE_URL to enforce new student validation.",
    } satisfies ApiError
  }

  const existing = await prisma.purchase.findFirst({
    where: { OR: or, status: { in: COMPLETED_PURCHASE_STATUSES } },
  })
  if (existing) {
    return {
      status: 409,
      error: "New student price not available for existing customers",
      code: "NEW_STUDENT_ALREADY",
    } satisfies ApiError
  }

  return null
}
