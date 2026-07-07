// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useCheckInPackageFlow } from "@/components/front/checkin/hooks/useCheckInPackageFlow"
import type { BootstrapResponse } from "@/components/front/checkin/checkin.types"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

type HookParams = Parameters<typeof useCheckInPackageFlow>[0]
type HookResult = ReturnType<typeof useCheckInPackageFlow>

const bootstrap = (override: Partial<BootstrapResponse> = {}): BootstrapResponse => ({
  context: {
    courseSlug: "salsa",
    courseTitle: "Salsa",
    date: "2026-06-03",
    time: "20:00",
    durationMinutes: 60,
    startsAt: "2026-06-03T20:00:00.000Z",
    endsAt: "2026-06-03T21:00:00.000Z",
    checkInWindow: { isOpen: true, opensAt: "", closesAt: "" },
  },
  customer: { userId: "u1", clerkUserId: "c1", firstName: "Ada", lastName: "Lovelace", name: "Ada Lovelace", email: "ada@test.dev", phone: "123", hasAvatar: true },
  package: { id: "purchase-1", packageId: "pkg-1", packageLabel: "5 classes", isUnlimited: false, remainingCredits: 4, expiresAt: null, status: "active" },
  packages: [],
  quickCheckout: null,
  purchaseHistory: [],
  hasPreviousPurchase: false,
  hasAnyCompletedPurchase: false,
  ...override,
})

const defaultParams = (override: Partial<HookParams> = {}): HookParams => ({
  bootstrap: bootstrap(),
  getToken: vi.fn().mockResolvedValue("token-1"),
  hasActiveClerkSession: true,
  kioskPinSessionToken: "",
  effectiveCheckInWindowOpen: true,
  photoFlowContext: "kiosk_terminal",
  isKioskTerminalFlow: true,
  setProcessingPackageCheckIn: vi.fn(),
  awaitingConsecutivePaymentSelection: false,
  setError: vi.fn(),
  setSuccess: vi.fn(),
  loadBootstrap: vi.fn().mockResolvedValue(undefined),
  checkConsecutiveOfferAfterCheckIn: vi.fn().mockResolvedValue(false),
  handleStationCompletion: vi.fn(),
  setAwaitingConsecutivePaymentSelection: vi.fn(),
  setShowConsecutiveOverlay: vi.fn(),
  setShowConsecutivePaymentSelection: vi.fn(),
  requestPackageCheckIn: vi.fn().mockResolvedValue({
    res: { ok: true } as Response,
    data: { package: { remainingCredits: 3 }, attendance: { id: "att-1" }, points: { awarded: 7 } },
  }),
  ...override,
})

