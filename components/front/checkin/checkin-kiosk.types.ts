export const CURRENT_CLERK_SESSION_SUPPRESSION = "__current_clerk_session__" as const

export type KioskSuppressedClerkSessionId = string | null

export type KioskPinRotationMode = "provisional" | "regeneration"

export type KioskPinField = "entry" | "next" | "confirm"

export type KioskPinIdentifySuccess = {
  identified: true
  credentialKind: "permanent" | "provisional"
  requiresPinRotation: boolean
  requiresPinRegeneration?: boolean
  regenerationReason?: "obsolete"
  sessionToken: string
  sessionExpiresAt: string
}

export type KioskPinIdentifyFailure = {
  identified: false
  terminalBlocked?: boolean
  blockedUntil?: string | null
  attemptsRemaining?: number
  requiresPinRegeneration?: boolean
  reason?: string
  message?: string
}

export type KioskPinIdentifyError = {
  error?: string
  message?: string
  blockedUntil?: string | null
  attemptsRemaining?: number
  requiresPinRegeneration?: boolean
}
