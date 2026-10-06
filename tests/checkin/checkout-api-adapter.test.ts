import { describe, expect, it, vi } from "vitest"
import {
  requestCheckoutCashApi,
  requestCheckoutFinalizeApi,
  requestCheckoutIntentApi,
  requestCheckoutQuoteApi,
  requestCheckoutSessionApi,
  requestCheckoutSessionStatusApi,
  requestDropInCheckInApi,
  requestNewStudentOutcomeApi,
} from "@/components/front/courses/enroll/effects/checkout-api"

const getSingleFetchCall = (fetchImpl: ReturnType<typeof vi.fn>) => {
  expect(fetchImpl).toHaveBeenCalledTimes(1)
  const call = fetchImpl.mock.calls.at(0)
  expect(call).toBeDefined()
  return call as [string, RequestInit]
}

describe("checkout/checkin api adapters", () => {
  const payload = {
    kioskSessionToken: "kiosk_tok_123",
    nested: { keep: true },
  }

  it("requests an anonymous authoritative public quote without authorization", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ amountCents: 1500, currency: "usd", promotionLabel: "Heritage pin benefit" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    })

    const { data } = await requestCheckoutQuoteApi({ payload, fetchImpl })

    const [url, init] = getSingleFetchCall(fetchImpl)
    expect(url).toBe("/api/public/checkout/quote")
    expect(init).toEqual({
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    expect(data).toEqual({ amountCents: 1500, currency: "usd", promotionLabel: "Heritage pin benefit" })
  })

  it("requests an authenticated authoritative public quote with authorization", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ error: "Quote unavailable" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      })
    })

    const { data } = await requestCheckoutQuoteApi({ token: "token_abc", payload, fetchImpl })

    const [url, init] = getSingleFetchCall(fetchImpl)
    expect(url).toBe("/api/public/checkout/quote")
    expect(init).toMatchObject({
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token_abc",
      },
      body: JSON.stringify(payload),
    })
    expect(data).toEqual({ error: "Quote unavailable" })
  })

  it("uses the public endpoint for checkout intent when explicitly requested", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    })

    await requestCheckoutIntentApi({ token: "token_abc", payload, fetchImpl, endpoint: "/api/public/checkout/intent" })

    const [url, init] = getSingleFetchCall(fetchImpl)
    expect(url).toBe("/api/public/checkout/intent")
    expect(init.headers).toMatchObject({ Authorization: "Bearer token_abc" })
  })

  it("uses the correct request contract for checkout intent", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    })

    const { data } = await requestCheckoutIntentApi({ payload, fetchImpl })

    const [url, init] = getSingleFetchCall(fetchImpl)
    expect(url).toBe("/api/checkout/intent")
    expect(init).toMatchObject({
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    expect(data).toEqual({ ok: true })
  })

  it("uses the correct request contract for checkout session", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    })

    const { data } = await requestCheckoutSessionApi({ token: "token_abc", payload, fetchImpl })

    const [url, init] = getSingleFetchCall(fetchImpl)
    expect(url).toBe("/api/checkout/session")
    expect(init).toMatchObject({
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token_abc",
      },
      body: JSON.stringify(payload),
    })
    expect(data).toEqual({ ok: true })
  })

  it("preserves the profile checkout-session endpoint", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    })

    await requestCheckoutSessionApi({ token: "token_abc", payload, fetchImpl, endpoint: "/api/profile/checkout/session" })

    const [url] = getSingleFetchCall(fetchImpl)
    expect(url).toBe("/api/profile/checkout/session")
  })

  it("uses the public endpoint for checkout session when explicitly requested", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    })

    await requestCheckoutSessionApi({ token: "token_abc", payload, fetchImpl, endpoint: "/api/public/checkout/session" })

    const [url, init] = getSingleFetchCall(fetchImpl)
    expect(url).toBe("/api/public/checkout/session")
    expect(init.headers).toMatchObject({ Authorization: "Bearer token_abc" })
  })

  it("uses the correct request contract for checkout session status", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ status: "open" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    })

    const { data } = await requestCheckoutSessionStatusApi({
      sessionId: "cs_test/value with spaces",
      fetchImpl,
    })

    const [url, init] = getSingleFetchCall(fetchImpl)
    expect(url).toBe("/api/checkout/session/status?sessionId=cs_test%2Fvalue%20with%20spaces")
    expect(init).toMatchObject({
      credentials: "include",
    })
    expect(data).toEqual({ status: "open" })
  })

  it("uses the correct request contract for checkout cash", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    })

    const { data } = await requestCheckoutCashApi({ token: "token_abc", payload, fetchImpl })

    const [url, init] = getSingleFetchCall(fetchImpl)
    expect(url).toBe("/api/checkout/cash")
    expect(init).toMatchObject({
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token_abc",
      },
      body: JSON.stringify(payload),
    })
    expect(data).toEqual({ ok: true })
  })

  it("uses the correct request contract for drop-in check-in", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    })

    const { data } = await requestDropInCheckInApi({ token: "token_abc", payload, fetchImpl })

    const [url, init] = getSingleFetchCall(fetchImpl)
    expect(url).toBe("/api/checkin/qr/dropin")
    expect(init).toMatchObject({
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token_abc",
      },
      body: JSON.stringify(payload),
    })
    expect(data).toEqual({ ok: true })
  })

  it("uses the correct request contract for checkout finalize", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    })

    const { data } = await requestCheckoutFinalizeApi({
      token: "token_abc",
      paymentIntentId: "pi_123",
      fetchImpl,
    })

    const [url, init] = getSingleFetchCall(fetchImpl)
    expect(url).toBe("/api/checkout/finalize")
    expect(init).toMatchObject({
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token_abc",
      },
      body: JSON.stringify({ paymentIntentId: "pi_123" }),
    })
    expect(data).toEqual({ ok: true })
  })

  it("uses the correct request contract for new-student verify", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ status: "existing" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    })

    const { data } = await requestNewStudentOutcomeApi({ phone: "+1 555 111 2222", fetchImpl })

    const [url, init] = getSingleFetchCall(fetchImpl)
    expect(url).toBe("/api/checkin/qr/new-student/verify")
    expect(init).toMatchObject({
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+1 555 111 2222" }),
    })
    expect(data).toEqual({ status: "existing" })
  })

  it("returns null data when checkout/session response json parsing fails", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response("not-json", {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    })

    const { data } = await requestCheckoutSessionApi({ token: "token_abc", payload, fetchImpl })
    expect(data).toBeNull()
  })

  it("returns null data when checkout/cash response json parsing fails", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response("not-json", {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    })

    const { data } = await requestCheckoutCashApi({ token: "token_abc", payload, fetchImpl })
    expect(data).toBeNull()
  })

  it("returns null data when checkout/intent response json parsing fails", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response("not-json", {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    })

    const { data } = await requestCheckoutIntentApi({ payload, fetchImpl })
    expect(data).toBeNull()
  })

  it("returns null data when drop-in response json parsing fails", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response("not-json", {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    })

    const { data } = await requestDropInCheckInApi({ token: "token_abc", payload, fetchImpl })
    expect(data).toBeNull()
  })

  it("returns null data when finalize response json parsing fails", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response("not-json", {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    })

    const { data } = await requestCheckoutFinalizeApi({
      token: "token_abc",
      paymentIntentId: "pi_123",
      fetchImpl,
    })
    expect(data).toBeNull()
  })

  it("returns null data for non-json new-student verify responses", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response("ok", {
        status: 200,
        headers: { "content-type": "text/plain" },
      })
    })

    const { data } = await requestNewStudentOutcomeApi({ phone: "+1 555 111 2222", fetchImpl })
    expect(data).toBeNull()
  })

  it("returns null data when new-student json parsing fails", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response("not-json", {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    })

    const { data } = await requestNewStudentOutcomeApi({ phone: "+1 555 111 2222", fetchImpl })
    expect(data).toBeNull()
  })
})
