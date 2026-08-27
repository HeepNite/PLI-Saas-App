import "server-only"

import { auth, clerkClient } from "@clerk/nextjs/server"
import { verifyToken } from "@clerk/backend"
import { resolveAvatarState, type ClerkUser } from "@/lib/clerk-users"
import { resolveTerminalKioskSession, touchKioskIdentificationSession } from "@/lib/checkin/kiosk-session"
import type { PhotoFlowContext } from "@/lib/checkin/photo-context-policy"
import {
  PREPARED_CHECKOUT_FALLBACK_REASONS,
  deletePreparedCheckoutContext,
  isPreparedCheckoutContextEnabled,
  lookupPreparedCheckoutContext,
  snapshotPreparedCheckoutVerification,
} from "@/lib/checkout/prepared-context"
import { createCheckoutExactAccountDependencies } from "@/lib/checkout/exact-identity-adapters"
import { ensureExactAccountIdentity, resolveExactIdentity } from "@/lib/checkout/identity-safety"
import { buildExactPhoneLookup, parseCanonicalPhone, parseServerPhoneInput, type ParsedPhone } from "@/lib/phone"
import { prisma } from "@/lib/prisma"
import { resolveKioskCustomerClerkAuth } from "@/lib/security/kiosk-customer-auth"
import {
  authorizeStaffTerminalSession,
  type StaffTerminalSessionAuthResult,
} from "@/lib/security/staff-terminal"
import { isEmail, type ApiError, type CheckoutBody, type CheckoutValidation } from "@/lib/checkout/validation"
import {
  replacePermanentStudentPin,
  assertStudentPinConfirmation,
  assertStudentPinGlobalUniqueness,
  isStudentPinConflictError,
  isStudentPinLifecycleEnabled,
} from "@/lib/security/student-pin"
import { writeStudentPinAudit, STUDENT_PIN_AUDIT_ACTIONS } from "@/lib/security/student-pin-audit"
import { upsertUserByIdentifiers } from "@/lib/users"
import { SUCCESSFUL_PURCHASE_STATUSES } from "@/lib/purchase-status"

const NEW_STUDENT_SERVICE_IDS = new Set(["new-student"])

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
  preparedContextId?: string
  verification: CheckoutVerification
  terminalAuth: Extract<StaffTerminalSessionAuthResult, { ok: true }> | null
  fallbackReason?: string
}

export const resolveAuthUser = async (
  req: Request
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
    } catch {
      // ignore and fallback
    }
  }

  return { userId, clerkUser }
}

export const resolveContactIdentity = (
  input: { clerkUser: ClerkUser | null; email?: string; phone?: string }
) => parseExactContact({
  email: input.email ?? input.clerkUser?.primaryEmailAddress?.emailAddress,
  phone: input.phone ?? input.clerkUser?.primaryPhoneNumber?.phoneNumber,
})

// ---------------------------------------------------------------------------
// prepareCheckoutAccount helpers
// ---------------------------------------------------------------------------

type PrepareCheckoutOptions = {
  photoContext?: PhotoFlowContext
  allowExistingAccountLookup?: boolean
  kioskSessionToken?: string
  terminalAuth?: Extract<StaffTerminalSessionAuthResult, { ok: true }> | null
  touchKioskSession?: boolean
  serviceId?: string
  deferUserCreation?: boolean
}

type PrepareCheckoutInput = {
  email?: string
  firstName?: string
  lastName?: string
  name?: string
  phone?: string
}

const isExactNewStudentFlow = (options: PrepareCheckoutOptions) =>
  (options.photoContext === "kiosk_terminal" || options.photoContext === "qr_phone") &&
  Boolean(options.serviceId && NEW_STUDENT_SERVICE_IDS.has(options.serviceId))

