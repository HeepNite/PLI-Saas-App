import { NextResponse } from "next/server"
import Stripe from "stripe"
import * as Sentry from "@sentry/nextjs"
import {
  clearPreparedCheckoutAfterSuccess,
  enforceNewStudentRules,
  resolveCheckoutPreparation,
  type ApiError,
} from "@/lib/checkout"
import { validateCheckoutPayload, type CheckoutBody } from "@/lib/checkout/validation"
import { resolveKioskEffectiveSessionDateTime } from "@/lib/checkout/kiosk-context"
import { getTodayNewYork } from "@/lib/class-schedule"
import { parsePhotoFlowContext } from "@/lib/checkin/photo-context-policy"
import { verifyKioskQrCashGrant } from "@/lib/checkin/kiosk-qr-cash-grant"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { upsertUserByIdentifiers } from "@/lib/users"
import { prisma } from "@/lib/prisma"
import { SUCCESSFUL_PURCHASE_STATUSES } from "@/lib/purchase-status"
import { FLOW_CONTEXT, PAYMENT_CHANNEL, SETTLEMENT_STATUS, resolveKioskPurchaseSource } from "@/lib/payment-constants"
import { incrementDayOfWeekCounter } from "@/lib/checkin/day-of-week-counter"
import { authorizeStaffTerminalSession } from "@/lib/security/staff-terminal"

export const runtime = "nodejs"

const stripeSecret = process.env.STRIPE_SECRET_KEY
const stripe = stripeSecret ? new Stripe(stripeSecret, { apiVersion: "2026-01-28.clover" }) : null

const QR_CHECKOUT_LOOKBACK_SECONDS = 24 * 60 * 60
// Studio volume is far below this; hitting it means we cannot be sure we saw every session.
const QR_CHECKOUT_MAX_SCANNED_SESSIONS = 1000

type QrCheckoutSessionGuard =
  | { ok: true }
  | { ok: false; status: number; error: string; code: "ALREADY_PAID_BY_CARD" | "CARD_CHECKOUT_UNVERIFIED" }

const CARD_CHECKOUT_UNVERIFIED: QrCheckoutSessionGuard = {
  ok: false,
  status: 409,
  code: "CARD_CHECKOUT_UNVERIFIED",
  error: "We couldn't confirm your card checkout was cancelled, so cash was not recorded. Please try again or pay at the front desk.",
}

const ALREADY_PAID_BY_CARD: QrCheckoutSessionGuard = {
  ok: false,
  status: 409,
  code: "ALREADY_PAID_BY_CARD",
  error: "This class was already paid by card, so cash was not recorded. Please check with the front desk.",
}

type QrBookingIdentity = { courseSlug: string; date: string; time: string; email: string; userId: string }

const sameEmail = (value: string | null | undefined, email: string) =>
  Boolean(value && email && value.trim().toLowerCase() === email.trim().toLowerCase())

/** True for a hosted session our session route created for this exact student + QR class. */
const isSessionForQrBooking = (session: Stripe.Checkout.Session, booking: QrBookingIdentity) => {
  const metadata = session.metadata ?? {}
  const sameBooking =
    metadata.flowContext === FLOW_CONTEXT.QR_PHONE &&
    metadata.courseSlug === booking.courseSlug &&
    metadata.date === booking.date &&
    metadata.time === booking.time
  if (!sameBooking) return false
  return (
    sameEmail(metadata.email, booking.email) ||
    sameEmail(session.customer_email, booking.email) ||
    sameEmail(session.customer_details?.email, booking.email) ||
    (Boolean(metadata.userId) && metadata.userId !== "guest" && metadata.userId === booking.userId)
  )
}

/**
 * A kiosk-QR student who cancelled Stripe Checkout leaves the hosted session open
 * (regular hosted sessions have no expiry), so it could still be paid from browser
 * history after cash is recorded. Before recording cash, find every recent session
 * our session route created for this student + class: refuse if any was paid,
 * expire the open ones, and fail closed on any Stripe error or doubt.
 */
