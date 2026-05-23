// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useKioskFlowCompletion } from "@/components/front/checkin/useKioskFlowCompletion"

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

function createMockParams() {
  return {
    isKioskTerminalFlow: true,
    kioskClerkSessionId: "session_123",
    replaceUrl: vi.fn().mockResolvedValue(undefined),
    resetKioskCustomerSession: vi.fn(),
    signOutKioskCustomerSession: vi.fn().mockResolvedValue(undefined),
    stationRedirectUrl: "https://pli.test/station",
    suppressClerkSessionOnCompletion: vi.fn(),
    setBootstrap: vi.fn(),
    setError: vi.fn(),
    setExistingRegularBookingOverride: vi.fn(),
    setKioskPin: vi.fn(),
    setKioskPinAttemptsRemaining: vi.fn(),
    setKioskPinBlockedUntil: vi.fn(),
    setKioskPinConfirm: vi.fn(),
    setKioskPinNext: vi.fn(),
    setKioskPinRotationMode: vi.fn(),
    setKioskPinRotationRequired: vi.fn(),
    setKioskPinSessionToken: vi.fn(),
    setMode: vi.fn(),
    setNewBookingOverride: vi.fn(),
    setLatePaymentEntryOverride: vi.fn(),
    setOpenNewBooking: vi.fn(),
    setPaymentsModalReady: vi.fn(),
    setPendingLoginPhone: vi.fn(),
    setShowPhoneSignIn: vi.fn(),
    setSuccess: vi.fn(),
    setPackageOfferContext: vi.fn(),
    setPackageOfferSelectedId: vi.fn(),
    setConsecutiveOffer: vi.fn(),
    setConsecutiveOfferSettled: vi.fn(),
    setConsecutiveFetchKey: vi.fn(),
    setPackageCheckInResult: vi.fn(),
    setShowConsecutiveOverlay: vi.fn(),
    setShowConsecutivePaymentSelection: vi.fn(),
    setAwaitingConsecutivePaymentSelection: vi.fn(),
  }
}

type HookResult = {
  resetCustomerFlowState: () => void
  handleStationCompletion: () => void
  dismissExistingCustomer: () => void
}

testGlobal.IS_REACT_ACT_ENVIRONMENT = true

describe("useKioskFlowCompletion — reset/cleanup", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null
  let captured: HookResult | null = null

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount()
      })
    }
    container?.remove()
    root = null
    captured = null
  })

  async function renderHook(params = createMockParams()) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)

    function Harness() {
      const result = useKioskFlowCompletion(params)
      captured = result
      return null
    }

    await act(async () => {
      root!.render(<Harness />)
    })

    return { params, getResult: () => captured! }
  }

  it("resetCustomerFlowState clears packageOfferContext to null", async () => {
    const { params } = await renderHook()

    await act(async () => {
      captured!.resetCustomerFlowState()
    })

    expect(params.setPackageOfferContext).toHaveBeenCalledWith(null)
  })

  it("resetCustomerFlowState clears packageOfferSelectedId to null", async () => {
    const { params } = await renderHook()

    await act(async () => {
      captured!.resetCustomerFlowState()
    })

    expect(params.setPackageOfferSelectedId).toHaveBeenCalledWith(null)
  })

  it("resetCustomerFlowState clears all other state without affecting package offer setters", async () => {
    const { params } = await renderHook()

    await act(async () => {
      captured!.resetCustomerFlowState()
    })

    // All state setters should be called exactly once
    expect(params.setOpenNewBooking).toHaveBeenCalledWith(false)
    expect(params.setNewBookingOverride).toHaveBeenCalledWith(null)
    expect(params.setLatePaymentEntryOverride).toHaveBeenCalledWith(null)
    expect(params.setExistingRegularBookingOverride).toHaveBeenCalledWith(null)
    expect(params.setPaymentsModalReady).toHaveBeenCalledWith(false)
    expect(params.setMode).toHaveBeenCalledWith("idle")
    expect(params.setBootstrap).toHaveBeenCalledWith(null)
    expect(params.setShowPhoneSignIn).toHaveBeenCalledWith(false)
    expect(params.setPendingLoginPhone).toHaveBeenCalledWith("")
    expect(params.setError).toHaveBeenCalledWith(null)
    expect(params.setSuccess).toHaveBeenCalledWith(null)
    expect(params.setKioskPin).toHaveBeenCalledWith("")
    expect(params.setKioskPinSessionToken).toHaveBeenCalledWith("")
    expect(params.setKioskPinRotationRequired).toHaveBeenCalledWith(false)
    expect(params.setKioskPinRotationMode).toHaveBeenCalledWith(null)
    expect(params.setKioskPinNext).toHaveBeenCalledWith("")
    expect(params.setKioskPinConfirm).toHaveBeenCalledWith("")
    expect(params.setKioskPinAttemptsRemaining).toHaveBeenCalledWith(null)
    expect(params.setKioskPinBlockedUntil).toHaveBeenCalledWith(null)
    expect(params.resetKioskCustomerSession).toHaveBeenCalled()
    expect(params.setConsecutiveOffer).toHaveBeenCalledWith(null)
    expect(params.setConsecutiveOfferSettled).toHaveBeenCalledWith(false)
    expect(params.setConsecutiveFetchKey).toHaveBeenCalledWith(expect.any(Function))
    expect(params.setPackageCheckInResult).toHaveBeenCalledWith(null)
    expect(params.setShowConsecutiveOverlay).toHaveBeenCalledWith(false)
    expect(params.setShowConsecutivePaymentSelection).toHaveBeenCalledWith(false)
    expect(params.setAwaitingConsecutivePaymentSelection).toHaveBeenCalledWith(false)
  })

  it("resetCustomerFlowState calls setPackageOfferContext and setPackageOfferSelectedId exactly once each", async () => {
    const { params } = await renderHook()

    await act(async () => {
      captured!.resetCustomerFlowState()
    })

    expect(params.setPackageOfferContext).toHaveBeenCalledTimes(1)
    expect(params.setPackageOfferSelectedId).toHaveBeenCalledTimes(1)
  })

  it("reset does not call unrelated async functions like replaceUrl or signOut", async () => {
    const { params } = await renderHook()

    await act(async () => {
      captured!.resetCustomerFlowState()
    })

    expect(params.replaceUrl).not.toHaveBeenCalled()
    expect(params.signOutKioskCustomerSession).not.toHaveBeenCalled()
    expect(params.suppressClerkSessionOnCompletion).not.toHaveBeenCalled()
  })

  it("reset works correctly even when isKioskTerminalFlow is false", async () => {
    const params = createMockParams()
    params.isKioskTerminalFlow = false
    const { params: returnedParams } = await renderHook(params)

    await act(async () => {
      captured!.resetCustomerFlowState()
    })

    expect(returnedParams.setPackageOfferContext).toHaveBeenCalledWith(null)
    expect(returnedParams.setPackageOfferSelectedId).toHaveBeenCalledWith(null)
    expect(returnedParams.setBootstrap).toHaveBeenCalledWith(null)
    expect(returnedParams.setMode).toHaveBeenCalledWith("idle")
  })
})
