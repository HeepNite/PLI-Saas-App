import type { PackageOfferScenario } from "@/components/front/checkin/checkin.types"
import type { PackageCheckInResult } from "@/components/front/checkin/hooks/useCheckInPackageFlow"

const EXISTING_CUSTOMER_INFO_STEP = 2

export const PACKAGE_CHECK_IN_MAX_ATTEMPTS = 3
const NO_PACKAGE_MESSAGE = "No active package available for this class."
const NO_CREDITS_MESSAGE = "This package has no credits left."
const DEFAULT_PACKAGE_CHECK_IN_FAILURE_MESSAGE = "We couldn't check you in. Please see the front desk."
const RETRY_AFTER_CAP_MS = 60_000

/**
 * Fixed backoff schedule (ms) applied between kiosk auto-retry attempts,
 * indexed by `packageCheckInAttempts` at the moment a retryable failure is
 * classified. Only 2 entries: with `maxAttempts = 3` and the
 * `attempts + 1 < maxAttempts` retry-exhaustion boundary, `attemptIndex` can
 * only ever be `0` or `1` — a would-be 3rd entry is unreachable dead
 * configuration and has been trimmed. Overridden per-attempt by the server's
 * `Retry-After` header for `rate_limited` failures.
 */
export const backoffDelays: readonly number[] = [0, 2000]

export const hasExistingCustomerPrefillContact = (input?: {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
}) =>
  Boolean(
    input?.firstName?.trim() &&
      input?.lastName?.trim() &&
      input?.email?.trim() &&
      input?.phone?.trim()
  )

/**
 * Returns the initial step index for existing customer kiosk flow.
 * 
 * For kiosk terminal flows, the step order is: info → [photo] → [packages] → payments
 * 
 * Logic:
 * - If contact is NOT prefilled → start at info (0)
 * - If contact IS prefilled:
 *   - If needs photo → go to photo step
 *   - Else if packages available AND no active package → go to packages step
 *   - Else → go to payments step
 */
export const getExistingCustomerInitialStep = (input?: {
  isKioskTerminalFlow?: boolean
  hasPrefilledContact?: boolean
  /** Whether photo step is included in the flow */
  requiresPhotoStep?: boolean
  /** Whether packages step is included in the flow (course has packages) */
  hasPackages?: boolean
  /** Whether the user already has an active package */
  hasActivePackage?: boolean
}) => {
  if (!input?.isKioskTerminalFlow) {
    return EXISTING_CUSTOMER_INFO_STEP
  }

  // No prefilled contact → start at info
  if (!input.hasPrefilledContact) {
    return 0
  }

  // Steps after info: [photo] → [packages] → payments
  // Calculate the target step index
  
  // If needs photo, that's the first step after info
  if (input.requiresPhotoStep) {
    return 1 // photo step
  }

  // If packages available AND user doesn't have active package, go to packages
  if (input.hasPackages && !input.hasActivePackage) {
    // packages step index = 1 (no photo) or would be 2 (with photo, but we handled that above)
    return 1
  }

  // Otherwise go to payments
  // payments index = 1 (no photo, no packages) 
  //                = 2 (with packages but user has active package)
  //                = 2 (with photo, no packages) - handled above
  let paymentsIndex = 1
  if (input.hasPackages) paymentsIndex++ // packages step exists, skip it
  return paymentsIndex
}

export const shouldShowCheckInQrPanel = (input: {
  hideQrPanel: boolean
  hasQrImage: boolean
  isCompactViewport: boolean
  isQrEntry: boolean
  shellVariant: "qr" | "terminal"
}) => {
  if (input.hideQrPanel || !input.hasQrImage || input.isQrEntry) {
    return false
  }

  if (input.shellVariant === "terminal") {
    return true
  }

  return !input.isCompactViewport
}

export const shouldAutoOpenExistingPurchase = (input: {
  mode: "idle" | "existing" | "new"
  hasBootstrap: boolean
  isSignedIn: boolean
  hasKioskPinSession: boolean
  loadingBootstrap: boolean
  hasExistingRegularBookingOverride: boolean
  openNewBooking: boolean
  processingPackageCheckIn: boolean
  hasPackage: boolean
}) => {
  if (input.mode !== "existing") return false
  if (!input.hasBootstrap || input.loadingBootstrap) return false
  if (!input.isSignedIn && !input.hasKioskPinSession) return false
  if (input.hasExistingRegularBookingOverride || input.openNewBooking || input.processingPackageCheckIn) return false
  return !input.hasPackage
}

