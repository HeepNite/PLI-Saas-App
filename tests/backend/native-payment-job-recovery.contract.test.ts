import { afterEach, describe, expect, it, vi } from "vitest"
import { NativePaymentJobsController } from "@/apps/backend/src/terminal/native-payment-jobs.controller"
import {
  NativePaymentJobsService,
  type NativePaymentJobRecord,
  type NativePaymentJobRecoveryStore,
  type NativePaymentJobStore,
} from "@/apps/backend/src/terminal/native-payment-jobs.service"
import {
  NATIVE_PAYMENT_JOB_RECOVERY_SCOPE,
  NativeReaderAuthorizationError,
} from "@/apps/backend/src/terminal/native-reader-auth.service"
import { createBackendRequestHandler } from "@/apps/backend/src/main"

const RETRY_IDENTITY = "tap-attempt-1"
const IDEMPOTENCY_KEY = `native-payment-job:reader_1:${RETRY_IDENTITY}`

const paymentJob = (status = "unknown"): NativePaymentJobRecord => ({
  id: "job_1",
  readerId: "reader_1",
  classSessionId: "session_1",
  courseSlugSnapshot: "salsa-beginner",
  courseTitleSnapshot: "Salsa Beginner",
  amountCents: 2500,
  currency: "usd",
  idempotencyKey: IDEMPOTENCY_KEY,
  providerPaymentId: "pi_native_1",
  status,
  needsReview: status === "unknown",
  classSession: { startsAt: new Date("2026-06-19T23:00:00.000Z") },
})

const createHarness = (options: {
  authorizationError?: NativeReaderAuthorizationError
  job?: NativePaymentJobRecord | null
  readerId?: string
} = {}) => {
  let job = options.job === undefined ? paymentJob() : options.job
  const findByIdentity = vi.fn(async (readerId: string, idempotencyKey: string) =>
    job?.readerId === readerId && job.idempotencyKey === idempotencyKey ? job : null)
  const findById = vi.fn(async (readerId: string, jobId: string) =>
    job?.readerId === readerId && job.id === jobId ? job : null)
  const recordClientSuccess = vi.fn(async (readerId: string, jobId: string) => {
    if (job?.readerId !== readerId || job.id !== jobId) return null
    if (["created", "collecting", "client_succeeded", "unknown"].includes(job.status)) {
      job = { ...job, status: "client_succeeded", needsReview: false }
    }
    return job
  })
  const recoveryStore: NativePaymentJobRecoveryStore = {
    findByIdentity,
    findById,
    recordClientSuccess,
  }
  const store = recoveryStore as unknown as NativePaymentJobStore
  const createPaymentIntent = vi.fn()
  const retrieve = vi.fn().mockResolvedValue({ client_secret: "pi_native_1_secret_test" })
  const jobs = new NativePaymentJobsService(store, { createPaymentIntent }, undefined, { retrieve }, recoveryStore)
  const authorize = options.authorizationError
    ? vi.fn().mockRejectedValue(options.authorizationError)
    : vi.fn().mockResolvedValue({ id: options.readerId ?? "reader_1", name: "Front desk iPhone" })
  const controller = new NativePaymentJobsController({ authorize }, jobs)
  return {
    authorize,
    createPaymentIntent,
    findById,
    findByIdentity,
    handleRequest: createBackendRequestHandler({ nativePaymentJobsController: controller }),
    recordClientSuccess,
    retrieve,
  }
}

const requestJob = (
  handleRequest: ReturnType<typeof createBackendRequestHandler>,
  method: string,
  suffix = "",
  body?: unknown
) => handleRequest(new Request(`http://backend.internal/terminal/native/jobs/job_1${suffix}`, {
  method,
  headers: {
    authorization: "Bearer reader-token",
    "content-type": "application/json",
    "x-forwarded-for": "203.0.113.10",
  },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
}))

