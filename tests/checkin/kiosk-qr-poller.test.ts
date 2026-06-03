import { afterEach, describe, expect, it, vi } from "vitest"

import { createKioskQrPoller } from "@/components/front/courses/enroll/effects/kiosk-qr-poller"

const createStatusResponse = (ok: boolean, data: Record<string, unknown>) => ({
  res: { ok } as Response,
  data,
})

describe("createKioskQrPoller", () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("emits a complete outcome for completed sessions without scheduling another poll", async () => {
    vi.useFakeTimers()
    const fetchStatus = vi.fn().mockResolvedValue(
      createStatusResponse(true, {
        status: "complete",
        purchaseId: "purchase-1",
        paymentStatus: "paid",
      })
    )
    const onOutcome = vi.fn()

    createKioskQrPoller({ sessionId: "session-1", fetchStatus, onOutcome })

    await vi.runAllTimersAsync()

    expect(fetchStatus).toHaveBeenCalledTimes(1)
    expect(fetchStatus).toHaveBeenCalledWith({ sessionId: "session-1" })
    expect(onOutcome).toHaveBeenCalledWith({
      type: "complete",
      purchaseId: "purchase-1",
      paymentStatus: "paid",
    })
  })

  it("emits waiting state and retries while payment is still in progress", async () => {
    vi.useFakeTimers()
    const fetchStatus = vi
      .fn()
      .mockResolvedValueOnce(
        createStatusResponse(true, {
          status: "open",
          awaitingWebhook: true,
          purchaseId: "purchase-2",
          paymentStatus: "processing",
        })
      )
      .mockResolvedValueOnce(createStatusResponse(true, { status: "complete" }))
    const onOutcome = vi.fn()

    createKioskQrPoller({
      sessionId: "session-2",
      fetchStatus,
      onOutcome,
      pollIntervalMs: 50,
    })

    await vi.runOnlyPendingTimersAsync()

    expect(fetchStatus).toHaveBeenCalledTimes(2)
    expect(onOutcome).toHaveBeenNthCalledWith(1, {
      type: "state",
      state: {
        phase: "waiting_for_payment",
        awaitingWebhook: true,
        purchaseId: "purchase-2",
        paymentStatus: "processing",
        error: null,
      },
    })
    expect(onOutcome).toHaveBeenNthCalledWith(2, {
      type: "complete",
      purchaseId: null,
      paymentStatus: null,
    })
  })

  it("emits an expired state for expired sessions", async () => {
    vi.useFakeTimers()
    const fetchStatus = vi.fn().mockResolvedValue(
      createStatusResponse(true, {
        status: "expired",
        error: "Session expired.",
      })
    )
    const onOutcome = vi.fn()

    createKioskQrPoller({ sessionId: "session-3", fetchStatus, onOutcome })

    await vi.runAllTimersAsync()

    expect(onOutcome).toHaveBeenCalledWith({
      type: "state",
      state: {
        phase: "expired",
        awaitingWebhook: false,
        purchaseId: null,
        paymentStatus: null,
        error: "Session expired.",
      },
    })
  })

  it("emits an error state when the status endpoint returns a failed response", async () => {
    vi.useFakeTimers()
    const fetchStatus = vi.fn().mockResolvedValue(
      createStatusResponse(false, {
        status: "open",
        error: "Gateway unavailable.",
      })
    )
    const onOutcome = vi.fn()

    createKioskQrPoller({ sessionId: "session-4", fetchStatus, onOutcome })

    await vi.runAllTimersAsync()

    expect(onOutcome).toHaveBeenCalledWith({
      type: "state",
      state: {
        phase: "error",
        awaitingWebhook: false,
        purchaseId: null,
        paymentStatus: null,
        error: "Gateway unavailable.",
      },
    })
  })

  it("emits an error outcome when status polling throws", async () => {
    vi.useFakeTimers()
    const thrown = new Error("network down")
    const fetchStatus = vi.fn().mockRejectedValue(thrown)
    const onOutcome = vi.fn()

    createKioskQrPoller({ sessionId: "session-5", fetchStatus, onOutcome })

    await vi.runAllTimersAsync()

    expect(onOutcome).toHaveBeenCalledWith({
      type: "error",
      error: thrown,
      message: "Unable to refresh checkout status.",
    })
  })
})
