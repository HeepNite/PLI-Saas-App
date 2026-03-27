import { NextResponse } from "next/server"
import Stripe from "stripe"
import {
  enrollStudentPinForCheckout,
  enforceNewStudentRules,
  prepareCheckoutAccount,
  type ApiError,
} from "@/lib/checkout"
import { validateCheckoutPayload, type CheckoutBody } from "@/lib/checkout/validation"
import { parsePhotoFlowContext } from "@/lib/checkin/photo-context-policy"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"

const secret = process.env.STRIPE_SECRET_KEY
const stripe = secret
  ? new Stripe(secret, {
      apiVersion: "2026-01-28.clover",
    })
  : null

const isApiError = (value: unknown): value is ApiError =>
  Boolean(value && typeof value === "object" && "status" in value && "error" in value)
const toErrorResponse = (error: ApiError) =>
  NextResponse.json({ error: error.error, ...(error.code ? { code: error.code } : {}) }, { status: error.status })

export async function POST(req: Request) {
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
    prepareOnly = false,
    kioskSessionToken,
    studentPin,
    studentPinConfirm,
  } = body || {}
  const photoContext = parsePhotoFlowContext((body as Record<string, unknown>)?.photoContext)

  const validation = await validateCheckoutPayload(body)
  if (isApiError(validation)) {
    return toErrorResponse(validation)
  }

  const preparedAccount = await prepareCheckoutAccount(
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
      allowExistingAccountLookup: prepareOnly || photoContext === "kiosk_terminal",
      kioskSessionToken,
    }
  )
  if (isApiError(preparedAccount)) {
    return toErrorResponse(preparedAccount)
  }

  const { clerkUser, resolvedUserId, identity, account } = preparedAccount

  if (prepareOnly) {
    return NextResponse.json({
      ok: true,
      prepareOnly: true,
      account,
    })
  }

  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 })
  }

  const newStudentError = await enforceNewStudentRules({
    serviceId: validation.serviceId,
    safeParticipants: validation.safeParticipants,
    clerkUserForVerification: clerkUser,
    resolvedUserId: resolvedUserId || undefined,
    resolvedEmail: identity.resolvedEmail,
    phoneNormalized: identity.phoneNormalized,
  })
  if (newStudentError) {
    return toErrorResponse(newStudentError)
  }

  const studentPinEnrollment = await enrollStudentPinForCheckout({
    serviceId: validation.serviceId,
    prepareOnly,
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

    return NextResponse.json({
      clientSecret: intent.client_secret,
      account,
    })
  } catch (err) {
    console.error("Stripe intent error", err)
    return NextResponse.json({ error: "Unable to create payment intent" }, { status: 500 })
  }
}
