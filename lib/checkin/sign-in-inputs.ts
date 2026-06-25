import type { KioskNumericField } from "@/lib/checkin/numeric-keypad"

export const PHONE_INPUT_ATTRIBUTES = {
  type: "tel" as const,
  inputMode: "tel" as const,
  autoComplete: "tel-national" as const,
  enterKeyHint: "next" as const,
  pattern: undefined,
}

export const CODE_INPUT_ATTRIBUTES = {
  type: "text" as const,
  inputMode: "numeric" as const,
  autoComplete: "one-time-code" as const,
  enterKeyHint: "done" as const,
}

export const INITIAL_KIOSK_NUMERIC_FIELD: KioskNumericField = null

export const selectKioskNumericField = (
  field: Exclude<KioskNumericField, null>
): KioskNumericField => field
