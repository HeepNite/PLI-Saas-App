import {
  CURRENT_CLERK_SESSION_SUPPRESSION,
  type KioskSuppressedClerkSessionId,
} from "@/components/front/checkin/checkin-kiosk.types"

type ResolveActiveKioskSessionInput = {
  activeSessionId?: string | null
  hasPrivilegedClerkSession?: boolean
  isKioskTerminalFlow: boolean
  isSignedIn?: boolean
  suppressedClerkSessionId: KioskSuppressedClerkSessionId
}

type ResolveSuppressedClerkSessionInput = {
  activeSessionId?: string | null
  isSignedIn?: boolean
  kioskClerkSessionId?: string | null
}

type ShouldClearSuppressedClerkSessionInput = {
  activeSessionId?: string | null
  isSignedIn?: boolean
  suppressedClerkSessionId: KioskSuppressedClerkSessionId
}

export const hasActiveKioskClerkSession = (input: ResolveActiveKioskSessionInput) => {
  if (!input.isSignedIn) return false
  if (input.isKioskTerminalFlow && input.hasPrivilegedClerkSession) return false
  if (!input.suppressedClerkSessionId) return true
  if (input.suppressedClerkSessionId === CURRENT_CLERK_SESSION_SUPPRESSION) return false
  return input.activeSessionId !== input.suppressedClerkSessionId
}

export const resolveSuppressedClerkSessionIdOnCompletion = (
  input: ResolveSuppressedClerkSessionInput
): KioskSuppressedClerkSessionId => {
  if (input.kioskClerkSessionId) return input.kioskClerkSessionId
  if (input.isSignedIn) return input.activeSessionId || CURRENT_CLERK_SESSION_SUPPRESSION
  return null
}

export const shouldClearSuppressedClerkSessionId = (input: ShouldClearSuppressedClerkSessionInput) => {
  if (!input.suppressedClerkSessionId) return false
  if (!input.isSignedIn) return true
  if (input.suppressedClerkSessionId === CURRENT_CLERK_SESSION_SUPPRESSION) return false
  if (!input.activeSessionId) return false
  return input.activeSessionId !== input.suppressedClerkSessionId
}
