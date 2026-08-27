import { NextResponse } from "next/server"
import { headers } from "next/headers"
import Stripe from "stripe"
import * as Sentry from "@sentry/nextjs"
import { Prisma } from "@prisma/client"
import type { ClerkClient } from "@clerk/backend"
import { clerkClient } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { upsertUserByIdentifiers } from "@/lib/users"
import { syncPackagePurchaseFromPaidPurchase } from "@/lib/packages"
import { normalizePersistedPurchaseStatus, SUCCESSFUL_PURCHASE_STATUSES } from "@/lib/purchase-status"
import {
  normalizeFailureFromPaymentIntent,
  normalizeFailureFromCheckoutSession,
  mergeFailureIntoMetadata,
  clearFailureFromMetadata,
  mergeMetadataPreservingFailure,
} from "@/lib/stripe-failure"
import { syncScheduledAttendanceFromPurchase } from "@/lib/bookings"
import { awardPointsFromRule } from "@/lib/points/service"
import { POINTS_RULE_KEYS } from "@/lib/points/constants"
import { normalizePhone } from "@/lib/shared"
import { FLOW_CONTEXT, PAYMENT_CHANNEL, PURCHASE_SOURCE, SETTLEMENT_STATUS, resolveKioskPurchaseSource } from "@/lib/payment-constants"
import { ATTENDANCE_STATUS } from "@/lib/attendance-constants"
import { pickStripeMetadata, parseIntSafe, normalize, type StripeMetadata } from "@/lib/stripe-metadata"
import { incrementDayOfWeekCounter } from "@/lib/checkin/day-of-week-counter"
import {
  claimStripeWebhookEvent,
  completeStripeWebhookEvent,
  markStripeWebhookEventFailed,
  touchStripeWebhookEventHeartbeat,
} from "@/lib/stripe/webhook-event-store"
import { SPECIAL_SALSA_CLASS, isSpecialClassPriceCents } from "@/lib/special-salsa-class/config"
import {
  admitSpecialClassAuthorization,
  finalizeSpecialClassCapture,
  finalizeSpecialClassNoCapacityCancellation,
  finalizeSpecialClassPaymentFailure,
} from "@/lib/special-classes/fulfillment"

export const runtime = "nodejs"

const stripeSecret = process.env.STRIPE_SECRET_KEY
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

const stripe = stripeSecret
  ? new Stripe(stripeSecret, {
      apiVersion: "2026-01-28.clover",
    })
  : null

const packagePurchaseEventKey = (packagePurchaseId: string) => `package-purchase:${packagePurchaseId}`

const resolveTrustedSpecialMetadata = (
  meta: StripeMetadata,
  amount: number,
  currency: string,
  lockedPurchase?: { amount: number; currency: string; metadata: unknown } | null,
): StripeMetadata => {
  if (!meta.specialEventKey) return meta
  if (meta.specialEventKey !== SPECIAL_SALSA_CLASS.key) {
    throw new Error("Unrecognized special event marker")
  }
  if (!isSpecialClassPriceCents(amount) || currency.toLowerCase() !== SPECIAL_SALSA_CLASS.currency) {
    throw new Error("Special event payment contract mismatch")
  }
  const metadataAmount = parseIntSafe(meta.lockedAmountCents)
  if (metadataAmount !== undefined && metadataAmount !== amount) {
    throw new Error("Special event metadata amount mismatch")
  }
  const lockedMetadata = lockedPurchase?.metadata
  if (lockedPurchase && (
    lockedPurchase.amount !== amount ||
    lockedPurchase.currency.toLowerCase() !== currency.toLowerCase() ||
    !lockedMetadata ||
    typeof lockedMetadata !== "object" ||
    Array.isArray(lockedMetadata) ||
    !Object.hasOwn(lockedMetadata, "specialEventKey") ||
    (lockedMetadata as Record<string, unknown>).specialEventKey !== SPECIAL_SALSA_CLASS.key
  )) {
    throw new Error("Special event locked Purchase mismatch")
  }
  return {
    ...meta,
    courseSlug: SPECIAL_SALSA_CLASS.courseSlug,
    courseTitle: SPECIAL_SALSA_CLASS.title,
    date: SPECIAL_SALSA_CLASS.localDate,
    time: SPECIAL_SALSA_CLASS.localTime,
    serviceId: SPECIAL_SALSA_CLASS.checkoutKind,
    participants: "1",
  }
}

