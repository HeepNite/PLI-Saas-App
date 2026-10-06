import { NextResponse } from "next/server"
import Stripe from "stripe"
import * as Sentry from "@sentry/nextjs"
import {
  clearPreparedCheckoutAfterSuccess,
  enforceNewStudentRules,
  resolveCheckoutPreparation,
  type ApiError,
} from "@/lib/checkout"
import { parsePhotoFlowContext } from "@/lib/checkin/photo-context-policy"
import { validateCheckoutPayload, type CheckoutBody } from "@/lib/checkout/validation"
import { resolveKioskEffectiveSessionDateTime } from "@/lib/checkout/kiosk-context"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { FLOW_CONTEXT } from "@/lib/payment-constants"
import { buildQrBookingUrl } from "@/lib/checkin/qr-booking-links"
import { resolveSpecialClassIdentity } from "@/lib/checkout/special-class-identity"
import {
  admitSpecialClassReservation,
  failSpecialClassHold,
  updateSpecialClassPurchaseSession,
} from "@/lib/checkout/special-class-reservation"
import {
  SPECIAL_SALSA_CLASS,
} from "@/lib/special-salsa-class/config"
import {
  HERITAGE_PIN_CAMPAIGN_KEY,
  isHeritagePinAcquisitionDate,
  normalizeHeritagePinCountryCode,
} from "@/lib/campaigns/heritage-pin"
import type { CoursePromotionChannel } from "@/lib/promotions/course-promotions"
import { prisma } from "@/lib/prisma"
import { getTrustedCheckoutChannel } from "@/lib/checkout/trusted-checkout-channel"
import { resolveCoursePromotionCheckoutPricing } from "@/lib/checkout/course-promotion-pricing"
import { enforcePublicBookingPolicy } from "@/lib/checkout/public-booking-policy"

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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const specialCheckoutError = (code: string) => {
  const errors: Record<string, { status: number; error: string }> = {
    INVALID_CONTACT: { status: 400, error: "Please enter a valid name, email, phone number, and checkout attempt." },
    CONTACT_DETAILS_UNAVAILABLE: { status: 409, error: "We could not use those contact details. Please verify them and try again." },
    CHECKOUT_EXPIRED: { status: 409, error: "This checkout attempt expired. Please try again." },
    CHECKOUT_IN_PROGRESS: { status: 409, error: "A checkout is already in progress for these contact details. Please try again shortly." },
    ALREADY_REGISTERED: { status: 409, error: "These contact details already have a reservation for this class." },
    SOLD_OUT: { status: 409, error: "This class is sold out." },
  }
  const resolved = Object.hasOwn(errors, code) ? errors[code] : { status: 500, error: "Unable to start checkout. Please try again." }
  return NextResponse.json({ error: resolved.error, code }, { status: resolved.status })
}

