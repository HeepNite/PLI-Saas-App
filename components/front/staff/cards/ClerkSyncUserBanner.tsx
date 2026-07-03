"use client"

import React from "react"
import { ClerkSyncMismatchBanner } from "@/components/front/staff/ClerkSyncMismatchBanner"
import { ClerkSyncContext } from "@/components/front/staff/ClerkSyncContext"

// ClerkSyncUserBanner — single source for both ProfileClerkBanner and
// PaymentClerkBanner. Reads the panel-local ClerkSyncContext and renders the
// ClerkSyncMismatchBanner only when a mismatch exists for the given user.
// Returns null for empty userId so callers can pass nullable values without
// extra guards.
export function ClerkSyncUserBanner({ userId }: { userId: string | null }) {
  const clerkSync = React.useContext(ClerkSyncContext)
  if (!clerkSync || !userId) return null
  const { canManageClerkSync, clerkMismatchByUserId, clerkSyncUserBusyId, onSyncClerkUser } = clerkSync
  if (!canManageClerkSync || !clerkMismatchByUserId.has(userId)) return null
  const mismatch = clerkMismatchByUserId.get(userId)
  if (!mismatch) return null
  return (
    <ClerkSyncMismatchBanner
      mismatch={mismatch}
      busy={clerkSyncUserBusyId === userId}
      onSync={() => onSyncClerkUser(userId)}
    />
  )
}
