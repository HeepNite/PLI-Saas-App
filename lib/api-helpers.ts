/**
 * Shared API helper utilities.
 */

const MAX_TEXT_FIELD_LENGTH = 120

/**
 * Trims and clamps a string value to the given max length.
 * Returns an empty string for non-string inputs.
 */
export const safeText = (value: unknown, max = MAX_TEXT_FIELD_LENGTH): string =>
  typeof value === "string" ? value.trim().slice(0, max) : ""

/**
 * Trims and clamps a string value to the given max length.
 * Returns undefined for non-string inputs or empty strings.
 */
export const safeOptionalText = (value: unknown, max = MAX_TEXT_FIELD_LENGTH): string | undefined => {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim().slice(0, max)
  return trimmed || undefined
}
