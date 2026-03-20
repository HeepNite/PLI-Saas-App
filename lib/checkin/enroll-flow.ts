type ResolveEnrollInitialStepInput = {
  initialStep?: number
  stepsLength: number
}

export type EnrollStepKey = "party" | "datetime" | "info" | "photo" | "payments" | "review"

type ResolveEnrollStepKeysInput = {
  isCheckInFlow: boolean
  isCheckInNewFlow: boolean
  isKioskTerminalFlow: boolean
  requiresPhotoStep: boolean
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

export const resolveEnrollStepKeys = (input: ResolveEnrollStepKeysInput): EnrollStepKey[] => {
  if (input.isCheckInFlow && input.isKioskTerminalFlow) {
    return [
      "info",
      ...(input.requiresPhotoStep ? (["photo"] as const) : []),
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