export const shouldAutoPromoteExistingMode = (input: {
  entryMode?: "existing" | string | null
  mode: "idle" | "existing" | "new"
  hasActiveClerkSession: boolean
  isKioskTerminalFlow: boolean
}) => {
  if (input.entryMode === "existing" && input.mode !== "existing") return true
  if (input.isKioskTerminalFlow) return false
  return input.hasActiveClerkSession && input.mode === "idle"
}

export const shouldShowPackageOffer = (input: {
  isKioskTerminalFlow: boolean
  hasPackage: boolean
  quickCheckoutServiceId: string | null
  quickCheckoutPackageId: string | null
  previousPackageId: string | null
  availablePackages: Array<{ id: string }>
}): "dropin-upsell" | "expired-rebuy" | "new-user-upsell" | null => {
  if (!input.isKioskTerminalFlow) return null
  if (input.hasPackage) return null
  if (input.availablePackages.length === 0) return null

  if (input.previousPackageId || input.quickCheckoutPackageId) {
    return "expired-rebuy"
  }

  if (input.quickCheckoutServiceId === "dropin") {
    return "dropin-upsell"
  }

  return null
}

export const shouldAutoTriggerPackageCheckIn = (input: {
  isKioskTerminalFlow: boolean
  mode: "idle" | "existing" | "new"
  hasPackage: boolean
  processingPackageCheckIn: boolean
  hasPackageCheckInResult: boolean
  hasExistingPurchaseForSession?: boolean
  effectiveCheckInWindowOpen: boolean
  hasActiveSession: boolean
  /** Whether a consecutive class offer was fetched for this course */
  hasConsecutiveOffer: boolean
  /** Whether the consecutive offer fetch has resolved (success or failure) */
  consecutiveOfferSettled: boolean
  /** Number of completed kiosk auto-retry attempts. Defaults to 0. */
  attemptCount?: number
  /** Retry budget. Defaults to 3. */
  maxAttempts?: number
  /** True once the kiosk retry budget is exhausted or a non-retryable failure occurred. Defaults to false. */
  hasTerminalFailure?: boolean
  /** True while a backoff delay is pending before the next automatic attempt. Defaults to false. */
  retryBackoffActive?: boolean
}) => {
  const attemptCount = input.attemptCount ?? 0
  const maxAttempts = input.maxAttempts ?? PACKAGE_CHECK_IN_MAX_ATTEMPTS
  const hasTerminalFailure = input.hasTerminalFailure ?? false
  const retryBackoffActive = input.retryBackoffActive ?? false

  // Already checked in or currently processing → don't re-trigger
  if (input.hasPackageCheckInResult || input.processingPackageCheckIn) return false
  // Existing successful attendance/purchase should show the duplicate/status
  // popup, not run another package check-in success flow.
  if (input.hasExistingPurchaseForSession) return false
  // Not a kiosk terminal existing-customer flow → no auto-trigger
  if (!input.isKioskTerminalFlow || input.mode !== "existing") return false
  // No package or check-in window closed → no auto-trigger
  if (!input.hasPackage || !input.effectiveCheckInWindowOpen) return false
  // No active session → no auto-trigger
  if (!input.hasActiveSession) return false
  // Terminal failure reached or a backoff delay is pending → don't re-fire
  // early on unrelated dependency changes.
  if (hasTerminalFailure || retryBackoffActive) return false
  // Retry budget exhausted → the flow must transition to terminal failure
  // instead of firing another automatic attempt. Intentionally redundant
  // defense-in-depth: the `hasTerminalFailure` check above normally
  // short-circuits first, since the caller sets a terminal failure the
  // moment the budget is exhausted. Kept as a backstop in case a caller ever
  // re-evaluates this gate with a stale `hasTerminalFailure` — not load-bearing
  // under the current call sites.
  if (attemptCount >= maxAttempts) return false
  // Always check in with package first. Consecutive promotion can only be
  // offered after a successful class-A check-in, so no-credit users go to the
  // regular purchase flow instead of seeing a stale promotion popup.
  return true
}

