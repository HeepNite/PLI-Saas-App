import { NextResponse } from "next/server"
import { headers } from "next/headers"
import Stripe from "stripe"
import type { ClerkClient } from "@clerk/backend"
import { clerkClient } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { upsertUserByIdentifiers } from "@/lib/users"

export const runtime = "nodejs"

const stripeSecret = process.env.STRIPE_SECRET_KEY
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

const stripe = stripeSecret
  ? new Stripe(stripeSecret, {
      apiVersion: "2024-06-20",
    })
  : null

const normalize = (value: string | undefined | null) => {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : undefined
}

const parseIntSafe = (value: string | undefined) => {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

const normalizePhone = (value?: string | null) => {
  const digits = value?.replace(/\D/g, "")
  return digits && digits.length >= 6 ? digits : undefined
}

const pickMetadata = (metadata?: Stripe.Metadata) => ({
  courseSlug: normalize(metadata?.courseSlug),
  courseTitle: normalize(metadata?.courseTitle),
  date: normalize(metadata?.date),
  time: normalize(metadata?.time),
  packageId: normalize(metadata?.packageId),
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

  if ((!email || !name || !phone) && clerkId) {
    try {
      const client = await clerkClient()
      const clerkUser = await client.users.getUser(clerkId)
      email = email || clerkUser.primaryEmailAddress?.emailAddress || undefined
      name = name || getDisplayName(clerkUser)
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
  })
}

async function handleCheckoutSession(session: Stripe.Checkout.Session) {
  const meta = pickMetadata(session.metadata)
  const clerkId = meta.userId && meta.userId !== "guest" ? meta.userId : undefined
  const email = meta.email || session.customer_details?.email || session.customer_email || undefined
  const name = session.customer_details?.name || meta.name || undefined
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
    name,
    phone,
    stripeCustomerId,
  })

  if (!user) {
    console.warn("Stripe webhook: user resolution failed", { clerkId, email })
    return
  }

  const amount = session.amount_total ?? 0
  const currency = session.currency || "usd"
  const status = session.payment_status === "paid" ? "paid" : session.payment_status || "unknown"
  const participants = parseIntSafe(meta.participants)
  const courseSlug = meta.courseSlug || "unknown"

  await prisma.purchase.upsert({
    where: { stripeCheckoutSessionId: session.id },
    update: {
      stripePaymentIntentId: paymentIntentId,
      status,
      amount,
      currency,
      email,
      name,
      phone,
      participants,
      coupon: meta.coupon,
      packageId: meta.packageId,
      serviceId: meta.serviceId,
      addonsCsv: meta.addons,
      courseSlug,
      courseTitle: meta.courseTitle,
      metadata: session.metadata ?? undefined,
    },
    create: {
      userId: user.id,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
      status,
      amount,
      currency,
      email,
      name,
      phone,
      participants,
      coupon: meta.coupon,
      packageId: meta.packageId,
      serviceId: meta.serviceId,
      addonsCsv: meta.addons,
      courseSlug,
      courseTitle: meta.courseTitle,
      metadata: session.metadata ?? undefined,
    },
  })
}

async function handlePaymentIntent(intent: Stripe.PaymentIntent) {
  const meta = pickMetadata(intent.metadata)
  const clerkId = meta.userId && meta.userId !== "guest" ? meta.userId : undefined
  const email = meta.email || intent.receipt_email || undefined
  const name = meta.name || undefined
  const phone = normalizePhone(meta.phone) || normalizePhone(meta.phoneRaw) || undefined
  const stripeCustomerId = typeof intent.customer === "string" ? intent.customer : undefined

  const user = await resolveUser({
    clerkId,
    email,
    name,
    phone,
    stripeCustomerId,
  })

  if (!user) {
    console.warn("Stripe webhook: user resolution failed", { clerkId, email })
    return
  }

  const amount = intent.amount ?? 0
  const currency = intent.currency || "usd"
  const status = intent.status || "unknown"
  const participants = parseIntSafe(meta.participants)
  const courseSlug = meta.courseSlug || "unknown"

  await prisma.purchase.upsert({
    where: { stripePaymentIntentId: intent.id },
    update: {
      status,
      amount,
      currency,
      email,
      name,
      phone,
      participants,
      coupon: meta.coupon,
      packageId: meta.packageId,
      serviceId: meta.serviceId,
      addonsCsv: meta.addons,
      courseSlug,
      courseTitle: meta.courseTitle,
      metadata: intent.metadata ?? undefined,
    },
    create: {
      userId: user.id,
      stripePaymentIntentId: intent.id,
      status,
      amount,
      currency,
      email,
      name,
      phone,
      participants,
      coupon: meta.coupon,
      packageId: meta.packageId,
      serviceId: meta.serviceId,
      addonsCsv: meta.addons,
      courseSlug,
      courseTitle: meta.courseTitle,
      metadata: intent.metadata ?? undefined,
    },
  })
}

export async function POST(req: Request) {
  if (!stripe || !webhookSecret) {
    return new NextResponse("Stripe not configured", { status: 500 })
  }

  const signature = headers().get("stripe-signature")
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

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSession(event.data.object as Stripe.Checkout.Session)
        break
      case "payment_intent.succeeded":
        await handlePaymentIntent(event.data.object as Stripe.PaymentIntent)
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
