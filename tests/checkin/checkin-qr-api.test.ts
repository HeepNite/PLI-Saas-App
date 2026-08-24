import { afterEach, describe, expect, it, vi } from "vitest"

import {
  requestCheckInBootstrapApi,
  requestCheckoutSessionApi,
  requestCheckoutSessionStatusApi,
  requestDropInCheckInApi,
  requestPackageCheckInApi,
  requestTerminalConsecutiveOfferApi,
} from "@/lib/checkin/checkin-qr-api"

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

const firstCall = (fetchImpl: ReturnType<typeof vi.fn>) => fetchImpl.mock.calls[0] as [string, RequestInit?]

describe("checkin QR API adapter", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("aborts package check-in at 12000ms and cleans its timeout", async () => {
    vi.useFakeTimers()
    let signal: AbortSignal | undefined
    const pendingFetch = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      signal = init?.signal ?? undefined
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })))
      })
    })
    const request = requestPackageCheckInApi({ fetchImpl: pendingFetch, payload: { courseSlug: "salsa" } }).catch((error) => error)
    await vi.advanceTimersByTimeAsync(12_000)
    expect(signal?.aborted).toBe(true)
    await expect(request).resolves.toMatchObject({ name: "AbortError" })
    await requestPackageCheckInApi({ fetchImpl: vi.fn().mockResolvedValue(jsonResponse({ ok: true })), payload: { courseSlug: "salsa" } })
    expect(vi.getTimerCount()).toBe(0)
  })

  it("posts bootstrap payload with bearer token and credentials", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))

    const result = await requestCheckInBootstrapApi({
      token: "token-1",
      fetchImpl,
      payload: {
        courseSlug: "salsa",
        date: "2026-06-03",
        time: "20:00",
        durationMinutes: 60,
        flowContext: "kiosk_terminal",
        kioskSessionToken: "kiosk-token",
      },
    })

    const [url, init] = firstCall(fetchImpl)
    expect(url).toBe("/api/checkin/qr/bootstrap")
    expect(init).toMatchObject({ method: "POST", credentials: "include" })
    expect(init?.headers).toMatchObject({
      "Content-Type": "application/json",
      Authorization: "Bearer token-1",
    })
    expect(JSON.parse(String(init?.body))).toMatchObject({
      courseSlug: "salsa",
      flowContext: "kiosk_terminal",
      kioskSessionToken: "kiosk-token",
    })
    expect(result.data).toEqual({ ok: true })
  })

  it("omits authorization header when no token is provided", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))

    await requestPackageCheckInApi({
      fetchImpl,
      payload: { courseSlug: "salsa" },
    })

    const [, init] = firstCall(fetchImpl)
    expect(init?.headers).toEqual({ "Content-Type": "application/json" })
  })

  it("posts package and drop-in check-in payloads to their existing endpoints", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))

    await requestPackageCheckInApi({ token: "token-2", fetchImpl, payload: { consecutiveAddOn: true } })
    await requestDropInCheckInApi({ token: "token-3", fetchImpl, payload: { consecutiveDiscountApplied: true } })

    expect(fetchImpl.mock.calls[0][0]).toBe("/api/checkin/qr/package")
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toEqual({ consecutiveAddOn: true })
    expect(fetchImpl.mock.calls[1][0]).toBe("/api/checkin/qr/dropin")
    expect(JSON.parse(String(fetchImpl.mock.calls[1][1]?.body))).toEqual({ consecutiveDiscountApplied: true })
  })

  it("starts checkout sessions without credentials to preserve existing behavior", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ sessionId: "sess_1", url: "https://pay" }))

    await requestCheckoutSessionApi({
      fetchImpl,
      payload: { courseSlug: "bachata", amount: 2500 },
    })

    const [url, init] = firstCall(fetchImpl)
    expect(url).toBe("/api/checkout/session")
    expect(init).toMatchObject({ method: "POST", headers: { "Content-Type": "application/json" } })
    expect(init).not.toHaveProperty("credentials")
    expect(JSON.parse(String(init?.body))).toMatchObject({ courseSlug: "bachata", amount: 2500 })
  })

  it("polls checkout session status with encoded session id and credentials", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ status: "complete" }))

    await requestCheckoutSessionStatusApi({ sessionId: "sess 1/2", fetchImpl })

    const [url, init] = firstCall(fetchImpl)
    expect(url).toBe("/api/checkout/session/status?sessionId=sess%201%2F2")
    expect(init).toEqual({ credentials: "include" })
  })

  it("gets terminal consecutive offers with date, optional time, and abort signal", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ linkedCourseSlug: "class-b" }))
    const controller = new AbortController()

    const result = await requestTerminalConsecutiveOfferApi({
      courseSlug: "class-a",
      date: "2026-08-07",
      time: "20:00",
      signal: controller.signal,
      fetchImpl,
    })

    const [url, init] = firstCall(fetchImpl)
    expect(url).toBe("/api/checkin/terminal/consecutive-offer?courseSlug=class-a&date=2026-08-07&time=20%3A00")
    expect(init).toMatchObject({ signal: expect.any(AbortSignal) })
    expect(result.data).toEqual({ linkedCourseSlug: "class-b" })
  })

  it("aborts a terminal consecutive offer request at the 1500ms budget and logs safe timing", async () => {
    vi.useFakeTimers()
    const logSpy = vi.spyOn(console, "info").mockImplementation(() => {})
    let observedSignal: AbortSignal | undefined
    const fetchImpl = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      observedSignal = init?.signal ?? undefined
      return new Promise<Response>((_resolve, reject) => {
        observedSignal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })))
      })
    })

    const request = requestTerminalConsecutiveOfferApi({ courseSlug: "class-a", fetchImpl }).catch((error) => error)

    await vi.advanceTimersByTimeAsync(1_499)
    expect(observedSignal?.aborted).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    expect(observedSignal?.aborted).toBe(true)
    await expect(request).resolves.toMatchObject({ name: "AbortError" })
    expect(logSpy).toHaveBeenCalledWith("[terminal-consecutive-offer-latency] client", {
      durationMs: expect.any(Number),
      outcome: "aborted",
    })
  })

  it("returns null data for non-ok terminal offer responses", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: "no offer" }, 404))

    const result = await requestTerminalConsecutiveOfferApi({ courseSlug: "class-a", fetchImpl })

    expect(result.res.ok).toBe(false)
    expect(result.data).toBeNull()
  })

  it("returns null data when JSON parsing fails", async () => {
    const res = {
      ok: true,
      json: vi.fn().mockRejectedValue(new Error("bad json")),
    } as unknown as Response
    const fetchImpl = vi.fn().mockResolvedValue(res)

    const result = await requestDropInCheckInApi({ fetchImpl, payload: { courseSlug: "salsa" } })

    expect(result.data).toBeNull()
  })
})
