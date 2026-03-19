type ResolveCheckInServiceSelectionInput = {
  previousService: string
  availableServiceIds: string[]
  isCheckInNewFlow: boolean
  hasNewStudentService: boolean
  regularFallbackLocked: boolean
}

export const normalizePhoneKey = (value: string) => value.replace(/\D/g, "")

export const isRegularFallbackLocked = (fallbackPhoneKey: string | null, currentPhone: string) => {
  if (!fallbackPhoneKey) return false
  return normalizePhoneKey(currentPhone) === fallbackPhoneKey
}

export const resolveCheckInServiceSelection = (input: ResolveCheckInServiceSelectionInput) => {
  if (input.isCheckInNewFlow && input.hasNewStudentService && !input.regularFallbackLocked) {
    return "new-student"
  }
  return input.availableServiceIds.includes(input.previousService)
    ? input.previousService
    : input.availableServiceIds[0] ?? ""
}