const parseExactContact = (
  input: Pick<PrepareCheckoutInput, "email" | "phone">
): ApiError | { resolvedEmail: string; phoneRaw: string; phoneNormalized: string; parsedPhone: ParsedPhone } => {
  const resolvedEmail = input.email?.trim().toLowerCase()
  let parsed = null
  try {
    parsed = parseServerPhoneInput(input.phone || "")
  } catch {
    // Fail closed when phone metadata is unavailable.
  }
  if (!resolvedEmail || !isEmail(resolvedEmail)) {
    return { status: 400, error: "Missing or invalid email" } satisfies ApiError
  }
  if (!parsed?.ok) {
    return { status: 400, error: "Missing or invalid phone" } satisfies ApiError
  }
  return {
    resolvedEmail,
    phoneRaw: input.phone!.trim(),
    phoneNormalized: parsed.phone.digits,
    parsedPhone: parsed.phone,
  }
}

/** Resolve the active Clerk user and kiosk customer auth, then determine
 *  the effective userId/clerkUser after kiosk-session preference logic. */
const resolveKioskAwareAuth = async (
  req: Request,
  input: PrepareCheckoutInput,
  options: PrepareCheckoutOptions
) => {
  const authUser = await resolveAuthUser(req)
  const kioskCustomerAuth =
    options.photoContext === "kiosk_terminal"
      ? await resolveKioskCustomerClerkAuth(authUser.userId)
      : null

  const shouldPreferKioskSession =
    options.photoContext === "kiosk_terminal" && Boolean(options.kioskSessionToken)
  const userId = shouldPreferKioskSession
    ? null
    : kioskCustomerAuth
      ? kioskCustomerAuth.userId
      : authUser.userId
  const clerkUser = shouldPreferKioskSession
    ? null
    : kioskCustomerAuth?.clerkUser || authUser.clerkUser

  const isNewStudentKioskFlow = options.serviceId
    ? NEW_STUDENT_SERVICE_IDS.has(options.serviceId)
    : false

  // The blocked check prevents staff from checking out as customers.
  // Skip it when: (a) it's a new-student flow, OR (b) the form provides
  // customer email/phone that differ from the staff's — meaning the staff
  // is operating the kiosk on behalf of a customer, not buying for themselves.
  const isStaffOperatingForCustomer =
    options.photoContext === "kiosk_terminal" &&
    kioskCustomerAuth?.blocked &&
    input.email &&
    clerkUser?.primaryEmailAddress?.emailAddress &&
    input.email.toLowerCase() !== clerkUser.primaryEmailAddress.emailAddress.toLowerCase()

  return { userId, clerkUser, kioskCustomerAuth, isNewStudentKioskFlow, isStaffOperatingForCustomer }
}

/** If the kiosk has an active session token, resolve it and return the
 *  prepared account early — bypassing all other account-resolution logic. */
const resolveKioskSessionAccount = async (
  options: PrepareCheckoutOptions
): Promise<ApiError | PreparedCheckoutAccount | null> => {
  if (options.photoContext !== "kiosk_terminal" || !options.kioskSessionToken) {
    return null
  }

  const kioskSessionResult = await resolveTerminalKioskSession(options.kioskSessionToken, {
    terminalAuth: options.terminalAuth || undefined,
    touch: false,
  })
  if (!kioskSessionResult.ok) {
    return {
      status: kioskSessionResult.status,
      error: kioskSessionResult.error,
    } satisfies ApiError
  }

  const resolvedEmail = kioskSessionResult.session.user.email?.trim().toLowerCase()
  const phoneRaw = kioskSessionResult.session.user.phone || ""
  const clerkId = kioskSessionResult.session.user.clerkId
  let parsedPhone: ParsedPhone | null = null
  let knownClerkUser: ClerkUser | null = null
  try {
    const parsed = parseServerPhoneInput(phoneRaw)
    if (parsed.ok) parsedPhone = parsed.phone
  } catch {
    // Recover only through the exact linked Clerk identity below.
  }

  try {
    const client = await clerkClient()
    if (!parsedPhone && clerkId && /^\d+$/.test(phoneRaw.trim())) {
      knownClerkUser = await client.users.getUser(clerkId)
      const linkedPhone = knownClerkUser.primaryPhoneNumber?.phoneNumber || ""
      const linked = parseCanonicalPhone(linkedPhone)
      if (linked.ok && linked.phone.country !== "US" && linked.phone.digits === phoneRaw.trim()) {
        parsedPhone = linked.phone
      }
    }

    if (!resolvedEmail || !isEmail(resolvedEmail) || !parsedPhone || !clerkId) {
      throw new Error("Incomplete kiosk identity")
    }
    const dependencies = createCheckoutExactAccountDependencies(client, undefined, knownClerkUser)
    const resolution = resolveExactIdentity(await dependencies.readSnapshot({
      email: resolvedEmail,
      phone: buildExactPhoneLookup(parsedPhone),
    }))
    if (
      resolution.kind !== "reused" ||
      resolution.clerkIdentity.id !== clerkId ||
      resolution.localIdentity.id !== kioskSessionResult.session.user.id
    ) {
      throw new Error("Incoherent kiosk identity")
    }
  } catch {
    return {
      status: 409,
      error: "Identified student is missing the required contact data for checkout.",
    } satisfies ApiError
  }

  if (options.touchKioskSession !== false) {
    await touchKioskIdentificationSession(prisma, kioskSessionResult.session.id)
  }

  const phoneNormalized = parsedPhone.digits

  return {
    userId: null,
    clerkUser: null,
    resolvedUserId: kioskSessionResult.session.user.clerkId || null,
    identity: { resolvedEmail, phoneRaw, phoneNormalized },
    account: {
      clerkUserId: kioskSessionResult.session.user.clerkId || null,
      created: false,
      requiresSignIn: false,
      hasAvatar: true,
    },
  }
}

