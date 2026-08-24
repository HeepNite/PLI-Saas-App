type FetchImpl = typeof fetch

type JsonRequestOptions = {
  token?: string | null
  fetchImpl?: FetchImpl
}

type GetRequestOptions = {
  fetchImpl?: FetchImpl
  signal?: AbortSignal
}

export const TERMINAL_CONSECUTIVE_OFFER_TIMEOUT_MS = 1_500
const PACKAGE_CHECK_IN_TIMEOUT_MS = 12_000

const resolveFetch = (fetchImpl?: FetchImpl) => fetchImpl ?? fetch

const readJsonOrNull = async (res: Response) => res.json().catch(() => null)

const buildJsonHeaders = (token?: string | null) => ({
  "Content-Type": "application/json",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
})

const postJson = async (url: string, payload: Record<string, unknown>, options: JsonRequestOptions = {}, timeoutMs?: number) => {
  const controller = timeoutMs === undefined ? null : new AbortController()
  const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null
  try {
    const res = await resolveFetch(options.fetchImpl)(url, {
      method: "POST",
      headers: buildJsonHeaders(options.token),
      credentials: "include",
      body: JSON.stringify(payload),
      signal: controller?.signal,
    })
    const data = await readJsonOrNull(res)
    return { res, data }
  } finally {
    if (timeout !== null) clearTimeout(timeout)
  }
}

export const requestCheckInBootstrapApi = async ({
  payload,
  token,
  fetchImpl,
}: JsonRequestOptions & {
  payload: Record<string, unknown>
}) => postJson("/api/checkin/qr/bootstrap", payload, { token, fetchImpl })

export const requestPackageCheckInApi = async ({
  payload,
  token,
  fetchImpl,
}: JsonRequestOptions & {
  payload: Record<string, unknown>
}) => postJson("/api/checkin/qr/package", payload, { token, fetchImpl }, PACKAGE_CHECK_IN_TIMEOUT_MS)

export const requestDropInCheckInApi = async ({
  payload,
  token,
  fetchImpl,
}: JsonRequestOptions & {
  payload: Record<string, unknown>
}) => postJson("/api/checkin/qr/dropin", payload, { token, fetchImpl })

export const requestCheckoutSessionApi = async ({
  payload,
  fetchImpl,
}: {
  payload: Record<string, unknown>
  fetchImpl?: FetchImpl
}) => {
  const res = await resolveFetch(fetchImpl)("/api/checkout/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  const data = await readJsonOrNull(res)
  return { res, data }
}

export const requestCheckoutSessionStatusApi = async ({
  sessionId,
  fetchImpl,
}: {
  sessionId: string
  fetchImpl?: FetchImpl
}) => {
  const res = await resolveFetch(fetchImpl)(
    `/api/checkout/session/status?sessionId=${encodeURIComponent(sessionId)}`,
    {
      credentials: "include",
    }
  )
  const data = await readJsonOrNull(res)
  return { res, data }
}

export const requestTerminalConsecutiveOfferApi = async ({
  courseSlug,
  date,
  time,
  signal,
  fetchImpl,
}: GetRequestOptions & {
  courseSlug: string
  date?: string
  time?: string
}) => {
  const controller = new AbortController()
  const abortFromCaller = () => controller.abort()
  if (signal?.aborted) abortFromCaller()
  else signal?.addEventListener("abort", abortFromCaller, { once: true })
  const startedAt = Date.now()
  const timeout = setTimeout(() => controller.abort(), TERMINAL_CONSECUTIVE_OFFER_TIMEOUT_MS)
  let outcome = "failed"
  const params = new URLSearchParams({ courseSlug })
  if (date) params.set("date", date)
  if (time) params.set("time", time)
  try {
    const res = await resolveFetch(fetchImpl)(`/api/checkin/terminal/consecutive-offer?${params.toString()}`, {
      signal: controller.signal,
    })
    const data = res.ok ? await readJsonOrNull(res) : null
    outcome = res.ok ? "completed" : "http_error"
    return { res, data }
  } catch (error) {
    outcome = controller.signal.aborted ? "aborted" : "failed"
    throw error
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener("abort", abortFromCaller)
    console.info("[terminal-consecutive-offer-latency] client", {
      durationMs: Date.now() - startedAt,
      outcome,
    })
  }
}
