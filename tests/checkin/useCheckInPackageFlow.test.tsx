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

  it("checks in kiosk package users and immediately looks up consecutive offers", async () => {
    const params = defaultParams()
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
})
