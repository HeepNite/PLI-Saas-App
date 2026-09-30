import "server-only"
import Stripe from "stripe"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { normalizePhone } from "@/lib/shared"
import { ConnectionTokenService } from "./connection-token.service"
import { createStripeTerminalPaymentIntent } from "./payment-intents.service"
import type { TerminalConnectionTokenGatewayRequest } from "@/lib/nest-gateway/contracts/terminal-precutover"
import {
  approvedInternalPurchase as approved, InternalPurchaseError, internalPaymentEnabled, internalAttemptSigningKey,
  issueInternalAttempt, readInternalAttempt, requireFreshInternalAttempt, internalAttemptExpiry,
  internalAttemptKey, internalIntentMetadata, validateInternalIntent, type InternalPurchaseRequest,
} from "@/lib/stripe/internal-purchase"
export { InternalPurchaseError } from "@/lib/stripe/internal-purchase"

export const isInternalPurchaseEnabled = () =>
  process.env.NODE_ENV === "production" && process.env.INTERNAL_PURCHASE_LIVE_ENABLED === "true"

const createLiveClient = (terminalId: string) => {
  if (!isInternalPurchaseEnabled()) throw new InternalPurchaseError("Internal purchase preparation is disabled")
  const assignedTerminal = process.env.INTERNAL_PURCHASE_LIVE_TERMINAL_ID?.trim()
  if (!assignedTerminal) throw new InternalPurchaseError("LIVE terminal assignment is not configured")
  if (terminalId !== assignedTerminal) throw new InternalPurchaseError("Terminal is not assigned to this flow", 403)
  const secret = process.env.STRIPE_INTERNAL_PURCHASE_LIVE_SECRET_KEY?.trim()
  if (!secret || !/^(sk|rk)_live_[a-zA-Z0-9]+$/.test(secret)) {
    throw new InternalPurchaseError("Dedicated LIVE runtime credential is not configured")
  }
  return new Stripe(secret, { apiVersion: "2026-01-28.clover", maxNetworkRetries: 0, timeout: 10_000 })
}

const verifyLiveMerchant = async (stripe: Stripe) => {
  const account = await stripe.accounts.retrieve()
  if (account.id !== approved.accountId || account.charges_enabled !== true) {
    throw new InternalPurchaseError("LIVE merchant verification failed")
  }
}
const verifyLiveCatalog = async (stripe: Stripe) => {
  const product = await stripe.products.retrieve(approved.productId)
  if (product.deleted || product.id !== approved.productId || product.active !== true || product.livemode !== true) {
    throw new InternalPurchaseError("LIVE product verification failed")
  }
  const price = await stripe.prices.retrieve(approved.priceId)
  const productId = typeof price.product === "string" ? price.product : price.product.id
  if (price.id !== approved.priceId || productId !== approved.productId || price.active !== true ||
      price.livemode !== true || price.type !== "one_time" || price.unit_amount !== approved.amount ||
      price.currency !== approved.currency || price.lookup_key !== "pli_internal_usd1_live") {
    throw new InternalPurchaseError("LIVE price verification failed")
  }
  const location = await stripe.terminal.locations.retrieve(approved.locationId)
  if (location.deleted || location.id !== approved.locationId || location.livemode !== true ||
      location.address.line1 !== "54 Coles St" || location.address.city !== "Jersey City" ||
      location.address.state !== "NJ" || location.address.postal_code !== "07302" || location.address.country !== "US") {
    throw new InternalPurchaseError("LIVE school location verification failed")
  }
}

const paymentReaderId = () => {
  if (!internalPaymentEnabled()) throw new InternalPurchaseError("Internal payment creation is disabled")
  internalAttemptSigningKey()
  const readerId = process.env.INTERNAL_PURCHASE_LIVE_READER_ID?.trim()
  if (!readerId || !/^tmr_[a-zA-Z0-9]+$/.test(readerId)) throw new InternalPurchaseError("LIVE reader assignment is not configured")
  return readerId
}
const verifyReader = async (stripe: Stripe, readerId: string) => {
  const reader = await stripe.terminal.readers.retrieve(readerId)
  if (reader.deleted || reader.id !== readerId || reader.livemode !== true || reader.device_type !== "stripe_m2" ||
      (typeof reader.location === "string" ? reader.location : reader.location?.id) !== approved.locationId) {
    throw new InternalPurchaseError("LIVE M2 reader assignment verification failed")
  }
}

const INTERNAL_GENERAL_CREDIT = Object.freeze({
  courseSlug: "general-class-credit",
  courseTitle: "General class credit",
  packageId: "pli-internal-general-class-credit-v1",
  packageLabel: "General class credit",
  totalCredits: "1",
  isUnlimited: "false",
  validDays: "180",
})

