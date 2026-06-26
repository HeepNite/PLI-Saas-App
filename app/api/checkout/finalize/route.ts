import { NextResponse } from "next/server"
import Stripe from "stripe"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { upsertUserByIdentifiers } from "@/lib/users"
import { syncPackagePurchaseFromPaidPurchase } from "@/lib/packages"
import { normalizePersistedPurchaseStatus } from "@/lib/purchase-status"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { normalizePhone } from "@/lib/shared"
import { pickStripeMetadata, parseIntSafe, normalize } from "@/lib/stripe-metadata"

export const runtime = "nodejs"

const stripeSecret = process.env.STRIPE_SECRET_KEY
const stripe = stripeSecret
  ? new Stripe(stripeSecret, {
      apiVersion: "2026-01-28.clover",
    })
  : null


type FinalizeBody = {
  paymentIntentId?: string
}

export async function POST(req: Request) {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 })
  }

  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("checkout:finalize", getClientIp(req)),
    limit: 30,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  const authResult = await auth()
  if (!authResult.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: FinalizeBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const paymentIntentId = normalize(body.paymentIntentId)
  if (!paymentIntentId) {
    return NextResponse.json({ error: "Missing payment intent id" }, { status: 400 })
  }

  const intent = await stripe.paymentIntents.retrieve(paymentIntentId)
  if (!intent || intent.object !== "payment_intent") {
    return NextResponse.json({ error: "Invalid payment intent" }, { status: 400 })
  }

  if (intent.status !== "succeeded") {
    return NextResponse.json({ error: "Payment not succeeded yet" }, { status: 409 })
  }

  const meta = pickStripeMetadata(intent.metadata)
  if (meta.userId && meta.userId !== "guest" && meta.userId !== authResult.userId) {
    return NextResponse.json({ error: "Payment intent user mismatch" }, { status: 403 })
  }

  const client = await clerkClient()
  const clerkUser = await client.users.getUser(authResult.userId)
  const email = meta.email || intent.receipt_email || clerkUser.primaryEmailAddress?.emailAddress || undefined
  const phone =
    normalizePhone(meta.phone) ||
    normalizePhone(meta.phoneRaw) ||
    normalizePhone(clerkUser.primaryPhoneNumber?.phoneNumber) ||
    undefined
  const canonicalClerkName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() || undefined
  const purchaseName = meta.name || canonicalClerkName
  const stripeCustomerId = typeof intent.customer === "string" ? intent.customer : undefined

  const user = await upsertUserByIdentifiers({
    clerkId: authResult.userId,
    email,
    phone,
    name: canonicalClerkName,
    stripeCustomerId,
    nameIsCanonical: true,
  })

  if (!user) {
    return NextResponse.json({ error: "Unable to resolve user" }, { status: 500 })
  }

  const purchaseStatus = normalizePersistedPurchaseStatus(intent.status)

  // ─── Dual Purchase creation for consecutive class ────────────
  const consecutivePriceCents = meta.consecutivePriceCents
    ? Number.parseInt(meta.consecutivePriceCents, 10)
    : null
  const hasConsecutive =
    Number.isFinite(consecutivePriceCents) &&
    consecutivePriceCents != null &&
    consecutivePriceCents > 0 &&
    meta.consecutiveLinkedCourseSlug

  if (hasConsecutive) {
    const primaryAmount = (intent.amount ?? 0) - consecutivePriceCents!

    const result = await prisma.$transaction(async (tx) => {
      // Purchase 1: original class (linked to PaymentIntent)
      const purchase1 = await tx.purchase.upsert({
        where: { stripePaymentIntentId: intent.id },
        update: {
          status: purchaseStatus,
          amount: primaryAmount,
          currency: intent.currency || "usd",
          email,
          name: purchaseName,
          phone,
          participants: parseIntSafe(meta.participants),
          coupon: meta.coupon,
          packageId: meta.packageId,
          serviceId: meta.serviceId,
          addonsCsv: meta.addons,
          courseSlug: meta.courseSlug || "unknown",
          courseTitle: meta.courseTitle,
          metadata: intent.metadata ?? undefined,
        },
        create: {
          userId: user.id,
          stripePaymentIntentId: intent.id,
          status: purchaseStatus,
          amount: primaryAmount,
          currency: intent.currency || "usd",
          email,
          name: purchaseName,
          phone,
          participants: parseIntSafe(meta.participants),
          coupon: meta.coupon,
          packageId: meta.packageId,
          serviceId: meta.serviceId,
          addonsCsv: meta.addons,
          courseSlug: meta.courseSlug || "unknown",
          courseTitle: meta.courseTitle,
          metadata: {
            ...(intent.metadata ?? {}),
            hasConsecutiveLinkedPurchase: true,
            consecutiveLinkedSlug: meta.consecutiveLinkedCourseSlug,
          },
        },
      })

      // Purchase 2: consecutive class (NOT linked to PaymentIntent — single PI covers both)
      const purchase2 = await tx.purchase.create({
        data: {
          userId: user.id,
          courseSlug: meta.consecutiveLinkedCourseSlug!,
          courseTitle: meta.consecutiveCourseTitle || null,
          amount: consecutivePriceCents!,
          currency: intent.currency || "usd",
          status: purchaseStatus,
          email,
          name: purchaseName,
          phone,
          participants: 1,
          coupon: null,
          packageId: null,
          serviceId: meta.serviceId || null,
          addonsCsv: null,
          metadata: {
            ...(intent.metadata ?? {}),
            consecutiveLinkedFrom: meta.courseSlug,
            consecutiveDiscount: true,
            parentPurchaseId: purchase1.id,
            // Override course-specific metadata for the consecutive class
            courseSlug: meta.consecutiveLinkedCourseSlug,
            courseTitle: meta.consecutiveCourseTitle || "",
            time: meta.consecutiveLinkedCourseTime ?? meta.time,
          },
        },
      })

      return { purchase1, purchase2 }
    })

    let packagePurchaseId: string | null = null
    if (intent.status === "succeeded") {
      const syncedPackage = await syncPackagePurchaseFromPaidPurchase({
        userId: user.id,
        purchaseId: result.purchase1.id,
        purchasedAt: result.purchase1.createdAt,
        metadata: {
          courseSlug: meta.courseSlug,
          packageId: meta.packageId,
          packageLabel: meta.packageLabel,
          packageTotalCredits: meta.packageTotalCredits,
          packageIsUnlimited: meta.packageIsUnlimited,
          packageCadence: meta.packageCadence,
          packageMakeUps: meta.packageMakeUps,
          packageValidDays: meta.packageValidDays,
        },
      })
      packagePurchaseId = syncedPackage?.id || null
    }

    return NextResponse.json({
      ok: true,
      purchaseId: result.purchase1.id,
      consecutivePurchaseId: result.purchase2.id,
      packagePurchaseId,
    })
  }

  // ─── Single Purchase (backward compatible) ──────────────────
  const purchase = await prisma.purchase.upsert({
    where: { stripePaymentIntentId: intent.id },
    update: {
      status: purchaseStatus,
      amount: intent.amount ?? 0,
      currency: intent.currency || "usd",
      email,
      name: purchaseName,
      phone,
      participants: parseIntSafe(meta.participants),
      coupon: meta.coupon,
      packageId: meta.packageId,
      serviceId: meta.serviceId,
      addonsCsv: meta.addons,
      courseSlug: meta.courseSlug || "unknown",
      courseTitle: meta.courseTitle,
      metadata: intent.metadata ?? undefined,
    },
    create: {
      userId: user.id,
      stripePaymentIntentId: intent.id,
      status: purchaseStatus,
      amount: intent.amount ?? 0,
      currency: intent.currency || "usd",
      email,
      name: purchaseName,
      phone,
      participants: parseIntSafe(meta.participants),
      coupon: meta.coupon,
      packageId: meta.packageId,
      serviceId: meta.serviceId,
      addonsCsv: meta.addons,
      courseSlug: meta.courseSlug || "unknown",
      courseTitle: meta.courseTitle,
      metadata: intent.metadata ?? undefined,
    },
  })

  let packagePurchaseId: string | null = null
  if (intent.status === "succeeded") {
    const syncedPackage = await syncPackagePurchaseFromPaidPurchase({
      userId: user.id,
      purchaseId: purchase.id,
      purchasedAt: purchase.createdAt,
      metadata: {
        courseSlug: meta.courseSlug,
        packageId: meta.packageId,
        packageLabel: meta.packageLabel,
        packageTotalCredits: meta.packageTotalCredits,
        packageIsUnlimited: meta.packageIsUnlimited,
        packageCadence: meta.packageCadence,
        packageMakeUps: meta.packageMakeUps,
        packageValidDays: meta.packageValidDays,
      },
    })
    packagePurchaseId = syncedPackage?.id || null
  }

  return NextResponse.json({
    ok: true,
    purchaseId: purchase.id,
    packagePurchaseId,
  })
}
