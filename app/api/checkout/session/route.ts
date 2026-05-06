import { NextResponse } from "next/server"
import Stripe from "stripe"
import {
  clearPreparedCheckoutAfterSuccess,
  enrollStudentPinForCheckout,
  enforceNewStudentRules,
  resolveCheckoutPreparation,
  type ApiError,
} from "@/lib/checkout"
import { parsePhotoFlowContext } from "@/lib/checkin/photo-context-policy"
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
  const startedAt = Date.now()
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
    phone = "",
    kioskSessionToken,
    studentPin,
    studentPinConfirm,
  } = body || {}
  const photoContext = parsePhotoFlowContext((body as Record<string, unknown>)?.photoContext)

  const validation = await validateCheckoutPayload(body)
  if (isApiError(validation)) {
    return toErrorResponse(validation)
  }

  const base = getBaseUrl()
  const success = `${base}/courses/${validation.courseSlug}?status=success`
  const cancel = `${base}/courses/${validation.courseSlug}?status=cancel`

  const preparation = await resolveCheckoutPreparation(
    req,
    {
      email,
      firstName,
      lastName,
      name,
      phone,
    },
    {
      photoContext,
      allowExistingAccountLookup: photoContext === "kiosk_terminal",
      kioskSessionToken,
      serviceId: validation.serviceId,
      validation,
    }
  )
  if (isApiError(preparation)) {
    return toErrorResponse(preparation)
  }

  const { preparedAccount, verification, source, fallbackReason, terminalAuth } = preparation
  const { clerkUser, resolvedUserId, identity } = preparedAccount
  const newStudentError = await enforceNewStudentRules({
    serviceId: validation.serviceId,
    safeParticipants: validation.safeParticipants,
    clerkUserForVerification: clerkUser,
    hasVerifiedPhone: verification.hasVerifiedPhone,
    resolvedUserId: resolvedUserId || undefined,
    resolvedEmail: identity.resolvedEmail,
    phoneNormalized: identity.phoneNormalized,
  })
  if (newStudentError) {
    return toErrorResponse(newStudentError)
  }

  const studentPinEnrollment = await enrollStudentPinForCheckout({
    serviceId: validation.serviceId,
    resolvedClerkUserId: resolvedUserId,
    resolvedEmail: identity.resolvedEmail,
    phoneNormalized: identity.phoneNormalized,
    name: name || [firstName, lastName].filter(Boolean).join(" ") || undefined,
    studentPin,
    studentPinConfirm,
  })
  if (isApiError(studentPinEnrollment)) {
    return toErrorResponse(studentPinEnrollment)
  }

  const expiresAt =
    photoContext === "kiosk_terminal" ? Math.floor(Date.now() / 1000) + 30 * 60 : undefined

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      client_reference_id: resolvedUserId || undefined,
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
      expires_at: expiresAt,
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
        flowContext: photoContext,
        paymentSurface: photoContext === "kiosk_terminal" ? "hosted_checkout" : "web_checkout",
        // Consecutive class fields (present when user accepted the consecutive offer)
        consecutivePriceCents: validation.consecutivePriceCents != null ? String(validation.consecutivePriceCents) : "",
        consecutiveLinkedCourseSlug: validation.consecutiveLinkedCourseSlug || "",
        consecutiveCourseTitle: validation.consecutiveCourseTitle || "",
      },
    })

    await clearPreparedCheckoutAfterSuccess({
      terminalAuth,
      kioskSessionToken,
      validation,
    })

    console.info("[staff-terminal-checkout-latency] checkout-session", {
      segment: "card_next_step",
      source,
      fallbackReason: fallbackReason || null,
      durationMs: Date.now() - startedAt,
    })

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
    })
  } catch (err) {
    console.error("Stripe checkout error", err)
    return NextResponse.json({ error: "Unable to create checkout session" }, { status: 500 })
  }
}
