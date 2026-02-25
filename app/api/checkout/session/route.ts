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
      apiVersion: "2026-01-28.clover",
    })
  : null

const getBaseUrl = () =>
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

const isApiError = (value: unknown): value is ApiError =>
  Boolean(value && typeof value === "object" && "status" in value && "error" in value)
const toErrorResponse = (error: ApiError) =>
  NextResponse.json({ error: error.error, ...(error.code ? { code: error.code } : {}) }, { status: error.status })

export async function POST(req: Request) {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 })
  }

  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("checkout:session", getClientIp(req)),
    limit: 20,
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
    phone,
  } = body || {}

  const validation = validateCheckoutPayload(body)
  if (isApiError(validation)) {
    return toErrorResponse(validation)
  }

  const base = getBaseUrl()
  const success = `${base}/cursos/${validation.courseSlug}?status=success`
  const cancel = `${base}/cursos/${validation.courseSlug}?status=cancel`

  const { userId, clerkUser } = await resolveAuthUser(req, { firstName, lastName, name, phone })
  const identity = resolveContactIdentity({ clerkUser, email, phone })
  if (isApiError(identity)) {
    return toErrorResponse(identity)
  }

  const guestResult = await ensureGuestClerkUser({
    userId: userId || undefined,
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
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      client_reference_id: resolvedUserId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: validation.currency,
            unit_amount: validation.amountInt,
            product_data: {
              name: validation.courseTitle,
              description: [validation.courseSlug, validation.date, validation.time].filter(Boolean).join(" • "),
            },
          },
        },
      ],
      success_url: success,
      cancel_url: cancel,
      customer_email: identity.resolvedEmail,
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
        phone: identity.phoneNormalized,
        phoneRaw: phone || "",
        email: identity.resolvedEmail,
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error("Stripe checkout error", err)
    return NextResponse.json({ error: "Unable to create checkout session" }, { status: 500 })
  }
}
