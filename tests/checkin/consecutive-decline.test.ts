import { describe, expect, it, vi } from "vitest"
import { resolvePackageConsecutiveDeclineAction } from "@/lib/checkin/existing-customer-flow"

/**
 * Behavior test for the decline path of the consecutive class offer.
 *
 * Bug reproduced (pre-fix):
 *   A package holder is shown the consecutive offer BEFORE class A check-in
 *   (pre-checkin mode). They press "No Thanks". The callback awaits the
 *   check-in API, then re-reads `packageCheckInResult` from the React
 *   closure — which is STILL `null` even after `setPackageCheckInResult` was
 *   queued. The stale read makes the callback fall through to
 *   `handleStationCompletion()`, which resets every flow state slot
 *   (including `packageCheckInResult`). The success overlay never appears,
 *   the kiosk snaps back to idle, and to the operator it looks like the
 *   package holder was NOT checked in — even though the DB write succeeded.
 *
 * Fix:
 *   Resolve the decline action from the CURRENT closure value BEFORE any
   *   await, via `resolvePackageConsecutiveDeclineAction`. In `pre-checkin` mode the
 *   callback records the check-in result and leaves the overlay to drive
 *   completion. In `post-checkin` mode it completes the station directly.
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

type DeclineDeps = {
  hasPackageCheckInResult: boolean
  performPackageCheckInApi: () => Promise<PackageCheckInOutcome>
  setConsecutiveProcessing: (value: boolean) => void
  setConsecutiveError: (value: string | null) => void
  setPackageCheckInResult: (
    value: { remainingCredits: number | null; points: number } | null,
  ) => void
  setConsecutiveOffer: (value: null) => void
  setShowConsecutiveOverlay: (value: false) => void
  handleStationCompletion: () => void
}

/**
 * Mirrors `handleConsecutiveDecline` in CheckInQrClient.tsx. The component
 * callback uses React state hooks; this harness uses plain functions but
 * follows the exact same control flow so the regression is locked in.
 */
async function runDecline(deps: DeclineDeps) {
  const action = resolvePackageConsecutiveDeclineAction({
    hasPackageCheckInResult: deps.hasPackageCheckInResult,
  })

  if (action === "pre-checkin") {
    deps.setConsecutiveProcessing(true)
    const result = await deps.performPackageCheckInApi()
    deps.setConsecutiveProcessing(false)
    if ("kind" in result) {
      deps.setConsecutiveError(result.message)
      return
    }
    deps.setPackageCheckInResult(result)
    deps.setConsecutiveOffer(null)
    deps.setShowConsecutiveOverlay(false)
    return
  }

  deps.setConsecutiveOffer(null)
  deps.setShowConsecutiveOverlay(false)
  deps.handleStationCompletion()
}

function createDeps(overrides: Partial<DeclineDeps> = {}): DeclineDeps {
  return {
    hasPackageCheckInResult: false,
    performPackageCheckInApi: vi
      .fn()
      .mockResolvedValue({ remainingCredits: 4, points: 1 }),
    setConsecutiveProcessing: vi.fn(),
    setConsecutiveError: vi.fn(),
    setPackageCheckInResult: vi.fn(),
    setConsecutiveOffer: vi.fn(),
    setShowConsecutiveOverlay: vi.fn(),
    handleStationCompletion: vi.fn(),
    ...overrides,
  }
}

describe("consecutive offer decline — package holder", () => {
  it("checks the package holder in when they decline the second-class offer before check-in", async () => {
    const deps = createDeps()
    await runDecline(deps)

    expect(deps.performPackageCheckInApi).toHaveBeenCalledTimes(1)
    expect(deps.setPackageCheckInResult).toHaveBeenCalledWith({
      remainingCredits: 4,
      points: 1,
    })
  })

  it("does NOT call handleStationCompletion in pre-checkin decline (overlay drives completion)", async () => {
    // Regression: the buggy version called handleStationCompletion() after
    // setPackageCheckInResult, which wiped the success overlay before the
    // operator could see it.
    const deps = createDeps()
    await runDecline(deps)

    expect(deps.handleStationCompletion).not.toHaveBeenCalled()
  })

  it("closes the consecutive overlay after successful pre-checkin decline", async () => {
    const deps = createDeps()
    await runDecline(deps)

    expect(deps.setConsecutiveOffer).toHaveBeenCalledWith(null)
    expect(deps.setShowConsecutiveOverlay).toHaveBeenCalledWith(false)
  })

  it("surfaces an error and does NOT reset when class A check-in fails", async () => {
    const deps = createDeps({
      performPackageCheckInApi: vi.fn().mockResolvedValue({
        kind: "server",
        message: "We couldn't check you in. Please see the front desk.",
      }),
    })

    await runDecline(deps)

    expect(deps.setConsecutiveError).toHaveBeenCalledWith(
      "We couldn't check you in. Please see the front desk.",
    )
    expect(deps.setPackageCheckInResult).not.toHaveBeenCalled()
    expect(deps.handleStationCompletion).not.toHaveBeenCalled()
    expect(deps.setConsecutiveOffer).not.toHaveBeenCalled()
    expect(deps.setShowConsecutiveOverlay).not.toHaveBeenCalled()
  })

  it("completes the station directly in post-checkin decline (legacy path)", async () => {
    const deps = createDeps({ hasPackageCheckInResult: true })

    await runDecline(deps)

    expect(deps.performPackageCheckInApi).not.toHaveBeenCalled()
    expect(deps.setPackageCheckInResult).not.toHaveBeenCalled()
    expect(deps.handleStationCompletion).toHaveBeenCalledTimes(1)
    expect(deps.setConsecutiveOffer).toHaveBeenCalledWith(null)
    expect(deps.setShowConsecutiveOverlay).toHaveBeenCalledWith(false)
  })
})
