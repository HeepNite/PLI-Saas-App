import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import Stripe from "stripe"
import { clerkClient } from "@clerk/nextjs/server"
import { ensureClerkUser, findClerkUserByIdentifiers, updateClerkUserIfMissing, type ClerkUser } from "@/lib/clerk-users"
import { authorizeStudentOperationalRequest, type StaffPortalAuthResult } from "@/lib/security/staff-portal-auth"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { upsertUserByIdentifiers, wasUserCreatedByUpsert } from "@/lib/users"
import { prisma } from "@/lib/prisma"
import { writeStudentDataAudit, type WriteStudentDataAuditParams } from "@/lib/audit/student-data-audit"
import { reservePackageCreditForAttendanceTx } from "@/lib/packages"
import { getNewYorkDateKey, isSelectableStudentSessionDate, isValidStudentSessionDate } from "./sessions/shared"
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
  checkIn?: { enabled: true; sessionId: string; date: string }
}

type ParseResult =
  | { ok: true; payload: StaffCreateStudentPayload }
  | { ok: false; error: string }

const safeText = (value: unknown, max = 120) => {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim().slice(0, max)
  return trimmed || undefined
}

const parseAmountCents = (value: unknown): number | null => {
  if (value === undefined || value === null || value === "") return 0
  if (typeof value !== "number" || !Number.isInteger(value) || !Number.isFinite(value)) return null
  return value
}

