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
