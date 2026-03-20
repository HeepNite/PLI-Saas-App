import { formatUSPhone, getUsPhoneDigits } from "@/components/front/courses/utils/phone"

export const KIOSK_NUMERIC_KEYPAD_DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"] as const

export const appendPhoneDigit = (currentValue: string, digit: string) => {
  const nextDigits = `${getUsPhoneDigits(currentValue)}${digit}`.replace(/\D/g, "").slice(0, 10)
  return formatUSPhone(nextDigits)
}

export const removePhoneDigit = (currentValue: string) => {
  const nextDigits = getUsPhoneDigits(currentValue).slice(0, -1)
  return formatUSPhone(nextDigits)
}

export const clearPhoneDigits = () => formatUSPhone("")

export const appendCodeDigit = (currentValue: string, digit: string, maxLength = 6) => {
  const normalized = currentValue.replace(/\D/g, "").slice(0, maxLength)
  if (normalized.length >= maxLength) return normalized
  return `${normalized}${digit}`.slice(0, maxLength)
}

export const removeCodeDigit = (currentValue: string) => currentValue.replace(/\D/g, "").slice(0, -1)

export const clearCodeDigits = () => ""
