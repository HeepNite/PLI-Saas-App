type BillingAddressInput = {
  line1?: unknown
  line2?: unknown
  city?: unknown
  state?: unknown
  postalCode?: unknown
  country?: unknown
}

export type ProfileUpdatePayload = {
  firstName?: string
  lastName?: string
  birthDate?: string
  emergencyContactName?: string
  emergencyContactRelation?: string
  emergencyContactPhone?: string
  billingAddress?: {
    line1: string
    line2?: string | null
    city: string
    state: string
    postalCode: string
    country: string
  } | null
}

type ValidationError = { status: number; error: string }

const PHONE_REGEX = /^[+\d][\d\s().-]{5,24}$/
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

const sanitizeString = (value: unknown, max = 120) => {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (trimmed.length > max) return undefined
  if (trimmed.includes("<") || trimmed.includes(">")) return undefined
  return trimmed
}

const sanitizePhone = (value: unknown) => {
  const raw = sanitizeString(value, 25)
  if (!raw) return undefined
  if (!PHONE_REGEX.test(raw)) return undefined
  return raw
}

const sanitizeBirthDate = (value: unknown) => {
  if (value === undefined || value === null || value === "") return undefined
  if (typeof value !== "string") return null
  const date = value.trim()
  if (!DATE_REGEX.test(date)) return null
  const parsed = new Date(`${date}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return null
  const now = new Date()
  const minDate = new Date("1900-01-01T00:00:00.000Z")
  if (parsed > now || parsed < minDate) return null
  return date
}

const validateBillingAddress = (input: unknown) => {
  if (input === undefined) return { ok: true as const, value: undefined }
  if (input === null) return { ok: true as const, value: null }
  if (!input || typeof input !== "object") return { ok: false as const, error: "Invalid billingAddress payload" }

  const data = input as BillingAddressInput
  const line1 = sanitizeString(data.line1, 160)
  const line2 = sanitizeString(data.line2, 160)
  const city = sanitizeString(data.city, 120)
  const state = sanitizeString(data.state, 120)
  const postalCode = sanitizeString(data.postalCode, 40)
  const country = sanitizeString(data.country, 80)

  if (!line1 || !city || !state || !postalCode || !country) {
    return { ok: false as const, error: "Incomplete billingAddress fields" }
  }

  return {
    ok: true as const,
    value: {
      line1,
      line2: line2 || null,
      city,
      state,
      postalCode,
      country,
    },
  }
}

export const validateProfileUpdatePayload = (input: unknown): ProfileUpdatePayload | ValidationError => {
  if (!input || typeof input !== "object") {
    return { status: 400, error: "Invalid payload" }
  }

  const body = input as Record<string, unknown>
  const firstName = sanitizeString(body.firstName, 80)
  const lastName = sanitizeString(body.lastName, 80)
  const birthDate = sanitizeBirthDate(body.birthDate)

  if (body.birthDate !== undefined && birthDate === null) {
    return { status: 400, error: "Invalid birthDate value" }
  }

  const emergencyContactName = sanitizeString(body.emergencyContactName, 120)
  const emergencyContactRelation = sanitizeString(body.emergencyContactRelation, 80)
  const emergencyContactPhone = sanitizePhone(body.emergencyContactPhone)

  if (body.emergencyContactPhone !== undefined && !emergencyContactPhone) {
    return { status: 400, error: "Invalid emergencyContactPhone value" }
  }

  const billingAddressResult = validateBillingAddress(body.billingAddress)
  if (!billingAddressResult.ok) {
    return { status: 400, error: billingAddressResult.error }
  }

  return {
    firstName,
    lastName,
    birthDate: birthDate ?? undefined,
    emergencyContactName,
    emergencyContactRelation,
    emergencyContactPhone,
    billingAddress: billingAddressResult.value,
  }
}
