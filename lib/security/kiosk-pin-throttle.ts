export const STUDENT_PIN_TERMINAL_MISS_WINDOW_MS = 10 * 60 * 1000
export const STUDENT_PIN_TERMINAL_WARNING_THRESHOLD = 3
export const STUDENT_PIN_TERMINAL_COOLDOWN_THRESHOLD = 5
export const STUDENT_PIN_TERMINAL_EMERGENCY_BLOCK_THRESHOLD = 10
export const STUDENT_PIN_TERMINAL_COOLDOWN_MS = 60 * 1000
export const STUDENT_PIN_TERMINAL_BLOCK_MS = 5 * 60 * 1000

export type KioskPinThrottleSeverity = "normal" | "warning" | "cooldown" | "emergency"

export type TerminalPinAlert = {
  severity: Exclude<KioskPinThrottleSeverity, "normal">
  label: string
  message: string
  blockedUntil: string | null
  missCount: number
}

export const resolveTerminalMissWindowActive = (windowStart: Date, now = new Date()) =>
  windowStart > new Date(now.getTime() - STUDENT_PIN_TERMINAL_MISS_WINDOW_MS)

export const resolveKioskPinThrottleSeverity = (input: {
  missCount: number
  blockedUntil?: Date | null
  now?: Date
}): KioskPinThrottleSeverity => {
  const missCount = Math.max(0, input.missCount)
  const now = input.now || new Date()
  const blockedUntilActive = Boolean(input.blockedUntil && input.blockedUntil > now)

  if (blockedUntilActive && missCount >= STUDENT_PIN_TERMINAL_EMERGENCY_BLOCK_THRESHOLD) return "emergency"
  if (blockedUntilActive && missCount >= STUDENT_PIN_TERMINAL_COOLDOWN_THRESHOLD) return "cooldown"
  if (missCount >= STUDENT_PIN_TERMINAL_WARNING_THRESHOLD) return "warning"
  return "normal"
}

export const getTerminalAttemptsRemaining = (missCount: number) => {
  const normalized = Math.max(0, missCount)
  if (normalized >= STUDENT_PIN_TERMINAL_EMERGENCY_BLOCK_THRESHOLD) return 0
  return Math.max(0, STUDENT_PIN_TERMINAL_COOLDOWN_THRESHOLD - normalized)
}

export const getKioskPinThrottleMessage = (severity: KioskPinThrottleSeverity) => {
  switch (severity) {
    case "warning":
      return "We still couldn't verify this PIN. Please double-check it or ask the front desk for help."
    case "cooldown":
      return "Too many failed attempts on this terminal. Please wait a minute or ask the front desk for help."
    case "emergency":
      return "This terminal is temporarily protected due to repeated PIN failures. Please contact the front desk."
    default:
      return "We couldn't verify that PIN. Please try again."
  }
}

export const getKioskPinRemoteAlertLabel = (severity: KioskPinThrottleSeverity) => {
  switch (severity) {
    case "warning":
      return "Repeated PIN failures"
    case "cooldown":
      return "PIN cooldown active"
    case "emergency":
      return "Emergency PIN protection"
    default:
      return null
  }
}

export const buildTerminalPinAlert = (input: {
  missCount: number
  blockedUntil?: Date | null
  windowStart?: Date | null
  now?: Date
}): TerminalPinAlert | null => {
  const now = input.now || new Date()
  if (input.windowStart && !resolveTerminalMissWindowActive(input.windowStart, now)) return null

  const severity = resolveKioskPinThrottleSeverity({
    missCount: input.missCount,
    blockedUntil: input.blockedUntil,
    now,
  })

  if (severity === "normal") return null

  return {
    severity,
    label: getKioskPinRemoteAlertLabel(severity) || "PIN activity",
    message: getKioskPinThrottleMessage(severity),
    blockedUntil: input.blockedUntil ? input.blockedUntil.toISOString() : null,
    missCount: input.missCount,
  }
}
