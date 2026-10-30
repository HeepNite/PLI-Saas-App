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
import { consumePreparedNativePurchase, PreparedNativePurchaseError } from "@/lib/stripe/prepared-native-purchase"
import {
  PreparedNativePaymentError, issuePreparedNativePaymentAttempt, preparedNativeAttemptGeneration, preparedNativeFulfillmentMetadata, preparedNativePaymentIdempotencyKey,
  preparedNativePaymentMetadata, readPreparedNativePaymentAttempt, validatePreparedNativePaymentIntent,
  type PreparedNativePaymentPurchase,
} from "@/lib/stripe/prepared-native-payment"
import { recordPreparedNativeAttemptFailure } from "@/lib/stripe/prepared-native-attempt-failure"
export { InternalPurchaseError } from "@/lib/stripe/internal-purchase"

export const isInternalPurchaseEnabled = () =>
  process.env.NODE_ENV === "production" && process.env.INTERNAL_PURCHASE_LIVE_ENABLED === "true"

const TERMINAL_ASSIGNMENT_ERROR = "LIVE terminal assignment is not configured"
const LIVE_TERMINAL_ENTRY = /^([^\s=,]+)(?:=(tmr_[a-zA-Z0-9]+)?)?$/

// Effective terminal -> reader assignment: INTERNAL_PURCHASE_LIVE_TERMINALS
// ("terminalId=tmr_readerId" pairs, comma separated; a reader may be omitted) unioned
// with the legacy INTERNAL_PURCHASE_LIVE_TERMINAL_ID/READER_ID pair. Any malformed,
// duplicate or conflicting entry fails closed. A null reader blocks payment creation.
const liveTerminalAssignments = () => {
  const assignments = new Map<string, string | null>()
  const list = process.env.INTERNAL_PURCHASE_LIVE_TERMINALS?.trim()
  if (list) {
    for (const entry of list.split(",").map((part) => part.trim())) {
      const match = LIVE_TERMINAL_ENTRY.exec(entry)
      if (!match || assignments.has(match[1])) throw new InternalPurchaseError(TERMINAL_ASSIGNMENT_ERROR)
      assignments.set(match[1], match[2] ?? null)
    }
  }
  const legacyTerminal = process.env.INTERNAL_PURCHASE_LIVE_TERMINAL_ID?.trim()
  if (legacyTerminal) {
    const legacyReader = process.env.INTERNAL_PURCHASE_LIVE_READER_ID?.trim() || null
    if (assignments.has(legacyTerminal) && assignments.get(legacyTerminal) !== legacyReader) {
      throw new InternalPurchaseError(TERMINAL_ASSIGNMENT_ERROR)
    }
    assignments.set(legacyTerminal, legacyReader)
  }
  if (assignments.size === 0) throw new InternalPurchaseError(TERMINAL_ASSIGNMENT_ERROR)
  return assignments
}

const assignedReader = (terminalId: string) => {
  const assignments = liveTerminalAssignments()
  if (!assignments.has(terminalId)) throw new InternalPurchaseError("Terminal is not assigned to this flow", 403)
  return assignments.get(terminalId) ?? null
}