const isTerminalFlow = (metadata: StripeMetadata) => {
  if (metadata.flowContext === FLOW_CONTEXT.KIOSK_TERMINAL) return true
  // Mobile-QR check-in paid via Stripe HOSTED checkout (full-page redirect): the
  // browser navigates away to Stripe, so — unlike the embedded-modal path — there is
  // no post-payment client callback to /api/checkin/qr/dropin. This webhook is the
  // ONLY completion path, so it must mark attendance as checked-in the same way the
  // staff kiosk terminal does. Gated on paymentSurface === "hosted_checkout" so a
  // regular (scheduled) qr_phone booking is never accidentally checked in.
  return metadata.flowContext === FLOW_CONTEXT.QR_PHONE && metadata.paymentSurface === "hosted_checkout"
}

const resolveAttendanceStatusForFlow = (input: {
  metadata: StripeMetadata
  hasPackagePurchase?: boolean
}) => {
  if (!isTerminalFlow(input.metadata)) return ATTENDANCE_STATUS.SCHEDULED
  return input.hasPackagePurchase ? ATTENDANCE_STATUS.CHECKED_IN : ATTENDANCE_STATUS.CHECKED_IN_NO_PACKAGE
}

const buildConsecutiveSplit = (input: {
  totalAmount: number
  metadata: StripeMetadata
}) => {
  const consecutivePriceCents = parseIntSafe(input.metadata.consecutivePriceCents)
  const consecutiveCourseSlug = input.metadata.consecutiveLinkedCourseSlug
  const hasConsecutiveSplit =
    Number.isFinite(consecutivePriceCents) &&
    (consecutivePriceCents ?? 0) > 0 &&
    Boolean(consecutiveCourseSlug) &&
    input.totalAmount > (consecutivePriceCents ?? 0)

  if (!hasConsecutiveSplit) {
    return {
      hasConsecutiveSplit: false,
      primaryAmount: input.totalAmount,
      consecutiveAmount: null,
      consecutiveCourseSlug: null,
      consecutiveCourseTitle: null,
      consecutiveCourseTime: null,
    }
  }

  return {
    hasConsecutiveSplit: true,
    primaryAmount: input.totalAmount - (consecutivePriceCents as number),
    consecutiveAmount: consecutivePriceCents as number,
    consecutiveCourseSlug: consecutiveCourseSlug as string,
    consecutiveCourseTitle: input.metadata.consecutiveCourseTitle || null,
    consecutiveCourseTime: input.metadata.consecutiveLinkedCourseTime || null,
  }
}

const mergeCardSettlementMetadata = (metadata: Record<string, unknown>, status: string) => {
  if (status !== SETTLEMENT_STATUS.PAID) return metadata

  return {
    ...metadata,
    paymentChannel: PAYMENT_CHANNEL.CARD,
    settlementStatus: SETTLEMENT_STATUS.PAID,
    settledAt: normalize(metadata.settledAt as string | undefined) || new Date().toISOString(),
  }
}

type ClerkUser = Awaited<ReturnType<ClerkClient["users"]["getUser"]>>

const getDisplayName = (user: ClerkUser) => {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim()
  if (fullName) return fullName
  return user.username || undefined
}

// (TODO: tune from measured Clerk API latency if this ever proves too tight —
// no p99 data exists yet; 5s is a conservative bound chosen to keep the whole
// webhook well within Stripe's response-time expectations even when Clerk is slow.)
const CLERK_GET_USER_TIMEOUT_MS = 5000

function timeoutRejectingAfter(ms: number): Promise<never> {
  return new Promise((_resolve, reject) => {
    setTimeout(() => reject(new Error(`Clerk getUser timed out after ${ms}ms`)), ms)
  })
}

