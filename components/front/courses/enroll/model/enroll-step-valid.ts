import type { EnrollmentOption } from "@/constants/courses"
import type { EnrollmentContact, PaymentMethod } from "@/components/front/courses/types"
import { isCompleteUSPhone } from "@/components/front/courses/utils/phone"
import type { EnrollStepKey } from "@/lib/checkin/enroll-flow"

export type StepValidContext = {
  steps: Array<{ key: EnrollStepKey }>
  participants: number
  availableServices: EnrollmentOption[]
  service: string
  date: string
  time: string
  consecutiveOfferLoading: boolean
  contact: EnrollmentContact
  studentPin: string
  studentPinConfirm: string
  requiresPhotoStep: boolean
  photoSaved: boolean
  consecutiveChoiceMade: boolean
  paymentMethod: PaymentMethod
}

export const resolveStepValid = (stepIndex: number, ctx: StepValidContext): boolean => {
  const stepKey = ctx.steps[stepIndex]?.key

  switch (stepKey) {
    case "party":
      return ctx.participants >= 1 && ctx.availableServices.some((opt) => opt.id === ctx.service)
    case "datetime":
      return Boolean(ctx.date) && Boolean(ctx.time) && !ctx.consecutiveOfferLoading
    case "info": {
      const baseValid =
        ctx.contact.firstName.trim().length > 1 &&
        ctx.contact.email.trim().length > 5 &&
        isCompleteUSPhone(ctx.contact.phone)
      if (!baseValid) return false
      if (ctx.service === "new-student") {
        return /^\d{4}$/.test(ctx.studentPin) && ctx.studentPin === ctx.studentPinConfirm
      }
      return true
    }
    case "photo":
      return !ctx.requiresPhotoStep || ctx.photoSaved
    case "packages":
      return true
    case "consecutive":
      return ctx.consecutiveChoiceMade
    case "payments":
      return ctx.paymentMethod !== "" && !ctx.consecutiveOfferLoading
    case "review":
      return true
    default:
      return false
  }
}
