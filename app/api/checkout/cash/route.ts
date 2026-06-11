import { NextResponse } from "next/server"
import {
  clearPreparedCheckoutAfterSuccess,
  enrollStudentPinForCheckout,
  enforceNewStudentRules,
  resolveCheckoutPreparation,
  type ApiError,
} from "@/lib/checkout"
import { validateCheckoutPayload, type CheckoutBody } from "@/lib/checkout/validation"
import { resolveKioskEffectiveSessionDateTime } from "@/lib/checkout/kiosk-context"
import { parsePhotoFlowContext } from "@/lib/checkin/photo-context-policy"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { upsertUserByIdentifiers } from "@/lib/users"
import { prisma } from "@/lib/prisma"
import { SUCCESSFUL_PURCHASE_STATUSES } from "@/lib/purchase-status"

export const runtime = "nodejs"

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
    studentPin,
    studentPinConfirm,
  } = body || {}
  const photoContext = parsePhotoFlowContext((body as Record<string, unknown>)?.photoContext)

  const cashNote = normalizeCashNote((body as Record<string, unknown>)?.cashNote)

  const validation = await validateCheckoutPayload(body)
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
            purchaseSource: "web",
            paymentMethod: "onsite",
            paymentChannel: "cash",
            settlementStatus: "pending",
            settledAt: null,
            date: effectiveSession.date,
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
            purchaseSource: "web",
            paymentMethod: "onsite",
            paymentChannel: "cash",
            settlementStatus: "pending",
            settledAt: null,
            date: effectiveSession.date,
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
      terminalAuth,
      kioskSessionToken,
      validation,
    })

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
        purchaseSource: "web",
        paymentMethod: "onsite",
        paymentChannel: "cash",
        settlementStatus: "pending",
        settledAt: null,
        date: effectiveSession.date,
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
    terminalAuth,
    kioskSessionToken,
    validation,
  })

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
