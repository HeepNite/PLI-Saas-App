"use client"

import React from "react"
import type { KioskSuppressedClerkSessionId } from "@/components/front/checkin/checkin-kiosk.types"
import {
  hasActiveKioskClerkSession,
  resolveSuppressedClerkSessionIdOnCompletion,
  shouldClearSuppressedClerkSessionId,
} from "@/lib/checkin/kiosk-session-policy"
import { hasStaffRoleInUserMetadata } from "@/lib/security/staff-role"

type KioskSessionUser = {
  publicMetadata?: unknown
  privateMetadata?: unknown
  unsafeMetadata?: unknown
} | null | undefined

type UseKioskCustomerSessionParams = {
  activeSessionId?: string | null
  isKioskTerminalFlow: boolean
  isSignedIn?: boolean
  user?: KioskSessionUser
}

export const useKioskCustomerSession = ({
  activeSessionId,
  isKioskTerminalFlow,
  isSignedIn,
  user,
}: UseKioskCustomerSessionParams) => {
  const [kioskClerkSessionId, setKioskClerkSessionId] = React.useState<string | null>(null)
  const [suppressedClerkSessionId, setSuppressedClerkSessionId] = React.useState<KioskSuppressedClerkSessionId>(null)

  const hasPrivilegedClerkSession = React.useMemo(() => Boolean(user && hasStaffRoleInUserMetadata(user)), [user])

  const hasActiveClerkSession = React.useMemo(
    () =>
      hasActiveKioskClerkSession({
        activeSessionId,
        hasPrivilegedClerkSession,
        isKioskTerminalFlow,
        isSignedIn,
        kioskClerkSessionId,
        suppressedClerkSessionId,
      }),
    [activeSessionId, hasPrivilegedClerkSession, isKioskTerminalFlow, isSignedIn, kioskClerkSessionId, suppressedClerkSessionId]
  )

  const registerKioskClerkSession = React.useCallback((sessionId: string | null) => {
    setKioskClerkSessionId(sessionId)
  }, [])

  const clearSuppressedClerkSessionId = React.useCallback(() => {
    setSuppressedClerkSessionId(null)
  }, [])

  const resetKioskCustomerSession = React.useCallback(() => {
    setKioskClerkSessionId(null)
  }, [])

  const suppressClerkSessionOnCompletion = React.useCallback(() => {
    setSuppressedClerkSessionId(
      resolveSuppressedClerkSessionIdOnCompletion({
        activeSessionId,
        isSignedIn,
        kioskClerkSessionId,
      })
    )
  }, [activeSessionId, isSignedIn, kioskClerkSessionId])

  React.useEffect(() => {
    if (shouldClearSuppressedClerkSessionId({ activeSessionId, isSignedIn, suppressedClerkSessionId })) {
      setSuppressedClerkSessionId(null)
    }
  }, [activeSessionId, isSignedIn, suppressedClerkSessionId])

  return {
    clearSuppressedClerkSessionId,
    hasActiveClerkSession,
    hasPrivilegedClerkSession,
    kioskClerkSessionId,
    registerKioskClerkSession,
    resetKioskCustomerSession,
    suppressClerkSessionOnCompletion,
    suppressedClerkSessionId,
  }
}
