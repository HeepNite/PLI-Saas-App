import {
  NATIVE_PAYMENT_JOB_CREATE_SCOPE,
  NATIVE_PAYMENT_JOB_RECOVERY_SCOPE,
  NativeReaderAuthService,
} from "./native-reader-auth.service"
import {
  NativePaymentJobCreationError,
  NativePaymentJobsService,
} from "./native-payment-jobs.service"
import { getClientIp } from "@/lib/security/rate-limit"

type NativeReaderAuthPort = Pick<NativeReaderAuthService, "authorize">
type NativePaymentJobsPort = Pick<NativePaymentJobsService, "create" | "get" | "observeClientSuccess" | "recover">

const IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]{1,128}$/

const parseRetryIdentity = (value: unknown) => {
  if (!value || typeof value !== "object") return null
  const retryIdentity = (value as { retryIdentity?: unknown }).retryIdentity
  if (typeof retryIdentity !== "string" || !IDENTIFIER_PATTERN.test(retryIdentity)) return null
  return retryIdentity
}

const parseJobId = (value: string) => IDENTIFIER_PATTERN.test(value) ? value : null

const readPayload = async (request: Request) => {
  try {
    return await request.json()
  } catch {
    throw new NativePaymentJobCreationError(400, "Invalid JSON body")
  }
}

export class NativePaymentJobsController {
  constructor(
    private readonly auth: NativeReaderAuthPort = new NativeReaderAuthService(),
    private readonly jobs: NativePaymentJobsPort = new NativePaymentJobsService()
  ) {}

  async post(request: Request) {
    const reader = await this.auth.authorize({
      authorization: request.headers.get("authorization"),
      ipAddress: getClientIp(request),
      requiredScope: NATIVE_PAYMENT_JOB_CREATE_SCOPE,
    })
    const payload = await readPayload(request)
    const retryIdentity = parseRetryIdentity(payload)
    if (!retryIdentity) throw new NativePaymentJobCreationError(400, "Invalid retry identity")
    return this.jobs.create({ readerId: reader.id, retryIdentity })
  }

  private async authorize(request: Request) {
    return this.auth.authorize({
      authorization: request.headers.get("authorization"),
      ipAddress: getClientIp(request),
      requiredScope: NATIVE_PAYMENT_JOB_RECOVERY_SCOPE,
    })
  }

  async get(request: Request, rawJobId: string) {
    const reader = await this.authorize(request)
    const jobId = parseJobId(rawJobId)
    if (!jobId) throw new NativePaymentJobCreationError(400, "Invalid job identity")
    return this.jobs.get({ readerId: reader.id, jobId })
  }

  async retry(request: Request, rawJobId: string) {
    const reader = await this.authorize(request)
    const jobId = parseJobId(rawJobId)
    const retryIdentity = parseRetryIdentity(await readPayload(request))
    if (!jobId) throw new NativePaymentJobCreationError(400, "Invalid job identity")
    if (!retryIdentity) throw new NativePaymentJobCreationError(400, "Invalid retry identity")
    return this.jobs.recover({ readerId: reader.id, jobId, retryIdentity })
  }

  async observe(request: Request, rawJobId: string) {
    const reader = await this.authorize(request)
    const jobId = parseJobId(rawJobId)
    const payload = await readPayload(request)
    if (!jobId) throw new NativePaymentJobCreationError(400, "Invalid job identity")
    if (!payload || typeof payload !== "object" || (payload as { type?: unknown }).type !== "client_succeeded") {
      throw new NativePaymentJobCreationError(400, "Invalid client observation")
    }
    return this.jobs.observeClientSuccess({ readerId: reader.id, jobId })
  }
}