const handleSpecialClassCheckout = async (body: Record<string, unknown>) => {
  const attemptId = typeof body.attemptId === "string" ? body.attemptId.trim() : ""
  const name = typeof body.name === "string" ? body.name : ""
  const email = typeof body.email === "string" ? body.email : ""
  const phone = typeof body.phone === "string" ? body.phone : ""
  if (!UUID_PATTERN.test(attemptId)) return specialCheckoutError("INVALID_CONTACT")

  const identity = await resolveSpecialClassIdentity({ name, email, phone })
  if (!identity.ok) return specialCheckoutError(identity.code)

  const requestNow = new Date()
  const specialClassSlug = typeof body.specialClassSlug === "string" && body.specialClassSlug.trim()
    ? body.specialClassSlug.trim()
    : SPECIAL_SALSA_CLASS.key
  const admission = await admitSpecialClassReservation({
    attemptId,
    specialClassSlug,
    dbUserId: identity.dbUserId,
    email: identity.email,
    name: identity.name,
    phone: identity.phone,
  }, { now: () => requestNow })
  if (!admission.ok) return specialCheckoutError(admission.code)
  const checkoutClass = admission.specialClass ?? {
    id: SPECIAL_SALSA_CLASS.key,
    slug: SPECIAL_SALSA_CLASS.key,
    title: SPECIAL_SALSA_CLASS.title,
    description: SPECIAL_SALSA_CLASS.displayTitle,
    coverImageUrl: null,
    priceCents: admission.purchase.amount,
    currency: SPECIAL_SALSA_CLASS.currency,
    classSessionId: "",
    session: { courseSlug: SPECIAL_SALSA_CLASS.courseSlug, startsAt: SPECIAL_SALSA_CLASS.startsAt, durationMinutes: SPECIAL_SALSA_CLASS.durationMinutes, capacity: SPECIAL_SALSA_CLASS.capacity, location: SPECIAL_SALSA_CLASS.address },
  }
  const lockedAmountCents = admission.purchase.amount
  if (!Number.isInteger(lockedAmountCents) || lockedAmountCents !== checkoutClass.priceCents) {
    return specialCheckoutError("CHECKOUT_UNAVAILABLE")
  }
  if (admission.purchase.stripeCheckoutSessionId) {
    let existingSession: Stripe.Checkout.Session
    try {
      existingSession = await stripe!.checkout.sessions.retrieve(admission.purchase.stripeCheckoutSessionId)
    } catch {
      return specialCheckoutError("CHECKOUT_IN_PROGRESS")
    }
    const holdIsActive = Date.now() < admission.holdExpiresAt.getTime()
    const sharesLockedAmount = existingSession.amount_total == null || existingSession.amount_total === lockedAmountCents
    const sharesLockedCurrency = !existingSession.currency || existingSession.currency.toLowerCase() === checkoutClass.currency
    if (existingSession.status === "open" && existingSession.url && sharesLockedAmount && sharesLockedCurrency && holdIsActive) {
      return NextResponse.json({
        url: existingSession.url,
        sessionId: existingSession.id,
        expiresAt: admission.holdExpiresAt.toISOString(),
      })
    }
    if (existingSession.status === "open") {
      try {
        await stripe!.checkout.sessions.expire(existingSession.id)
      } catch {
        return specialCheckoutError("CHECKOUT_IN_PROGRESS")
      }
      await failSpecialClassHold(admission.purchase.id)
      return specialCheckoutError("CHECKOUT_EXPIRED")
    }
    if (existingSession.status === "expired") {
      await failSpecialClassHold(admission.purchase.id)
      return specialCheckoutError("CHECKOUT_EXPIRED")
    }
    return specialCheckoutError("CHECKOUT_IN_PROGRESS")
  }

  const base = getBaseUrl()
  let session: Stripe.Checkout.Session
  try {
    session = await stripe!.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      client_reference_id: identity.clerkUserId,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: checkoutClass.currency,
          unit_amount: lockedAmountCents,
          product_data: {
            name: checkoutClass.title,
            description: `${checkoutClass.session.durationMinutes ?? 60} minutes • ${checkoutClass.session.location ?? "PLI"}`,
          },
        },
      }],
      success_url: `${base}/special-classes/${encodeURIComponent(checkoutClass.slug)}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/special-classes/${encodeURIComponent(checkoutClass.slug)}?checkout=cancelled&attempt=${encodeURIComponent(attemptId)}`,
      ...(identity.stripeCustomerId
        ? { customer: identity.stripeCustomerId }
        : { customer_creation: "always" as const, customer_email: identity.email }),
      payment_intent_data: {
        capture_method: "manual",
        metadata: {
          specialClassId: checkoutClass.id,
          specialClassSlug: checkoutClass.slug,
          classSessionId: checkoutClass.classSessionId,
          attemptId,
          lockedAmountCents: String(lockedAmountCents),
          purchaseId: admission.purchase.id,
        },
      },
      metadata: {
        specialClassId: checkoutClass.id,
        specialClassSlug: checkoutClass.slug,
        classSessionId: checkoutClass.classSessionId,
        attemptId,
        lockedAmountCents: String(lockedAmountCents),
        courseSlug: checkoutClass.session.courseSlug,
        courseTitle: checkoutClass.title,
        date: checkoutClass.session.startsAt.toISOString().slice(0, 10),
        time: checkoutClass.session.startsAt.toISOString().slice(11, 16),
        serviceId: "special-class",
        userId: identity.clerkUserId,
        participants: "1",
        name: identity.name,
        email: identity.email,
        phone: identity.phone,
        flowContext: "external_web",
        paymentSurface: "web_checkout",
      },
    }, { idempotencyKey: admission.idempotencyKey })
  } catch {
    await failSpecialClassHold(admission.purchase.id)
    return specialCheckoutError("CHECKOUT_UNAVAILABLE")
  }

  if (!session.url) {
    await failSpecialClassHold(admission.purchase.id)
    return specialCheckoutError("CHECKOUT_UNAVAILABLE")
  }
  if (Date.now() >= admission.holdExpiresAt.getTime()) {
    try {
      await stripe!.checkout.sessions.expire(session.id)
    } catch {
      return specialCheckoutError("CHECKOUT_UNAVAILABLE")
    }
    await failSpecialClassHold(admission.purchase.id)
    return specialCheckoutError("CHECKOUT_UNAVAILABLE")
  }
  try {
    await updateSpecialClassPurchaseSession(admission.purchase.id, session.id)
  } catch {
    return specialCheckoutError("CHECKOUT_UNAVAILABLE")
  }

  return NextResponse.json({
    url: session.url,
    sessionId: session.id,
    expiresAt: admission.holdExpiresAt.toISOString(),
  })
}

