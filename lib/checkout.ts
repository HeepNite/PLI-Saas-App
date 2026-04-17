import "server-only"

import { auth, clerkClient } from "@clerk/nextjs/server"
import { verifyToken } from "@clerk/backend"
import { ensureClerkUser, findClerkUserByIdentifiers, resolveAvatarState, updateClerkUserIfMissing, type ClerkUser } from "@/lib/clerk-users"
import { resolveTerminalKioskSession } from "@/lib/checkin/kiosk-session"
import type { PhotoFlowContext } from "@/lib/checkin/photo-context-policy"
import {
  PREPARED_CHECKOUT_FALLBACK_REASONS,
  deletePreparedCheckoutContext,
  isPreparedCheckoutContextEnabled,
  lookupPreparedCheckoutContext,
  snapshotPreparedCheckoutVerification,
} from "@/lib/checkout/prepared-context"
import { prisma } from "@/lib/prisma"
import { resolveKioskCustomerClerkAuth } from "@/lib/security/kiosk-customer-auth"
import {
  authorizeStaffTerminalSession,
  type StaffTerminalSessionAuthResult,
} from "@/lib/security/staff-terminal"
import { isEmail, normalizePhone, type ApiError, type CheckoutBody, type CheckoutValidation } from "@/lib/checkout/validation"
import {
  replacePermanentStudentPin,
  assertStudentPinConfirmation,
  isStudentPinConflictError,
  isStudentPinLifecycleEnabled,
} from "@/lib/security/student-pin"
import { writeStudentPinAudit, STUDENT_PIN_AUDIT_ACTIONS } from "@/lib/security/student-pin-audit"
import { upsertUserByIdentifiers } from "@/lib/users"

const NEW_STUDENT_SERVICE_IDS = new Set(["new-student"])
const COMPLETED_PURCHASE_STATUSES = ["paid", "succeeded"]

const hasVerifiedPhone = (user: ClerkUser | null) => {
  if (!user) return false
  const primary = user.phoneNumbers.find((p) => p.id === user.primaryPhoneNumberId) || user.phoneNumbers[0]
  return primary?.verification?.status === "verified"
}

export type { ApiError, CheckoutBody, CheckoutValidation }

export type PreparedCheckoutAccount = {
  userId: string | null
  clerkUser: ClerkUser | null
  resolvedUserId: string | null
  identity: {
    resolvedEmail: string
    phoneRaw: string
    phoneNormalized: string
  }
  account: {
    clerkUserId: string | null
    created: boolean
    requiresSignIn: boolean
    hasAvatar: boolean
  }
}

export type EnrollStudentPinInput = {
  serviceId: string
  prepareOnly?: boolean
  resolvedClerkUserId?: string | null
  resolvedEmail: string
  phoneNormalized: string
  name?: string
  studentPin?: string
  studentPinConfirm?: string
}

export type CheckoutVerification = {
  hasVerifiedPhone: boolean
}

