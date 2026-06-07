import type { CheckoutValidation } from "@/lib/checkout/validation"

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const TIME_24_REGEX = /^\d{2}:\d{2}$/

const isValidIsoDate = (value: string | null) => Boolean(value && ISO_DATE_REGEX.test(value))
const isValidTime24 = (value: string | null) => Boolean(value && TIME_24_REGEX.test(value))

export const resolveKioskEffectiveSessionDateTime = ({
  photoContext,
  validation,
}: {
  photoContext: string
  validation: CheckoutValidation
}) => {
  if (photoContext !== "kiosk_terminal") {
    return {
      date: validation.date,
      time: validation.time,
    }
  }

  const kioskDate = validation.kioskCurrentCourseDate
  const kioskTime = validation.kioskCurrentCourseTime

  return {
    date: isValidIsoDate(kioskDate) ? kioskDate : validation.date,
    time: isValidTime24(kioskTime) ? kioskTime : validation.time,
  }
}