describe("native payment job recovery and status", () => {
  afterEach(() => vi.restoreAllMocks())

  it("recovers an interrupted job by job and retry identity with the same PaymentIntent and client secret", async () => {
    const harness = createHarness()

    const response = await requestJob(harness.handleRequest, "POST", "/retry", { retryIdentity: RETRY_IDENTITY })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      id: "job_1",
      status: "unknown",
      retryIdentity: RETRY_IDENTITY,
      clientSecret: "pi_native_1_secret_test",
      needsReview: true,
    })
    expect(harness.findByIdentity).toHaveBeenCalledWith("reader_1", IDEMPOTENCY_KEY)
    expect(harness.retrieve).toHaveBeenCalledWith("pi_native_1")
    expect(harness.createPaymentIntent).not.toHaveBeenCalled()
  })

  it.each([
    ["created", "pending", false],
    ["collecting", "collecting", false],
    ["client_succeeded", "client_succeeded", false],
    ["authoritative_succeeded", "authoritative_succeeded", true],
    ["finalized", "finalized", false],
    ["failed", "failed", false],
    ["refunded", "refunded", false],
    ["unknown", "unknown", true],
  ])("maps durable %s status to API %s with orthogonal review state", async (stored, exposed, needsReview) => {
    const harness = createHarness({ job: { ...paymentJob(stored), needsReview } })

    const response = await requestJob(harness.handleRequest, "GET")

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ id: "job_1", status: exposed, needsReview })
    expect(harness.authorize).toHaveBeenCalledWith(expect.objectContaining({
      requiredScope: NATIVE_PAYMENT_JOB_RECOVERY_SCOPE,
    }))
  })

  it.each([
    ["status to another reader", createHarness({ readerId: "reader_2" }), "GET", "", undefined],
    ["recovery to another reader", createHarness({ readerId: "reader_2" }), "POST", "/retry", { retryIdentity: RETRY_IDENTITY }],
    ["missing status", createHarness({ job: null }), "GET", "", undefined],
    ["missing recovery", createHarness({ job: null }), "POST", "/retry", { retryIdentity: RETRY_IDENTITY }],
  ])("does not disclose %s", async (_case, harness, method, suffix, body) => {
    const response = await requestJob(harness.handleRequest, method, suffix, body)

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: "Native payment job unavailable" })
  })

  it("propagates existing reader/IP rate limits before job access", async () => {
    const harness = createHarness({ authorizationError: new NativeReaderAuthorizationError(429, 17) })

    const response = await requestJob(harness.handleRequest, "GET")

    expect(response.status).toBe(429)
    expect(response.headers.get("Retry-After")).toBe("17")
    expect(harness.findById).not.toHaveBeenCalled()
  })

  it("records client success as observation only without provider lookup, replacement charge, or authoritative state", async () => {
    const harness = createHarness({ job: paymentJob("collecting") })

    const response = await requestJob(harness.handleRequest, "POST", "/observations", { type: "client_succeeded" })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ id: "job_1", status: "client_succeeded" })
    expect(harness.recordClientSuccess).toHaveBeenCalledWith("reader_1", "job_1")
    expect(harness.retrieve).not.toHaveBeenCalled()
    expect(harness.createPaymentIntent).not.toHaveBeenCalled()
  })

  it.each([
    ["POST", "/retry", { retryIdentity: "bad identity" }, 400],
    ["POST", "/observations", { type: "finalized" }, 400],
    ["GET", "/retry", undefined, 404],
    ["DELETE", "", undefined, 404],
  ])("rejects unsupported or malformed %s job route%s", async (method, suffix, body, expectedStatus) => {
    const harness = createHarness()

    const response = await requestJob(harness.handleRequest, method, suffix, body)

    expect(response.status).toBe(expectedStatus)
    if (expectedStatus === 404) expect(harness.authorize).not.toHaveBeenCalled()
  })

  it("rejects a malformed job identifier after reader authentication", async () => {
    const harness = createHarness()
    const request = new Request("http://backend.internal/terminal/native/jobs/job%20bad", {
      headers: { authorization: "Bearer reader-token", "x-forwarded-for": "203.0.113.10" },
    })

    const response = await harness.handleRequest(request)

    expect(response.status).toBe(400)
    expect(harness.authorize).toHaveBeenCalledOnce()
    expect(harness.findById).not.toHaveBeenCalled()
  })
})