export const shouldSurfaceClosedWindowPackageError = (input: {
  isKioskTerminalFlow: boolean
  mode: "idle" | "existing" | "new"
  hasBootstrap: boolean
  hasPackage: boolean
  effectiveCheckInWindowOpen: boolean
  processingPackageCheckIn: boolean
  hasPackageCheckInResult: boolean
  hasExistingRegularBookingOverride: boolean
  /**
   * True once a package check-in failure (terminal or closed-window) has
   * already been recorded. When true, this effect is a no-op so it cannot
   * re-assert the failure while a manual Retry has just cleared it.
   * Defaults to false.
   */
  hasPackageCheckInFailure?: boolean
}) => {
  const hasPackageCheckInFailure = input.hasPackageCheckInFailure ?? false
  if (hasPackageCheckInFailure) return false
  if (!input.isKioskTerminalFlow || input.mode !== "existing") return false
  if (!input.hasBootstrap || !input.hasPackage) return false
  if (input.effectiveCheckInWindowOpen) return false
  if (input.processingPackageCheckIn || input.hasPackageCheckInResult) return false
  return !input.hasExistingRegularBookingOverride
}

/**
 * Determines whether packageOfferContext should be preserved when bootstrap becomes null.
 * In scenario 3 (new-user-upsell), the offer is set AFTER the first purchase completes,
 * when bootstrap may be null. Clearing it would make the offer screen disappear immediately.
 */
export const shouldPreserveOfferOnBootstrapClear = (
  scenario: PackageOfferScenario | null
): boolean => scenario === "new-user-upsell"

/**
 * Resolves the action to take when the user declines a package offer.
 * - new-user-upsell: "No thanks, I'm done" → station completion
 * - existing customer (expired-rebuy, dropin-upsell): → existing purchase flow
 */
export const resolvePackageOfferDeclineAction = (
  scenario: PackageOfferScenario | null
): "station-completion" | "existing-purchase" =>
  scenario === "new-user-upsell" ? "station-completion" : "existing-purchase"

/**
 * Resolves what should happen after a package holder declines the consecutive
 * class offer.
 *
 * - `pre-checkin`: class A has NOT been checked in yet → the caller must
 *   perform the package check-in, then show the standard package success
 *   overlay so the operator can confirm completion (which then triggers
 *   station completion via the overlay's "Done" button or the kiosk
 *   inactivity timer). The caller must NOT call `handleStationCompletion`
 *   directly here — doing so wipes `packageCheckInResult` before the overlay
 *   can render and looks like a silent failure.
 *
 * - `post-checkin`: class A was already checked in BEFORE the offer was
 *   shown → the success overlay was already displayed. The caller dismisses
 *   the consecutive overlay and proceeds to station completion.
 *
 * This is intentionally derived from a single boolean so the caller can read
 * it BEFORE awaiting any check-in API call, avoiding stale-closure bugs that
 * arise when re-reading React state after `await`.
 */
export const resolvePackageConsecutiveDeclineAction = (input: {
  hasPackageCheckInResult: boolean
}): "pre-checkin" | "post-checkin" =>
  input.hasPackageCheckInResult ? "post-checkin" : "pre-checkin"

/**
 * Resolves what should happen when a PACKAGE HOLDER accepts the consecutive
 * class offer.
 *
 * - `pre-checkin-then-payment-selection`: class A has NOT been checked in yet
 *   AND the consecutive class has a positive price. The caller must check
 *   class A in first (via package), then show the Cash/Card payment
 *   selection for class B. The monetary add-on must NOT be created until the
 *   user picks a payment method.
 *
 * - `show-payment-selection`: class A was already checked in AND the
 *   consecutive class has a positive price. The caller must show Cash/Card
 *   selection. The monetary add-on must NOT be created until the user picks
 *   a payment method.
 *
 * - `direct-add`: the consecutive class is free (price 0, null, or
 *   negative). No payment collection is required, so the caller may add the
 *   class directly via `/api/checkin/qr/package` (without
 *   `consecutiveCashPayment`).
 *
 * RATIONALE: Hitting `/api/checkin/qr/package` directly with
 * `consecutiveAddOn: true` and a positive price (and no
 * `consecutiveCashPayment`) causes the backend to mark the monetary
 * purchase as `paid` with `paymentChannel: consecutive_addon` and no Stripe
 * IDs — money never collected. See Jhon Doe purchase
 * `cmpbkyowj001ow3gpqxwdpexa`.
 */
export const resolvePackageConsecutiveAcceptAction = (input: {
  hasPackageCheckInResult: boolean
  priceCents: number | null
}):
  | "pre-checkin-then-payment-selection"
  | "show-payment-selection"
  | "direct-add" => {
  const hasPositivePrice =
    typeof input.priceCents === "number" && input.priceCents > 0

  if (!hasPositivePrice) {
    return "direct-add"
  }

  return input.hasPackageCheckInResult
    ? "show-payment-selection"
    : "pre-checkin-then-payment-selection"
}

