import { NextResponse } from "next/server"
import Stripe from "stripe"
import * as Sentry from "@sentry/nextjs"
import { createNestGatewayTerminalPaymentIntent } from "@/lib/nest-gateway/client"
import {
  clearPreparedCheckoutAfterSuccess,
  enforceNewStudentRules,
  resolveCheckoutPreparation,
  type ApiError,
} from "@/lib/checkout"
import { validateCheckoutPayload, type CheckoutBody, type CheckoutValidation } from "@/lib/checkout/validation"
import { parsePhotoFlowContext } from "@/lib/checkin/photo-context-policy"
import { resolveKioskEffectiveSessionDateTime } from "@/lib/checkout/kiosk-context"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { FLOW_CONTEXT } from "@/lib/payment-constants"

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

const UNKNOWN_PAYMENT_INTENT_ERROR = "Payment intent status is unknown. Verify the terminal payment before retrying."

type EffectiveSession = {
  date: string | null
  time: string | null
}

type CheckoutIntentMetadata = Record<string, string>

const omitEmptyMetadataFields = (metadata: CheckoutIntentMetadata): CheckoutIntentMetadata =>
  Object.fromEntries(Object.entries(metadata).filter(([, value]) => value.trim().length > 0))

const hasUsableClientSecret = (payload: unknown): payload is { clientSecret: string } =>
  Boolean(
    payload &&
    typeof payload === "object" &&
    "clientSecret" in payload &&
    typeof payload.clientSecret === "string" &&
    payload.clientSecret.trim().length > 0
  )

const buildCheckoutIntentMetadata = ({
  effectiveSession,
  firstName,
  identity,
  lastName,
  name,
  phone,
  photoContext,
  resolvedUserId,
  validation,
}: {
  effectiveSession: EffectiveSession
  firstName?: string
  identity: { resolvedEmail: string; phoneNormalized: string }
  lastName?: string
  name?: string
  phone?: string
  photoContext?: string
  resolvedUserId: string | null
  validation: CheckoutValidation
}): CheckoutIntentMetadata =>
  omitEmptyMetadataFields({
    courseSlug: validation.courseSlug,
    courseTitle: validation.courseTitle,
    date: effectiveSession.date ?? "",
    time: effectiveSession.time ?? "",
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
    consecutivePriceCents: validation.consecutivePriceCents != null ? String(validation.consecutivePriceCents) : "",
    consecutiveLinkedCourseSlug: validation.consecutiveLinkedCourseSlug || "",
    consecutiveCourseTitle: validation.consecutiveCourseTitle || "",
    consecutiveLinkedCourseTime: validation.consecutiveLinkedCourseTime || "",
    flowContext: photoContext || "",
  })

const buildDelegatedTerminalPaymentIntentIdempotencyKey = (input: {
  amountInt: number
  currency: string
  preparedContextId: string
}) => `terminal-payment-intent:${input.preparedContextId}:${input.amountInt}:${input.currency}`

const createLocalPaymentIntent = async (input: {
  amount: number
  currency: string
  metadata: CheckoutIntentMetadata
  receiptEmail: string
}) => {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 })
  }

  const intent = await stripe.paymentIntents.create({
    amount: input.amount,
    currency: input.currency,
    automatic_payment_methods: { enabled: true, allow_redirects: "never" },
    receipt_email: input.receiptEmail,
    metadata: input.metadata,
  })

  return NextResponse.json({
    clientSecret: intent.client_secret,
  })
}