export type CheckoutPreparationResolution = {
  source: "prepared" | "fallback"
  preparedAccount: PreparedCheckoutAccount
  verification: CheckoutVerification
  terminalAuth: Extract<StaffTerminalSessionAuthResult, { ok: true }> | null
  fallbackReason?: string
}

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
      const tokenSub = (verified as { data?: { sub?: unknown } }).data?.sub
      if (typeof tokenSub === "string" && tokenSub) {
        userId = tokenSub
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

export const resolveContactIdentity = (
  input: { clerkUser: ClerkUser | null; email?: string; phone?: string }
): ApiError | { resolvedEmail: string; phoneRaw: string; phoneNormalized: string } => {
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

export const prepareCheckoutAccount = async (
  req: Request,
  input: {
    email?: string
    firstName?: string
    lastName?: string
    name?: string
    phone?: string
  },
  options: {
    photoContext?: PhotoFlowContext
    allowExistingAccountLookup?: boolean
    kioskSessionToken?: string
    terminalAuth?: Extract<StaffTerminalSessionAuthResult, { ok: true }> | null
    touchKioskSession?: boolean
    serviceId?: string
  } = {}
): Promise<ApiError | PreparedCheckoutAccount> => {
  const authUser = await resolveAuthUser(req, input)
  const kioskCustomerAuth =
    options.photoContext === "kiosk_terminal"
      ? await resolveKioskCustomerClerkAuth(authUser.userId)
      : null

  let userId = kioskCustomerAuth ? kioskCustomerAuth.userId : authUser.userId
  let clerkUser = kioskCustomerAuth?.clerkUser || authUser.clerkUser

  const isNewStudentKioskFlow = options.serviceId ? NEW_STUDENT_SERVICE_IDS.has(options.serviceId) : false

  // For new-student kiosk flows, ignore the staff's Clerk session entirely.
  // The new student's identity comes from the form input, not from the
  // authenticated staff member operating the kiosk.
  if (isNewStudentKioskFlow) {
    userId = null
    clerkUser = null
  }

  if (options.photoContext === "kiosk_terminal" && kioskCustomerAuth?.blocked && !options.kioskSessionToken && !isNewStudentKioskFlow) {
    return {
      status: 401,
      error: "Kiosk customer identification is required before checkout.",
    } satisfies ApiError
  }

  if (!userId && options.photoContext === "kiosk_terminal" && options.kioskSessionToken) {
    const kioskSessionResult = await resolveTerminalKioskSession(options.kioskSessionToken, {
      terminalAuth: options.terminalAuth || undefined,
      touch: options.touchKioskSession,
    })
    if (!kioskSessionResult.ok) {
      return {
        status: kioskSessionResult.status,
        error: kioskSessionResult.error,
      } satisfies ApiError
    }

    const resolvedEmail = kioskSessionResult.session.user.email?.trim()
    const phoneRaw = kioskSessionResult.session.user.phone || ""
    const phoneNormalized = normalizePhone(phoneRaw)

    if (!resolvedEmail || !phoneNormalized) {
      return {
        status: 409,
        error: "Identified student is missing the required contact data for checkout.",
      } satisfies ApiError
    }

    return {
      userId: null,
      clerkUser: null,
      resolvedUserId: kioskSessionResult.session.user.clerkId || null,
      identity: {
        resolvedEmail,
        phoneRaw,
        phoneNormalized,
      },
      account: {
        clerkUserId: kioskSessionResult.session.user.clerkId || null,
        created: false,
        requiresSignIn: false,
        hasAvatar: true,
      },
    }
  }

  const identity = resolveContactIdentity({ clerkUser, email: input.email, phone: input.phone })
  if ("status" in identity) {
    return identity
  }

  const allowExistingAccountLookup = Boolean(options.allowExistingAccountLookup)
  if (allowExistingAccountLookup && !userId && options.photoContext === "kiosk_terminal") {
    const terminalAuth = options.terminalAuth || (await authorizeStaffTerminalSession({ touchLastSeen: false }))
    if (!terminalAuth.ok) {
      return {
        status: 401,
        error: "Terminal session required for kiosk checkout preparation.",
      } satisfies ApiError
    }
  }

  let resolvedClerkUser = clerkUser
  let created = false

  if (!resolvedClerkUser && allowExistingAccountLookup) {
    const existing = await findClerkUserByIdentifiers({
      email: identity.resolvedEmail,
      phone: identity.phoneRaw || input.phone,
    })

    if (existing) {
      resolvedClerkUser = existing
    } else {
      try {
        resolvedClerkUser = await ensureClerkUser({
          email: identity.resolvedEmail,
          firstName: input.firstName,
          lastName: input.lastName,
          name: input.name,
          phone: input.phone,
        })
        created = Boolean(resolvedClerkUser)
      } catch (err) {
        console.warn("Clerk user creation failed", err)
        return { status: 502, error: "Unable to create user" } satisfies ApiError
      }
    }
  } else {
    const guestResult = await ensureGuestClerkUser({
      userId: userId || undefined,
      resolvedEmail: identity.resolvedEmail,
      phoneRaw: identity.phoneRaw,
      firstName: input.firstName,
      lastName: input.lastName,
      name: input.name,
      phone: input.phone,
    })
    if ("status" in guestResult && typeof guestResult.status === "number") {
      return guestResult
    }
    resolvedClerkUser = resolvedClerkUser || guestResult.ensuredClerkUser
    created = Boolean(guestResult.ensuredClerkUser && !userId)
  }

  let avatarState = resolveAvatarState(resolvedClerkUser)

  if (avatarState.needsRefresh && resolvedClerkUser?.id) {
    try {
      const client = await clerkClient()
      resolvedClerkUser = await client.users.getUser(resolvedClerkUser.id)
      avatarState = resolveAvatarState(resolvedClerkUser)
    } catch (error) {
      console.warn("Unable to refresh Clerk user before avatar gating", error)
    }
  }

  const hasAvatar = Boolean(avatarState.hasAvatar ?? resolveAvatarState(clerkUser).hasAvatar)

  const resolvedUserId = userId || resolvedClerkUser?.id || null

  return {
    userId: userId || null,
    clerkUser: resolvedClerkUser || null,
    resolvedUserId,
    identity,
    account: {
      clerkUserId: resolvedUserId,
      created,
      requiresSignIn: Boolean(!userId && options.photoContext === "qr_phone"),
      hasAvatar,
    },
  }
}

export const enforceNewStudentRules = async (input: {
  serviceId: string
  safeParticipants: number
  clerkUserForVerification?: ClerkUser | null
  hasVerifiedPhone?: boolean
  resolvedUserId?: string
  resolvedEmail: string
  phoneNormalized: string
}) => {
  if (!NEW_STUDENT_SERVICE_IDS.has(input.serviceId)) return null

  if (input.safeParticipants !== 1) {
    return { status: 400, error: "New student price is limited to 1 participant." } satisfies ApiError
  }
  const verifiedPhone = typeof input.hasVerifiedPhone === "boolean"
    ? input.hasVerifiedPhone
    : hasVerifiedPhone(input.clerkUserForVerification || null)

  if (!verifiedPhone) {
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

export const resolveCheckoutPreparation = async (
  req: Request,
  input: {
    email?: string
    firstName?: string
    lastName?: string
    name?: string
    phone?: string
  },
  options: {
    photoContext?: PhotoFlowContext
    allowExistingAccountLookup?: boolean
    kioskSessionToken?: string
    serviceId?: string
    validation: Pick<CheckoutValidation, "courseSlug" | "date" | "time"> & { durationMinutes?: number | null }
  }
): Promise<ApiError | CheckoutPreparationResolution> => {
  const shouldAttemptPreparedContext =
    options.photoContext === "kiosk_terminal" && Boolean(options.kioskSessionToken) && isPreparedCheckoutContextEnabled()

  if (!shouldAttemptPreparedContext) {
    const preparedAccount = await prepareCheckoutAccount(req, input, {
      photoContext: options.photoContext,
      allowExistingAccountLookup: options.allowExistingAccountLookup,
      kioskSessionToken: options.kioskSessionToken,
      serviceId: options.serviceId,
    })
    if ("status" in preparedAccount) return preparedAccount

    return {
      source: "fallback",
      preparedAccount,
      verification: snapshotPreparedCheckoutVerification({
        hasVerifiedPhone: hasVerifiedPhone(preparedAccount.clerkUser),
      }),
      terminalAuth: null,
      fallbackReason: !isPreparedCheckoutContextEnabled()
        ? PREPARED_CHECKOUT_FALLBACK_REASONS.disabled
        : PREPARED_CHECKOUT_FALLBACK_REASONS.missingKioskSession,
    }
  }

  const terminalAuth = await authorizeStaffTerminalSession()
  if (!terminalAuth.ok) {
    return {
      status: 401,
      error: "Terminal session required for kiosk checkout.",
    }
  }

  const preparedContext = await lookupPreparedCheckoutContext({
    terminalId: terminalAuth.terminal.id,
    kioskSessionId: options.kioskSessionToken as string,
    validation: options.validation,
  })

  if (preparedContext.ok) {
    return {
      source: "prepared",
      preparedAccount: preparedContext.preparedAccount,
      verification: preparedContext.verification,
      terminalAuth,
    }
  }

  const preparedAccount = await prepareCheckoutAccount(req, input, {
    photoContext: options.photoContext,
    allowExistingAccountLookup: options.allowExistingAccountLookup,
    kioskSessionToken: options.kioskSessionToken,
    serviceId: options.serviceId,
    terminalAuth,
    touchKioskSession: false,
  })
  if ("status" in preparedAccount) return preparedAccount

  return {
    source: "fallback",
    preparedAccount,
    verification: snapshotPreparedCheckoutVerification({
      hasVerifiedPhone: hasVerifiedPhone(preparedAccount.clerkUser),
    }),
    terminalAuth,
    fallbackReason: preparedContext.reason,
  }
}

export const clearPreparedCheckoutAfterSuccess = async (input: {
  terminalAuth: Extract<StaffTerminalSessionAuthResult, { ok: true }> | null
  kioskSessionToken?: string
  validation: Pick<CheckoutValidation, "courseSlug" | "date" | "time"> & { durationMinutes?: number | null }
}) => {
  if (!input.terminalAuth || !input.kioskSessionToken || !isPreparedCheckoutContextEnabled()) {
    return
  }

  await deletePreparedCheckoutContext({
    terminalId: input.terminalAuth.terminal.id,
    kioskSessionId: input.kioskSessionToken,
    validation: input.validation,
  })
}

export const enrollStudentPinForCheckout = async (input: EnrollStudentPinInput): Promise<ApiError | { ok: true; dbUserId: string | null }> => {
  if (!isStudentPinLifecycleEnabled()) {
    return { ok: true, dbUserId: null }
  }

  if (!NEW_STUDENT_SERVICE_IDS.has(input.serviceId)) {
    return { ok: true, dbUserId: null }
  }

  if (input.prepareOnly) {
    return { ok: true, dbUserId: null }
  }

  const confirmationError = assertStudentPinConfirmation(input.studentPin || "", input.studentPinConfirm || "")
  if (confirmationError) {
    return confirmationError
  }

  const dbUser = await upsertUserByIdentifiers({
    clerkId: input.resolvedClerkUserId || undefined,
    email: input.resolvedEmail,
    phone: input.phoneNormalized,
    name: input.name,
  })

  if (!dbUser) {
    return { status: 500, error: "Unable to resolve user for PIN enrollment." }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await replacePermanentStudentPin(tx as typeof prisma, {
        userId: dbUser.id,
        nextPin: input.studentPin as string,
      })
    })
    await writeStudentPinAudit({
      userId: dbUser.id,
      action: STUDENT_PIN_AUDIT_ACTIONS.ENROLLED,
      result: "success",
      actorType: "student",
      actorClerkId: input.resolvedClerkUserId || null,
      credentialKind: "permanent",
      metadata: { source: "checkout" },
    })
  } catch (error) {
    if (isStudentPinConflictError(error)) {
      return { status: 409, error: error.message }
    }
    console.error("Student PIN enrollment failed", error)
    return { status: 500, error: "Unable to save student PIN." }
  }

  return { ok: true, dbUserId: dbUser.id }
}
