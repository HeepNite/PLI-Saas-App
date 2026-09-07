import Stripe from "stripe"
import { PaymentIntentsService } from "./payment-intents.service"
import {
  buildTodayTerminalClasses,
  resolveCurrentTerminalClass,
  type ResolvedTerminalClass,
  type TerminalCourseCatalogLike,
} from "@/lib/checkin/terminal-current-class"
import { prisma } from "@/lib/prisma"

const NATIVE_PAYMENT_CURRENCY = "usd"

export type NativePaymentJobRecord = {
  id: string
  readerId: string
  classSessionId: string
  courseSlugSnapshot: string
  courseTitleSnapshot: string | null
  amountCents: number
  currency: string
  idempotencyKey: string
  providerPaymentId: string | null
  status: string
  classSession: { startsAt: Date }
}

type SaveNativePaymentJob = {
  readerId: string
  currentClass: ResolvedTerminalClass
  courseSlugSnapshot: string
  courseTitleSnapshot: string
  amountCents: number
  currency: string
  idempotencyKey: string
  providerPaymentId: string
}

export type NativePaymentJobStore = {
  findByIdentity(readerId: string, idempotencyKey: string): Promise<NativePaymentJobRecord | null>
  loadActiveCourses(): Promise<TerminalCourseCatalogLike[]>
  save(input: SaveNativePaymentJob): Promise<NativePaymentJobRecord>
}

type PaymentIntentsPort = Pick<PaymentIntentsService, "createPaymentIntent">

export type ProviderPaymentLookupPort = {
  retrieve(providerPaymentId: string): Promise<{ client_secret: string | null }>
}

const stripeSecret = process.env.STRIPE_SECRET_KEY
const stripeClient = stripeSecret
  ? new Stripe(stripeSecret, {
      apiVersion: "2026-01-28.clover",
    })
  : null

const providerPaymentLookup: ProviderPaymentLookupPort = {
  retrieve: async (providerPaymentId) => {
    if (!stripeClient) throw new Error("Stripe not configured")
    return stripeClient.paymentIntents.retrieve(providerPaymentId)
  },
}

const nativePaymentJobStore: NativePaymentJobStore = {
  findByIdentity: (readerId, idempotencyKey) => prisma.nativePaymentJob.findFirst({
    where: { readerId, idempotencyKey },
    include: { classSession: { select: { startsAt: true } } },
  }),
  loadActiveCourses: () => prisma.courseCatalog.findMany({
    where: { active: true },
    orderBy: [{ createdAt: "asc" }],
    take: 100,
  }),
  save: (input) => prisma.$transaction(async (tx) => {
    const current = input.currentClass
    const classSession = await tx.classSession.upsert({
      where: { courseSlug_startsAt: { courseSlug: current.slug, startsAt: current.startsAt } },
      update: { title: current.title, durationMinutes: current.durationMinutes ?? 60 },
      create: {
        courseSlug: current.slug,
        title: current.title,
        startsAt: current.startsAt,
        durationMinutes: current.durationMinutes ?? 60,
      },
    })
    return tx.nativePaymentJob.upsert({
      where: { idempotencyKey: input.idempotencyKey },
      update: {},
      create: {
        readerId: input.readerId,
        classSessionId: classSession.id,
        courseSlugSnapshot: input.courseSlugSnapshot,
        courseTitleSnapshot: input.courseTitleSnapshot,
        amountCents: input.amountCents,
        currency: input.currency,
        idempotencyKey: input.idempotencyKey,
        providerPaymentId: input.providerPaymentId,
      },
      include: { classSession: { select: { startsAt: true } } },
    })
  }),
}

export class NativePaymentJobCreationError extends Error {
  constructor(readonly status: 400 | 409, message: string) {
    super(message)
  }
}

const paymentIntentIdFromClientSecret = (clientSecret: string) => {
  const separatorIndex = clientSecret.indexOf("_secret_")
  if (separatorIndex <= 0) throw new Error("Stripe payment intent client secret malformed")
  return clientSecret.slice(0, separatorIndex)
}

const toResponse = (job: NativePaymentJobRecord, retryIdentity: string, clientSecret?: string) => ({
  id: job.id,
  status: job.status === "created" ? "pending" : job.status,
  readerId: job.readerId,
  classSessionId: job.classSessionId,
  courseSlug: job.courseSlugSnapshot,
  amountCents: job.amountCents,
  currency: job.currency,
  retryIdentity,
  ...(clientSecret ? { clientSecret } : {}),
})

export class NativePaymentJobsService {
  constructor(
    private readonly store: NativePaymentJobStore = nativePaymentJobStore,
    private readonly paymentIntents: PaymentIntentsPort = new PaymentIntentsService(),
    private readonly now: () => Date = () => new Date(),
    private readonly providerPayments: ProviderPaymentLookupPort = providerPaymentLookup
  ) {}

  async create(input: { readerId: string; retryIdentity: string }) {
    const idempotencyKey = `native-payment-job:${input.readerId}:${input.retryIdentity}`
    const existing = await this.store.findByIdentity(input.readerId, idempotencyKey)
    if (existing) {
      if (!existing.providerPaymentId) throw new Error("Native payment job missing provider payment ID")
      const providerPayment = await this.providerPayments.retrieve(existing.providerPaymentId)
      if (!providerPayment.client_secret?.trim()) {
        throw new Error("Stripe payment intent missing client secret")
      }
      return toResponse(existing, input.retryIdentity, providerPayment.client_secret)
    }

    const now = this.now()
    const courses = await this.store.loadActiveCourses()
    const currentClass = resolveCurrentTerminalClass(buildTodayTerminalClasses(courses, now), now)
    const amountCents = currentClass?.dropInPriceCents
    if (!currentClass || !amountCents || amountCents <= 0) {
      throw new NativePaymentJobCreationError(409, "No payable class is active")
    }

    const paymentIntent = await this.paymentIntents.createPaymentIntent({
      amount: amountCents,
      currency: NATIVE_PAYMENT_CURRENCY,
      receiptEmail: "",
      idempotencyKey,
      metadata: {
        flowContext: "native_kiosk",
        readerId: input.readerId,
        retryIdentity: input.retryIdentity,
        courseSlug: currentClass.slug,
        classStartsAt: currentClass.startsAt.toISOString(),
      },
    })
    const job = await this.store.save({
      readerId: input.readerId,
      currentClass,
      courseSlugSnapshot: currentClass.slug,
      courseTitleSnapshot: currentClass.title,
      amountCents,
      currency: NATIVE_PAYMENT_CURRENCY,
      idempotencyKey,
      providerPaymentId: paymentIntentIdFromClientSecret(paymentIntent.clientSecret),
    })
    return toResponse(job, input.retryIdentity, paymentIntent.clientSecret)
  }
}
