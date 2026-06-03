type FetchImpl = typeof fetch

type RequestOptions = {
  token?: string | null
  payload: Record<string, unknown>
  fetchImpl?: FetchImpl
}

const resolveFetch = (fetchImpl?: FetchImpl) => fetchImpl ?? fetch

const createJsonHeaders = (token?: string | null) => ({
  "Content-Type": "application/json",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
})

export const requestNewStudentOutcomeApi = async ({
  phone,
  fetchImpl,
}: {
  phone: string
  fetchImpl?: FetchImpl
}) => {
  const res = await resolveFetch(fetchImpl)("/api/checkin/qr/new-student/verify", {
    method: "POST",
    headers: createJsonHeaders(),
    credentials: "include",
    body: JSON.stringify({ phone }),
  })
  const contentType = res.headers.get("content-type") || ""
  const data = contentType.includes("application/json") ? await res.json().catch(() => null) : null
  return { res, data }
}

export const requestCheckoutIntentApi = async ({ token, payload, fetchImpl }: RequestOptions) => {
  const res = await resolveFetch(fetchImpl)("/api/checkout/intent", {
    method: "POST",
    headers: createJsonHeaders(token),
    credentials: "include",
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => null)
  return { res, data }
}

export const requestCheckoutSessionApi = async ({ token, payload, fetchImpl }: RequestOptions) => {
  const res = await resolveFetch(fetchImpl)("/api/checkout/session", {
    method: "POST",
    headers: createJsonHeaders(token),
    credentials: "include",
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => null)
  return { res, data }
}

export const requestCheckoutCashApi = async ({ token, payload, fetchImpl }: RequestOptions) => {
  const res = await resolveFetch(fetchImpl)("/api/checkout/cash", {
    method: "POST",
    headers: createJsonHeaders(token),
    credentials: "include",
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => null)
  return { res, data }
}

export const requestDropInCheckInApi = async ({ token, payload, fetchImpl }: RequestOptions) => {
  const res = await resolveFetch(fetchImpl)("/api/checkin/qr/dropin", {
    method: "POST",
    headers: createJsonHeaders(token),
    credentials: "include",
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => null)
  return { res, data }
}

export const requestPinAvailabilityApi = async ({
  pin,
  fetchImpl,
}: {
  pin: string
  fetchImpl?: FetchImpl
}) => {
  const res = await resolveFetch(fetchImpl)("/api/checkin/pin/check", {
    method: "POST",
    headers: createJsonHeaders(),
    body: JSON.stringify({ pin }),
  })
  const data = await res.json().catch(() => null)
  return { res, data }
}

export const requestCheckoutFinalizeApi = async ({
  token,
  paymentIntentId,
  fetchImpl,
}: {
  token?: string | null
  paymentIntentId: string
  fetchImpl?: FetchImpl
}) => {
  const res = await resolveFetch(fetchImpl)("/api/checkout/finalize", {
    method: "POST",
    headers: createJsonHeaders(token),
    credentials: "include",
    body: JSON.stringify({ paymentIntentId }),
  })
  const data = await res.json().catch(() => null)
  return { res, data }
}