const isP2002 = (error: unknown): error is Prisma.PrismaClientKnownRequestError =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"

async function resolveUser(params: {
  clerkId?: string
  email?: string
  name?: string
  phone?: string
  stripeCustomerId?: string
}) {
  const clerkId = params.clerkId
  const stripeCustomerId = params.stripeCustomerId
  let { email, name, phone } = params

  if (clerkId) {
    try {
      const client = await clerkClient()
      // .catch() is attached directly to the getUser() promise (not to the
      // race result) because @clerk/backend's getUser() takes no
      // AbortSignal/cancellation token: if the timeout branch wins the race,
      // getUser() keeps running in the background and can still reject later.
      // Without a handler attached here, that late rejection would be an
      // unhandled promise rejection.
      const clerkUser = await Promise.race([
        client.users.getUser(clerkId).catch(() => undefined),
        timeoutRejectingAfter(CLERK_GET_USER_TIMEOUT_MS),
      ])
      if (clerkUser) {
        email = email || clerkUser.primaryEmailAddress?.emailAddress || undefined
        const canonicalClerkName = getDisplayName(clerkUser)
        if (canonicalClerkName) {
          name = canonicalClerkName
        }
        phone = phone || clerkUser.primaryPhoneNumber?.phoneNumber || undefined
      }
    } catch {
      // ignore and fallback to whatever we already have (timeout path)
    }
  }

  const normalizedPhone = normalizePhone(phone)

  return upsertUserByIdentifiers({
    clerkId,
    email,
    name,
    phone: normalizedPhone,
    stripeCustomerId,
    nameIsCanonical: true,
  })
}

type ResolvedUser = NonNullable<Awaited<ReturnType<typeof resolveUser>>>

type UpsertWhere =
  | { stripeCheckoutSessionId: string }
  | { stripePaymentIntentId: string }

interface ProcessPaidEventParams {
  eventId: string
  upsertWhere: UpsertWhere
  upsertCreateIds: { stripeCheckoutSessionId?: string; stripePaymentIntentId?: string }
  existingMetadata: Prisma.JsonValue | undefined | null
  incomingRawMeta: Record<string, unknown> | null | undefined
  meta: StripeMetadata
  user: ResolvedUser
  amount: number
  currency: string
  status: string
  purchaseName: string | undefined
  email: string | undefined
  phone: string | undefined
  source: "stripe_webhook_checkout" | "stripe_webhook_intent"
}