export async function POST(req: Request) {
  const startedAt = Date.now()
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
  } = body || {}
  const photoContext = parsePhotoFlowContext((body as Record<string, unknown>)?.photoContext)

  const validation = await validateCheckoutPayload(body, { prepareOnly })
  if (isApiError(validation)) {
    return toErrorResponse(validation)
  }
  const effectiveSession = resolveKioskEffectiveSessionDateTime({
    photoContext,
    validation,
  })

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
      allowExistingAccountLookup: prepareOnly || photoContext === FLOW_CONTEXT.KIOSK_TERMINAL,
      kioskSessionToken,
      serviceId: validation.serviceId,
      // NOTE: deferUserCreation is intentionally FALSE for kiosk new-student prepareOnly.
      // EmbeddedSignIn uses signIn.create({ strategy: "phone_code" }) which requires an
      // existing Clerk user. Without creating the Clerk user here, SMS verification cannot
      // work for truly new students. The staff-session isolation guard in lib/checkout.ts
      // ensures the new user uses the STUDENT's identity, not the staff's.
      deferUserCreation: false,
      validation,
    }
  )
  if (isApiError(preparation)) {
    return toErrorResponse(preparation)
  }

  const { preparedAccount, verification, source, fallbackReason, terminalAuth, preparedContextId } = preparation
  const { clerkUser, resolvedUserId, identity, account } = preparedAccount

  if (prepareOnly) {
    console.info("[staff-terminal-checkout-latency] checkout-intent", {
      segment: "prepare_only",
      source,
      fallbackReason: fallbackReason || null,
      durationMs: Date.now() - startedAt,
    })
    return NextResponse.json({
      ok: true,
      prepareOnly: true,
      account,
    })
  }

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

  const metadata = buildCheckoutIntentMetadata({
    effectiveSession,
    firstName,
    identity,
    lastName,
    name,
    phone,
    photoContext,
    resolvedUserId,
    validation,
  })

  const shouldDelegateTerminalPaymentIntent =
    photoContext === FLOW_CONTEXT.KIOSK_TERMINAL &&
    source === "prepared" &&
    Boolean(terminalAuth?.ok) &&
    Boolean(preparedContextId)

  try {
    let response: Response

    if (shouldDelegateTerminalPaymentIntent && preparedContextId) {
      const idempotencyKey = buildDelegatedTerminalPaymentIntentIdempotencyKey({
        amountInt: validation.amountInt,
        currency: validation.currency,
        preparedContextId,
      })
      const requestId = req.headers.get("x-request-id")?.trim() || idempotencyKey
      const gatewayResult = await createNestGatewayTerminalPaymentIntent({
        payload: {
          amount: validation.amountInt,
          currency: validation.currency,
          receiptEmail: identity.resolvedEmail,
          idempotencyKey,
          metadata,
        },
        requestId,
      })

      if ("clientSecret" in gatewayResult) {
        response = NextResponse.json({ clientSecret: gatewayResult.clientSecret, account })
      } else if (gatewayResult.source === "fallback") {
        response = await createLocalPaymentIntent({
          amount: validation.amountInt,
          currency: validation.currency,
          metadata,
          receiptEmail: identity.resolvedEmail,
        })
      } else {
        console.error("Terminal payment-intent gateway unknown state", {
          idempotencyKey,
          preparedContextId,
          reason: gatewayResult.reason,
          requestId,
          source,
        })
        Sentry.captureMessage("Terminal payment-intent gateway unknown state", {
          level: "error",
          extra: {
            idempotencyKey,
            preparedContextId,
            reason: gatewayResult.reason,
            requestId,
            source,
          },
        })
        return NextResponse.json({ error: UNKNOWN_PAYMENT_INTENT_ERROR }, { status: 502 })
      }
    } else {
      response = await createLocalPaymentIntent({
        amount: validation.amountInt,
        currency: validation.currency,
        metadata,
        receiptEmail: identity.resolvedEmail,
      })
    }

    const payload = await response.json()

    if (response.ok && hasUsableClientSecret(payload)) {
      await clearPreparedCheckoutAfterSuccess({
        terminalAuth,
        kioskSessionToken,
        validation,
      })
    }

    console.info("[staff-terminal-checkout-latency] checkout-intent", {
      segment: "card_next_step",
      source,
      fallbackReason: fallbackReason || null,
      durationMs: Date.now() - startedAt,
    })

    return NextResponse.json({
      ...payload,
      account,
    }, { status: response.status })
  } catch (err) {
    console.error("Stripe intent error", err)
    Sentry.captureException(err)
    return NextResponse.json({ error: "Unable to create payment intent" }, { status: 500 })
  }
}