/**
 * Resolves what should happen when the user presses "Done" on the
 * KioskPackageSuccessOverlay (the credit-consumed confirmation screen).
 *
 * - `open-payment-selection`: the success overlay is showing because class A
 *   was checked in as part of a consecutive ACCEPT flow with a positive
 *   price. The credit-consumed confirmation has been acknowledged; the
 *   caller must NOW open the Cash/Card payment selection for class B
 *   (instead of resetting the station).
 *
 * - `complete-station`: the success overlay is showing for a normal package
 *   check-in (no pending consecutive add-on). The caller resets the station.
 *
 * RATIONALE: The original ACCEPT flow set `showConsecutivePaymentSelection`
 * immediately after recording `packageCheckInResult`, racing the success
 * overlay so the operator never saw the credit-consumed confirmation. The
 * confirmation must be acknowledged explicitly BEFORE the payment selection
 * appears.
 */
export const resolvePackageSuccessDoneAction = (input: {
  awaitingConsecutivePaymentSelection: boolean
}): "open-payment-selection" | "complete-station" =>
  input.awaitingConsecutivePaymentSelection
    ? "open-payment-selection"
    : "complete-station"

export const resolveConsecutivePaymentSuccessAction = (input: {
  isKioskTerminalFlow: boolean
}): "complete-station" | "show-success" =>
  input.isKioskTerminalFlow ? "complete-station" : "show-success"

/**
 * Resolves what should happen when KioskDuplicatePurchaseOverlay's `onDone`
 * fires (operator dismiss or auto-timeout).
 *
 * - `open-consecutive-overlay`: a consecutive offer exists AND the customer
 *   has a USABLE current-class package (`hasPackage: true`). The
 *   consecutive overlay must NEVER appear for someone without a usable
 *   package for the current class, because the package-holder branches
 *   would mis-route them and could trigger a package check-in that has no
 *   credits to consume.
 *
 * - `complete-station`: no offer or no usable package → existing
 *   registered-customer purchase flow already concluded for class A; just
 *   complete the station.
 */
export const resolveDuplicatePurchaseDoneAction = (input: {
  hasConsecutiveOffer: boolean
  hasPackage: boolean
}): "open-consecutive-overlay" | "complete-station" => {
  if (input.hasConsecutiveOffer && input.hasPackage) {
    return "open-consecutive-overlay"
  }
  return "complete-station"
}

/**
 * Every terminal or retryable failure shape the package check-in request
 * (`POST /api/checkin/qr/package`) can produce.
 *
 * Retryable (kiosk auto-retry only): `timeout`, `network`, `server`,
 * `rate_limited`.
 * Terminal immediately: `closed_window`, `no_package`, `no_credits`,
 * `client_precondition`, `unknown`.
 */
export type PackageCheckInFailureKind =
  | "timeout"
  | "network"
  | "server"
  | "rate_limited"
  | "closed_window"
  | "no_package"
  | "no_credits"
  | "client_precondition"
  | "unknown"

export type PackageCheckInFailure = {
  kind: PackageCheckInFailureKind
  /** User-facing English message; server message verbatim when available. */
  message: string
  /** Only set for `kind === "rate_limited"`, parsed from `Retry-After`, capped at 60000ms. */
  retryAfterMs?: number
}

export type PackageCheckInOutcome = PackageCheckInResult | PackageCheckInFailure

const RETRYABLE_PACKAGE_CHECK_IN_FAILURE_KINDS: ReadonlySet<PackageCheckInFailureKind> = new Set([
  "timeout",
  "network",
  "server",
  "rate_limited",
])

export const isRetryablePackageFailure = (kind: PackageCheckInFailureKind): boolean =>
  RETRYABLE_PACKAGE_CHECK_IN_FAILURE_KINDS.has(kind)

/**
 * Builds the resolving-overlay progress message for an in-progress kiosk
 * auto-retry attempt.
 *
 * `attempt` is 1-indexed and describes the IN-PROGRESS attempt (the same
 * convention as the retry-exhaustion boundary: at classification time,
 * `packageCheckInAttempts` still reflects prior completed attempts, so the
 * in-progress attempt is `packageCheckInAttempts + 1`).
 *
 * Returns `undefined` on the first attempt (no progress copy needed yet).
 */
