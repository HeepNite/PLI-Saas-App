"use client"

import React from "react"
import { RefreshCw } from "lucide-react"
import type { StudentsBoardClerkSyncProps } from "@/components/front/staff/studentsBoardTypes"

export function ClerkSyncBanner({
  canManageClerkSync,
  clerkSyncLoading,
  clerkSyncRepairing,
  clerkSyncError,
  clerkSyncMessage,
  clerkSyncHealth,
  onCheckClerkSync,
  onRepairClerkSync,
}: StudentsBoardClerkSyncProps) {
  const hasMissing = (clerkSyncHealth?.missingCount ?? 0) > 0
  const hasMismatched = (clerkSyncHealth?.mismatchedCount ?? 0) > 0
  const shouldRender =
    canManageClerkSync &&
    (clerkSyncLoading || clerkSyncRepairing || clerkSyncError || hasMissing || hasMismatched)

  if (!shouldRender) return null

  const hasConfirmedSyncIssue = hasMissing || hasMismatched
  const statusLabel = clerkSyncLoading
    ? "Checking users"
    : clerkSyncRepairing
      ? "Syncing users"
      : hasConfirmedSyncIssue
        ? "Users need sync"
        : "User sync unavailable"

  const healthMessage = (() => {
    if (!clerkSyncHealth) {
      return clerkSyncError
        ? "User sync status is temporarily unavailable. Try checking again shortly."
        : "Checking whether all users are ready to use the app."
    }
    const missing = clerkSyncHealth.missingCount
    const mismatched = clerkSyncHealth.mismatchedCount ?? 0
    if (missing > 0 && mismatched > 0) {
      return `${missing} user${missing === 1 ? "" : "s"} missing and ${mismatched} with outdated info — sync recommended.`
    }
    if (missing > 0) {
      return `${missing} user${missing === 1 ? "" : "s"} need to be synced before they can use the app.`
    }
    if (mismatched > 0) {
      return `${mismatched} student${mismatched === 1 ? " has" : "s have"} outdated info vs Clerk. Sync per student in the cards below (phone is locked).`
    }
    return "All users are up to date."
  })()

  return (
    <div className="mb-4 rounded-2xl border border-[var(--brand,#b61616)]/30 bg-[var(--brand,#b61616)]/8 p-3 shadow-[0_14px_28px_-20px_rgba(0,0,0,0.65)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--brand,#b61616)]/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand,#b61616)] dark:text-[var(--brand,#ff4b4b)]">
              {statusLabel}
            </span>
            <p className="text-sm text-black/70 dark:text-white/70">{healthMessage}</p>
          </div>
          {clerkSyncError ? (
            <p className="mt-1 text-xs text-red-500 dark:text-red-400">{clerkSyncError}</p>
          ) : null}
          {clerkSyncMessage ? (
            <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-300">{clerkSyncMessage}</p>
          ) : null}
          {clerkSyncHealth && clerkSyncHealth.missingCount > 0 ? (
            <p className="mt-1 text-xs text-black/60 dark:text-white/60">
              Users to sync: {clerkSyncHealth.missingUsers
                .slice(0, 3)
                .map((user) => user.email || "User without email")
                .join(", ")}
              {clerkSyncHealth.missingCount > 3 ? ` +${clerkSyncHealth.missingCount - 3} more` : ""}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onCheckClerkSync()}
            disabled={clerkSyncLoading || clerkSyncRepairing}
            className="inline-flex h-9 items-center gap-1 rounded-full border border-black/20 px-3 text-xs font-medium text-black/70 transition hover:border-[var(--brand,#b61616)]/60 hover:text-[var(--brand,#b61616)] disabled:opacity-50 dark:border-white/20 dark:text-white/70"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${clerkSyncLoading ? "animate-spin" : ""}`} />
            Check users
          </button>
          <button
            type="button"
            onClick={() => onRepairClerkSync()}
            disabled={clerkSyncLoading || clerkSyncRepairing}
            className="inline-flex h-9 items-center gap-1 rounded-full border border-[var(--brand,#b61616)]/60 bg-[var(--brand,#b61616)]/12 px-3 text-xs font-semibold text-[var(--brand,#b61616)] transition hover:bg-[var(--brand,#b61616)]/18 disabled:opacity-50 dark:text-[var(--brand,#ff4b4b)]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${clerkSyncRepairing ? "animate-spin" : ""}`} />
            {clerkSyncRepairing ? "Syncing..." : "Sync users"}
          </button>
        </div>
      </div>
    </div>
  )
}