async function processPaidStripeEvent(params: ProcessPaidEventParams) {
  const {
    eventId,
    upsertWhere,
    upsertCreateIds,
    existingMetadata,
    incomingRawMeta,
    meta,
    user,
    amount,
    currency,
    status,
    purchaseName,
    email,
    phone,
    source,
  } = params

  const participants = parseIntSafe(meta.participants)
  const courseSlug = meta.courseSlug || "unknown"
  const split = buildConsecutiveSplit({ totalAmount: amount, metadata: meta })

  const baseMeta = mergeMetadataPreservingFailure(existingMetadata, incomingRawMeta)
  const mergedMetadata = mergeCardSettlementMetadata(
    status === "paid" ? clearFailureFromMetadata(baseMeta) : baseMeta,
    status,
  ) as Prisma.InputJsonValue

  if (mergedMetadata && typeof mergedMetadata === "object" && !Array.isArray(mergedMetadata)) {
    ;(mergedMetadata as Record<string, unknown>).purchaseSource =
      resolveKioskPurchaseSource((mergedMetadata as Record<string, unknown>)?.flowContext as string | undefined)
  }

  const purchase = await prisma.purchase.upsert({
    where: upsertWhere as Parameters<typeof prisma.purchase.upsert>[0]["where"],
    update: {
      ...upsertCreateIds,
      status,
      amount: split.primaryAmount,
      currency,
      email,
      name: purchaseName,
      phone,
      participants,
      coupon: meta.coupon,
      packageId: meta.packageId,
      serviceId: meta.serviceId,
      addonsCsv: meta.addons,
      courseSlug,
      courseTitle: meta.courseTitle,
      metadata: mergedMetadata,
    },
    create: {
      userId: user.id,
      ...upsertCreateIds,
      status,
      amount: split.primaryAmount,
      currency,
      email,
      name: purchaseName,
      phone,
      participants,
      coupon: meta.coupon,
      packageId: meta.packageId,
      serviceId: meta.serviceId,
      addonsCsv: meta.addons,
      courseSlug,
      courseTitle: meta.courseTitle,
      metadata: {
        ...(mergedMetadata as Record<string, unknown>),
        ...(split.hasConsecutiveSplit ? { hasConsecutiveLinkedPurchase: true } : {}),
      } as Prisma.InputJsonValue,
    },
  })
  await touchStripeWebhookEventHeartbeat(eventId)

  let consecutivePurchase: { id: string } | null = null
  if (split.hasConsecutiveSplit) {
    try {
      consecutivePurchase = await prisma.$transaction(async (tx) => {
        const existingChild = await tx.purchase.findFirst({
          where: {
            userId: user.id,
            metadata: { path: ["parentPurchaseId"], equals: purchase.id },
          },
          select: { id: true },
        })

        if (existingChild) return existingChild

        return tx.purchase.create({
          data: {
            userId: user.id,
            courseSlug: split.consecutiveCourseSlug as string,
            courseTitle: split.consecutiveCourseTitle,
            amount: split.consecutiveAmount as number,
            currency,
            status,
            email,
            name: purchaseName,
            phone,
            participants: 1,
            coupon: null,
            packageId: null,
            serviceId: meta.serviceId,
            addonsCsv: null,
            // Top-level column, purely a DB-level uniqueness guard for the
            // concurrent-double-write defense (@@unique([parentPurchaseId]),
            // design §2b). MUST be written IN ADDITION to metadata below — do
            // NOT remove parentPurchaseId from metadata; payments-loader-purchase.ts
            // and payments-row.ts, plus this route's own pre-check findFirst above,
            // still read metadata.parentPurchaseId (design ADR-4b / baked-in
            // constraint #1).
            parentPurchaseId: purchase.id,
            metadata: {
              ...(mergedMetadata as Record<string, unknown>),
              parentPurchaseId: purchase.id,
              consecutiveLinkedFrom: courseSlug,
              courseSlug: split.consecutiveCourseSlug,
              courseTitle: split.consecutiveCourseTitle || "",
              time: split.consecutiveCourseTime || meta.time || "",
            },
          },
          select: { id: true },
        })
      })
    } catch (err) {
      if (!isP2002(err)) throw err
      // A concurrent worker won the race on @@unique([parentPurchaseId]) first.
      // Postgres aborts the ENTIRE transaction on any statement failure inside
      // it (25P02) — any further query on the same `tx` client would itself
      // throw. The recovery read MUST happen outside the transaction, on the
      // top-level `prisma` client, on a fresh connection (design §6/ADR-4d,
      // baked-in constraint #2).
      consecutivePurchase = await prisma.purchase.findUnique({
        where: { parentPurchaseId: purchase.id },
      })
    }
    await touchStripeWebhookEventHeartbeat(eventId)
  }

  if (status === "paid") {
    const packagePurchase = await syncPackagePurchaseFromPaidPurchase({
      userId: user.id,
      purchaseId: purchase.id,
      purchasedAt: purchase.createdAt,
      metadata: {
        courseSlug,
        packageId: meta.packageId,
        packageLabel: meta.packageLabel,
        packageTotalCredits: meta.packageTotalCredits,
        packageIsUnlimited: meta.packageIsUnlimited,
        packageCadence: meta.packageCadence,
        packageMakeUps: meta.packageMakeUps,
        packageValidDays: meta.packageValidDays,
      },
    })
    await touchStripeWebhookEventHeartbeat(eventId)

    await syncScheduledAttendanceFromPurchase({
      userId: user.id,
      purchaseId: purchase.id,
      courseSlug,
      courseTitle: meta.courseTitle,
      date: meta.date,
      time: meta.time,
      packagePurchaseId: packagePurchase?.id,
      preferredStatus: resolveAttendanceStatusForFlow({
        metadata: {
          ...meta,
          flowContext: meta.flowContext || normalize((mergedMetadata as Record<string, unknown>)?.flowContext as string | undefined),
          paymentSurface: meta.paymentSurface || normalize((mergedMetadata as Record<string, unknown>)?.paymentSurface as string | undefined),
        },
        hasPackagePurchase: Boolean(packagePurchase?.id),
      }),
      source,
    })
    await touchStripeWebhookEventHeartbeat(eventId)

    if (split.hasConsecutiveSplit && consecutivePurchase?.id) {
      await syncScheduledAttendanceFromPurchase({
        userId: user.id,
        purchaseId: consecutivePurchase.id,
        courseSlug: split.consecutiveCourseSlug as string,
        courseTitle: split.consecutiveCourseTitle,
        date: meta.date,
        time: split.consecutiveCourseTime || meta.time,
        preferredStatus: resolveAttendanceStatusForFlow({
          metadata: {
            ...meta,
            flowContext: meta.flowContext || normalize((mergedMetadata as Record<string, unknown>)?.flowContext as string | undefined),
            paymentSurface: meta.paymentSurface || normalize((mergedMetadata as Record<string, unknown>)?.paymentSurface as string | undefined),
          },
          hasPackagePurchase: false,
        }),
        source,
      })
      await touchStripeWebhookEventHeartbeat(eventId)
    }

    if (packagePurchase?.id) {
      await awardPointsFromRule({
        userId: user.id,
        ruleKey: POINTS_RULE_KEYS.PACKAGE_PURCHASE,
        eventKey: packagePurchaseEventKey(packagePurchase.id),
        fallbackType: "PACKAGE_PURCHASE",
        meta: {
          purchaseId: purchase.id,
          packagePurchaseId: packagePurchase.id,
          packageId: packagePurchase.packageId,
          source,
        },
      })
      await touchStripeWebhookEventHeartbeat(eventId)
    }

    // Increment day-of-week counter for kiosk purchases
    const purchaseSource =
      typeof (mergedMetadata as Record<string, unknown>)?.purchaseSource === "string"
        ? (mergedMetadata as Record<string, unknown>).purchaseSource as string
        : null
    if (purchaseSource === PURCHASE_SOURCE.KIOSK && meta.date) {
      try {
        await incrementDayOfWeekCounter(user.id, new Date(`${meta.date}T12:00:00.000Z`))
      } catch (err) {
        // Non-critical — log and continue; do not fail the webhook
        console.warn("Failed to increment day-of-week purchase counter", { userId: user.id, date: meta.date, err })
      }
    }
  }
}