async function guardQrCashAgainstCardCheckout(booking: QrBookingIdentity): Promise<QrCheckoutSessionGuard> {
  if (!stripe || !booking.courseSlug || !booking.date || !booking.time) return CARD_CHECKOUT_UNVERIFIED
  try {
    const matches: Stripe.Checkout.Session[] = []
    let scanned = 0
    for await (const session of stripe.checkout.sessions.list({
      created: { gte: Math.floor(Date.now() / 1000) - QR_CHECKOUT_LOOKBACK_SECONDS },
      limit: 100,
    })) {
      scanned += 1
      if (scanned > QR_CHECKOUT_MAX_SCANNED_SESSIONS) return CARD_CHECKOUT_UNVERIFIED
      if (isSessionForQrBooking(session, booking)) matches.push(session)
    }
    if (matches.some((session) => session.payment_status === "paid" || session.status === "complete")) {
      return ALREADY_PAID_BY_CARD
    }
    for (const session of matches) {
      if (session.status === "expired") continue
      if (session.status !== "open") return CARD_CHECKOUT_UNVERIFIED
      const expired = await stripe.checkout.sessions.expire(session.id)
      if (expired.status !== "expired") return CARD_CHECKOUT_UNVERIFIED
    }
    return { ok: true }
  } catch (err) {
    console.error("qr_cash_card_checkout_guard_failed", err)
    Sentry.captureException(err)
    return CARD_CHECKOUT_UNVERIFIED
  }
}

const isApiError = (value: unknown): value is ApiError =>
  Boolean(value && typeof value === "object" && "status" in value && "error" in value)

const toErrorResponse = (error: ApiError) =>
  NextResponse.json({ error: error.error, ...(error.code ? { code: error.code } : {}) }, { status: error.status })

const normalizeCashNote = (value: unknown) => {
  if (typeof value !== "string") return ""
  return value.trim().slice(0, 500)
}

