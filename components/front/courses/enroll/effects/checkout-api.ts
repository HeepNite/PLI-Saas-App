type FetchImpl = typeof fetch

export type CheckoutPayload = Record<string, unknown>

export type PublicCheckoutQuoteResponse =
  | { amountCents: number; currency: string; promotionLabel?: string }
  | { error: string }

type RequestOptions = {
  token?: string | null
  payload: CheckoutPayload
  fetchImpl?: FetchImpl
}

type CheckoutIntentRequestOptions = RequestOptions & {
  endpoint?: "/api/checkout/intent" | "/api/public/checkout/intent"
}

type CheckoutSessionRequestOptions = RequestOptions & {
  endpoint?: "/api/checkout/session" | "/api/profile/checkout/session" | "/api/public/checkout/session"
}

const resolveFetch = (fetchImpl?: FetchImpl) => fetchImpl ?? fetch

const createJsonHeaders = (token?: string | null) => ({
  "Content-Type": "application/json",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
})

const isPublicCheckoutQuoteResponse = (value: unknown): value is PublicCheckoutQuoteResponse => {
  if (!value || typeof value !== "object") return false
  if ("error" in value && typeof value.error === "string") return true
  return (
    "amountCents" in value &&
    typeof value.amountCents === "number" &&
    "currency" in value &&
    typeof value.currency === "string" &&
    (!("promotionLabel" in value) || typeof value.promotionLabel === "string")
  )
}

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

export const requestCheckoutQuoteApi = async ({ token, payload, fetchImpl }: RequestOptions) => {
  const res = await resolveFetch(fetchImpl)("/api/public/checkout/quote", {
    method: "POST",
    headers: createJsonHeaders(token),
    credentials: "include",
    body: JSON.stringify(payload),
  })
  const response = await res.json().catch(() => null)
  const data = isPublicCheckoutQuoteResponse(response) ? response : null
  return { res, data }
}

export const requestCheckoutIntentApi = async ({
  token,
  payload,
  fetchImpl,
  endpoint = "/api/checkout/intent",
}: CheckoutIntentRequestOptions) => {
  const res = await resolveFetch(fetchImpl)(endpoint, {
    method: "POST",
    headers: createJsonHeaders(token),
    credentials: "include",
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => null)
  return { res, data }
}

export const requestCheckoutSessionApi = async ({
  token,
  payload,
  fetchImpl,
  endpoint = "/api/checkout/session",
}: CheckoutSessionRequestOptions) => {
  const res = await resolveFetch(fetchImpl)(endpoint, {
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

export const requestPublicPackageReservationApi = async ({ token, payload, fetchImpl }: RequestOptions) => {
  const res = await resolveFetch(fetchImpl)("/api/profile/bookings/reserve-package", {
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
  const data = await res.json().catch(() => null)
  return { res, data }
}
