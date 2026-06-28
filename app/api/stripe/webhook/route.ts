import { NextResponse } from "next/server"
import { headers } from "next/headers"
import Stripe from "stripe"
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

export const runtime = "nodejs"

const stripeSecret = process.env.STRIPE_SECRET_KEY
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

const stripe = stripeSecret
  ? new Stripe(stripeSecret, {
      apiVersion: "2026-01-28.clover",
    })
  : null

const packagePurchaseEventKey = (packagePurchaseId: string) => `package-purchase:${packagePurchaseId}`

const isTerminalFlow = (metadata: StripeMetadata) => {
  return metadata.flowContext === FLOW_CONTEXT.KIOSK_TERMINAL
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
      const clerkUser = await client.users.getUser(clerkId)
      email = email || clerkUser.primaryEmailAddress?.emailAddress || undefined
      const canonicalClerkName = getDisplayName(clerkUser)
      if (canonicalClerkName) {
        name = canonicalClerkName
      }
      phone = phone || clerkUser.primaryPhoneNumber?.phoneNumber || undefined
    } catch {
      // ignore and fallback to whatever we already have
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

async function handleCheckoutSession(session: Stripe.Checkout.Session) {
  const meta = pickStripeMetadata(session.metadata)
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

  const user = await resolveUser({
    clerkId,
    email,
    name: undefined,
    phone,
    stripeCustomerId,
  })

  if (!user) {
    console.warn("Stripe webhook: user resolution failed", { clerkId, email })
    return
  }

  const amount = session.amount_total ?? 0
  const currency = session.currency || "usd"
  const status = normalizePersistedPurchaseStatus(session.payment_status)
  const participants = parseIntSafe(meta.participants)
  const courseSlug = meta.courseSlug || "unknown"
  const split = buildConsecutiveSplit({ totalAmount: amount, metadata: meta })

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
  const existingPurchase = await prisma.purchase.findUnique({
    where: { stripeCheckoutSessionId: session.id },
    select: { metadata: true },
  })
  const incomingMeta = session.metadata as Record<string, unknown> | null | undefined
  const baseMeta = mergeMetadataPreservingFailure(existingPurchase?.metadata, incomingMeta)
  const mergedMetadata = mergeCardSettlementMetadata(
    status === "paid" ? clearFailureFromMetadata(baseMeta) : baseMeta,
    status,
  ) as Prisma.InputJsonValue

  if (mergedMetadata && typeof mergedMetadata === "object" && !Array.isArray(mergedMetadata)) {
    ;(mergedMetadata as Record<string, unknown>).purchaseSource =
      resolveKioskPurchaseSource((mergedMetadata as Record<string, unknown>)?.flowContext as string | undefined)
  }

  const purchase = await prisma.purchase.upsert({
    where: { stripeCheckoutSessionId: session.id },
    update: {
      stripePaymentIntentId: paymentIntentId,
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
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
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

  let consecutivePurchase: { id: string } | null = null
  if (split.hasConsecutiveSplit) {
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
      source: "stripe_webhook_checkout",
    })

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
        source: "stripe_webhook_checkout",
      })
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
          source: "stripe_webhook_checkout",
        },
      })
    }
  }
}

async function handlePaymentIntent(intent: Stripe.PaymentIntent) {
  // Skip if this payment intent already has a Purchase record — either created by
  // this handler's upsert or by handleCheckoutSession which sets stripePaymentIntentId.
  const existingByIntent = await prisma.purchase.findUnique({
    where: { stripePaymentIntentId: intent.id },
    select: { id: true },
  })
  if (existingByIntent) return

  const meta = pickStripeMetadata(intent.metadata)
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
    console.warn("Stripe webhook: user resolution failed", { clerkId, email })
    return
  }

  const amount = intent.amount ?? 0
  const currency = intent.currency || "usd"
  const status = normalizePersistedPurchaseStatus(intent.status)
  const participants = parseIntSafe(meta.participants)
  const courseSlug = meta.courseSlug || "unknown"
  const split = buildConsecutiveSplit({ totalAmount: amount, metadata: meta })

  // Fetch existing metadata to avoid clobbering stripeFailure on success
  const existingPurchase = await prisma.purchase.findUnique({
    where: { stripePaymentIntentId: intent.id },
    select: { metadata: true },
  })
  const incomingMeta = intent.metadata as Record<string, unknown> | null | undefined
  const baseMeta = mergeMetadataPreservingFailure(existingPurchase?.metadata, incomingMeta)
  const mergedMetadata = mergeCardSettlementMetadata(
    status === "paid" ? clearFailureFromMetadata(baseMeta) : baseMeta,
    status,
  ) as Prisma.InputJsonValue

  if (mergedMetadata && typeof mergedMetadata === "object" && !Array.isArray(mergedMetadata)) {
    ;(mergedMetadata as Record<string, unknown>).purchaseSource =
      resolveKioskPurchaseSource((mergedMetadata as Record<string, unknown>)?.flowContext as string | undefined)
  }

  const purchase = await prisma.purchase.upsert({
    where: { stripePaymentIntentId: intent.id },
    update: {
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
      stripePaymentIntentId: intent.id,
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

  let consecutivePurchase: { id: string } | null = null
  if (split.hasConsecutiveSplit) {
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
      source: "stripe_webhook_intent",
    })

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
        source: "stripe_webhook_intent",
      })
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
          source: "stripe_webhook_intent",
        },
      })
    }
  }
}

async function handlePaymentIntentFailure(event: Stripe.Event) {
  const intent = event.data.object as Stripe.PaymentIntent
  const failure = normalizeFailureFromPaymentIntent(intent, event)

  const purchase = await prisma.purchase.findUnique({
    where: { stripePaymentIntentId: intent.id },
  })
  if (!purchase) return // failure events never create purchases
  if (SUCCESSFUL_PURCHASE_STATUSES.includes(purchase.status)) return // status guard: never downgrade paid

  await prisma.purchase.update({
    where: { id: purchase.id },
    data: {
      status: "failed",
      metadata: mergeFailureIntoMetadata(purchase.metadata, failure) as Prisma.InputJsonValue,
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
    const message = err instanceof Error ? err.message : "Unknown error"
    return new NextResponse(`Webhook error: ${message}`, { status: 400 })
  }

  // Deduplicate webhook events — Stripe may retry on timeout
  try {
    await prisma.stripeWebhookEvent.create({
      data: {
        eventId: event.id,
        eventType: event.type,
      },
    })
  } catch (err) {
    // Unique constraint violation = already processed
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return new NextResponse("Event already processed", { status: 200 })
    }
    throw err
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSession(event.data.object as Stripe.Checkout.Session)
        break
      case "payment_intent.succeeded":
        await handlePaymentIntent(event.data.object as Stripe.PaymentIntent)
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
    return new NextResponse("Webhook handler failed", { status: 500 })
  }

  return NextResponse.json({ received: true })
}
