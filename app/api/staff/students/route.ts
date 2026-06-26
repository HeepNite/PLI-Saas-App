import { NextResponse } from "next/server"
import Stripe from "stripe"
import { clerkClient } from "@clerk/nextjs/server"
import { ensureClerkUser, findClerkUserByIdentifiers, updateClerkUserIfMissing, type ClerkUser } from "@/lib/clerk-users"
import { authorizeStudentOperationalRequest, type StaffPortalAuthResult } from "@/lib/security/staff-portal-auth"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { upsertUserByIdentifiers } from "@/lib/users"
import { prisma } from "@/lib/prisma"
import { writeStudentDataAudit } from "@/lib/audit/student-data-audit"

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
  let phone = safeText(record.phone, 32)
  const name = safeText(record.name, 120)
  const note = safeText(record.note, 500)

  // Auto-prefix + for E.164 if user provided digits only
  if (phone && !phone.startsWith("+")) {
    phone = `+${phone.replace(/\D/g, "")}`
  }
  // Strip non-digit chars after the + (spaces, dashes, parens)
  if (phone) {
    phone = `+${phone.slice(1).replace(/\D/g, "")}`
  }

  if (!email && !phone) {
    return { ok: false, error: "Provide an email or phone number." }
  }
  if (email && !EMAIL_PATTERN.test(email)) {
    return { ok: false, error: "Invalid email." }
  }
  if (phone && phone.length < 7) {
    return { ok: false, error: "Phone number is too short." }
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

const createCashPurchase = async (userId: string, amountCents: number, note?: string) => {
  return prisma.purchase.create({
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
      },
    },
  })
}

const createCardQrPurchase = async (userId: string, amountCents: number, req: Request, note?: string) => {
  const purchase = await prisma.purchase.create({
    data: {
      userId,
      courseSlug: "_staff_registration",
      courseTitle: "Staff Registration",
      amount: amountCents,
      currency: "usd",
      status: "pending",
      metadata: {
        source: "staff_created_student",
        paymentMode: "card_qr",
        paymentChannel: "card",
        settlementStatus: "pending",
        isRegistrationDeposit: true,
        staffNote: note ?? null,
      },
    },
  })

  if (!stripe) {
    return { purchase, checkoutUrl: undefined }
  }

  const requestUrl = new URL(req.url)
  const baseUrl = requestUrl.origin
  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 60

  const session = await stripe.checkout.sessions.create({
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
  })

  return { purchase, checkoutUrl: session.url ?? undefined }
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

const createOrReuseStudentIdentity = async (payload: StaffCreateStudentPayload, req: Request) => {
  const existingClerkUser = await findClerkUserByIdentifiers({ email: payload.email, phone: payload.phone })
  const clerkUser = existingClerkUser || await ensureClerkUser({
    email: payload.email,
    phone: payload.phone,
    name: payload.name,
  })

  if (!clerkUser) {
    return { ok: false as const, error: "Unable to create student identity." }
  }

  if (existingClerkUser) {
    await updateClerkUserIfMissing(existingClerkUser, {
      email: payload.email,
      phone: payload.phone,
      name: payload.name,
    })
  }

  const localUser = await upsertUserByIdentifiers({
    clerkId: clerkUser.id,
    email: emailFromClerkUser(clerkUser, payload.email),
    phone: phoneFromClerkUser(clerkUser, payload.phone),
    name: fullNameFromClerkUser(clerkUser, payload.name),
    nameIsCanonical: false,
  })

  if (!localUser) {
    return { ok: false as const, error: "Unable to link student identity." }
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

  const identity = await createOrReuseStudentIdentity(parsed.payload, req)
  if (!identity.ok) {
    return NextResponse.json({ error: identity.error }, { status: 500 })
  }

  await writeProfileCreationAudit(identity.localUser.id, authResult)

  const { amountCents, paymentMode, note } = parsed.payload
  let purchaseId: string | undefined
  let stripeCheckoutUrl: string | undefined

  if (amountCents > 0 && paymentMode === "cash") {
    const purchase = await createCashPurchase(identity.localUser.id, amountCents, note)
    purchaseId = purchase.id
    await writePaymentCreationAudit(identity.localUser.id, purchase.id, amountCents, "cash", authResult)
  } else if (amountCents > 0 && paymentMode === "card_qr") {
    const { purchase, checkoutUrl } = await createCardQrPurchase(identity.localUser.id, amountCents, req, note)
    purchaseId = purchase.id
    stripeCheckoutUrl = checkoutUrl
    await writePaymentCreationAudit(identity.localUser.id, purchase.id, amountCents, "card_qr", authResult)
  }

  return NextResponse.json({
    userId: identity.localUser.id,
    clerkUserId: identity.clerkUser.id,
    isExisting: identity.isExisting,
    purchaseId,
    paymentMode: amountCents > 0 ? paymentMode : undefined,
    stripeCheckoutUrl,
    activation: identity.activation,
  }, { status: 201 })
}