async function handleCheckoutSession(session: Stripe.Checkout.Session, eventId: string) {
  const amount = session.amount_total ?? 0
  const currency = session.currency || "usd"
  const rawMeta = pickStripeMetadata(session.metadata)
  const specialPurchase = rawMeta.specialEventKey || rawMeta.specialClassId
    ? await prisma.purchase.findUnique({
        where: { stripeCheckoutSessionId: session.id },
        select: { id: true, metadata: true, amount: true, currency: true, stripePaymentIntentId: true },
      })
    : null
  if ((rawMeta.specialEventKey || rawMeta.specialClassId) && !specialPurchase) {
    throw new Error("Special event locked Purchase missing")
  }
  const meta = resolveTrustedSpecialMetadata(rawMeta, amount, currency, specialPurchase)
  const clerkId = meta.userId && meta.userId !== "guest" ? meta.userId : undefined
  const email = meta.email || session.customer_details?.email || session.customer_email || undefined
  const purchaseName = session.customer_details?.name || meta.name || undefined
  const phone =
    normalizePhone(meta.phone) ||
    normalizePhone(meta.phoneRaw) ||
    normalizePhone(session.customer_details?.phone) ||
    undefined
  const stripeCustomerId = typeof session.customer === "string" ? session.customer : undefined
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id

  if (rawMeta.specialClassId) {
    if (!paymentIntentId || !specialPurchase) throw new Error("Special class PaymentIntent missing")
    if (specialPurchase.amount !== amount || specialPurchase.currency.toLowerCase() !== currency.toLowerCase()) {
      throw new Error("Special class payment contract mismatch")
    }
    if (!specialPurchase.stripePaymentIntentId) {
      await prisma.purchase.update({
        where: { id: specialPurchase.id },
        data: { stripePaymentIntentId: paymentIntentId, stripeCheckoutSessionId: session.id },
      })
    }
    const intent = typeof session.payment_intent === "object" && session.payment_intent
      ? session.payment_intent
      : await stripe!.paymentIntents.retrieve(paymentIntentId)
    if (intent.status === "requires_capture" || intent.status === "succeeded" || intent.status === "canceled") {
      await handleSpecialClassPaymentIntent(intent, eventId)
    }
    return
  }

  const user = await resolveUser({
    clerkId,
    email,
    name: undefined,
    phone,
    stripeCustomerId,
  })

  if (!user) {
    console.warn("Stripe webhook: user resolution failed", {
      hasClerkId: Boolean(clerkId),
      hasEmail: Boolean(email),
    })
    throw new Error("Stripe webhook user resolution incomplete")
  }

  const status = normalizePersistedPurchaseStatus(session.payment_status)

  // If the payment_intent.succeeded handler already created a Purchase for this PI,
  // link it to the checkout session so the upsert below finds it instead of creating a duplicate.
  if (paymentIntentId) {
    const existingByIntent = await prisma.purchase.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
      select: { id: true, stripeCheckoutSessionId: true },
    })
    if (existingByIntent && !existingByIntent.stripeCheckoutSessionId) {
      await prisma.purchase.update({
        where: { id: existingByIntent.id },
        data: { stripeCheckoutSessionId: session.id },
      })
    }
  }

  // Fetch existing metadata to avoid clobbering stripeFailure on success
  const existingPurchase = specialPurchase || await prisma.purchase.findUnique({
    where: { stripeCheckoutSessionId: session.id },
    select: { metadata: true },
  })

  await processPaidStripeEvent({
    eventId,
    upsertWhere: { stripeCheckoutSessionId: session.id },
    upsertCreateIds: {
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
    },
    existingMetadata: existingPurchase?.metadata,
    incomingRawMeta: session.metadata as Record<string, unknown> | null | undefined,
    meta,
    user,
    amount,
    currency,
    status,
    purchaseName,
    email,
    phone,
    source: "stripe_webhook_checkout",
  })
}

