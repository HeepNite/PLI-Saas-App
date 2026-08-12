import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import Stripe from "stripe"
import { clerkClient } from "@clerk/nextjs/server"
import { ensureClerkUser, findClerkUserByIdentifiers, updateClerkUserIfMissing, type ClerkUser } from "@/lib/clerk-users"
import { authorizeStudentOperationalRequest, type StaffPortalAuthResult } from "@/lib/security/staff-portal-auth"
import { buildRateLimitKey, getClientIp } from "@/lib/security/rate-limit"
import { withStaffGuard } from "@/lib/security/with-staff-guard"
import { upsertUserByIdentifiers, wasUserCreatedByUpsert } from "@/lib/users"
import { prisma } from "@/lib/prisma"
import { writeStudentDataAudit, type WriteStudentDataAuditParams } from "@/lib/audit/student-data-audit"
import { reservePackageCreditForAttendanceTx } from "@/lib/packages"
import { ensureAttendancePackagePurchase } from "@/lib/purchase-attendance"
import { PURCHASE_SOURCE } from "@/lib/payment-constants"
import { findSelectableClassSessions, isSelectableSessionDateKey, isValidSessionDateKey, materializeSelectableClassSession } from "./sessions/selectable-sessions"
import { safeOptionalText as safeText } from "@/lib/api-helpers"
import { consumeRecoveryTicket, normalizeRecoveryCode, releaseRecoveryTicket, reserveRecoveryTicket } from "@/lib/student-recovery"

const stripeSecret = process.env.STRIPE_SECRET_KEY
const stripe = stripeSecret
  ? new Stripe(stripeSecret, { apiVersion: "2026-01-28.clover" })
  : null

export const runtime = "nodejs"

const PAYMENT_MODES = new Set(["cash", "card_qr"])
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type StaffCreateStudentPayload = {
  email?: string
  phone?: string
  name?: string
  amountCents: number
  paymentMode?: "cash" | "card_qr"
  note?: string
  checkIn?: {
    enabled: boolean
    sessionId?: string
    date?: string
  }
}

type ParseResult =
  | { ok: true; payload: StaffCreateStudentPayload }
  | { ok: false; error: string }

const safeCheckInDateText = (value: unknown) => {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

const parseAmountCents = (value: unknown): number | null => {
  if (value === undefined || value === null || value === "") return 0
  if (typeof value !== "number" || !Number.isInteger(value) || !Number.isFinite(value)) return null
  return value
}

const normalizeStaffPhone = (value: string | undefined) => {
  if (!value) return undefined
  const trimmed = value.trim()
  const digits = value.replace(/\D/g, "")

  if (trimmed.startsWith("+")) {
    return /^\+[\d\s().-]+$/.test(trimmed) && /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null
  }

  return /^\d{10}$/.test(digits) ? `+1${digits}` : null
}

const parsePayload = (body: unknown): ParseResult => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid JSON body" }
  }

  const record = body as Record<string, unknown>
  const email = safeText(record.email, 254)?.toLowerCase()
  const phoneInput = safeText(record.phone, 32)
  const phone = normalizeStaffPhone(phoneInput)
  const name = safeText(record.name, 120)
  const note = safeText(record.note, 500)
  const attendanceSessionId = safeText(record.attendanceSessionId, 120)
  const checkInRecord = record.checkIn && typeof record.checkIn === "object" && !Array.isArray(record.checkIn)
    ? record.checkIn as Record<string, unknown>
    : null
  const checkInEnabled = checkInRecord ? checkInRecord.enabled === true : Boolean(attendanceSessionId)
  const checkInSessionId = safeText(checkInRecord?.sessionId, 120) || attendanceSessionId
  const checkInDate = safeCheckInDateText(checkInRecord?.date)

  if (email && !EMAIL_PATTERN.test(email)) {
    return { ok: false, error: "Invalid email." }
  }
  if (phoneInput && !phone) {
    return { ok: false, error: "Enter a valid phone number: a 10-digit US number, or include the country code with + for international (for example +5491123456789)." }
  }
  if (!email && !phone) {
    return { ok: false, error: "Provide an email or phone number." }
  }

  const amountCents = parseAmountCents(record.amountCents)
  if (amountCents === null) {
    return { ok: false, error: "Amount must be an integer number of cents." }
  }
  if (amountCents < 0) {
    return { ok: false, error: "Amount must be zero or greater." }
  }

  const paymentMode = safeText(record.paymentMode, 20)
  if (amountCents > 0 && !paymentMode) {
    return { ok: false, error: "Payment mode is required when amount is greater than zero." }
  }
  if (paymentMode && !PAYMENT_MODES.has(paymentMode)) {
    return { ok: false, error: "Payment mode must be cash or card_qr." }
  }
  if (checkInEnabled && !checkInSessionId) {
    return { ok: false, error: "Select a class session for check-in." }
  }
  if (checkInEnabled && checkInDate && (checkInDate.length > 64 || !isValidSessionDateKey(checkInDate))) {
    return { ok: false, error: "Invalid check-in date. Use YYYY-MM-DD." }
  }

  return {
    ok: true,
    payload: {
      email,
      phone: phone ?? undefined,
      name,
      amountCents,
      paymentMode: paymentMode as "cash" | "card_qr" | undefined,
      note,
      checkIn: checkInEnabled ? { enabled: true, sessionId: checkInSessionId, date: checkInDate } : undefined,
    },
  }
}

