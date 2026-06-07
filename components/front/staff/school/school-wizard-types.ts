export type SchoolWizardEntity = "courses" | "rooms" | "packages" | "points"

export interface StepEnabledContext {
  courseEditingSlug: string | null
}

export interface SchoolWizardStepConfig {
  key: string
  label: string
  enabled?: (ctx: StepEnabledContext) => boolean
}

export interface SchoolWizardState {
  activeEntity: SchoolWizardEntity
  step: number
  setStep: (n: number) => void
  goToEntity: (entity: SchoolWizardEntity) => void
  nextStep: (ctx?: StepEnabledContext) => void
  prevStep: (ctx?: StepEnabledContext) => void
  totalSteps: number
}
