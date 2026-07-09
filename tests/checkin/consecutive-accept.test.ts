import { describe, expect, it, vi } from "vitest"
import {
  resolvePackageConsecutiveAcceptAction,
  resolvePackageSuccessDoneAction,
  resolveConsecutivePaymentSuccessAction,
} from "@/lib/checkin/existing-customer-flow"

/**
 * Behavior test for the ACCEPT path of the consecutive class offer
 * for package holders.
 *
 * Bug reproduced (pre-fix):
 *   Jhon Doe (purchase cmpbkyowj001ow3gpqxwdpexa) — a package holder —
 *   completed class A check-in (`packageCheckInResult` set). The consecutive
 *   offer surfaced. Pressing "Yes" went straight to
 *   `POST /api/checkin/qr/package` with `consecutiveAddOn: true` and NO
 *   `consecutiveCashPayment`. The backend created the $10 add-on as `paid`
 *   with `paymentChannel: consecutive_addon` and no Stripe IDs. The operator
 *   never collected cash and never saw a card flow.
 *
 * Fix:
 *   For package holders, ANY consecutive accept with a positive price must
 *   resolve to `"show-payment-selection"`, regardless of whether class A
 *   check-in already happened. The actual monetary add-on must only be
 *   created after Cash (sets `consecutiveCashPayment=true`) or Card (goes
 *   through `/api/checkout/session`) is selected.
 *
 *   `pre-checkin` (class A not yet checked in) must still perform the
 *   package check-in for class A first; the price-gated payment selection
 *   then opens for class B.
 */

type PackageCheckInSuccess = {
  remainingCredits: number | null
  points: number
}

type PackageCheckInFailure = {
  kind: string
  message: string
}

type PackageCheckInOutcome = PackageCheckInSuccess | PackageCheckInFailure

type AcceptDeps = {
  hasPackageCheckInResult: boolean
  priceCents: number | null
  performPackageCheckInApi: () => Promise<PackageCheckInOutcome>
  setConsecutiveProcessing: (value: boolean) => void
  setConsecutiveError: (value: string | null) => void
  setPackageCheckInResult: (
    value: { remainingCredits: number | null; points: number } | null,
  ) => void
  setShowConsecutivePaymentSelection: (value: boolean) => void
  /** Pre-checkin accept arms this flag so the success overlay's Done
   * advances to payment selection instead of resetting the station. */
  setAwaitingConsecutivePaymentSelection: (value: boolean) => void
  /** Hides the consecutive offer overlay while the credit-consumed
   * confirmation is on screen. */
  setShowConsecutiveOverlay: (value: boolean) => void
  /** Direct add (free / non-monetary) — should NEVER fire when priceCents > 0 */
  performDirectAdd: () => Promise<void>
}

/**
 * Mirrors the relevant branches of `handleConsecutiveAccept` in
 * CheckInQrClient.tsx so the regression is locked in at a pure-logic layer
 * without spinning up React.
 */
async function runAccept(deps: AcceptDeps) {
  const action = resolvePackageConsecutiveAcceptAction({
    hasPackageCheckInResult: deps.hasPackageCheckInResult,
    priceCents: deps.priceCents,
  })

  if (action === "pre-checkin-then-payment-selection") {
    deps.setConsecutiveProcessing(true)
    const result = await deps.performPackageCheckInApi()
    if ("kind" in result) {
      deps.setConsecutiveError(result.message)
      deps.setConsecutiveProcessing(false)
      return
    }
    // Show credit-consumed confirmation first; DO NOT open payment
    // selection in the same tick — that would race the success overlay so
    // the operator never sees "1 class was used, X credits remaining".
    deps.setPackageCheckInResult(result)
    deps.setAwaitingConsecutivePaymentSelection(true)
    deps.setShowConsecutiveOverlay(false)
    deps.setConsecutiveProcessing(false)
    return
  }

  if (action === "show-payment-selection") {
    deps.setShowConsecutivePaymentSelection(true)
    return
  }

  // direct-add: free add-on, allowed to call API directly
  await deps.performDirectAdd()
}

type SuccessDoneDeps = {
  awaitingConsecutivePaymentSelection: boolean
  setAwaitingConsecutivePaymentSelection: (value: boolean) => void
  setPackageCheckInResult: (
    value: { remainingCredits: number | null; points: number } | null,
  ) => void
  setShowConsecutiveOverlay: (value: boolean) => void
  setShowConsecutivePaymentSelection: (value: boolean) => void
  completeStationPackageFlow: () => void
}

/**
 * Mirrors `handlePackageSuccessDone` in CheckInQrClient.tsx: when the user
 * presses "Done" on KioskPackageSuccessOverlay, either advance to the
 * Cash/Card payment selection (mid-consecutive-flow) or reset the station
 * (normal package check-in).
 */
