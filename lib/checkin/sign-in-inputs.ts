export const PHONE_INPUT_ATTRIBUTES = {
  type: "tel" as const,
  inputMode: "numeric" as const,
  autoComplete: "tel-national" as const,
  pattern: "[0-9]*",
}

export const CODE_INPUT_ATTRIBUTES = {
  type: "tel" as const,
  inputMode: "numeric" as const,
  autoComplete: "one-time-code" as const,
  pattern: "[0-9]*",
}
