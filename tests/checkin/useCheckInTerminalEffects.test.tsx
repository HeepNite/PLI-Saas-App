// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useCheckInTerminalEffects, type UseCheckInTerminalEffectsInput } from "@/components/front/checkin/hooks/useCheckInTerminalEffects"
import { createEmptyKioskQrCheckoutState } from "@/lib/checkin/kiosk-qr-payment"
import type { BootstrapResponse } from "@/components/front/checkin/checkin.types"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

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

const defaultParams = (override: Partial<UseCheckInTerminalEffectsInput> = {}): UseCheckInTerminalEffectsInput => ({
  bootstrap: bootstrap(),
  loadingBootstrap: false,
  isLoaded: true,
  hasActiveClerkSession: true,
  kioskPinSessionToken: null,
  hasKioskPinSession: true,
  loadBootstrap: vi.fn().mockResolvedValue(undefined),
  mode: "existing",
  setMode: vi.fn(),
  entryMode: null,
  isKioskTerminalFlow: true,
  setInternalNowTick: vi.fn(),
  setOrigin: vi.fn(),
  setIsCompactViewport: vi.fn(),
  showPhoneSignIn: false,
  setShowPhoneSignIn: vi.fn(),
  packageOfferContext: null,
  setPackageOfferContext: vi.fn(),
  setPackageOfferSelectedId: vi.fn(),
  openNewBooking: false,
  existingRegularBookingOverride: null,
  newBookingOverride: null,
  processingPackageCheckIn: false,
  packageCheckInResult: null,
  packageCheckInAttempts: 0,
  packageCheckInFailure: null,
  retryBackoffActive: false,
  setPackageCheckInFailure: vi.fn(),
  hasUsablePackageForCurrentClass: true,
  effectiveCheckInWindowOpen: true,
  handlePackageCheckIn: vi.fn().mockResolvedValue(undefined),
  consecutiveOffer: null,
  consecutiveOfferSettled: false,
  showConsecutiveOverlay: false,
  setShowConsecutiveOverlay: vi.fn(),
  showConsecutivePaymentSelection: false,
  setShowConsecutivePaymentSelection: vi.fn(),
  awaitingConsecutivePaymentSelection: false,
  consecutiveQrCheckout: createEmptyKioskQrCheckoutState(),
  consecutiveSuccess: null,
  consecutiveError: null,
  openExistingPurchaseFlow: vi.fn(),
  setShowDuplicatePurchasePopup: vi.fn(),
  error: null,
  success: null,
  setError: vi.fn(),
  setSuccess: vi.fn(),
  showKioskPinPanel: false,
  pendingLoginPhone: "",
  showDuplicatePurchasePopup: false,
  kioskPinSessionActive: true,
  handleStationCompletion: vi.fn(),
  onFlowActiveChange: undefined,
  ...override,
})

describe("useCheckInTerminalEffects — PR2 retry/backoff/failure wiring", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount()
      })
    }
    container?.remove()
    root = null
    container = null
    vi.restoreAllMocks()
  })

  const mount = async (params: UseCheckInTerminalEffectsInput) => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)

    function Harness() {
      useCheckInTerminalEffects(params)
      return null
    }

    await act(async () => {
      root!.render(<Harness />)
    })

    return { params }
  }

  describe("closed-window package error effect", () => {
    it("calls setPackageCheckInFailure(closed_window) WITHOUT calling setError (PR3: failure overlay is the sole kiosk surface)", async () => {
      const params = defaultParams({ effectiveCheckInWindowOpen: false })
      await mount(params)

      expect(params.setPackageCheckInFailure).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "closed_window" })
      )
      expect(params.setError).not.toHaveBeenCalled()
    })

    it("is a no-op (race fix) when hasPackageCheckInFailure is already true — does not re-assert while a manual Retry may have just cleared it", async () => {
      const params = defaultParams({
        effectiveCheckInWindowOpen: false,
        packageCheckInFailure: { kind: "closed_window", message: "The check-in window for this class is closed." },
      })
      await mount(params)

      expect(params.setPackageCheckInFailure).not.toHaveBeenCalled()
      expect(params.setError).not.toHaveBeenCalled()
    })

    it("does not fire when the check-in window is open", async () => {
      const params = defaultParams({ effectiveCheckInWindowOpen: true })
      await mount(params)

      expect(params.setPackageCheckInFailure).not.toHaveBeenCalled()
    })
  })

  describe("auto-trigger gate — retry/backoff/failure wiring", () => {
    it("fires handlePackageCheckIn on a fresh mount with no prior attempts, failure, or backoff", async () => {
      const params = defaultParams()
      await mount(params)

      expect(params.handlePackageCheckIn).toHaveBeenCalledTimes(1)
    })

    it("does NOT fire handlePackageCheckIn while retryBackoffActive is true", async () => {
      const params = defaultParams({ retryBackoffActive: true })
      await mount(params)

      expect(params.handlePackageCheckIn).not.toHaveBeenCalled()
    })

    it("does NOT fire handlePackageCheckIn once packageCheckInFailure has been recorded", async () => {
      const params = defaultParams({
        packageCheckInFailure: { kind: "server", message: "We couldn't check you in. Please see the front desk." },
      })
      await mount(params)

      expect(params.handlePackageCheckIn).not.toHaveBeenCalled()
    })

    it("does NOT fire handlePackageCheckIn once the retry budget (3) is exhausted", async () => {
      const params = defaultParams({ packageCheckInAttempts: 3 })
      await mount(params)

      expect(params.handlePackageCheckIn).not.toHaveBeenCalled()
    })

    it("still fires within budget (attempts=2 of default maxAttempts=3)", async () => {
      const params = defaultParams({ packageCheckInAttempts: 2 })
      await mount(params)

      expect(params.handlePackageCheckIn).toHaveBeenCalledTimes(1)
    })
  })
})