async function handlePaymentIntent(intent: Stripe.PaymentIntent, eventId: string) {
  const amount = intent.amount ?? 0
  const currency = intent.currency || "usd"
  const meta = pickStripeMetadata(intent.metadata)
  if (meta.specialClassId) {
    resolveTrustedSpecialMetadata(meta, amount, currency)
    await handleSpecialClassPaymentIntent(intent, eventId)
    return
  }
  // Skip if this payment intent already has a Purchase record — either created by
  // this handler's upsert or by handleCheckoutSession which sets stripePaymentIntentId.
  const existingByIntent = await prisma.purchase.findUnique({
    where: { stripePaymentIntentId: intent.id },
    select: { id: true },
  })
  if (existingByIntent) return

  if (meta.specialEventKey) {
    resolveTrustedSpecialMetadata(meta, amount, currency)
    return
  }
  const clerkId = meta.userId && meta.userId !== "guest" ? meta.userId : undefined
  const email = meta.email || intent.receipt_email || undefined
  const purchaseName = meta.name || undefined
  const phone = normalizePhone(meta.phone) || normalizePhone(meta.phoneRaw) || undefined
  const stripeCustomerId = typeof intent.customer === "string" ? intent.customer : undefined

  const user = await resolveUser({
    clerkId,
    email,
    name: undefined,
    phone,
    stripeCustomerId,
  })

  if (!user) {
    console.warn("Stripe webhook: user resolution failed", {
      hasClerkId: Boolean(clerkId),
      hasEmail: Boolean(email),
    })
    throw new Error("Stripe webhook user resolution incomplete")
  }

  const status = normalizePersistedPurchaseStatus(intent.status)

  // Fetch existing metadata to avoid clobbering stripeFailure on success
  // Note: existingByIntent is null here (we returned early if it existed),
  // so existingPurchase will always be null — kept for symmetry with checkout handler.
  const existingPurchase = await prisma.purchase.findUnique({
    where: { stripePaymentIntentId: intent.id },
    select: { metadata: true },
  })

  await processPaidStripeEvent({
    eventId,
    upsertWhere: { stripePaymentIntentId: intent.id },
    upsertCreateIds: { stripePaymentIntentId: intent.id },
    existingMetadata: existingPurchase?.metadata,
    incomingRawMeta: intent.metadata as Record<string, unknown> | null | undefined,
    meta,
    user,
    amount,
    currency,
    status,
    purchaseName,
    email,
    phone,
    source: "stripe_webhook_intent",
  })
}