describe("useCheckInPackageFlow", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null
  let result: HookResult | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    result = null
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const mount = async (params: HookParams) => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    function Harness() {
      result = useCheckInPackageFlow(params)
      return null
    }
    await act(async () => root!.render(<Harness />))
    return { params, getResult: () => result! }
  }

  it("checks in kiosk package users without blocking on consecutive offer lookup", async () => {
    const params = defaultParams({ checkConsecutiveOfferAfterCheckIn: vi.fn(() => new Promise<boolean>(() => {})) })
    const { getResult } = await mount(params)

    await act(async () => getResult().handlePackageCheckIn())

    expect(getResult().packageCheckInResult).toEqual({ attendanceId: "att-1", remainingCredits: 3, points: 7 })
    expect(params.requestPackageCheckIn).toHaveBeenCalledWith({
      token: "token-1",
      payload: { courseSlug: "salsa", date: "2026-06-03", time: "20:00", durationMinutes: 60, flowContext: "kiosk_terminal" },
    })
    expect(params.checkConsecutiveOfferAfterCheckIn).toHaveBeenCalledTimes(1)
  })

  it("includes kiosk session token when there is no active Clerk session", async () => {
    const params = defaultParams({ hasActiveClerkSession: false, kioskPinSessionToken: "kiosk-token" })
    const { getResult } = await mount(params)

    await act(async () => getResult().handlePackageCheckIn())

    expect(params.requestPackageCheckIn).toHaveBeenCalledWith({
      token: "token-1",
      payload: {
        courseSlug: "salsa",
        date: "2026-06-03",
        time: "20:00",
        durationMinutes: 60,
        flowContext: "kiosk_terminal",
        kioskSessionToken: "kiosk-token",
      },
    })
  })

  it("preserves #35 by completing station only when success is acknowledged", async () => {
    vi.useFakeTimers()
    const params = defaultParams()
    const { getResult } = await mount(params)

    await act(async () => getResult().handlePackageCheckIn())
    expect(params.handleStationCompletion).not.toHaveBeenCalled()

    await act(async () => getResult().handlePackageSuccessDone())
    expect(params.handleStationCompletion).toHaveBeenCalledTimes(1)
    expect(getResult().packageCheckInResult).toBeNull()

    await act(async () => vi.advanceTimersByTimeAsync(2500))
    expect(params.checkConsecutiveOfferAfterCheckIn).toHaveBeenCalledTimes(1)
  })

  it("opens consecutive payment selection instead of resetting station when awaiting selection", async () => {
    const params = defaultParams({ awaitingConsecutivePaymentSelection: true })
    const { getResult } = await mount(params)

    act(() => getResult().setPackageCheckInResult({ attendanceId: "att-1", remainingCredits: 3, points: 7 }))
    await act(async () => getResult().handlePackageSuccessDone())

    expect(params.handleStationCompletion).not.toHaveBeenCalled()
    expect(params.setAwaitingConsecutivePaymentSelection).toHaveBeenCalledWith(false)
    expect(params.setShowConsecutiveOverlay).toHaveBeenCalledWith(true)
    expect(params.setShowConsecutivePaymentSelection).toHaveBeenCalledWith(true)
    expect(getResult().packageCheckInResult).toBeNull()
  })

  // ─── PR2: failure classification, retry/backoff, kiosk-vs-non-kiosk routing ───

  const retryableFailureResponse = (status = 500, body: Record<string, unknown> = { error: "boom" }) => ({
    res: { ok: false, status } as unknown as Response,
    data: body,
  })

  const closedWindowFailureResponse = () => ({
    res: { ok: false, status: 409 } as unknown as Response,
    data: { error: "The check-in window for this class is closed.", opensAt: "2026-06-03T19:00:00.000Z", closesAt: "2026-06-03T20:30:00.000Z" },
  })

  it("performPackageCheckInApi returns typed pre-flight failures, never null", async () => {
    const params = defaultParams()
    const { getResult } = await mount(params)
    expect(await getResult().performPackageCheckInApi()).toEqual(
      expect.objectContaining({ remainingCredits: 3 })
    )

    const noBootstrap = defaultParams({ bootstrap: null })
    const { getResult: getNoBootstrapResult } = await mount(noBootstrap)
    expect(await getNoBootstrapResult().performPackageCheckInApi()).toEqual(
      expect.objectContaining({ kind: "client_precondition" })
    )

    const noSession = defaultParams({ hasActiveClerkSession: false, kioskPinSessionToken: "" })
    const { getResult: getNoSessionResult } = await mount(noSession)
    expect(await getNoSessionResult().performPackageCheckInApi()).toEqual(
      expect.objectContaining({ kind: "client_precondition" })
    )

    const noPackage = defaultParams({ bootstrap: bootstrap({ package: null }) })
    const { getResult: getNoPackageResult } = await mount(noPackage)
    expect(await getNoPackageResult().performPackageCheckInApi()).toEqual(
      expect.objectContaining({ kind: "client_precondition" })
    )

    const closedWindow = defaultParams({ effectiveCheckInWindowOpen: false })
    const { getResult: getClosedWindowResult } = await mount(closedWindow)
    expect(await getClosedWindowResult().performPackageCheckInApi()).toEqual(
      expect.objectContaining({ kind: "closed_window" })
    )
  })

  it("non-kiosk failure calls setError only — no attempt counter, backoff, or packageCheckInFailure touched", async () => {
    const params = defaultParams({
      isKioskTerminalFlow: false,
      requestPackageCheckIn: vi.fn().mockResolvedValue(retryableFailureResponse()),
    })
    const { getResult } = await mount(params)

    await act(async () => getResult().handlePackageCheckIn())

    expect(params.setError).toHaveBeenCalledWith("We couldn't check you in. Please see the front desk.")
    expect(getResult().packageCheckInFailure).toBeNull()
    expect(getResult().packageCheckInAttempts).toBe(0)
    expect(getResult().retryBackoffActive).toBe(false)
  })

  it("kiosk backoff-scheduled branch (budget remaining) fires NEITHER setPackageCheckInFailure NOR setError", async () => {
    vi.useFakeTimers()
    const params = defaultParams({
      isKioskTerminalFlow: true,
      requestPackageCheckIn: vi.fn().mockResolvedValue(retryableFailureResponse()),
    })
    const { getResult } = await mount(params)

    await act(async () => getResult().handlePackageCheckIn())

    expect(getResult().retryBackoffActive).toBe(true)
    expect(getResult().packageCheckInFailure).toBeNull()
    expect(params.setError).not.toHaveBeenCalledWith(expect.any(String))
  })

  it("kiosk terminal failure calls BOTH setPackageCheckInFailure and the existing transient setError (PR2 parity)", async () => {
    const params = defaultParams({
      isKioskTerminalFlow: true,
      requestPackageCheckIn: vi.fn().mockResolvedValue(closedWindowFailureResponse()),
    })
    const { getResult } = await mount(params)

    await act(async () => getResult().handlePackageCheckIn())

    expect(getResult().packageCheckInFailure).toEqual(
      expect.objectContaining({ kind: "closed_window" })
    )
    expect(params.setError).toHaveBeenCalledWith(getResult().packageCheckInFailure!.message)
  })

  it("retry-exhaustion boundary: 3rd consecutive retryable failure with maxAttempts=3 sets packageCheckInFailure, schedules no 4th attempt", async () => {
    vi.useFakeTimers()
    const params = defaultParams({
      isKioskTerminalFlow: true,
      requestPackageCheckIn: vi.fn().mockResolvedValue(retryableFailureResponse()),
    })
    const { getResult } = await mount(params)

    // Attempt 1 (packageCheckInAttempts=0): 0+1=1 < 3 → schedules backoff (delay 0ms).
    await act(async () => getResult().handlePackageCheckIn())
    expect(getResult().retryBackoffActive).toBe(true)
    expect(getResult().packageCheckInFailure).toBeNull()
    await act(async () => vi.advanceTimersByTimeAsync(0))
    expect(getResult().packageCheckInAttempts).toBe(1)
    expect(getResult().retryBackoffActive).toBe(false)

    // Attempt 2 (packageCheckInAttempts=1): 1+1=2 < 3 → schedules backoff (delay 2000ms).
    await act(async () => getResult().handlePackageCheckIn())
    expect(getResult().retryBackoffActive).toBe(true)
    expect(getResult().packageCheckInFailure).toBeNull()
    await act(async () => vi.advanceTimersByTimeAsync(2000))
    expect(getResult().packageCheckInAttempts).toBe(2)
    expect(getResult().retryBackoffActive).toBe(false)

    // Attempt 3 (packageCheckInAttempts=2): 2+1=3, NOT < 3 → terminal, no 4th schedule.
    await act(async () => getResult().handlePackageCheckIn())
    expect(getResult().packageCheckInFailure).toEqual(expect.objectContaining({ kind: "server" }))
    expect(getResult().retryBackoffActive).toBe(false)
    expect(getResult().packageCheckInAttempts).toBe(2)

    // No further timer was scheduled — advancing time doesn't change attempts.
    await act(async () => vi.advanceTimersByTimeAsync(10_000))
    expect(getResult().packageCheckInAttempts).toBe(2)
    expect(params.requestPackageCheckIn).toHaveBeenCalledTimes(3)
  })

  it("handleRetryPackageCheckIn only clears state — does not call the API directly", async () => {
    const params = defaultParams({
      isKioskTerminalFlow: true,
      requestPackageCheckIn: vi.fn().mockResolvedValue(closedWindowFailureResponse()),
    })
    const { getResult } = await mount(params)

    await act(async () => getResult().handlePackageCheckIn())
    expect(getResult().packageCheckInFailure).not.toBeNull()
    expect(params.requestPackageCheckIn).toHaveBeenCalledTimes(1)

    act(() => getResult().handleRetryPackageCheckIn())

    expect(getResult().packageCheckInFailure).toBeNull()
    expect(getResult().packageCheckInAttempts).toBe(0)
    expect(getResult().retryBackoffActive).toBe(false)
    // Retry does not itself invoke the API — only the auto-trigger effect
    // (outside this hook) re-enters, once the gate re-evaluates true.
    expect(params.requestPackageCheckIn).toHaveBeenCalledTimes(1)
  })

  it("clears the pending backoff timer on unmount", async () => {
    vi.useFakeTimers()
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout")
    const params = defaultParams({
      isKioskTerminalFlow: true,
      requestPackageCheckIn: vi.fn().mockResolvedValue(retryableFailureResponse()),
    })
    const { getResult } = await mount(params)

    await act(async () => getResult().handlePackageCheckIn())
    expect(getResult().retryBackoffActive).toBe(true)
    clearTimeoutSpy.mockClear()

    await act(async () => root?.unmount())
    root = null

    expect(clearTimeoutSpy).toHaveBeenCalled()
  })
})
