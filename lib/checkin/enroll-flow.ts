type ResolveEnrollInitialStepInput = {
  initialStep?: number
  stepsLength: number
}

export type EnrollStepKey = "party" | "datetime" | "info" | "photo" | "packages" | "consecutive" | "payments" | "review"

type ResolveEnrollStepKeysInput = {
  isCheckInFlow: boolean
  isCheckInNewFlow: boolean
  isKioskTerminalFlow: boolean
  requiresPhotoStep: boolean
  /** Whether the course has packages available (shows packages step in kiosk) */
  hasPackages?: boolean
  /** Whether a consecutive class offer is available (shows consecutive step in kiosk) */
  hasConsecutiveOffer?: boolean
}

type ShouldIncludePhotoStepInput = {
  isCheckInFlow: boolean
  photoPolicyRequired: boolean
  hasAvatar: boolean
  photoSaved: boolean
}

export const resolveEnrollInitialStep = (input: ResolveEnrollInitialStepInput) => {
  const maxStep = Math.max(0, input.stepsLength - 1)
  if (typeof input.initialStep !== "number" || !Number.isFinite(input.initialStep)) {
    return 0
  }
  return Math.max(0, Math.min(maxStep, Math.floor(input.initialStep)))
}

/**
 * Resolves the step keys for the enrollment flow based on context.
 *
 * For kiosk terminal flows, packages are shown in a dedicated step AFTER
 * user info collection (so we know if they're new/existing for pricing).
 * Kiosk flow: info → [photo] → [packages] → payments
 */
export const resolveEnrollStepKeys = (input: ResolveEnrollStepKeysInput): EnrollStepKey[] => {
  if (input.isCheckInFlow && input.isKioskTerminalFlow) {
    return [
      "info",
      ...(input.requiresPhotoStep ? (["photo"] as const) : []),
      ...(input.hasPackages ? (["packages"] as const) : []),
      ...(input.hasConsecutiveOffer ? (["consecutive"] as const) : []),
      "payments",
    ]
  }

  return [
    "party",
    "datetime",
    "info",
    ...(input.requiresPhotoStep ? (["photo"] as const) : []),
    "payments",
    ...(input.isCheckInFlow ? [] : (["review"] as const)),
  ]
}

export const isCheckInContactGateStep = (input: {
  isCheckInFlow: boolean
  activeStepKey: EnrollStepKey | ""
}) => input.isCheckInFlow && input.activeStepKey === "info"

export const shouldIncludePhotoStep = (input: ShouldIncludePhotoStepInput) =>
  input.isCheckInFlow && input.photoPolicyRequired && !(input.hasAvatar || input.photoSaved)

export const getCheckInSignInModalVariant = (isCheckInFlow: boolean) =>
  isCheckInFlow ? "compact" : "sheet"

export const resolvePostPhotoStepIndex = (input: {
  packagesStepIndex: number
  paymentsStepIndex: number
  currentStep: number
  stepsLength: number
}) => {
  if (input.packagesStepIndex >= 0) return input.packagesStepIndex
  if (input.paymentsStepIndex >= 0) return input.paymentsStepIndex

  const maxStep = Math.max(0, input.stepsLength - 1)
  return Math.max(0, Math.min(maxStep, input.currentStep + 1))
}

export const shouldNotifyPaymentsStepReady = (input: {
  open: boolean
  hasFired: boolean
  activeStepKey: string
  showKioskPaymentTransition: boolean
}) => {
  if (!input.open || input.hasFired) return false
  if (input.activeStepKey === "info") return true
  if (input.activeStepKey !== "payments" && input.activeStepKey !== "packages") return false
  return !input.showKioskPaymentTransition
}

export const notifyPaymentsStepReadyForOpenSession = (input: {
  open: boolean
  hasFired: boolean
  activeStepKey: string
  showKioskPaymentTransition: boolean
  markFired: () => void
  onPaymentsStepReadyAction?: () => void
}) => {
  if (!input.open) return false
  if (!shouldNotifyPaymentsStepReady(input)) return false

  input.markFired()
  input.onPaymentsStepReadyAction?.()
  return true
}

export const resolveStationTimeoutAction = (
  onTimeoutAction?: () => void,
  onCompletedAction?: () => void | Promise<void>
) => onTimeoutAction ?? onCompletedAction
