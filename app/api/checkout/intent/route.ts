import { NextResponse } from "next/server"
import Stripe from "stripe"
import {
  ensureGuestClerkUser,
  enforceNewStudentRules,
  resolveAuthUser,
  resolveContactIdentity,
  type ApiError,
} from "@/lib/checkout"
import { validateCheckoutPayload, type CheckoutBody } from "@/lib/checkout/validation"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"

const secret = process.env.STRIPE_SECRET_KEY
const stripe = secret
  ? new Stripe(secret, {
      apiVersion: "2024-06-20",
    })
  : null

const isApiError = (value: unknown): value is ApiError =>
  Boolean(value && typeof value === "object" && "status" in value && "error" in value)
const toErrorResponse = (error: ApiError) =>
  NextResponse.json({ error: error.error, ...(error.code ? { code: error.code } : {}) }, { status: error.status })

export async function POST(req: Request) {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 })
  }

  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("checkout:intent", getClientIp(req)),
    limit: 30,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  let body: CheckoutBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const {
    email,
    firstName,
    lastName,
    name,
    phone = "",
  } = body || {}

  const validation = validateCheckoutPayload(body)
  if (isApiError(validation)) {
    return toErrorResponse(validation)
  }

  const { userId, clerkUser } = await resolveAuthUser(req, { firstName, lastName, name, phone })
  const identity = resolveContactIdentity({ clerkUser, email, phone })
  if (isApiError(identity)) {
    return toErrorResponse(identity)
  }

  const guestResult = await ensureGuestClerkUser({
    userId,
    resolvedEmail: identity.resolvedEmail,
    phoneRaw: identity.phoneRaw,
    firstName,
    lastName,
    name,
    phone,
  })
  if (isApiError(guestResult)) {
    return toErrorResponse(guestResult)
  }

  const ensuredClerkUser = guestResult.ensuredClerkUser
  const resolvedUserId = userId || ensuredClerkUser?.id
  const newStudentError = await enforceNewStudentRules({
    serviceId: validation.serviceId,
    safeParticipants: validation.safeParticipants,
    clerkUserForVerification: clerkUser || ensuredClerkUser,
    resolvedUserId,
    resolvedEmail: identity.resolvedEmail,
    phoneNormalized: identity.phoneNormalized,
  })
  if (newStudentError) {
    return toErrorResponse(newStudentError)
  }

  try {
    const intent = await stripe.paymentIntents.create({
      amount: validation.amountInt,
      currency: validation.currency,
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      receipt_email: identity.resolvedEmail,
      metadata: {
        courseSlug: validation.courseSlug,
        courseTitle: validation.courseTitle,
        date: validation.date,
        time: validation.time,
        packageId: validation.packageId,
        packageLabel: validation.pkg?.label || "",
        packageTotalCredits: validation.packageTotalCredits === null ? "" : String(validation.packageTotalCredits),
        packageIsUnlimited: String(validation.packageIsUnlimited),
        packageCadence: validation.packageCadence,
        packageMakeUps: String(validation.packageMakeUps),
        packageValidDays: String(validation.packageValidDays),
        serviceId: validation.serviceId,
        userId: resolvedUserId || "guest",
        participants: String(validation.safeParticipants),
        coupon: validation.coupon || "",
        addons: validation.addons.join(","),
        name: name || [firstName, lastName].filter(Boolean).join(" ") || "",
        email: identity.resolvedEmail,
        phone: identity.phoneNormalized,
        phoneRaw: phone || "",
      },
    })

    return NextResponse.json({ clientSecret: intent.client_secret })
  } catch (err) {
    console.error("Stripe intent error", err)
    return NextResponse.json({ error: "Unable to create payment intent" }, { status: 500 })
  }
}