const parsePayload = (body: unknown): ParseResult => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid JSON body" }
  }

  const record = body as Record<string, unknown>
  const email = safeText(record.email, 254)?.toLowerCase()
  const phone = safeText(record.phone, 32)
  const name = safeText(record.name, 120)
  const note = safeText(record.note, 500)
  const checkIn = record.checkIn && typeof record.checkIn === "object" && !Array.isArray(record.checkIn)
    ? record.checkIn as Record<string, unknown>
    : null

  if (!email && !phone) {
    return { ok: false, error: "Provide an email or phone number." }
  }
  if (email && !EMAIL_PATTERN.test(email)) {
    return { ok: false, error: "Invalid email." }
  }
  if (phone && !phone.startsWith("+")) {
    return { ok: false, error: "Phone must use E.164 format." }
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
  if (checkIn?.enabled === true) {
    const sessionId = safeText(checkIn.sessionId, 120)
    const date = safeText(checkIn.date, 10)
    if (!sessionId) return { ok: false, error: "Select a class session for check-in." }
    if (!date || !isValidStudentSessionDate(date)) return { ok: false, error: "Invalid check-in date. Use YYYY-MM-DD." }
    return { ok: true, payload: { email, phone, name, amountCents, paymentMode: paymentMode as "cash" | "card_qr" | undefined, note, checkIn: { enabled: true, sessionId, date } } }
  }

  return {
    ok: true,
    payload: {
      email,
      phone,
      name,
      amountCents,
      paymentMode: paymentMode as "cash" | "card_qr" | undefined,
      note,
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
  } catch {
    console.warn("Student invitation creation failed")
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

const createStripeCheckout = async (
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

  return { id: session.id, url: session.url ?? undefined }
}

const writeProfileCreationAudit = async (
  targetUserId: string,
  authResult: Extract<StaffPortalAuthResult, { ok: true }>,
  tx?: Prisma.TransactionClient,
  ipAddress?: string
) => {
  const audit: WriteStudentDataAuditParams = {
    targetUserId,
    staffClerkId: authResult.userId,
    staffName: authResult.staffName,
    entity: "profile",
    field: "created",
    valueBefore: null,
    valueAfter: "created",
    reason: "Student created by staff",
    ipAddress,
  }
  if (tx) await writeStudentDataAudit(audit, tx)
  else await writeStudentDataAudit(audit)
}

const createHistoricalAttendanceTx = async (
  tx: Prisma.TransactionClient,
  input: {
    userId: string
    sessionId: string
    date: string
    auth: Extract<StaffPortalAuthResult, { ok: true }>
    ipAddress: string
  }
) => {
  const session = await tx.classSession.findUnique({
    where: { id: input.sessionId },
    select: { id: true, courseSlug: true, title: true, startsAt: true },
  })
  if (!session || !isSelectableStudentSessionDate(input.date) || getNewYorkDateKey(session.startsAt) !== input.date) {
    return { ok: false as const, status: 400, error: "Selected class session is not available for staff check-in." }
  }

  const existing = await tx.attendance.findUnique({
    where: { userId_sessionId: { userId: input.userId, sessionId: session.id } },
    select: { id: true },
  })
  if (existing) return { ok: false as const, status: 409, error: "Student is already checked in for this class session." }

  const selectedPackage = await tx.packagePurchase.findFirst({
    where: {
      userId: input.userId,
      status: "active",
      purchasedAt: { lte: session.startsAt },
      OR: [{ expiresAt: null }, { expiresAt: { gt: session.startsAt } }],
      AND: [{ OR: [{ courseSlug: null, packagePlanId: null }, { courseSlug: session.courseSlug }, { packagePlan: { courseSlugs: { has: session.courseSlug } } }] }, { OR: [{ isUnlimited: true, remainingCredits: null }, { remainingCredits: { gt: 0 } }] }],
    },
    orderBy: [{ expiresAt: "asc" }, { purchasedAt: "desc" }],
  })
  const attendance = await tx.attendance.create({
    data: {
      userId: input.userId,
      sessionId: session.id,
      status: selectedPackage ? "checked_in" : "checked_in_no_package",
      checkedInAt: session.startsAt,
      metadata: { source: "staff_created_student", staffUserId: input.auth.userId },
    },
  })
  if (selectedPackage) await reservePackageCreditForAttendanceTx(tx, {
    packagePurchaseId: selectedPackage.id,
    userId: input.userId,
    attendanceId: attendance.id,
    courseSlug: session.courseSlug,
    at: session.startsAt,
    reason: "STAFF_CREATED_STUDENT_CHECK_IN",
  })
  await writeStudentDataAudit({
    targetUserId: input.userId,
    staffClerkId: input.auth.userId,
    staffName: input.auth.staffName,
    entity: "attendance",
    entityId: attendance.id,
    field: "checked_in",
    valueBefore: null,
    valueAfter: { sessionId: session.id, checkedInAt: session.startsAt.toISOString() },
    reason: "Class check-in assigned by staff",
    ipAddress: input.ipAddress,
  }, tx)
  return { ok: true as const, attendance }
}

const writePaymentCreationAudit = async (
  targetUserId: string,
  purchaseId: string,
  amountCents: number,
  paymentMode: string,
  authResult: Extract<StaffPortalAuthResult, { ok: true }>,
  tx?: Prisma.TransactionClient
) => {
  const audit: WriteStudentDataAuditParams = {
    targetUserId,
    staffClerkId: authResult.userId,
    staffName: authResult.staffName,
    entity: "payment",
    entityId: purchaseId,
    field: "created",
    valueBefore: null,
    valueAfter: { amount: amountCents, mode: paymentMode },
    reason: "Registration deposit recorded by staff",
  }
  if (tx) await writeStudentDataAudit(audit, tx)
  else await writeStudentDataAudit(audit)
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

const resolveClerkStudentIdentity = async (payload: StaffCreateStudentPayload) => {
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
    console.warn("Clerk student identity operation failed", { status: clerkErrorStatus(error) ?? "unknown" })
    return { ok: false as const, ...describeClerkIdentityFailure(error) }
  }

  if (!clerkUser) {
    return { ok: false as const, error: "Student identity service is temporarily unavailable. Please try again.", status: 503 }
  }

  return {
    ok: true as const,
    clerkUser,
    isExisting: Boolean(existingClerkUser),
  }
}

const verifyRecoveryPhone = async (clerkUser: ClerkUser, phone: string) => {
  const phoneNumber = clerkUser.phoneNumbers.find((item) => item.phoneNumber === phone)
  if (!phoneNumber || phoneNumber.verification?.status === "verified") return
  const client = await clerkClient()
  await client.phoneNumbers.updatePhoneNumber(phoneNumber.id, { verified: true })
}

class StaffStudentCreateFailure extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

export async function POST(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:students:create", getClientIp(req)),
    limit: 30,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  const authResult = await authorizeStudentOperationalRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

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

  if (parsed.payload.checkIn) {
    const session = await prisma.classSession.findUnique({
      where: { id: parsed.payload.checkIn.sessionId },
      select: { startsAt: true },
    })
    if (!session || !isSelectableStudentSessionDate(parsed.payload.checkIn.date) || getNewYorkDateKey(session.startsAt) !== parsed.payload.checkIn.date) {
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
  const identityPayload = recovery
    ? { ...parsed.payload, phone: recovery.draft.phone, email: recovery.draft.email || undefined, name: recovery.draft.name || undefined }
    : parsed.payload

  const releaseRecovery = async () => {
    if (recovery) await releaseRecoveryTicket(recovery.ticketId)
  }
  let identity: Awaited<ReturnType<typeof resolveClerkStudentIdentity>>
  try {
    identity = await resolveClerkStudentIdentity(identityPayload)
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
      const localUser = await upsertUserByIdentifiers({
        clerkId: identity.clerkUser.id,
        email: emailFromClerkUser(identity.clerkUser, identityPayload.email),
        phone: phoneFromClerkUser(identity.clerkUser, identityPayload.phone),
        name: fullNameFromClerkUser(identity.clerkUser, identityPayload.name),
        nameIsCanonical: false,
      }, tx)
      if (!localUser) {
        throw new StaffStudentCreateFailure(503, "Student identity service is temporarily unavailable. Please try again.")
      }

      if (recovery && deferRecoveryConsumption) {
        const existingPurchase = await tx.purchase.findUnique({
          where: { idempotencyKey: recovery.ticketId },
          select: { id: true, metadata: true },
        })
        if (existingPurchase) {
          const metadata = existingPurchase.metadata
          const attendanceId = metadata && typeof metadata === "object" && !Array.isArray(metadata)
            && typeof (metadata as Record<string, unknown>).attendanceId === "string"
            ? (metadata as Record<string, unknown>).attendanceId as string
            : undefined
          return { localUser, attendanceId, purchase: existingPurchase }
        }
      }

      const attendanceResult = parsed.payload.checkIn
        ? await createHistoricalAttendanceTx(tx, {
            userId: localUser.id,
            sessionId: parsed.payload.checkIn.sessionId,
            date: parsed.payload.checkIn.date,
            auth: authResult,
            ipAddress: getClientIp(req),
          })
        : null

      if (attendanceResult && !attendanceResult.ok) {
        throw new StaffStudentCreateFailure(attendanceResult.status, attendanceResult.error)
      }

      if (recovery && !deferRecoveryConsumption && !await consumeRecoveryTicket(recovery.ticketId, recovery.draftId, tx)) {
        throw new StaffStudentCreateFailure(400, "Recovery authorization is unavailable.")
      }

      const resolvedAttendanceId = attendanceResult?.attendance.id
      let createdPurchase: { id: string } | undefined

      if (amountCents > 0 && paymentMode === "cash") {
        createdPurchase = await createCashPurchase(tx.purchase, localUser.id, amountCents, note, resolvedAttendanceId)
      } else if (amountCents > 0 && paymentMode === "card_qr") {
        createdPurchase = await createCardQrPurchaseRecord(
          tx.purchase,
          localUser.id,
          amountCents,
          note,
          resolvedAttendanceId,
          recovery && deferRecoveryConsumption ? recovery.ticketId : undefined,
        )
      }

      if (wasUserCreatedByUpsert(localUser)) await writeProfileCreationAudit(localUser.id, authResult, undefined, getClientIp(req))
      if (recovery && !deferRecoveryConsumption) await writeRecoveryAudit(localUser.id, recovery.correlationId, authResult, tx)
      if (createdPurchase && amountCents > 0 && paymentMode) {
        await writePaymentCreationAudit(localUser.id, createdPurchase.id, amountCents, paymentMode, authResult)
      }

      return { localUser, attendanceId: resolvedAttendanceId, purchase: createdPurchase }
    })

    attendanceId = result.attendanceId
    purchase = result.purchase
    const emailInvitationAttempted = await maybeSendEmailInvitation(req, identityPayload.email)
    const activation = {
      emailInvitationAttempted,
      phoneSignInAvailable: Boolean(identityPayload.phone),
    }

    if (purchase && amountCents > 0 && paymentMode === "card_qr") {
      const checkout = await createStripeCheckout(purchase, result.localUser.id, amountCents, req, recovery?.ticketId)
      stripeCheckoutUrl = checkout?.url
      if (recovery && deferRecoveryConsumption) {
        await prisma.$transaction(async (tx) => {
          if (!await consumeRecoveryTicket(recovery.ticketId, recovery.draftId, tx)) {
            throw new StaffStudentCreateFailure(400, "Recovery authorization is unavailable.")
          }
          await writeRecoveryAudit(result.localUser.id, recovery.correlationId, authResult, tx)
        })
      }
    }

    return NextResponse.json({
      userId: result.localUser.id,
      clerkUserId: identity.clerkUser.id,
      isExisting: identity.isExisting,
      purchaseId: purchase?.id,
      attendanceId,
      paymentMode: amountCents > 0 ? paymentMode : undefined,
      stripeCheckoutUrl,
      activation,
    }, { status: 201 })
  } catch (error) {
    await releaseRecovery()
    if (error instanceof StaffStudentCreateFailure) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Student is already checked in for this class session." }, { status: 409 })
    }
    return NextResponse.json({ error: "Student creation could not be completed. Please try again." }, { status: 503 })
  }
}
