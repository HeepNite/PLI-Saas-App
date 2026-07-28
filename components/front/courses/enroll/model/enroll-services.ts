import type { EnrollmentOption } from "@/constants/courses"

type ResolveAvailableEnrollServicesInput = {
  services: EnrollmentOption[]
  isCheckInExistingFlow: boolean
  skipContactStep: boolean
}

export const resolveAvailableEnrollServices = ({
  services,
  isCheckInExistingFlow,
  skipContactStep,
}: ResolveAvailableEnrollServicesInput) => {
  if (isCheckInExistingFlow || skipContactStep) {
    return services.filter((item) => item.id !== "new-student")
  }
  return services
}