async function handleSpecialClassPaymentIntent(intent: Stripe.PaymentIntent, eventId: string) {
  const metadataPurchaseId = intent.metadata.purchaseId?.trim()
  const purchase = metadataPurchaseId
    ? await prisma.purchase.findUnique({ where: { id: metadataPurchaseId } })
    : await prisma.purchase.findUnique({ where: { stripePaymentIntentId: intent.id } })
  if (!purchase) throw new Error("Special class locked Purchase missing")
  if (purchase.amount !== intent.amount || purchase.currency.toLowerCase() !== intent.currency.toLowerCase()) {
    throw new Error("Special class payment contract mismatch")
  }
  if (!purchase.stripePaymentIntentId) {
    await prisma.purchase.update({ where: { id: purchase.id }, data: { stripePaymentIntentId: intent.id } })
  } else if (purchase.stripePaymentIntentId !== intent.id) {
    throw new Error("Special class PaymentIntent linkage mismatch")
  }

  const outcome = await admitSpecialClassAuthorization(prisma, {
    purchaseId: purchase.id,
    amount: intent.amount,
    currency: intent.currency,
    eventId,
    source: "stripe_webhook_intent",
  })
  if (outcome.kind === "captured") return
  if (outcome.kind === "capture") {
    if (intent.status !== "succeeded") {
      if (intent.status !== "requires_capture") throw new Error(`Special class PaymentIntent is not capturable: ${intent.status}`)
      await stripe!.paymentIntents.capture(intent.id, {}, { idempotencyKey: `special-class:capture:${purchase.id}` })
    }
    await finalizeSpecialClassCapture(prisma, { purchaseId: purchase.id, eventId })
    return
  }
  if (intent.status !== "canceled") {
    if (intent.status !== "requires_capture") throw new Error(`Special class PaymentIntent is not cancellable: ${intent.status}`)
    await stripe!.paymentIntents.cancel(intent.id, {}, { idempotencyKey: `special-class:cancel:${purchase.id}` })
  }
  await finalizeSpecialClassNoCapacityCancellation(prisma, { purchaseId: purchase.id, eventId })
}

async function handlePaymentIntentFailure(event: Stripe.Event) {
  const intent = event.data.object as Stripe.PaymentIntent
  const failure = normalizeFailureFromPaymentIntent(intent, event)

  const purchase = await prisma.purchase.findUnique({
    where: { stripePaymentIntentId: intent.id },
  })
  if (!purchase) return // failure events never create purchases
  if (SUCCESSFUL_PURCHASE_STATUSES.includes(purchase.status)) return // status guard: never downgrade paid

  const failureMetadata = mergeFailureIntoMetadata(purchase.metadata, failure) as Prisma.InputJsonValue
  if (purchase.specialClassId && purchase.classSessionId) {
    await finalizeSpecialClassPaymentFailure(prisma, { purchaseId: purchase.id, eventId: event.id, metadata: failureMetadata })
    return
  }

  await prisma.purchase.update({
    where: { id: purchase.id },
    data: {
      status: "failed",
      metadata: failureMetadata,
    },
  })
}