const fullNameFromClerkUser = (user: ClerkUser, fallback?: string) => {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim()
  return fullName || fallback
}

const emailFromClerkUser = (user: ClerkUser, fallback?: string) =>
  user.emailAddresses?.[0]?.emailAddress?.toLowerCase() || fallback

const phoneFromClerkUser = (user: ClerkUser, fallback?: string) =>
  user.phoneNumbers?.[0]?.phoneNumber || fallback

const clerkErrorStatus = (error: unknown) => {
  if (!error || typeof error !== "object") return undefined
  const record = error as Record<string, unknown>
  const status = record.status ?? record.statusCode
  return typeof status === "number" ? status : undefined
}

const describeClerkIdentityFailure = (error: unknown) => {
  const status = clerkErrorStatus(error)
  if (status === 400 || status === 422) {
    return {
      status: 400,
      error: "Unable to create student identity with the provided email or phone. Please check the contact details.",
    }
  }

  return {
    status: 503,
    error: "Student identity service is temporarily unavailable. Please try again.",
  }
}

const maybeSendEmailInvitation = async (req: Request, email?: string) => {
  if (!email) return false
  const client = await clerkClient()
  const requestUrl = new URL(req.url)
  const redirectUrl = `${requestUrl.origin}/profile`
  try {
    await client.invitations.createInvitation({
      emailAddress: email,
      notify: true,
      ignoreExisting: true,
      redirectUrl,
    })
    return true
  } catch (error) {
    console.warn("Student invitation creation failed", error)
    return false
  }
}

type PurchaseDelegate = Pick<typeof prisma.purchase, "create">

const createCashPurchase = async (
  purchaseDelegate: PurchaseDelegate,
  userId: string,
  amountCents: number,
  note?: string,
  attendanceId?: string
) => {
  return purchaseDelegate.create({
    data: {
      userId,
      courseSlug: "_staff_registration",
      courseTitle: "Staff Registration",
      amount: amountCents,
      currency: "usd",
      status: "pending",
      metadata: {
        source: "staff_created_student",
        paymentMode: "cash",
        paymentChannel: "cash",
        settlementStatus: "pending",
        isRegistrationDeposit: true,
        staffNote: note ?? null,
        attendanceId: attendanceId ?? null,
      },
    },
  })
}

