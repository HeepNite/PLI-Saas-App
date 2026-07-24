import type { EnrollmentOption } from "@/constants/courses"
import type { EnrollmentContact, PaymentMethod } from "@/components/front/courses/types"
import { isCompleteUSPhone } from "@/components/front/courses/utils/phone"

export type EnrollValidationIssue = {
  step: number
  message: string
}

type EnrollValidationInput = {
  services: EnrollmentOption[]
  packages: EnrollmentOption[]
  addons?: EnrollmentOption[]
  serviceId: string
  packageId: string
  addonIds: string[]
  participants: number
  date: string
  time: string
  contact: EnrollmentContact
  skipContactValidation?: boolean
  paymentMethod: PaymentMethod
  contactStepIndex?: number
  paymentsStepIndex: number
  total: number
}

const emailIsValid = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

export const validateEnrollBeforeSubmit = ({
  services,
  packages,
  addons = [],
  serviceId,
  packageId,
  addonIds,
  participants,
  date,
  time,
  contact,
  skipContactValidation = false,
  paymentMethod,
  contactStepIndex = 2,
  paymentsStepIndex,
  total,
}: EnrollValidationInput): EnrollValidationIssue | null => {
  const contactStep = contactStepIndex >= 0 ? contactStepIndex : 0

  if (!serviceId || !services.some((service) => service.id === serviceId)) {
    return { step: 0, message: "Select a valid service." }
  }
  if (packageId && !packages.some((pkg) => pkg.id === packageId)) {
    return { step: 0, message: "The selected package is invalid." }
  }
  if (participants < 1 || participants > 10) {
    return { step: 0, message: "The number of participants is invalid." }
  }
  if (!date || !time) {
    return { step: 1, message: "Select date and time." }
  }
  if (!skipContactValidation) {
    if (!contact.firstName.trim() || !contact.lastName.trim()) {
      return { step: contactStep, message: "Complete your first and last name." }
    }
    if (!emailIsValid(contact.email)) {
      return { step: contactStep, message: "Enter a valid email." }
    }
    if (!isCompleteUSPhone(contact.phone)) {
      return { step: contactStep, message: "Enter a valid US phone number." }
    }
  }
  if (paymentMethod !== "stripe" && paymentMethod !== "onsite") {
    return { step: paymentsStepIndex >= 0 ? paymentsStepIndex : 3, message: "Select a payment method." }
  }
  if (!addonIds.every((id) => addons.some((addon) => addon.id === id))) {
    return { step: 0, message: "Invalid extras." }
  }
  if (!Number.isFinite(total) || total <= 0) {
    return { step: 0, message: "Calculated amount is invalid." }
  }
  return null
}