export const getPackageCheckInResolvingMessage = (input: {
  attempt: number
  maxAttempts: number
}): string | undefined =>
  input.attempt <= 1 ? undefined : `Still checking you in… (attempt ${input.attempt} of ${input.maxAttempts})`

const readPackageCheckInServerErrorMessage = (body: unknown): string | undefined => {
  if (!body || typeof body !== "object") return undefined
  const error = (body as { error?: unknown }).error
  return typeof error === "string" && error.trim() ? error : undefined
}

const isClosedWindowFailureBody = (body: unknown): boolean =>
  Boolean(body) && typeof body === "object" && "opensAt" in (body as object) && "closesAt" in (body as object)

const parseRetryAfterMs = (retryAfterHeader?: string | null): number | undefined => {
  if (!retryAfterHeader) return undefined
  const seconds = Number(retryAfterHeader)
  if (!Number.isFinite(seconds) || seconds < 0) return undefined
  return Math.min(seconds * 1000, RETRY_AFTER_CAP_MS)
}

const classifyPackageCheckInHttpFailure = (
  status: number,
  body: unknown,
  retryAfterHeader?: string | null
): PackageCheckInFailure => {
  if (status === 409) {
    if (isClosedWindowFailureBody(body)) {
      return {
        kind: "closed_window",
        message: readPackageCheckInServerErrorMessage(body) ?? DEFAULT_PACKAGE_CHECK_IN_FAILURE_MESSAGE,
      }
    }
    const serverMessage = readPackageCheckInServerErrorMessage(body)
    if (serverMessage === NO_PACKAGE_MESSAGE) {
      return { kind: "no_package", message: serverMessage }
    }
    if (serverMessage === NO_CREDITS_MESSAGE) {
      return { kind: "no_credits", message: serverMessage }
    }
    return { kind: "unknown", message: serverMessage ?? DEFAULT_PACKAGE_CHECK_IN_FAILURE_MESSAGE }
  }

  if (status === 429) {
    const retryAfterMs = parseRetryAfterMs(retryAfterHeader)
    return {
      kind: "rate_limited",
      message: DEFAULT_PACKAGE_CHECK_IN_FAILURE_MESSAGE,
      ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
    }
  }

  if (status === 401 || status === 403 || status === 404) {
    return { kind: "unknown", message: readPackageCheckInServerErrorMessage(body) ?? DEFAULT_PACKAGE_CHECK_IN_FAILURE_MESSAGE }
  }

  if (status >= 500) {
    // A parseable body is a recognizable transient server-error shape and
    // stays retryable. An unparseable body (e.g. `data === null`) cannot be
    // distinguished from an unmapped failure, so it is treated as terminal.
    if (body && typeof body === "object") {
      return { kind: "server", message: DEFAULT_PACKAGE_CHECK_IN_FAILURE_MESSAGE }
    }
    return { kind: "unknown", message: DEFAULT_PACKAGE_CHECK_IN_FAILURE_MESSAGE }
  }

  return { kind: "unknown", message: readPackageCheckInServerErrorMessage(body) ?? DEFAULT_PACKAGE_CHECK_IN_FAILURE_MESSAGE }
}

/**
 * Describes what happened on a package check-in attempt, without requiring
 * an actual `Response`/`fetch` throw — keeps `classifyPackageCheckInFailure`
 * a pure, network-free, directly-testable function.
 */
export type PackageCheckInFailureSource =
  | { kind: "timeout" }
  | { kind: "network" }
  | { kind: "http"; status: number; body: unknown; retryAfterHeader?: string | null }

/**
 * Classifies a failed package check-in attempt into one of the 9
 * `PackageCheckInFailureKind`s. Never throws — every branch resolves to a
 * value.
 *
 * `closed_window` is discriminated STRUCTURALLY (`opensAt`/`closesAt`
 * presence in the response body), never by matching message text.
 * `no_package`/`no_credits` are both bare `{ error: string }` 409s and are
 * matched by exact server copy; an unrecognized 409 body degrades to
 * `unknown` rather than throwing.
 */
export const classifyPackageCheckInFailure = (source: PackageCheckInFailureSource): PackageCheckInFailure => {
  if (source.kind === "timeout") {
    return { kind: "timeout", message: DEFAULT_PACKAGE_CHECK_IN_FAILURE_MESSAGE }
  }
  if (source.kind === "network") {
    return { kind: "network", message: DEFAULT_PACKAGE_CHECK_IN_FAILURE_MESSAGE }
  }
  return classifyPackageCheckInHttpFailure(source.status, source.body, source.retryAfterHeader)
}