const createCardQrPurchaseRecord = async (
  purchaseDelegate: PurchaseDelegate,
  userId: string,
  amountCents: number,
  note?: string,
  attendanceId?: string,
  idempotencyKey?: string,
) => {
  return purchaseDelegate.create({
    data: {
      userId,
      courseSlug: "_staff_registration",
      courseTitle: "Staff Registration",
      amount: amountCents,
      currency: "usd",
      status: "pending",
      idempotencyKey,
      metadata: {
        source: "staff_created_student",
        paymentMode: "card_qr",
        paymentChannel: "card",
        settlementStatus: "pending",
        isRegistrationDeposit: true,
        staffNote: note ?? null,
        attendanceId: attendanceId ?? null,
      },
    },
  })
}

const createStripeCheckoutUrl = async (
  purchase: { id: string },
  userId: string,
  amountCents: number,
  req: Request,
  idempotencyKey?: string,
) => {

  if (!stripe) {
    return undefined
  }

  const requestUrl = new URL(req.url)
  const baseUrl = requestUrl.origin
  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 60

  const checkoutParams: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: {
            name: "Staff Registration",
            description: "Registration deposit",
          },
        },
      },
    ],
    success_url: `${baseUrl}/staff?payment=success`,
    cancel_url: `${baseUrl}/staff?payment=cancel`,
    expires_at: expiresAt,
    metadata: {
      purchaseId: purchase.id,
      userId,
      source: "staff_created_student",
      isRegistrationDeposit: "true",
    },
  }
  const session = idempotencyKey
    ? await stripe.checkout.sessions.create(checkoutParams, { idempotencyKey })
    : await stripe.checkout.sessions.create(checkoutParams)

  return session.url ?? undefined
}

const writeProfileCreationAudit = async (
  targetUserId: string,
  authResult: Extract<StaffPortalAuthResult, { ok: true }>
) => {
  await writeStudentDataAudit({
    targetUserId,
    staffClerkId: authResult.userId,
    staffName: authResult.staffName,
    entity: "profile",
    field: "created",
    valueBefore: null,
    valueAfter: "created",
    reason: "Student created by staff",
  })
}

const writePaymentCreationAudit = async (
  targetUserId: string,
  purchaseId: string,
  amountCents: number,
  paymentMode: string,
  authResult: Extract<StaffPortalAuthResult, { ok: true }>
) => {
  await writeStudentDataAudit({
    targetUserId,
    staffClerkId: authResult.userId,
    staffName: authResult.staffName,
    entity: "payment",
    entityId: purchaseId,
    field: "created",
    valueBefore: null,
    valueAfter: { amount: amountCents, mode: paymentMode },
    reason: "Registration deposit recorded by staff",
  })
}

const writeRecoveryAudit = async (
  targetUserId: string,
  correlationId: string,
  authResult: Extract<StaffPortalAuthResult, { ok: true }>,
  tx?: Prisma.TransactionClient
) => {
  await writeStudentDataAudit({
    targetUserId,
    staffClerkId: authResult.userId,
    staffName: authResult.staffName,
    entity: "profile",
    field: "sms_recovery_confirmed",
    valueBefore: null,
    valueAfter: { correlationId, noSmsConfirmed: true, phoneValidated: true },
    reason: "Staff-confirmed SMS verification recovery",
  }, tx)
}

const verifyRecoveryPhone = async (clerkUser: ClerkUser, phone: string) => {
  const phoneNumber = clerkUser.phoneNumbers.find((item) => item.phoneNumber === phone)
  if (!phoneNumber || phoneNumber.verification?.status === "verified") return
  const client = await clerkClient()
  await client.phoneNumbers.updatePhoneNumber(phoneNumber.id, { verified: true })
}

