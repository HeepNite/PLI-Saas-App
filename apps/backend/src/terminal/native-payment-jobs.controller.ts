import {
  NATIVE_PAYMENT_JOB_CREATE_SCOPE,
  NativeReaderAuthService,
} from "./native-reader-auth.service"
import {
  NativePaymentJobCreationError,
  NativePaymentJobsService,
} from "./native-payment-jobs.service"
import { getClientIp } from "@/lib/security/rate-limit"

type NativeReaderAuthPort = Pick<NativeReaderAuthService, "authorize">
type NativePaymentJobsPort = Pick<NativePaymentJobsService, "create">

const parseRetryIdentity = (value: unknown) => {
  if (!value || typeof value !== "object") return null
  const retryIdentity = (value as { retryIdentity?: unknown }).retryIdentity
  if (typeof retryIdentity !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(retryIdentity)) return null
  return retryIdentity
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
    let payload: unknown
    try {
      payload = await request.json()
    } catch {
      throw new NativePaymentJobCreationError(400, "Invalid JSON body")
    }
    const retryIdentity = parseRetryIdentity(payload)
    if (!retryIdentity) throw new NativePaymentJobCreationError(400, "Invalid retry identity")
    return this.jobs.create({ readerId: reader.id, retryIdentity })
  }
}
