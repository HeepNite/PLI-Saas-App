import type { EnrollmentOption } from "@/constants/courses"

type ResolveAvailableEnrollServicesInput = {
  services: EnrollmentOption[]
  isCheckInExistingFlow: boolean
  isCheckInNewFlow: boolean
  skipContactStep: boolean
}

export const resolveAvailableEnrollServices = ({
  services,
  isCheckInExistingFlow,
  isCheckInNewFlow,
  skipContactStep,
}: ResolveAvailableEnrollServicesInput) => {
  // The new-student service only applies to a new-student flow. Drop it for an
  // existing-customer check-in, or for any signed-in flow that skips the contact
  // step — UNLESS it's a new-student flow (a never-purchased customer is signed in
  // mid-flow by SMS, is priced as a new student, yet still skips contact). Keeping
  // it here avoids selecting "new-student" while it's absent from the list, which
  // fails validation with "Select a valid service."
  if (isCheckInExistingFlow || (skipContactStep && !isCheckInNewFlow)) {
    return services.filter((item) => item.id !== "new-student")
  }
  return services
}