/** Validate terminal auth when an existing-account lookup is requested on
 *  the kiosk and no user session is present. Returns an ApiError or null. */
const assertKioskTerminalAuthForLookup = async (
  userId: string | null | undefined,
  options: PrepareCheckoutOptions,
  kioskCustomerAuthBlocked: boolean | undefined,
  isStaffOperatingForCustomer: boolean | undefined
): Promise<ApiError | null> => {
  const allowExistingAccountLookup = Boolean(options.allowExistingAccountLookup)
  const skipExistingLookupForBlockedStaff = Boolean(
    options.photoContext === "kiosk_terminal" && kioskCustomerAuthBlocked && isStaffOperatingForCustomer
  )

  if (
    allowExistingAccountLookup &&
    !userId &&
    !skipExistingLookupForBlockedStaff &&
    options.photoContext === "kiosk_terminal"
  ) {
    const terminalAuth =
      options.terminalAuth || (await authorizeStaffTerminalSession({ touchLastSeen: false }))
    if (!terminalAuth.ok) {
      return {
        status: 401,
        error: "Terminal session required for kiosk checkout preparation.",
      } satisfies ApiError
    }
  }
  return null
}

const buildDeferredAccount = (
  userId: string | null | undefined,
  clerkUser: ClerkUser | null | undefined,
  identity: { resolvedEmail: string; phoneRaw: string; phoneNormalized: string },
  options: Pick<PrepareCheckoutOptions, "photoContext" | "deferUserCreation">,
  isNewStudentKioskFlow: boolean
): PreparedCheckoutAccount | null => {
  if (!options.deferUserCreation) return null

  // Guard: in kiosk new-student flow, staff Clerk session may leak into
  // userId/clerkUser via resolveAuthUser(). Force all identity fields to null
  // so the prepared account never claims the staff user as the student.
  const isKioskNewStudent = options.photoContext === "kiosk_terminal" && isNewStudentKioskFlow
  const safeUserId = isKioskNewStudent ? null : (userId || null)
  const safeClerkUser = isKioskNewStudent ? null : (clerkUser || null)
  const safeResolvedUserId = isKioskNewStudent ? null : (userId || clerkUser?.id || null)

  return {
    userId: safeUserId,
    clerkUser: safeClerkUser,
    resolvedUserId: safeResolvedUserId,
    identity,
    account: {
      clerkUserId: safeResolvedUserId,
      created: false,
      requiresSignIn: false,
      hasAvatar: isKioskNewStudent ? false : Boolean(resolveAvatarState(clerkUser || null).hasAvatar),
    },
  }
}