type BoundPurchase = {
  id: string
  userId: string
  idempotencyKey: string | null
  stripePaymentIntentId: string | null
  amount: number
  currency: string
  status: string
  courseSlug: string
  packageId: string | null
  metadata: unknown
}

const isP2002 = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"

const assertBoundPurchase = (purchase: BoundPurchase | null, ticket: string) => {
  const attempt = readInternalAttempt(ticket)
  const metadata = purchase?.metadata
  const record = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata as Record<string, unknown> : null
  if (!purchase || purchase.userId !== attempt.userId || purchase.idempotencyKey !== internalAttemptKey(ticket) ||
      purchase.amount !== approved.amount || purchase.currency !== approved.currency || purchase.courseSlug !== INTERNAL_GENERAL_CREDIT.courseSlug ||
      purchase.packageId !== INTERNAL_GENERAL_CREDIT.packageId || record?.flowContext !== "pli_internal_purchase_v1" ||
      record.recipientUserId !== attempt.userId || record.attemptId !== attempt.id || record.creditQuantity !== 1 ||
      record.creditType !== "general_class_credit") {
    throw new InternalPurchaseError("Internal purchase ownership or binding mismatch; reconcile manually", 409)
  }
  return purchase
}

type StudentIdentity = { id: string; name: string | null }

export type StudentLookupAdapter = {
  findByCanonicalPhone: (canonicalPhone: string) => Promise<StudentIdentity[]>
}

export const prismaStudentLookupAdapter: StudentLookupAdapter = {
  findByCanonicalPhone: (canonicalPhone) => prisma.$queryRaw<StudentIdentity[]>`
    SELECT "id", "name"
    FROM "User"
    WHERE regexp_replace("phone", '[^0-9]', '', 'g') = ${canonicalPhone}
  `,
}

export const createStudentLookup = (adapter: StudentLookupAdapter) => async (phone: string) => {
  const canonicalPhone = normalizePhone(phone)
  if (!canonicalPhone) throw new InternalPurchaseError("Complete student phone is required", 400)
  const matches = await adapter.findByCanonicalPhone(canonicalPhone)
  if (matches.length === 0) throw new InternalPurchaseError("Existing student was not found", 404)
  if (matches.length !== 1) throw new InternalPurchaseError("Student lookup is ambiguous", 409)
  const student = matches[0]
  return { student: { id: student.id, name: student.name || null } }
}

const lookupStudent = createStudentLookup(prismaStudentLookupAdapter)

const createBoundPendingPurchase = async (ticket: string) => {
  const attempt = readInternalAttempt(ticket)
  const student = await prisma.user.findUnique({
    where: { id: attempt.userId },
    select: { id: true, email: true, name: true, phone: true },
  })
  if (!student) throw new InternalPurchaseError("Selected student was not found", 404)
  const idempotencyKey = internalAttemptKey(ticket)
  const create = async (db: Pick<typeof prisma, "purchase">) => {
    const existing = await db.purchase.findUnique({ where: { idempotencyKey } })
    if (existing) return assertBoundPurchase(existing, ticket)
    return db.purchase.create({
      data: {
        userId: student.id,
        courseSlug: INTERNAL_GENERAL_CREDIT.courseSlug,
        courseTitle: INTERNAL_GENERAL_CREDIT.courseTitle,
        amount: approved.amount,
        currency: approved.currency,
        status: "pending",
        email: student.email,
        name: student.name,
        phone: student.phone,
        participants: 1,
        packageId: INTERNAL_GENERAL_CREDIT.packageId,
        serviceId: "internal_purchase",
        idempotencyKey,
        metadata: {
          flowContext: "pli_internal_purchase_v1",
          attemptId: attempt.id,
          recipientUserId: student.id,
          creditType: "general_class_credit",
          creditQuantity: 1,
        },
      },
    })
  }
  try {
    return await prisma.$transaction((tx) => create(tx))
  } catch (error) {
    if (!isP2002(error)) throw error
    return assertBoundPurchase(await prisma.purchase.findUnique({ where: { idempotencyKey } }), ticket)
  }
}

const readBoundPurchase = async (ticket: string) =>
  assertBoundPurchase(await prisma.purchase.findUnique({ where: { idempotencyKey: internalAttemptKey(ticket) } }), ticket)

const bindPaymentIntent = async (purchase: BoundPurchase, paymentIntentId: string) => {
  if (purchase.stripePaymentIntentId && purchase.stripePaymentIntentId !== paymentIntentId) {
    throw new InternalPurchaseError("Internal payment identity mismatch", 409)
  }
  if (!purchase.stripePaymentIntentId) {
    await prisma.purchase.updateMany({
      where: { id: purchase.id, stripePaymentIntentId: null },
      data: { stripePaymentIntentId: paymentIntentId },
    })
  }
  return readBoundPurchaseById(purchase.id, paymentIntentId)
}