const findUsablePackageTx = async (
  tx: Prisma.TransactionClient,
  userId: string,
  courseSlug: string,
  now: Date
) => {
  const packages = await tx.packagePurchase.findMany({
    where: {
      userId,
      status: "active",
      AND: [
        {
          OR: [
            { courseSlug },
            { packagePlan: { courseSlugs: { has: courseSlug } } },
            { courseSlug: null, packagePlanId: null },
          ],
        },
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        { OR: [{ isUnlimited: true, remainingCredits: null }, { remainingCredits: { gt: 0 } }] },
      ],
    },
    select: {
      id: true,
      packageId: true,
      packageLabel: true,
      courseSlug: true,
      isUnlimited: true,
      remainingCredits: true,
      expiresAt: true,
      status: true,
      packagePlan: { select: { courseSlugs: true } },
    },
    orderBy: [{ expiresAt: "asc" }, { purchasedAt: "desc" }],
    take: 1,
  })
  return packages[0] || null
}

const createManualAttendanceTx = async (
  tx: Prisma.TransactionClient,
  input: {
    user: { id: string; email?: string | null; name?: string | null; phone?: string | null }
    sessionId: string
    date?: string
    staffUserId: string
  }
) => {
  const now = new Date()
  const session = await materializeSelectableClassSession(tx, now, input.sessionId, input.date)
  if (!session) {
    return { ok: false as const, status: 400, error: "Selected class session is not available for staff check-in." }
  }

  const existingAttendance = await tx.attendance.findUnique({
    where: { userId_sessionId: { userId: input.user.id, sessionId: session.id } },
    select: { id: true },
  })
  if (existingAttendance) {
    return { ok: false as const, status: 409, error: "Student is already checked in for this class session." }
  }

  const selectedPackage = await findUsablePackageTx(tx, input.user.id, session.courseSlug, now)
  const attendance = await tx.attendance.create({
    data: {
      userId: input.user.id,
      sessionId: session.id,
      status: selectedPackage ? "checked_in" : "checked_in_no_package",
      checkedInAt: now,
      metadata: {
        source: "staff_created_student",
        staffUserId: input.staffUserId,
      },
    },
  })

  if (selectedPackage) {
    const reserveResult = await reservePackageCreditForAttendanceTx(tx, {
      packagePurchaseId: selectedPackage.id,
      userId: input.user.id,
      attendanceId: attendance.id,
      courseSlug: session.courseSlug,
      at: now,
      reason: "STAFF_CREATED_STUDENT_CHECK_IN",
    })
    const packagePurchase = reserveResult.packagePurchase || selectedPackage
    const startsAtIso = session.startsAt.toISOString()
    await ensureAttendancePackagePurchase(tx, {
      attendanceId: attendance.id,
      userId: input.user.id,
      courseSlug: session.courseSlug,
      courseTitle: session.title || session.courseSlug,
      email: input.user.email || null,
      name: input.user.name || null,
      phone: input.user.phone || null,
      packageId: packagePurchase.packageId,
      packagePurchaseId: packagePurchase.id,
      source: "staff_created_student",
      purchaseSource: PURCHASE_SOURCE.FRONT_DESK,
      date: input.date || startsAtIso.slice(0, 10),
      time: startsAtIso.slice(11, 16),
    })
  }

  return { ok: true as const, attendance }
}