const createLiveClient = (terminalId: string) => {
  if (!isInternalPurchaseEnabled()) throw new InternalPurchaseError("Internal purchase preparation is disabled")
  assignedReader(terminalId)
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

// The reader is always the calling terminal's own assignment, so an attempt (which signs
// both terminalId and readerId) can never collect on another terminal's reader.
const paymentReaderId = (terminalId: string) => {
  if (!internalPaymentEnabled()) throw new InternalPurchaseError("Internal payment creation is disabled")
  internalAttemptSigningKey()
  const readerId = assignedReader(terminalId)
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

const preparedPurchase = (purchase: BoundPurchase | null, requirePending = false): PreparedNativePaymentPurchase => {
  if (!purchase || (requirePending && purchase.status !== "pending") || !purchase.idempotencyKey ||
      !purchase.metadata || typeof purchase.metadata !== "object" || Array.isArray(purchase.metadata)) {
    throw new InternalPurchaseError("Prepared purchase is invalid", 409)
  }
  try {
    return {
      id: purchase.id, userId: purchase.userId, amount: purchase.amount, currency: purchase.currency,
      idempotencyKey: purchase.idempotencyKey, fulfillmentMetadata: preparedNativeFulfillmentMetadata(purchase.metadata),
      attemptGeneration: preparedNativeAttemptGeneration(purchase.metadata),
    }
  } catch {
    throw new InternalPurchaseError("Prepared purchase is invalid", 409)
  }
}

const readPreparedPurchase = async (purchaseId: string, requirePending = false) =>
  preparedPurchase(await prisma.purchase.findUnique({ where: { id: purchaseId } }), requirePending)

type PreparedPaymentContext = {
  attempt: ReturnType<typeof readPreparedNativePaymentAttempt>
  purchase: PreparedNativePaymentPurchase
  paymentIntentId: string | undefined
  exactBoundRecovery: boolean
}

const preparedCreationStatus = async (
  input: Extract<InternalPurchaseRequest, { action: "prepared-creation-status" }>,
  caller: TerminalConnectionTokenGatewayRequest,
) => {
  try {
    const attempt = readPreparedNativePaymentAttempt(input.ticket, caller)
    const current = await prisma.purchase.findUnique({ where: { id: attempt.purchaseId } })
    const purchase = preparedPurchase(current)
    preparedNativePaymentMetadata(input.ticket, purchase)
    return { creation: current?.stripePaymentIntentId ? "CREATED" as const : "UNCREATED" as const }
  } catch (error) {
    const status = error instanceof InternalPurchaseError || error instanceof PreparedNativePaymentError ? error.status : 502
    throw new InternalPurchaseError("Prepared creation status unavailable", status)
  }
}

const resolvePreparedPaymentContext = async (
  input: Extract<InternalPurchaseRequest, { action: "prepared-payment-intent" | "prepared-recover" }>,
  caller: TerminalConnectionTokenGatewayRequest,
): Promise<PreparedPaymentContext> => {
  const attempt = readPreparedNativePaymentAttempt(input.ticket, caller)
  const associated = await prisma.purchase.findUnique({ where: { id: attempt.purchaseId } })
  const associatedId = associated?.stripePaymentIntentId || undefined
  if (input.paymentIntentId && associatedId && input.paymentIntentId !== associatedId) {
    throw new InternalPurchaseError("Prepared payment identity mismatch", 409)
  }
  const exactBoundRecovery = input.action === "prepared-recover" &&
    Boolean(associatedId) && input.paymentIntentId === associatedId
  if (!exactBoundRecovery) readPreparedNativePaymentAttempt(input.ticket, caller, { requireFresh: true })
  const paymentIntentId = input.paymentIntentId || associatedId
  const purchase = preparedPurchase(associated, !paymentIntentId)
  preparedNativePaymentMetadata(input.ticket, purchase)
  return { attempt, purchase, paymentIntentId, exactBoundRecovery }
}

// Only states in which Stripe guarantees no charge has happened and none can happen after
// cancellation. processing/requires_capture and anything unknown are never canceled here.
const PREPARED_CANCELABLE_STATUSES = new Set(["requires_payment_method", "requires_confirmation", "requires_action"])

const preparedCancelIdempotencyKey = (paymentIntentId: string) => `prepared-native-m2-cancel:v1:${paymentIntentId}`

// Cancel is allowed only for the exact PaymentIntent already bound to the ticket's Purchase,
// even after ticket expiry, mirroring exact-bound prepared-recover.
const resolveExactBoundPreparedCancel = async (
  input: Extract<InternalPurchaseRequest, { action: "prepared-cancel" }>,
  caller: TerminalConnectionTokenGatewayRequest,
) => {
  const attempt = readPreparedNativePaymentAttempt(input.ticket, caller)
  const associated = await prisma.purchase.findUnique({ where: { id: attempt.purchaseId } })
  if (!associated?.stripePaymentIntentId || associated.stripePaymentIntentId !== input.paymentIntentId) {
    throw new InternalPurchaseError("Prepared payment identity mismatch", 409)
  }
  const purchase = preparedPurchase(associated)
  preparedNativePaymentMetadata(input.ticket, purchase)
  return purchase
}

// A canceled PaymentIntent is recorded on its still-bound unpaid Purchase here, so the staff
// Verify record never depends on payment_intent.canceled webhook delivery. Same recording as
// the webhook path; idempotent, never downgrades paid, and leaves the PaymentIntent bound so
// a retry reopens the Purchase (reopenRetryablePurchase).
const recordPreparedCancellation = async (purchaseId: string, intent: Stripe.PaymentIntent) => {
  const current = await prisma.purchase.findUnique({ where: { id: purchaseId } })
  if (!current || current.stripePaymentIntentId !== intent.id) return
  const created = typeof intent.canceled_at === "number" ? intent.canceled_at : Math.floor(Date.now() / 1000)
  await recordPreparedNativeAttemptFailure(prisma, current, intent, { type: "payment_intent.canceled", created }, "canceled", { requireBoundIntent: true })
}

const cancelPreparedPayment = async (
  stripe: Stripe,
  input: Extract<InternalPurchaseRequest, { action: "prepared-cancel" }>,
  purchase: PreparedNativePaymentPurchase,
) => {
  const id = input.paymentIntentId
  const intent = await stripe.paymentIntents.retrieve(id)
  validatePreparedNativePaymentIntent(intent, input.ticket, purchase)
  if (intent.id !== id) throw new InternalPurchaseError("Prepared payment identity mismatch", 409)
  await verifyExactPreparedPaymentBinding(input.ticket, purchase.id, id)
  let final: Stripe.PaymentIntent = intent
  if (PREPARED_CANCELABLE_STATUSES.has(intent.status)) {
    final = await stripe.paymentIntents.cancel(id, {}, { idempotencyKey: preparedCancelIdempotencyKey(id) })
    if (final.id !== id) throw new InternalPurchaseError("Prepared payment identity mismatch", 409)
  }
  const status: string = final.status
  if (status === "canceled") await recordPreparedCancellation(purchase.id, final)
  return { id, status, paid: status === "succeeded" }
}

const asInternalPreparedError = (error: unknown) => {
  if (error instanceof InternalPurchaseError) return error
  if (error instanceof PreparedNativePaymentError || error instanceof PreparedNativePurchaseError) {
    return new InternalPurchaseError(error.message, error.status)
  }
  return new InternalPurchaseError("Payment outcome unknown; retain this ticket and retry it only or reconcile", 502)
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

const bindPreparedPaymentIntent = async (purchase: PreparedNativePaymentPurchase, paymentIntentId: string) => {
  const current = await prisma.purchase.findUnique({ where: { id: purchase.id } })
  if (!current || (current.stripePaymentIntentId && current.stripePaymentIntentId !== paymentIntentId)) {
    throw new InternalPurchaseError("Prepared payment identity mismatch", 409)
  }
  if (!current.stripePaymentIntentId) {
    await prisma.purchase.updateMany({
      where: { id: purchase.id, stripePaymentIntentId: null }, data: { stripePaymentIntentId: paymentIntentId },
    })
  }
  const rebound = await prisma.purchase.findUnique({ where: { id: purchase.id } })
  if (!rebound || rebound.stripePaymentIntentId !== paymentIntentId) {
    throw new InternalPurchaseError("Prepared payment identity mismatch", 409)
  }
}

const verifyExactPreparedPaymentBinding = async (
  ticket: string, purchaseId: string, paymentIntentId: string,
) => {
  const current = await prisma.purchase.findUnique({ where: { id: purchaseId } })
  const purchase = preparedPurchase(current)
  preparedNativePaymentMetadata(ticket, purchase)
  if (current?.stripePaymentIntentId !== paymentIntentId) {
    throw new InternalPurchaseError("Prepared payment identity mismatch", 409)
  }
}

const preparedPayment = async (
  stripe: Stripe,
  input: Extract<InternalPurchaseRequest, { action: "prepared-payment-intent" | "prepared-recover" }>,
  context: PreparedPaymentContext,
) => {
  try {
    const { attempt, purchase } = context
    let id = context.paymentIntentId
    if (!id) {
      await createStripeTerminalPaymentIntent({ paymentIntents: { create: async (params, options) => {
        const intent = await stripe.paymentIntents.create({ ...params, capture_method: "automatic" }, options)
        id = intent.id
        return intent
      } } }, {
        amount: purchase.amount, currency: purchase.currency, idempotencyKey: preparedNativePaymentIdempotencyKey(purchase),
        metadata: preparedNativePaymentMetadata(input.ticket, purchase),
      })
    }
    if (!id) throw new Error("Missing provider identity")
    const intent = await stripe.paymentIntents.retrieve(id)
    validatePreparedNativePaymentIntent(intent, input.ticket, purchase)
    if (intent.id !== id) throw new InternalPurchaseError("Prepared payment identity mismatch", 409)
    if (context.exactBoundRecovery) await verifyExactPreparedPaymentBinding(input.ticket, purchase.id, id)
    else await bindPreparedPaymentIntent(purchase, id)
    const result = { id, status: intent.status, paid: intent.status === "succeeded" }
    const collectible = ["requires_payment_method", "requires_confirmation"].includes(intent.status)
    if (input.action === "prepared-recover" || !collectible || Date.now() >= attempt.expiresAt) return result
    if (!intent.client_secret?.trim()) throw new InternalPurchaseError("Payment client secret missing; retain the attempt", 502)
    return { ...result, clientSecret: intent.client_secret }
  } catch (error) {
    throw asInternalPreparedError(error)
  }
}

const internalPayment = async (
  stripe: Stripe,
  input: Extract<InternalPurchaseRequest, { action: "payment-intent" | "recover" }>,
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
  if (input.action === "prepared-creation-status") return preparedCreationStatus(input, caller)
  if (input.action === "prepared-attempt") {
    try {
      const { purchaseId } = await consumePreparedNativePurchase(input.preparedPurchaseReference, caller)
      const purchase = await readPreparedPurchase(purchaseId, true)
      const readerId = paymentReaderId(caller.terminalId)
      const stripe = createLiveClient(caller.terminalId)
      await verifyLiveMerchant(stripe)
      await verifyReader(stripe, readerId)
      const ticket = issuePreparedNativePaymentAttempt(caller, { readerId, purchase })
      return { ticket, expiresAt: readPreparedNativePaymentAttempt(ticket).expiresAt, readerId, locationId: approved.locationId }
    } catch (error) {
      throw asInternalPreparedError(error)
    }
  }
  if (input.action === "prepared-cancel") {
    try {
      const purchase = await resolveExactBoundPreparedCancel(input, caller)
      const stripe = createLiveClient(caller.terminalId)
      await verifyLiveMerchant(stripe)
      return await cancelPreparedPayment(stripe, input, purchase)
    } catch (error) {
      throw asInternalPreparedError(error)
    }
  }
  if (input.action === "prepared-payment-intent" || input.action === "prepared-recover") {
    try {
      const context = await resolvePreparedPaymentContext(input, caller)
      const stripe = createLiveClient(caller.terminalId)
      await verifyLiveMerchant(stripe)
      if (input.action === "prepared-payment-intent") {
        const readerId = paymentReaderId(caller.terminalId)
        if (context.attempt.readerId !== readerId) throw new InternalPurchaseError("Reader assignment changed; reconcile this attempt", 409)
        await verifyReader(stripe, readerId)
      }
      return preparedPayment(stripe, input, context)
    } catch (error) {
      throw asInternalPreparedError(error)
    }
  }
  const attempt = "ticket" in input ? readInternalAttempt(input.ticket, caller) : null
  // A visible lookup result is informational only. Bind attempts to a fresh,
  // canonical complete-phone resolution so no client-supplied user ID is trusted.
  const selectedStudent = input.action === "attempt" ? await lookupStudent(input.phone) : null
  const collects = input.action === "attempt" || input.action === "payment-intent"
  const readerId = collects ? paymentReaderId(caller.terminalId) : null
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
