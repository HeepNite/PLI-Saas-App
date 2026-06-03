// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useStaffPortalDataLifecycle } from "@/components/front/staff/useStaffPortalDataLifecycle"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type HookOptions = Parameters<typeof useStaffPortalDataLifecycle>[0]

const createOptions = (overrides: Partial<HookOptions> = {}): HookOptions => ({
  checkoutMenuPaymentId: null,
  setCheckoutMenuPaymentId: vi.fn(),
  canAccessUsersNav: false,
  showStaffOps: false,
  isProfileView: false,
  canAccessProfileNav: false,
  requestStatusFilter: "PENDING",
  profileRequestStatusFilter: "PENDING",
  fetchStaffRequests: vi.fn(),
  fetchPaymentChangeRequests: vi.fn(),
  fetchSelfProfile: vi.fn(),
  ...overrides,
})

function HookHarness({ options }: { options: HookOptions }) {
  useStaffPortalDataLifecycle(options)
  return null
}

describe("useStaffPortalDataLifecycle", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    vi.restoreAllMocks()
  })

  async function renderHook(options: HookOptions) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root!.render(<HookHarness options={options} />))
  }

  it("fetches staff and payment-change requests for staff ops", async () => {
    const fetchStaffRequests = vi.fn()
    const fetchPaymentChangeRequests = vi.fn()

    await renderHook(createOptions({
      canAccessUsersNav: true,
      showStaffOps: true,
      requestStatusFilter: "APPROVED",
      fetchStaffRequests,
      fetchPaymentChangeRequests,
    }))

    expect(fetchStaffRequests).toHaveBeenCalledWith("APPROVED", { scope: "all" })
    expect(fetchPaymentChangeRequests).toHaveBeenCalledTimes(1)
  })

  it("fetches self profile and own requests for profile view", async () => {
    const fetchStaffRequests = vi.fn()
    const fetchSelfProfile = vi.fn()

    await renderHook(createOptions({
      isProfileView: true,
      canAccessProfileNav: true,
      profileRequestStatusFilter: "REJECTED",
      fetchStaffRequests,
      fetchSelfProfile,
    }))

    expect(fetchSelfProfile).toHaveBeenCalledTimes(1)
    expect(fetchStaffRequests).toHaveBeenCalledWith("REJECTED", { scope: "mine" })
  })

  it("closes checkout menu when clicking outside", async () => {
    const setCheckoutMenuPaymentId = vi.fn()
    await renderHook(createOptions({ checkoutMenuPaymentId: "payment-1", setCheckoutMenuPaymentId }))
    const outside = document.createElement("button")
    document.body.appendChild(outside)

    await act(async () => {
      outside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))
    })

    expect(setCheckoutMenuPaymentId).toHaveBeenCalledWith(null)
  })
})