function runSuccessDone(deps: SuccessDoneDeps) {
  const action = resolvePackageSuccessDoneAction({
    awaitingConsecutivePaymentSelection: deps.awaitingConsecutivePaymentSelection,
  })

  if (action === "open-payment-selection") {
    deps.setAwaitingConsecutivePaymentSelection(false)
    deps.setPackageCheckInResult(null)
    deps.setShowConsecutiveOverlay(true)
    deps.setShowConsecutivePaymentSelection(true)
    return
  }

  deps.completeStationPackageFlow()
}

function createDeps(overrides: Partial<AcceptDeps> = {}): AcceptDeps {
  return {
    hasPackageCheckInResult: false,
    priceCents: 1000,
    performPackageCheckInApi: vi
      .fn()
      .mockResolvedValue({ remainingCredits: 4, points: 1 }),
    setConsecutiveProcessing: vi.fn(),
    setConsecutiveError: vi.fn(),
    setPackageCheckInResult: vi.fn(),
    setShowConsecutivePaymentSelection: vi.fn(),
    setAwaitingConsecutivePaymentSelection: vi.fn(),
    setShowConsecutiveOverlay: vi.fn(),
    performDirectAdd: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function createSuccessDoneDeps(
  overrides: Partial<SuccessDoneDeps> = {},
): SuccessDoneDeps {
  return {
    awaitingConsecutivePaymentSelection: false,
    setAwaitingConsecutivePaymentSelection: vi.fn(),
    setPackageCheckInResult: vi.fn(),
    setShowConsecutiveOverlay: vi.fn(),
    setShowConsecutivePaymentSelection: vi.fn(),
    completeStationPackageFlow: vi.fn(),
    ...overrides,
  }
}

describe("consecutive offer accept — package holder", () => {
  it("post-checkin + positive price → shows payment selection (does NOT call package check-in API again, does NOT call direct add)", async () => {
    // Regression: pre-fix this branch called /api/checkin/qr/package
    // directly with consecutiveAddOn:true → backend marked $10 as paid
    // with paymentChannel:consecutive_addon. (Jhon Doe purchase
    // cmpbkyowj001ow3gpqxwdpexa.)
    const deps = createDeps({ hasPackageCheckInResult: true, priceCents: 1000 })
    await runAccept(deps)

    expect(deps.setShowConsecutivePaymentSelection).toHaveBeenCalledWith(true)
    expect(deps.performPackageCheckInApi).not.toHaveBeenCalled()
    expect(deps.performDirectAdd).not.toHaveBeenCalled()
    expect(deps.setPackageCheckInResult).not.toHaveBeenCalled()
  })

  it("pre-checkin + positive price → checks class A in, records result, arms await flag, does NOT open payment selection yet (overlay must show first)", async () => {
    // UX regression: previously this branch set
    // showConsecutivePaymentSelection(true) in the same tick as
    // setPackageCheckInResult, so KioskPackageSuccessOverlay (credit
    // consumed, remaining credits) was raced/covered by the payment
    // selection. The operator never saw the credit confirmation. The fix
    // shows the success overlay first; its Done button advances to
    // payment selection via the arming flag.
    const deps = createDeps({ hasPackageCheckInResult: false, priceCents: 1000 })
    await runAccept(deps)

    expect(deps.performPackageCheckInApi).toHaveBeenCalledTimes(1)
    expect(deps.setPackageCheckInResult).toHaveBeenCalledWith({
      remainingCredits: 4,
      points: 1,
    })
    expect(deps.setAwaitingConsecutivePaymentSelection).toHaveBeenCalledWith(true)
    // Hide the consecutive overlay so it doesn't cover the success overlay.
    expect(deps.setShowConsecutiveOverlay).toHaveBeenCalledWith(false)
    // Critical: payment selection must NOT open here — Done on the
    // success overlay does that.
    expect(deps.setShowConsecutivePaymentSelection).not.toHaveBeenCalled()
    expect(deps.performDirectAdd).not.toHaveBeenCalled()
  })

  it("pre-checkin + check-in fails → surfaces error, does NOT show payment selection, does NOT arm await flag", async () => {
    const deps = createDeps({
      hasPackageCheckInResult: false,
      priceCents: 1000,
      performPackageCheckInApi: vi.fn().mockResolvedValue({
        kind: "server",
        message: "We couldn't check you in. Please see the front desk.",
      }),
    })
    await runAccept(deps)

    expect(deps.setConsecutiveError).toHaveBeenCalledWith(
      "We couldn't check you in. Please see the front desk.",
    )
    expect(deps.setShowConsecutivePaymentSelection).not.toHaveBeenCalled()
    expect(deps.setAwaitingConsecutivePaymentSelection).not.toHaveBeenCalled()
    expect(deps.setPackageCheckInResult).not.toHaveBeenCalled()
    expect(deps.performDirectAdd).not.toHaveBeenCalled()
  })

  it("post-checkin + zero price → free add-on may call direct add (no payment selection)", async () => {
    const deps = createDeps({ hasPackageCheckInResult: true, priceCents: 0 })
    await runAccept(deps)

    expect(deps.performDirectAdd).toHaveBeenCalledTimes(1)
    expect(deps.setShowConsecutivePaymentSelection).not.toHaveBeenCalled()
  })

  it("post-checkin + null price → treated as free add-on (legacy fallback, direct add)", async () => {
    const deps = createDeps({ hasPackageCheckInResult: true, priceCents: null })
    await runAccept(deps)

    expect(deps.performDirectAdd).toHaveBeenCalledTimes(1)
    expect(deps.setShowConsecutivePaymentSelection).not.toHaveBeenCalled()
  })
})

describe("resolvePackageConsecutiveAcceptAction (pure)", () => {
  it("returns show-payment-selection for post-checkin with positive price", () => {
    expect(
      resolvePackageConsecutiveAcceptAction({
        hasPackageCheckInResult: true,
        priceCents: 1000,
      }),
    ).toBe("show-payment-selection")
  })

  it("returns pre-checkin-then-payment-selection for pre-checkin with positive price", () => {
    expect(
      resolvePackageConsecutiveAcceptAction({
        hasPackageCheckInResult: false,
        priceCents: 1000,
      }),
    ).toBe("pre-checkin-then-payment-selection")
  })

  it("returns direct-add when priceCents is 0 (free)", () => {
    expect(
      resolvePackageConsecutiveAcceptAction({
        hasPackageCheckInResult: true,
        priceCents: 0,
      }),
    ).toBe("direct-add")
  })

  it("returns direct-add when priceCents is null (legacy/free fallback)", () => {
    expect(
      resolvePackageConsecutiveAcceptAction({
        hasPackageCheckInResult: true,
        priceCents: null,
      }),
    ).toBe("direct-add")
  })

  it("treats negative price as direct-add (defensive — no monetary collection)", () => {
    expect(
      resolvePackageConsecutiveAcceptAction({
        hasPackageCheckInResult: true,
        priceCents: -5,
      }),
    ).toBe("direct-add")
  })
})

describe("package success overlay — Done handler (post credit confirmation)", () => {
  it("when awaiting consecutive payment → opens payment selection, hides success overlay, does NOT reset station", () => {
    // Pre-checkin consecutive accept armed the flag. The operator
    // acknowledged the credit-consumed confirmation by pressing Done.
    // We must continue the consecutive flow, NOT reset the station.
    const deps = createSuccessDoneDeps({
      awaitingConsecutivePaymentSelection: true,
    })

    runSuccessDone(deps)

    expect(deps.completeStationPackageFlow).not.toHaveBeenCalled()
    expect(deps.setAwaitingConsecutivePaymentSelection).toHaveBeenCalledWith(false)
    expect(deps.setPackageCheckInResult).toHaveBeenCalledWith(null)
    expect(deps.setShowConsecutiveOverlay).toHaveBeenCalledWith(true)
    expect(deps.setShowConsecutivePaymentSelection).toHaveBeenCalledWith(true)
  })

  it("normal package check-in (no consecutive accept in flight) → resets station", () => {
    const deps = createSuccessDoneDeps({
      awaitingConsecutivePaymentSelection: false,
    })

    runSuccessDone(deps)

    expect(deps.completeStationPackageFlow).toHaveBeenCalledTimes(1)
    expect(deps.setShowConsecutivePaymentSelection).not.toHaveBeenCalled()
    expect(deps.setAwaitingConsecutivePaymentSelection).not.toHaveBeenCalled()
  })
})

describe("resolvePackageSuccessDoneAction (pure)", () => {
  it("returns open-payment-selection when awaiting consecutive payment", () => {
    expect(
      resolvePackageSuccessDoneAction({
        awaitingConsecutivePaymentSelection: true,
      }),
    ).toBe("open-payment-selection")
  })

  it("returns complete-station when not awaiting consecutive payment", () => {
    expect(
      resolvePackageSuccessDoneAction({
        awaitingConsecutivePaymentSelection: false,
      }),
    ).toBe("complete-station")
  })
})

describe("resolveConsecutivePaymentSuccessAction (pure)", () => {
  it("completes the station immediately after kiosk consecutive payment succeeds", () => {
    expect(
      resolveConsecutivePaymentSuccessAction({
        isKioskTerminalFlow: true,
      })
    ).toBe("complete-station")
  })

  it("keeps the inline success screen outside kiosk terminal flow", () => {
    expect(
      resolveConsecutivePaymentSuccessAction({
        isKioskTerminalFlow: false,
      })
    ).toBe("show-success")
  })
})