/** Refresh the Clerk user object when the avatar state signals it is stale,
 *  then derive the final hasAvatar flag. */
const resolveAvatarForAccount = async (
  resolvedClerkUser: ClerkUser | null,
  fallbackClerkUser: ClerkUser | null
): Promise<{ clerkUser: ClerkUser | null; hasAvatar: boolean }> => {
  let current = resolvedClerkUser
  let avatarState = resolveAvatarState(current)

  if (avatarState.needsRefresh && current?.id) {
    try {
      const client = await clerkClient()
      current = await client.users.getUser(current.id)
      avatarState = resolveAvatarState(current)
    } catch (error) {
      console.warn("Unable to refresh Clerk user before avatar gating", error)
    }
  }

  const hasAvatar = Boolean(avatarState.hasAvatar ?? resolveAvatarState(fallbackClerkUser).hasAvatar)
  return { clerkUser: current, hasAvatar }
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

export const prepareCheckoutAccount = async (
  req: Request,
  input: PrepareCheckoutInput,
  options: PrepareCheckoutOptions = {}
): Promise<ApiError | PreparedCheckoutAccount> => {
  const exactNewStudentFlow = isExactNewStudentFlow(options)
  const exactNewStudentIdentity = exactNewStudentFlow ? parseExactContact(input) : null
  if (exactNewStudentIdentity && "status" in exactNewStudentIdentity) return exactNewStudentIdentity

  // Phase 1 — Auth + kiosk customer auth
  const { userId, clerkUser, kioskCustomerAuth, isNewStudentKioskFlow, isStaffOperatingForCustomer } =
    await resolveKioskAwareAuth(req, input, options)

  if (
    options.photoContext === "kiosk_terminal" &&
    kioskCustomerAuth?.blocked &&
    !options.kioskSessionToken &&
    !isNewStudentKioskFlow &&
    !isStaffOperatingForCustomer
  ) {
    return {
      status: 401,
      error: "Kiosk customer identification is required before checkout.",
    } satisfies ApiError
  }

  // Phase 2 — Kiosk session token early return
  const kioskSessionAccount = await resolveKioskSessionAccount(options)
  if (kioskSessionAccount !== null) return kioskSessionAccount

  // Phase 3 — Strict contact identity + terminal auth guard
  const skipAmbientIdentity = exactNewStudentFlow || Boolean(isStaffOperatingForCustomer)
  const identityClerkUser = skipAmbientIdentity ? null : clerkUser
  let exactContact: ReturnType<typeof parseExactContact> | null = exactNewStudentIdentity
  try {
    exactContact ||= resolveContactIdentity({ clerkUser: identityClerkUser, email: input.email, phone: input.phone })
  } catch { return { status: 400, error: "Missing or invalid phone" } satisfies ApiError }
  if ("status" in exactContact) return exactContact
  const { parsedPhone, ...identity } = exactContact

  const terminalAuthError = await assertKioskTerminalAuthForLookup(
    userId,
    options,
    kioskCustomerAuth?.blocked,
    Boolean(isStaffOperatingForCustomer)
  )
  if (terminalAuthError) return terminalAuthError

  if (exactNewStudentFlow) {
    if (options.deferUserCreation) {
      return {
        userId: null,
        clerkUser: null,
        resolvedUserId: null,
        identity,
        account: { clerkUserId: null, created: false, requiresSignIn: false, hasAvatar: false },
      }
    }

    const creation = { occurred: false }
    try {
      const client = await clerkClient()
      const exactAccount = await ensureExactAccountIdentity({
        email: identity.resolvedEmail,
        phone: exactNewStudentIdentity!.parsedPhone.e164,
        firstName: input.firstName,
        lastName: input.lastName,
        name: input.name,
      }, createCheckoutExactAccountDependencies(client, creation))
      if (!exactAccount.ok) {
        return {
          status: exactAccount.code === "INVALID_CONTACT" ? 400 : 409,
          error: exactAccount.code === "INVALID_CONTACT"
            ? "Missing or invalid contact details"
            : "Contact details are already linked to another account.",
        } satisfies ApiError
      }
      const avatar = await resolveAvatarForAccount(exactAccount.clerkIdentity, null)
      return {
        userId: null,
        clerkUser: avatar.clerkUser,
        resolvedUserId: exactAccount.clerkIdentity.id,
        identity,
        account: {
          clerkUserId: exactAccount.clerkIdentity.id,
          created: creation.occurred,
          requiresSignIn: false,
          hasAvatar: avatar.hasAvatar,
        },
      }
    } catch (error) {
      console.warn("Exact checkout account preparation failed", error)
      return { status: 502, error: "Unable to prepare student account" } satisfies ApiError
    }
  }

  let resolvedClerkUser: ClerkUser | null = null
  const creation = { occurred: false }
  try {
    const client = await clerkClient()
    const dependencies = createCheckoutExactAccountDependencies(client, creation, identityClerkUser)
    if (options.deferUserCreation) {
      const resolution = resolveExactIdentity(await dependencies.readSnapshot({
        email: identity.resolvedEmail, phone: buildExactPhoneLookup(parsedPhone),
      }))
      if (resolution.kind === "conflict") {
        return { status: 409, error: "Contact details are already linked to another account." } satisfies ApiError
      }
      resolvedClerkUser = resolution.clerkIdentity
    } else {
      const exactAccount = await ensureExactAccountIdentity({
        email: identity.resolvedEmail,
        phone: parsedPhone.e164,
        firstName: input.firstName,
        lastName: input.lastName,
        name: input.name,
      }, dependencies)
      if (!exactAccount.ok) {
        return {
          status: exactAccount.code === "INVALID_CONTACT" ? 400 : 409,
          error: exactAccount.code === "INVALID_CONTACT"
            ? "Missing or invalid contact details"
            : "Contact details are already linked to another account.",
        } satisfies ApiError
      }
      resolvedClerkUser = exactAccount.clerkIdentity
    }
    const authenticatedClerkId = skipAmbientIdentity ? null : (identityClerkUser?.id || userId)
    if (authenticatedClerkId && resolvedClerkUser?.id !== authenticatedClerkId) {
      return { status: 409, error: "Contact details are already linked to another account." } satisfies ApiError
    }
  } catch (error) {
    console.warn("Exact checkout account preparation failed", error)
    return { status: 502, error: "Unable to prepare account" } satisfies ApiError
  }

  if (!resolvedClerkUser) {
    const deferredAccount = buildDeferredAccount(userId, clerkUser, identity, options, isNewStudentKioskFlow)
    if (deferredAccount) return deferredAccount
  }

  // Phase 5 — Avatar refresh + final result assembly
  const { clerkUser: refreshedClerkUser, hasAvatar } = await resolveAvatarForAccount(
    resolvedClerkUser,
    identityClerkUser
  )
  resolvedClerkUser = refreshedClerkUser

  const resolvedUserId = (skipAmbientIdentity ? null : userId) || resolvedClerkUser?.id || null

  return {
    userId: skipAmbientIdentity ? null : (userId || null),
    clerkUser: resolvedClerkUser || null,
    resolvedUserId,
    identity,
    account: {
      clerkUserId: resolvedUserId,
      created: creation.occurred,
      requiresSignIn: Boolean(!userId && options.photoContext === "qr_phone" && !isNewStudentKioskFlow),
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
    where: { OR: or, status: { in: SUCCESSFUL_PURCHASE_STATUSES } },
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
    deferUserCreation?: boolean
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
      deferUserCreation: options.deferUserCreation,
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
      preparedContextId: preparedContext.rowId,
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
    deferUserCreation: options.deferUserCreation,
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

  // Check PIN availability BEFORE creating/updating user to prevent
  // persisting user data when PIN enrollment will fail
  try {
    await assertStudentPinGlobalUniqueness(prisma, { nextPin: input.studentPin as string })
  } catch (err) {
    if (isStudentPinConflictError(err)) {
      return { status: 409, error: "This PIN is already in use. Please choose a different one." }
    }
    throw err
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
