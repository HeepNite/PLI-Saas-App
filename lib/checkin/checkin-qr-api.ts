type FetchImpl = typeof fetch

type JsonRequestOptions = {
  token?: string | null
  fetchImpl?: FetchImpl
}

type GetRequestOptions = {
  fetchImpl?: FetchImpl
  signal?: AbortSignal
}

const resolveFetch = (fetchImpl?: FetchImpl) => fetchImpl ?? fetch

const readJsonOrNull = async (res: Response) => res.json().catch(() => null)

const buildJsonHeaders = (token?: string | null) => ({
  "Content-Type": "application/json",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
})

const postJson = async (url: string, payload: Record<string, unknown>, options: JsonRequestOptions = {}) => {
  const res = await resolveFetch(options.fetchImpl)(url, {
    method: "POST",
    headers: buildJsonHeaders(options.token),
    credentials: "include",
    body: JSON.stringify(payload),
  })
  const data = await readJsonOrNull(res)
  return { res, data }
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
}) => postJson("/api/checkin/qr/package", payload, { token, fetchImpl })

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
  time,
  signal,
  fetchImpl,
}: GetRequestOptions & {
  courseSlug: string
  time?: string
}) => {
  const params = new URLSearchParams({ courseSlug })
  if (time) params.set("time", time)
  const res = await resolveFetch(fetchImpl)(`/api/checkin/terminal/consecutive-offer?${params.toString()}`, {
    signal,
  })
  const data = res.ok ? await readJsonOrNull(res) : null
  return { res, data }
}
