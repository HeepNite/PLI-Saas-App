export const getUsPhoneDigits = (value: string) => {
  let digits = value.replace(/\D/g, "")
  if (digits.startsWith("1")) {
    digits = digits.slice(1)
  }
  return digits.slice(0, 10)
}

export const toE164Phone = (value: string) => {
  const digits = getUsPhoneDigits(value)
  if (digits.length !== 10) return undefined
  return `+1${digits}`
}

export const formatUSPhone = (value: string) => {
  const normalized = getUsPhoneDigits(value)

  if (!normalized.length) {
    return "+1 "
  }

  const area = normalized.slice(0, 3)
  const mid = normalized.slice(3, 6)
  const last = normalized.slice(6, 10)

  let formatted = ""
  if (area.length) {
    formatted = `(${area}`
    if (area.length === 3) {
      formatted += ")"
    }
  }
  if (mid.length) {
    formatted += `${area.length === 3 ? " " : ""}${mid}`
  }
  if (last.length) {
    formatted += `${mid.length === 3 ? "-" : ""}${last}`
  }

  return `+1 ${formatted}`
}

export const hasPhoneDigits = (value: string) => getUsPhoneDigits(value).length > 0

export const isCompleteUSPhone = (value: string) => getUsPhoneDigits(value).length === 10

/**
 * Format phone number for onChange events, handling backspace gracefully.
 *
 * On mobile browsers, backspacing on a format character (e.g. "(" or "-")
 * removes the character from the input but leaves the digits intact.
 * Since formatUSPhone strips non-digits and reformats, the format chars
 * reappear — creating an infinite loop where backspace does nothing.
 *
 * This function compares digit counts: if fewer digits than before, it
 * strips the last digit and reformats, allowing the user to delete normally.
 */
export const formatUSPhoneOnChange = (newValue: string, oldValue: string) => {
  const newDigits = getUsPhoneDigits(newValue)
  const oldDigits = getUsPhoneDigits(oldValue)

  if (newDigits.length < oldDigits.length) {
    return formatUSPhone(oldDigits.slice(0, -1))
  }

  return formatUSPhone(newValue)
}