const readBoundPurchaseById = async (purchaseId: string, paymentIntentId: string) => {
  const purchase = await prisma.purchase.findUnique({ where: { id: purchaseId } })
  if (!purchase || purchase.stripePaymentIntentId !== paymentIntentId) {
    throw new InternalPurchaseError("Internal payment identity mismatch", 409)
  }
  return purchase
}

const internalPayment = async (
  stripe: Stripe, input: Extract<InternalPurchaseRequest, { ticket: string }>,
) => {
  let id = input.paymentIntentId
  try {
    const purchase = await readBoundPurchase(input.ticket)
    if (!id) {
      await createStripeTerminalPaymentIntent({ paymentIntents: { create: async (params, options) => {
        const intent = await stripe.paymentIntents.create({ ...params, capture_method: "automatic",
          description: "PLI — Internal Purchase USD 1; one general class credit" }, options)
        id = intent.id
        return intent
      } } }, { amount: approved.amount, currency: approved.currency, idempotencyKey: internalAttemptKey(input.ticket),
        metadata: internalIntentMetadata(input.ticket, purchase.id) })
    }
    if (!id) throw new Error("Missing provider identity")
    const intent = await stripe.paymentIntents.retrieve(id)
    validateInternalIntent(intent, input.ticket, purchase.id)
    if (intent.id !== id) throw new InternalPurchaseError("Internal payment identity mismatch", 409)
    await bindPaymentIntent(purchase, id)
    const result = { id, status: intent.status, paid: intent.status === "succeeded" }
    if (input.action === "recover" || !["requires_payment_method", "requires_confirmation"].includes(intent.status)) return result
    requireFreshInternalAttempt(readInternalAttempt(input.ticket))
    if (!intent.client_secret?.trim()) throw new InternalPurchaseError("Payment client secret missing; retain the attempt", 502)
    return { ...result, clientSecret: intent.client_secret }
  } catch (error) {
    if (error instanceof InternalPurchaseError) throw error
    throw new InternalPurchaseError("Payment outcome unknown; retain this ticket and retry it only or reconcile", 502)
  }
}

export const prepareInternalPurchase = async (
  input: InternalPurchaseRequest,
  caller: TerminalConnectionTokenGatewayRequest,
) => {
  if (input.action === "student-lookup") {
    const { student } = await lookupStudent(input.phone)
    return { student: { name: student.name } }
  }
  const attempt = "ticket" in input ? readInternalAttempt(input.ticket, caller) : null
  // A visible lookup result is informational only. Bind attempts to a fresh,
  // canonical complete-phone resolution so no client-supplied user ID is trusted.
  const selectedStudent = input.action === "attempt" ? await lookupStudent(input.phone) : null
  const collects = input.action === "attempt" || input.action === "payment-intent"
  const readerId = collects ? paymentReaderId() : null
  if (collects && attempt) {
    requireFreshInternalAttempt(attempt)
    if (attempt.readerId !== readerId) throw new InternalPurchaseError("Reader assignment changed; reconcile this attempt", 409)
  }
  const stripe = createLiveClient(caller.terminalId)
  await verifyLiveMerchant(stripe)
  if (input.action === "recover") return internalPayment(stripe, input)
  await verifyLiveCatalog(stripe)
  if (readerId) await verifyReader(stripe, readerId)
  if (input.action === "attempt" && readerId) {
    const ticket = issueInternalAttempt({ terminalId: caller.terminalId, sessionId: caller.sessionId }, readerId, selectedStudent!.student.id)
    await createBoundPendingPurchase(ticket)
    return { ticket, expiresAt: internalAttemptExpiry(readInternalAttempt(ticket)), readerId, locationId: approved.locationId }
  }
  if (input.action === "payment-intent") {
    requireFreshInternalAttempt(readInternalAttempt(input.ticket, caller))
    return internalPayment(stripe, input)
  }
  const config = { ...approved, paymentCreationEnabled: internalPaymentEnabled() }
  if (input.action === "preflight") return config

  const service = new ConnectionTokenService(async () => {
    // Stripe only enforces this scope for internet-connected readers, not Bluetooth M2.
    const token = await stripe.terminal.connectionTokens.create({ location: approved.locationId })
    if (token.location !== approved.locationId) throw new InternalPurchaseError("Terminal token location mismatch", 502)
    return token
  })
  const token = await service.createConnectionToken(caller)
  if (!token.secret?.trim()) throw new InternalPurchaseError("Terminal connection token missing", 502)
  return { ...config, secret: token.secret }
}