const createOrReuseStudentIdentity = async (payload: StaffCreateStudentPayload, req: Request) => {
  let existingClerkUser: ClerkUser | null
  let clerkUser: ClerkUser | null

  try {
    existingClerkUser = await findClerkUserByIdentifiers({ email: payload.email, phone: payload.phone })
    clerkUser = existingClerkUser || await ensureClerkUser({
      email: payload.email,
      phone: payload.phone,
      name: payload.name,
    })

    if (existingClerkUser) {
      await updateClerkUserIfMissing(existingClerkUser, {
        email: payload.email,
        phone: payload.phone,
        name: payload.name,
      })
    }
  } catch (error) {
    console.warn("Clerk student identity operation failed", error)
    return { ok: false as const, ...describeClerkIdentityFailure(error) }
  }

  if (!clerkUser) {
    return { ok: false as const, error: "Student identity service is temporarily unavailable. Please try again.", status: 503 }
  }

  const localUser = await upsertUserByIdentifiers({
    clerkId: clerkUser.id,
    email: emailFromClerkUser(clerkUser, payload.email),
    phone: phoneFromClerkUser(clerkUser, payload.phone),
    name: fullNameFromClerkUser(clerkUser, payload.name),
    nameIsCanonical: false,
  })

  if (!localUser) {
    return { ok: false as const, error: "Student identity service is temporarily unavailable. Please try again.", status: 503 }
  }

  const emailInvitationAttempted = await maybeSendEmailInvitation(req, payload.email)

  return {
    ok: true as const,
    localUser,
    clerkUser,
    isExisting: Boolean(existingClerkUser),
    activation: {
      emailInvitationAttempted,
      phoneSignInAvailable: Boolean(payload.phone),
    },
  }
}

