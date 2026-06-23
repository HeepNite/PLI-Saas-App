// ── Object coercion ──────────────────────────────────────────────

/** Coerce unknown JSON value to a plain object. Returns {} for non-objects. */
export const asObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value))
    return value as Record<string, unknown>
  return {}
}

/** Coerce unknown value to a plain object. Returns null for non-objects. */
export const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null

/** Coerce unknown value to a trimmed string. Returns "" for non-strings. */
export const asText = (value: unknown): string =>
  typeof value === "string" ? value.trim() : ""

// ── Phone normalization ──────────────────────────────────────────

/** Strip non-digits; return undefined when fewer than 6 digits. */
export const normalizePhone = (val?: string | null): string | undefined => {
  const digits = val?.replace(/\D/g, "")
  return digits && digits.length >= 6 ? digits : undefined
}

/** Strip non-digits; return empty string when fewer than 6 digits. */
export const normalizePhoneDigits = (value: string): string => {
  const digits = value.replace(/\D/g, "")
  return digits.length >= 6 ? digits : ""
}

// ── Validation patterns ──────────────────────────────────────────

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Basic email format check. */
export const isEmail = (val: string | undefined): val is string =>
  Boolean(val && EMAIL_REGEX.test(val))

/** Course slug format: lowercase alphanumeric segments joined by hyphens. */
export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
