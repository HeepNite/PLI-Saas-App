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
  studentPin: string
  studentPinConfirm: string
  paymentMethod: PaymentMethod
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
  studentPin,
  studentPinConfirm,
  paymentMethod,
  paymentsStepIndex,
  total,
}: EnrollValidationInput): EnrollValidationIssue | null => {
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
      return { step: 2, message: "Complete your first and last name." }
    }
    if (!emailIsValid(contact.email)) {
      return { step: 2, message: "Enter a valid email." }
    }
    if (!isCompleteUSPhone(contact.phone)) {
      return { step: 2, message: "Enter a valid US phone number." }
    }
  }
  if (serviceId === "new-student") {
    if (!/^\d{4}$/.test(studentPin)) {
      return { step: 2, message: "Create a 4-digit PIN to continue." }
    }
    if (studentPin !== studentPinConfirm) {
      return { step: 2, message: "PIN confirmation does not match." }
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