export async function POST(req: Request) {
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:students:create", limit: 30, windowMs: 60_000 },
    authorize: () => authorizeStudentOperationalRequest(),
  })
  if (!guard.ok) return guard.response
  const authResult = guard.auth

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = parsePayload(body)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const now = new Date()
  if (parsed.payload.checkIn?.date && !isSelectableSessionDateKey(parsed.payload.checkIn.date, now)) {
    return NextResponse.json({ error: "Check-in date must be today or within the last 14 days." }, { status: 400 })
  }

  if (parsed.payload.checkIn?.enabled) {
    const selectableSessions = await findSelectableClassSessions(prisma, now, parsed.payload.checkIn.date)
    const isSelectableSession = selectableSessions.some((session) => (
      session.id === parsed.payload.checkIn?.sessionId
        || ("syntheticId" in session && session.syntheticId === parsed.payload.checkIn?.sessionId)
    ))
    if (!isSelectableSession) {
      return NextResponse.json({ error: "Selected class session is not available for staff check-in." }, { status: 400 })
    }
  }

  const recoveryToken = body && typeof body === "object"
    ? normalizeRecoveryCode((body as Record<string, unknown>).recoveryTicket)
    : null
  const recovery = recoveryToken === null ? null : await reserveRecoveryTicket(recoveryToken, authResult.userId)
  if (recoveryToken && !recovery) {
    return NextResponse.json({ error: "Recovery authorization is unavailable." }, { status: 400 })
  }

  const releaseRecovery = async () => {
    if (recovery) await releaseRecoveryTicket(recovery.ticketId)
  }

  const identityPayload = recovery
    ? { ...parsed.payload, phone: recovery.draft.phone, email: recovery.draft.email || undefined, name: recovery.draft.name || undefined }
    : parsed.payload

  let identity: Awaited<ReturnType<typeof createOrReuseStudentIdentity>>
  try {
    identity = await createOrReuseStudentIdentity(identityPayload, req)
  } catch {
    await releaseRecovery()
    return NextResponse.json({ error: "Student identity service is temporarily unavailable. Please try again." }, { status: 503 })
  }
  if (!identity.ok) {
    await releaseRecovery()
    return NextResponse.json({ error: identity.error }, { status: identity.status })
  }

  if (recovery) {
    try {
      await verifyRecoveryPhone(identity.clerkUser, recovery.draft.phone)
    } catch {
      await releaseRecovery()
      return NextResponse.json({ error: "Student identity service is temporarily unavailable. Please try again." }, { status: 503 })
    }
  }

  const { amountCents, paymentMode, note } = parsed.payload
  const deferRecoveryConsumption = Boolean(recovery && amountCents > 0 && paymentMode === "card_qr")
  let purchase: { id: string } | undefined
  let attendanceId: string | undefined
  let stripeCheckoutUrl: string | undefined

  try {
    const result = await prisma.$transaction(async (tx) => {
      const attendanceResult = parsed.payload.checkIn?.enabled
        ? await createManualAttendanceTx(tx, {
            user: identity.localUser,
            sessionId: parsed.payload.checkIn.sessionId || "",
            date: parsed.payload.checkIn.date,
            staffUserId: authResult.userId,
          })
        : null

      if (attendanceResult && !attendanceResult.ok) {
        return attendanceResult
      }

      if (recovery && deferRecoveryConsumption) {
        const existingPurchase = await tx.purchase.findUnique({
          where: { idempotencyKey: recovery.ticketId },
          select: { id: true, metadata: true },
        })
        if (existingPurchase) {
          const metadata = existingPurchase.metadata
          const reusedAttendanceId = metadata && typeof metadata === "object" && !Array.isArray(metadata)
            && typeof (metadata as Record<string, unknown>).attendanceId === "string"
            ? (metadata as Record<string, unknown>).attendanceId as string
            : undefined
          return { ok: true as const, attendanceId: reusedAttendanceId, purchase: existingPurchase }
        }
      }

      if (recovery && !deferRecoveryConsumption) {
        if (!await consumeRecoveryTicket(recovery.ticketId, recovery.draftId, tx)) {
          return { ok: false as const, status: 400, error: "Recovery authorization is unavailable." }
        }
        await writeRecoveryAudit(identity.localUser.id, recovery.correlationId, authResult, tx)
      }

      const resolvedAttendanceId = attendanceResult?.attendance.id
      let createdPurchase: { id: string } | undefined

      if (amountCents > 0 && paymentMode === "cash") {
        createdPurchase = await createCashPurchase(tx.purchase, identity.localUser.id, amountCents, note, resolvedAttendanceId)
      } else if (amountCents > 0 && paymentMode === "card_qr") {
        createdPurchase = await createCardQrPurchaseRecord(
          tx.purchase,
          identity.localUser.id,
          amountCents,
          note,
          resolvedAttendanceId,
          deferRecoveryConsumption && recovery ? recovery.ticketId : undefined,
        )
      }

      return { ok: true as const, attendanceId: resolvedAttendanceId, purchase: createdPurchase }
    })

    if (!result.ok) {
      await releaseRecovery()
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    attendanceId = result.attendanceId
    purchase = result.purchase
  } catch (error) {
    await releaseRecovery()
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Student is already checked in for this class session." }, { status: 409 })
    }
    throw error
  }

  try {
    if (wasUserCreatedByUpsert(identity.localUser)) {
      await writeProfileCreationAudit(identity.localUser.id, authResult)
    }

    if (purchase && amountCents > 0 && paymentMode) {
      await writePaymentCreationAudit(identity.localUser.id, purchase.id, amountCents, paymentMode, authResult)
      if (paymentMode === "card_qr") {
        stripeCheckoutUrl = await createStripeCheckoutUrl(
          purchase,
          identity.localUser.id,
          amountCents,
          req,
          recovery && deferRecoveryConsumption ? recovery.ticketId : undefined,
        )
        if (recovery && deferRecoveryConsumption) {
          await prisma.$transaction(async (tx) => {
            if (!await consumeRecoveryTicket(recovery.ticketId, recovery.draftId, tx)) {
              throw new Error("Recovery authorization is unavailable.")
            }
            await writeRecoveryAudit(identity.localUser.id, recovery.correlationId, authResult, tx)
          })
        }
      }
    }
  } catch (error) {
    await releaseRecovery()
    if (recovery) {
      return NextResponse.json({ error: "Student creation could not be completed. Please try again." }, { status: 503 })
    }
    throw error
  }

  return NextResponse.json({
    userId: identity.localUser.id,
    clerkUserId: identity.clerkUser.id,
    isExisting: identity.isExisting,
    purchaseId: purchase?.id,
    attendanceId,
    paymentMode: amountCents > 0 ? paymentMode : undefined,
    stripeCheckoutUrl,
    activation: identity.activation,
  }, { status: 201 })
}