async function handleCheckoutSession(req: Request) {
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

  const bodyRecord = body && typeof body === "object" && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {}
  if (Object.hasOwn(bodyRecord, "checkoutKind") && [SPECIAL_SALSA_CLASS.checkoutKind, "special-class"].includes(String(bodyRecord.checkoutKind))) {
    return handleSpecialClassCheckout(bodyRecord)
  }

  const {
    email,
    firstName,
    lastName,
    name,
    phone = "",
    kioskSessionToken,
  } = body || {}
  const photoContext = parsePhotoFlowContext((body as Record<string, unknown>)?.photoContext)
  const bookingSource = typeof body.bookingSource === "string" ? body.bookingSource.trim() : ""
  const heritagePinCountryCode = normalizeHeritagePinCountryCode(body.heritagePinCountryCode)
  if (bookingSource === "public_booking" && isHeritagePinAcquisitionDate(new Date()) && !heritagePinCountryCode) {
    return NextResponse.json({ error: "Select a valid country for the Heritage pin." }, { status: 400 })
  }
  const heritagePinMetadata: Record<string, string> = bookingSource === "public_booking" && heritagePinCountryCode
    ? {
        heritagePinIntent: HERITAGE_PIN_CAMPAIGN_KEY,
        heritagePinCountryCode,
        heritagePinSource: "public_booking",
      }
    : {}
  // Mobile-QR check-in booking paid via Stripe HOSTED checkout (full-page redirect).
  // The client sets `checkInBooking: true` on the QR-phone check-in payload so the
  // webhook can complete the booking as a real check-in (attendance = checked-in),
  // mirroring the staff kiosk terminal — there is no post-redirect client callback.
  const isMobileQrCheckInBooking =
    photoContext === FLOW_CONTEXT.QR_PHONE &&
    (body as Record<string, unknown>)?.checkInBooking === true

  const initialValidation = await validateCheckoutPayload(body)
  if (isApiError(initialValidation)) {
    return toErrorResponse(initialValidation)
  }
  const trustedChannel = getTrustedCheckoutChannel()
  if (trustedChannel === "public_booking") {
    const publicBookingPolicy = enforcePublicBookingPolicy(initialValidation)
    if (isApiError(publicBookingPolicy)) return toErrorResponse(publicBookingPolicy)
  }
  const initialEffectiveSession = resolveKioskEffectiveSessionDateTime({
    photoContext,
    validation: initialValidation,
  })

  const base = getBaseUrl()
  const success = initialValidation.consecutiveAddOnOnly
    ? `${base}/checkin/promo-added?course=${encodeURIComponent(initialValidation.consecutiveCourseTitle ?? "")}&price=${initialValidation.consecutivePriceCents ?? 0}&remaining=${initialValidation.packageRemaining ?? ""}`
    : isMobileQrCheckInBooking
      ? `${base}/checkin/booked?course=${encodeURIComponent(initialValidation.courseTitle)}&name=${encodeURIComponent(firstName ?? "")}`
      : `${base}/client-profile?status=success`
  // On cancel, a plain `/courses/{slug}?status=cancel` drops ALL the QR/new-student
  // context. Since SMS verification signed the new student in mid-flow, re-opening the
  // booking would capture them as an EXISTING customer and charge the drop-in price
  // instead of the $15 new-student promo. For the QR check-in booking, return to the
  // same QR flow; for a new-student booking, force `newStudent=1` so the promo price
  // survives the Stripe round-trip. The server still re-verifies eligibility
  // (hasCompletedPurchase), so a genuine returning customer cannot abuse the flag.
  const cancel = isMobileQrCheckInBooking
    ? `${base}${buildQrBookingUrl({
        courseSlug: initialValidation.courseSlug,
        date: initialEffectiveSession.date ?? undefined,
        time: initialEffectiveSession.time ?? undefined,
      })}${initialValidation.serviceId === "new-student" ? "&newStudent=1" : ""}&status=cancel${bookingSource === "public_booking" && heritagePinCountryCode ? `&bookingSource=public_booking&heritagePinCountryCode=${encodeURIComponent(heritagePinCountryCode)}` : ""}`
    : `${base}/courses/${initialValidation.courseSlug}?status=cancel`

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
      allowExistingAccountLookup: photoContext === FLOW_CONTEXT.KIOSK_TERMINAL,
      kioskSessionToken,
      serviceId: initialValidation.serviceId,
      validation: initialValidation,
    }
  )
  if (isApiError(preparation)) {
    return toErrorResponse(preparation)
  }

  const validation = await validateCheckoutPayload(body)
  if (isApiError(validation)) {
    return toErrorResponse(validation)
  }
  const publicBookingPolicy = trustedChannel === "public_booking"
    ? enforcePublicBookingPolicy(validation)
    : null
  if (isApiError(publicBookingPolicy)) return toErrorResponse(publicBookingPolicy)
  const currency = publicBookingPolicy?.currency ?? validation.currency
  const effectiveSession = resolveKioskEffectiveSessionDateTime({
    photoContext,
    validation,
  })

  const { preparedAccount, verification, source, fallbackReason, terminalAuth } = preparation
  const { clerkUser, resolvedUserId, identity } = preparedAccount
  const promotionChannel: CoursePromotionChannel | null = photoContext === FLOW_CONTEXT.KIOSK_TERMINAL && terminalAuth
    ? "trusted_kiosk"
    : trustedChannel === "profile" || trustedChannel === "public_booking"
      ? trustedChannel
      : null
  const promotions = validation.course && typeof validation.course.scheduleRules === "object" && validation.course.scheduleRules
    ? (validation.course.scheduleRules as Record<string, unknown>).promotions
    : []
  const regularDropIn = validation.course?.enrollment?.services?.find((service) => service.id === "dropin")
  const regularPriceCents = regularDropIn?.price ? Math.round(regularDropIn.price * 100) : 0
  const { effectiveAmountCents, promotionMetadata } = await resolveCoursePromotionCheckoutPricing({
    db: prisma,
    trustedChannel: promotionChannel,
    authoritativePromotions: promotions,
    authoritativeCourse: validation.course,
    classDate: effectiveSession.date || validation.date,
    classTime: effectiveSession.time || validation.time,
    amountCents: validation.amountInt,
    regularPriceCents,
    checkoutShape: {
      serviceId: validation.serviceId,
      safeParticipants: validation.safeParticipants,
      packageId: validation.packageId,
      coupon: validation.coupon,
      addons: validation.addons,
      consecutivePriceCents: validation.consecutivePriceCents,
      consecutiveAddOnOnly: validation.consecutiveAddOnOnly,
    },
    resolvedIdentity: {
      clerkId: resolvedUserId,
      email: identity.resolvedEmail,
      phone: identity.phoneNormalized,
    },
  })
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


  const expiresAt =
    photoContext === FLOW_CONTEXT.KIOSK_TERMINAL ? Math.floor(Date.now() / 1000) + 30 * 60 : undefined

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      client_reference_id: resolvedUserId || undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: effectiveAmountCents,
            product_data: {
              name: validation.courseTitle,
              description: [validation.courseSlug, effectiveSession.date, effectiveSession.time].filter(Boolean).join(" • "),
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
        date: effectiveSession.date,
        time: effectiveSession.time,
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
        paymentSurface:
          photoContext === FLOW_CONTEXT.KIOSK_TERMINAL || isMobileQrCheckInBooking ? "hosted_checkout" : "web_checkout",
        // Consecutive class fields (present when user accepted the consecutive offer)
        consecutivePriceCents: validation.consecutivePriceCents != null ? String(validation.consecutivePriceCents) : "",
        consecutiveLinkedCourseSlug: validation.consecutiveLinkedCourseSlug || "",
        consecutiveCourseTitle: validation.consecutiveCourseTitle || "",
        consecutiveLinkedCourseTime: validation.consecutiveLinkedCourseTime || "",
        consecutiveAddOnOnly: String(validation.consecutiveAddOnOnly),
        linkedFromCourseSlug: validation.linkedFromCourseSlug || "",
        ...heritagePinMetadata,
        ...promotionMetadata,
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
    Sentry.captureException(err)
    return NextResponse.json({ error: "Unable to create checkout session" }, { status: 500 })
  }
}

export const POST = (req: Request) => handleCheckoutSession(req)
