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
  // Only suppress the customer's kiosk session, never the staff session
  // If there's no kiosk customer session, there's nothing to suppress
  if (input.kioskClerkSessionId) return input.kioskClerkSessionId
  // The customer completed the flow through an existing Clerk session that
  // the kiosk never explicitly registered (no kioskClerkSessionId). Fall back
  // to suppressing whatever session is currently active so the shared
  // terminal doesn't stay signed in as this customer.
  if (input.isSignedIn) return CURRENT_CLERK_SESSION_SUPPRESSION
  return null
}

export const shouldClearSuppressedClerkSessionId = (input: ShouldClearSuppressedClerkSessionInput) => {
  if (!input.suppressedClerkSessionId) return false
  if (!input.isSignedIn) return true
  if (input.suppressedClerkSessionId === CURRENT_CLERK_SESSION_SUPPRESSION) return false
  if (!input.activeSessionId) return false
  return input.activeSessionId !== input.suppressedClerkSessionId
}
