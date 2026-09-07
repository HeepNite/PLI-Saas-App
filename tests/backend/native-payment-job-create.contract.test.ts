import { afterEach, describe, expect, it, vi } from "vitest"
import { NativePaymentJobsController } from "@/apps/backend/src/terminal/native-payment-jobs.controller"
import {
  NativePaymentJobsService,
  type NativePaymentJobRecord,
  type NativePaymentJobStore,
} from "@/apps/backend/src/terminal/native-payment-jobs.service"
import { NATIVE_PAYMENT_JOB_CREATE_SCOPE } from "@/apps/backend/src/terminal/native-reader-auth.service"
import { PaymentIntentsService } from "@/apps/backend/src/terminal/payment-intents.service"
import { createBackendRequestHandler } from "@/apps/backend/src/main"

const NOW = new Date("2026-06-19T23:10:00.000Z")
const RETRY_IDENTITY = "tap-attempt-1"

const activeCourse = {
  slug: "salsa-beginner",
  title: "Salsa Beginner",
  category: "salsa",
  level: "beginner",
  durationMinutes: 60,
  availableWeekdays: [5],
  availableTimes: ["19:00"],
  scheduleRules: null,
  dropInPriceCents: 2500,
  firstClassPriceCents: 1000,
  coverImageUrl: null,
}

const createHarness = (courses = [activeCourse]) => {
  let savedJob: NativePaymentJobRecord | null = null
  const findByIdentity = vi.fn(async () => savedJob)
  const save = vi.fn(async (input: Parameters<NativePaymentJobStore["save"]>[0]) => {
    savedJob = {
      id: "job_1",
      classSessionId: "session_1",
      status: "created",
      ...input,
      classSession: { startsAt: input.currentClass.startsAt },
    }
    return savedJob
  })
  const store: NativePaymentJobStore = {
    findByIdentity,
    loadActiveCourses: vi.fn().mockResolvedValue(courses),
    save,
  }
  const createStripeIntent = vi.fn().mockResolvedValue({ client_secret: "pi_native_1_secret_test" })
  const retrieveStripeIntent = vi.fn().mockResolvedValue({ client_secret: "pi_native_1_secret_test" })
  const paymentIntents = new PaymentIntentsService({ paymentIntents: { create: createStripeIntent } })
  const jobs = new NativePaymentJobsService(store, paymentIntents, () => NOW, { retrieve: retrieveStripeIntent })
  const authorize = vi.fn().mockResolvedValue({ id: "reader_1", name: "Front desk iPhone" })
  const controller = new NativePaymentJobsController({ authorize }, jobs)
  const handleRequest = createBackendRequestHandler({ nativePaymentJobsController: controller })
  return { authorize, createStripeIntent, findByIdentity, handleRequest, retrieveStripeIntent, save }
}

const createJob = (handleRequest: ReturnType<typeof createBackendRequestHandler>, body: object = {}) =>
  handleRequest(new Request("http://backend.internal/terminal/native/jobs", {
    method: "POST",
    headers: {
      authorization: "Bearer reader-token",
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.10",
    },
    body: JSON.stringify({ retryIdentity: RETRY_IDENTITY, ...body }),
  }))

describe("native payment job creation", () => {
  afterEach(() => vi.restoreAllMocks())

  it("authorizes the dedicated scope and pins server-owned class, amount, currency, reader, and Stripe terms", async () => {
    const harness = createHarness()

    const response = await createJob(harness.handleRequest, { amountCents: 1, currency: "ars" })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      id: "job_1",
      status: "pending",
      readerId: "reader_1",
      classSessionId: "session_1",
      courseSlug: "salsa-beginner",
      amountCents: 2500,
      currency: "usd",
      retryIdentity: RETRY_IDENTITY,
      clientSecret: "pi_native_1_secret_test",
    })
    expect(harness.authorize).toHaveBeenCalledWith(expect.objectContaining({ requiredScope: NATIVE_PAYMENT_JOB_CREATE_SCOPE }))
    expect(harness.createStripeIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2500,
        currency: "usd",
        payment_method_types: ["card_present"],
        metadata: expect.objectContaining({ readerId: "reader_1", courseSlug: "salsa-beginner" }),
      }),
      { idempotencyKey: `native-payment-job:reader_1:${RETRY_IDENTITY}` }
    )
    expect(harness.save).toHaveBeenCalledWith(expect.objectContaining({
      readerId: "reader_1",
      amountCents: 2500,
      currency: "usd",
      providerPaymentId: "pi_native_1",
    }))
  })

  it("returns a clear non-success response and performs zero PaymentIntent or job writes when no class is active", async () => {
    const harness = createHarness([])

    const response = await createJob(harness.handleRequest)

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({ error: "No payable class is active" })
    expect(harness.createStripeIntent).not.toHaveBeenCalled()
    expect(harness.save).not.toHaveBeenCalled()
  })

  it("returns the same durable job for the same reader and retry identity without another PaymentIntent", async () => {
    const harness = createHarness()

    const first = await createJob(harness.handleRequest)
    const retry = await createJob(harness.handleRequest)

    expect(first.status).toBe(200)
    expect(retry.status).toBe(200)
    expect((await first.json()).id).toBe("job_1")
    expect(await retry.json()).toMatchObject({
      id: "job_1",
      retryIdentity: RETRY_IDENTITY,
      clientSecret: "pi_native_1_secret_test",
    })
    expect(harness.retrieveStripeIntent).toHaveBeenCalledTimes(1)
    expect(harness.retrieveStripeIntent).toHaveBeenNthCalledWith(1, "pi_native_1")
    expect(harness.createStripeIntent).toHaveBeenCalledTimes(1)
    expect(harness.save).toHaveBeenCalledTimes(1)
  })
})
