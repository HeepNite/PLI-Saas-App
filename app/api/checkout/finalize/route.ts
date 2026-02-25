import { NextResponse } from "next/server"
import Stripe from "stripe"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { upsertUserByIdentifiers } from "@/lib/users"
import { syncPackagePurchaseFromPaidPurchase } from "@/lib/packages"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"

export const runtime = "nodejs"

const stripeSecret = process.env.STRIPE_SECRET_KEY
const stripe = stripeSecret
  ? new Stripe(stripeSecret, {
      apiVersion: "2026-01-28.clover",
    })
  : null

const normalize = (value: string | null | undefined) => {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : undefined
}

const normalizePhone = (value: string | null | undefined) => {
  const digits = value?.replace(/\D/g, "")
  return digits && digits.length >= 6 ? digits : undefined
}

const parseIntSafe = (value: string | undefined) => {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

const pickMetadata = (metadata?: Stripe.Metadata) => ({
  courseSlug: normalize(metadata?.courseSlug),
  courseTitle: normalize(metadata?.courseTitle),
  packageId: normalize(metadata?.packageId),
  packageLabel: normalize(metadata?.packageLabel),
  packageTotalCredits: normalize(metadata?.packageTotalCredits),
  packageIsUnlimited: normalize(metadata?.packageIsUnlimited),
  packageCadence: normalize(metadata?.packageCadence),
  packageMakeUps: normalize(metadata?.packageMakeUps),
  packageValidDays: normalize(metadata?.packageValidDays),
  serviceId: normalize(metadata?.serviceId),
  userId: normalize(metadata?.userId),
  participants: normalize(metadata?.participants),
  coupon: normalize(metadata?.coupon),
  addons: normalize(metadata?.addons),
  name: normalize(metadata?.name),
  email: normalize(metadata?.email),
  phone: normalize(metadata?.phone),
  phoneRaw: normalize(metadata?.phoneRaw),
})

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

  const meta = pickMetadata(intent.metadata)
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
  const name = meta.name || [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() || undefined
  const stripeCustomerId = typeof intent.customer === "string" ? intent.customer : undefined

  const user = await upsertUserByIdentifiers({
    clerkId: authResult.userId,
    email,
    phone,
    name,
    stripeCustomerId,
  })

  if (!user) {
    return NextResponse.json({ error: "Unable to resolve user" }, { status: 500 })
  }

  const purchase = await prisma.purchase.upsert({
    where: { stripePaymentIntentId: intent.id },
    update: {
      status: intent.status,
      amount: intent.amount ?? 0,
      currency: intent.currency || "usd",
      email,
      name,
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
      status: intent.status,
      amount: intent.amount ?? 0,
      currency: intent.currency || "usd",
      email,
      name,
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