export async function POST(req: Request) {
  const startedAt = Date.now()
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("checkout:cash", getClientIp(req)),
    limit: 40,
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
  } = body || {}
  const requestContext = body && typeof body === "object" ? body as Record<string, unknown> : {}
  const photoContext = parsePhotoFlowContext(requestContext.photoContext)
  const isPublicBookingRequest =
    requestContext.bookingSource === "public_booking" || requestContext.checkoutChannel === "public_booking"
  const isQrPhone = photoContext === FLOW_CONTEXT.QR_PHONE
  const grantVerification = isQrPhone && !isPublicBookingRequest
    ? verifyKioskQrCashGrant(requestContext.kioskQrCashGrant, {
        courseSlug: typeof requestContext.courseSlug === "string" ? requestContext.courseSlug : "",
        date: typeof requestContext.date === "string" ? requestContext.date : "",
        time: typeof requestContext.time === "string" ? requestContext.time : "",
      })
    : { ok: false as const }
  const hasSpecialClassFields = Boolean(requestContext.checkoutKind || requestContext.specialClassId)
  const isInStudioQrPhone = isQrPhone && grantVerification.ok && !hasSpecialClassFields
  if (photoContext !== FLOW_CONTEXT.KIOSK_TERMINAL && !isInStudioQrPhone) {
    return NextResponse.json(
      { error: "Cash payment is available only from a studio terminal." },
      { status: 403 },
    )
  }

  const cashNote = normalizeCashNote(requestContext.cashNote)

  const validation = await validateCheckoutPayload(body)
  if (isApiError(validation)) {
    return toErrorResponse(validation)
  }
  const effectiveSession = resolveKioskEffectiveSessionDateTime({
    photoContext,
    validation,
  })
  // A package sold without a class has no session date. Stamp the sale day so
  // history ranges (which scope on metadata.date) can find the purchase.
  const purchaseDate = effectiveSession.date || (validation.packageId ? getTodayNewYork() : effectiveSession.date)

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
      serviceId: validation.serviceId,
      validation,
    }
  )
  if (isApiError(preparation)) {
    return toErrorResponse(preparation)
  }

  const { preparedAccount, verification, source, fallbackReason, terminalAuth } = preparation
  const resolvedTerminalAuth = terminalAuth?.ok
    ? terminalAuth
    : photoContext === FLOW_CONTEXT.KIOSK_TERMINAL
      ? await authorizeStaffTerminalSession()
      : null
  const authorizedTerminalAuth = resolvedTerminalAuth?.ok ? resolvedTerminalAuth : null
  if (!isInStudioQrPhone && !authorizedTerminalAuth) {
    return NextResponse.json(
      { error: "Cash payment is available only from an authorized studio terminal." },
      { status: 403 },
    )
  }
  const { userId, clerkUser, resolvedUserId, identity, account } = preparedAccount

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

  const dbUser = await upsertUserByIdentifiers({
    clerkId: resolvedUserId || undefined,
    email: identity.resolvedEmail,
    phone: identity.phoneNormalized,
    name: name || [firstName, lastName].filter(Boolean).join(" ") || undefined,
  })

  if (!dbUser) {
    return NextResponse.json({ error: "Unable to resolve user" }, { status: 500 })
  }


  // Prevent duplicate purchases for the same user + class + date/time (drop-in only)
  if (validation.serviceId && effectiveSession.date && effectiveSession.time) {
    const existingPurchase = await prisma.purchase.findFirst({
      where: {
        userId: dbUser.id,
        serviceId: validation.serviceId,
        status: { in: SUCCESSFUL_PURCHASE_STATUSES },
        metadata: {
          path: ["date"],
          equals: effectiveSession.date,
        },
      },
      select: { id: true, metadata: true },
    })
    // Check time in metadata (Prisma doesn't support AND on same path)
    if (existingPurchase) {
      const existingTime =
        existingPurchase.metadata &&
        typeof existingPurchase.metadata === "object" &&
        "time" in existingPurchase.metadata
          ? existingPurchase.metadata.time
          : null
      if (existingTime === effectiveSession.time) {
        return NextResponse.json(
          { error: "You already have a purchase for this class", code: "DUPLICATE_PURCHASE" },
          { status: 409 }
        )
      }
    }
  }

  if (isInStudioQrPhone) {
    const guard = await guardQrCashAgainstCardCheckout({
      courseSlug: validation.courseSlug,
      date: effectiveSession.date ?? "",
      time: effectiveSession.time ?? "",
      email: identity.resolvedEmail ?? "",
      userId: resolvedUserId ?? "",
    })
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error, code: guard.code }, { status: guard.status })
    }
  }

  // ─── Dual Purchase creation for consecutive class ────────────
  const hasConsecutive =
    validation.consecutivePriceCents != null &&
    validation.consecutiveLinkedCourseSlug != null

  if (hasConsecutive) {
    const consecutiveAmountCents = validation.consecutivePriceCents!
    const consecutiveSlug = validation.consecutiveLinkedCourseSlug!
    const consecutiveTitle = validation.consecutiveCourseTitle || null
    const primaryAmountCents = validation.amountInt - consecutiveAmountCents

    const result = await prisma.$transaction(async (tx) => {
      // Purchase 1: original class
      const purchase1 = await tx.purchase.create({
        data: {
          userId: dbUser.id,
          courseSlug: validation.courseSlug,
          courseTitle: validation.courseTitle,
          amount: primaryAmountCents,
          currency: validation.currency,
          status: "pending",
          email: identity.resolvedEmail,
          name: name || [firstName, lastName].filter(Boolean).join(" ") || null,
          phone: identity.phoneNormalized,
          participants: validation.safeParticipants,
          coupon: validation.coupon || null,
          packageId: validation.packageId || null,
          serviceId: validation.serviceId || null,
          addonsCsv: validation.addons.join(",") || null,
          metadata: {
            source: "cash_checkout",
            purchaseSource: resolveKioskPurchaseSource(photoContext),
            paymentMethod: "onsite",
            paymentChannel: PAYMENT_CHANNEL.CASH,
            settlementStatus: SETTLEMENT_STATUS.PENDING,
            settledAt: null,
            date: purchaseDate,
            time: effectiveSession.time,
            courseSlug: validation.courseSlug,
            courseTitle: validation.courseTitle,
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
            phoneRaw: identity.phoneRaw || "",
            cashNote,
            requiresCardMigration: true,
            // Consecutive metadata: this purchase has a linked consecutive purchase
            hasConsecutiveLinkedPurchase: true,
            consecutiveLinkedSlug: consecutiveSlug,
          },
        },
      })

      // Purchase 2: consecutive class
      const purchase2 = await tx.purchase.create({
        data: {
          userId: dbUser.id,
          courseSlug: consecutiveSlug,
          courseTitle: consecutiveTitle,
          amount: consecutiveAmountCents,
          currency: validation.currency,
          status: "pending",
          email: identity.resolvedEmail,
          name: name || [firstName, lastName].filter(Boolean).join(" ") || null,
          phone: identity.phoneNormalized,
          participants: 1,
          coupon: null,
          packageId: null,
          serviceId: validation.serviceId || null,
          addonsCsv: null,
          metadata: {
            source: "cash_checkout",
            purchaseSource: resolveKioskPurchaseSource(photoContext),
            paymentMethod: "onsite",
            paymentChannel: PAYMENT_CHANNEL.CASH,
            settlementStatus: SETTLEMENT_STATUS.PENDING,
            settledAt: null,
            date: purchaseDate,
            time: validation.consecutiveLinkedCourseTime ?? effectiveSession.time,
            courseSlug: consecutiveSlug,
            courseTitle: consecutiveTitle || "",
            serviceId: validation.serviceId,
            userId: resolvedUserId || "guest",
            participants: "1",
            coupon: "",
            addons: "",
            name: name || [firstName, lastName].filter(Boolean).join(" ") || "",
            email: identity.resolvedEmail,
            phone: identity.phoneNormalized,
            phoneRaw: identity.phoneRaw || "",
            cashNote,
            requiresCardMigration: true,
            // Consecutive metadata: this IS the consecutive purchase
            consecutiveLinkedFrom: validation.courseSlug,
            consecutiveDiscount: true,
            parentPurchaseId: purchase1.id,
          },
        },
      })

      return { purchase1, purchase2 }
    })

    await clearPreparedCheckoutAfterSuccess({
      terminalAuth: authorizedTerminalAuth,
      kioskSessionToken,
      validation,
    })

    if (photoContext === FLOW_CONTEXT.KIOSK_TERMINAL && effectiveSession.date) {
      await incrementDayOfWeekCounter(dbUser.id, new Date(`${effectiveSession.date}T12:00:00.000Z`))
    }

    console.info("[staff-terminal-checkout-latency] checkout-cash", {
      segment: "cash_consecutive",
      source,
      fallbackReason: fallbackReason || null,
      durationMs: Date.now() - startedAt,
      reusedUserId: userId || null,
    })

    return NextResponse.json({
      ok: true,
      purchaseId: result.purchase1.id,
      consecutivePurchaseId: result.purchase2.id,
      packagePurchaseId: null,
      paymentMethod: "onsite",
      paymentStatus: result.purchase1.status,
      migration: {
        target: "card",
        recommended: true,
        message: "Cash request recorded as pending. Staff must confirm payment before class access.",
      },
      account,
    })
  }

  const purchase = await prisma.purchase.create({
    data: {
      userId: dbUser.id,
      courseSlug: validation.courseSlug,
      courseTitle: validation.courseTitle,
      amount: validation.amountInt,
      currency: validation.currency,
      status: "pending",
      email: identity.resolvedEmail,
      name: name || [firstName, lastName].filter(Boolean).join(" ") || null,
      phone: identity.phoneNormalized,
      participants: validation.safeParticipants,
      coupon: validation.coupon || null,
      packageId: validation.packageId || null,
      serviceId: validation.serviceId || null,
      addonsCsv: validation.addons.join(",") || null,
      metadata: {
        source: "cash_checkout",
        purchaseSource: resolveKioskPurchaseSource(photoContext),
        paymentMethod: "onsite",
        paymentChannel: PAYMENT_CHANNEL.CASH,
        settlementStatus: SETTLEMENT_STATUS.PENDING,
        settledAt: null,
        date: purchaseDate,
        time: effectiveSession.time,
        courseSlug: validation.courseSlug,
        courseTitle: validation.courseTitle,
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
        phoneRaw: identity.phoneRaw || "",
        cashNote,
        requiresCardMigration: true,
      },
    },
  })

  await clearPreparedCheckoutAfterSuccess({
    terminalAuth: authorizedTerminalAuth,
    kioskSessionToken,
    validation,
  })

  if (photoContext === FLOW_CONTEXT.KIOSK_TERMINAL && effectiveSession.date) {
    await incrementDayOfWeekCounter(dbUser.id, new Date(`${effectiveSession.date}T12:00:00.000Z`))
  }

  console.info("[staff-terminal-checkout-latency] checkout-cash", {
    segment: "cash_next_step",
    source,
    fallbackReason: fallbackReason || null,
    durationMs: Date.now() - startedAt,
    reusedUserId: userId || null,
  })

  return NextResponse.json({
    ok: true,
    purchaseId: purchase.id,
    packagePurchaseId: null,
    paymentMethod: "onsite",
    paymentStatus: purchase.status,
    migration: {
      target: "card",
      recommended: true,
      message: "Cash request recorded as pending. Staff must confirm payment before class access.",
    },
    account,
  })
}
