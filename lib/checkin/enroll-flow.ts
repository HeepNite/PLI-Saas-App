type ResolveEnrollInitialStepInput = {
  initialStep?: number
  stepsLength: number
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

export const shouldIncludePhotoStep = (input: ShouldIncludePhotoStepInput) =>
  input.isCheckInFlow && input.photoPolicyRequired && !(input.hasAvatar || input.photoSaved)

export const getCheckInSignInModalVariant = (isCheckInFlow: boolean) =>
  isCheckInFlow ? "compact" : "sheet"