async function handleCheckoutSessionTerminal(event: Stripe.Event, status: "expired" | "failed") {
  const session = event.data.object as Stripe.Checkout.Session
  const failure = normalizeFailureFromCheckoutSession(session, event)

  const purchase = await prisma.purchase.findUnique({
    where: { stripeCheckoutSessionId: session.id },
  })
  if (!purchase) return // failure events never create purchases
  if (SUCCESSFUL_PURCHASE_STATUSES.includes(purchase.status)) return // status guard: never downgrade paid

  await prisma.purchase.update({
    where: { id: purchase.id },
    data: {
      status,
      metadata: mergeFailureIntoMetadata(purchase.metadata, failure) as Prisma.InputJsonValue,
    },
  })
}

export async function POST(req: Request) {
  if (!stripe || !webhookSecret) {
    return new NextResponse("Stripe not configured", { status: 500 })
  }

  const signature = (await headers()).get("stripe-signature")
  if (!signature) {
    return new NextResponse("Missing Stripe signature", { status: 400 })
  }

  const body = await req.text()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error("Stripe webhook: failed to construct event from signature", err)
    const message = err instanceof Error ? err.message : "Unknown error"
    return new NextResponse(`Webhook error: ${message}`, { status: 400 })
  }

  // Claim-then-process: the eventId unique constraint is the lock (design §3/§4).
  // No StripeWebhookEvent row is ever written for a signature failure (handled above).
  const claim = await claimStripeWebhookEvent(event.id, event.type)
  if (claim === "duplicate") {
    return new NextResponse("Event already processed", { status: 200 })
  }
  if (claim === "in-flight") {
    // Distinct log tag from the 500/processing-failure path — a healthy system
    // shows occasional 409s under Stripe's near-duplicate delivery behavior;
    // a SPIKE in rate is the actionable signal, not any single occurrence.
    console.warn("stripe_webhook_in_flight", { eventId: event.id, eventType: event.type })
    return new NextResponse("Event is currently being processed", { status: 409 })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSession(event.data.object as Stripe.Checkout.Session, event.id)
        break
      case "payment_intent.succeeded":
        await handlePaymentIntent(event.data.object as Stripe.PaymentIntent, event.id)
        break
      case "payment_intent.amount_capturable_updated":
        await handlePaymentIntent(event.data.object as Stripe.PaymentIntent, event.id)
        break
      case "payment_intent.payment_failed":
        await handlePaymentIntentFailure(event)
        break
      case "checkout.session.expired":
        await handleCheckoutSessionTerminal(event, "expired")
        break
      case "checkout.session.async_payment_failed":
        await handleCheckoutSessionTerminal(event, "failed")
        break
      default:
        break
    }
  } catch (err) {
    console.error("Stripe webhook handler failed", err)
    Sentry.captureException(err, { tags: { eventType: event.type, eventId: event.id } })
    await markStripeWebhookEventFailed(event.id)
    return new NextResponse("Webhook handler failed", { status: 500 })
  }

  // Completion write is isolated in its own try/catch, separate from the
  // processing try/catch above, so a bookkeeping-write failure after real
  // success is never confused with (or triggers the same remediation as) an
  // actual processing failure (design §4 step 6, ADR-4).
  const completionRecorded = await markEventCompletedWithRetry(event.id, event.type)
  if (!completionRecorded) return new NextResponse("Webhook completion could not be recorded", { status: 500 })

  return NextResponse.json({ received: true })
}

const COMPLETION_WRITE_MAX_ATTEMPTS = 3

async function markEventCompletedWithRetry(eventId: string, eventType: string): Promise<boolean> {
  for (let attempt = 1; attempt <= COMPLETION_WRITE_MAX_ATTEMPTS; attempt++) {
    try {
      await completeStripeWebhookEvent(eventId)
      return true
    } catch (err) {
      if (attempt < COMPLETION_WRITE_MAX_ATTEMPTS) continue
      // Business processing is idempotent, so leave the claim incomplete and
      // return non-2xx. Stripe can safely retry until completion is durable.
      console.error("stripe_webhook_completion_write_exhausted", { eventId, eventType, err })
      return false
    }
  }
  return false
}
