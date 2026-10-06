import "server-only"
import type { CheckoutValidation, ApiError } from "@/lib/checkout/validation"
import { getAvailableTimesForCourseDateFromCourse } from "@/lib/class-schedule"

const invalidPublicBookingRequest = (): ApiError => ({
  status: 400,
  error: "Invalid public booking request",
  code: "PUBLIC_BOOKING_POLICY_INVALID",
})

const isRealIsoDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split("-").map(Number)
  if (month < 1 || month > 12 || day < 1) return false
  const daysInMonth = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day <= daysInMonth[month - 1]
}

const isTime24 = (value: unknown): value is string =>
  typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)

/** Enforces the stricter occurrence and currency boundary for trusted public booking only. */
export const enforcePublicBookingPolicy = (
  validation: CheckoutValidation,
): ApiError | { currency: "usd" } => {
  if (
    typeof validation.currency !== "string" ||
    validation.currency.toLowerCase() !== "usd" ||
    !isRealIsoDate(validation.date) ||
    !isTime24(validation.time) ||
    !getAvailableTimesForCourseDateFromCourse(validation.course, validation.date).includes(validation.time)
  ) {
    return invalidPublicBookingRequest()
  }

  return { currency: "usd" }
}
