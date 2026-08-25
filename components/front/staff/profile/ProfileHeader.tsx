"use client"

import React from "react"
import Image from "next/image"
import { Loader2 } from "lucide-react"
import { CATEGORY_LABELS, ROLE_LABELS } from "../staffAdminConstants"
import type { SelfProfileSnapshot, StaffUserRow } from "../staffAdminTypes"

type ProfileHeaderProps = {
  resolvedSelfProfile: SelfProfileSnapshot
  selfProfileRow: StaffUserRow
  selfProfileLoading: boolean
  selfIsOnline: boolean
  selfLiveSessionMinutes: number | null
  openProfileModal: (row: StaffUserRow) => void | Promise<void>
  getInitials: (firstName: string, lastName: string, fallback: string) => string
  formatDurationLabel: (minutes: number) => string
}

export default function ProfileHeader(props: ProfileHeaderProps) {
  const {
    resolvedSelfProfile,
    selfProfileRow,
    selfProfileLoading,
    selfIsOnline,
    selfLiveSessionMinutes,
    openProfileModal,
    getInitials,
    formatDurationLabel,
  } = props

  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-4">
        {resolvedSelfProfile.imageUrl ? (
          <Image
            src={resolvedSelfProfile.imageUrl}
            alt="Staff avatar"
            width={80}
            height={80}
            unoptimized
            className="h-20 w-20 rounded-2xl border border-black/15 object-cover dark:border-white/15"
          />
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-black/15 bg-black/[0.05] text-2xl font-semibold text-black/80 dark:border-white/15 dark:bg-white/[0.05] dark:text-white/85">
            {getInitials(resolvedSelfProfile.firstName, resolvedSelfProfile.lastName, "")}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Employee profile</p>
          <h3 className="mt-2 text-2xl font-semibold text-black dark:text-white">
            {resolvedSelfProfile.firstName || resolvedSelfProfile.lastName
              ? `${resolvedSelfProfile.firstName} ${resolvedSelfProfile.lastName}`.trim()
              : "My staff profile"}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                selfIsOnline
                  ? "border-emerald-500/45 bg-emerald-500/12 text-emerald-300"
                  : "border-zinc-500/35 bg-zinc-500/10 text-zinc-300"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {selfIsOnline ? "Checked in" : "Not checked in"}
            </span>
            <span className="inline-flex rounded-full border border-sky-500/35 bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-300">
              {selfLiveSessionMinutes !== null
                ? `Working ${formatDurationLabel(selfLiveSessionMinutes)}`
                : "No active work session"}
            </span>
          </div>
          <p className="mt-1 text-sm text-black/65 dark:text-white/65">
            Access level: <span className="font-semibold">{ROLE_LABELS[resolvedSelfProfile.role]}</span> ·{" "}
            <span className="font-semibold">{CATEGORY_LABELS[resolvedSelfProfile.category]}</span>
          </p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {selfProfileLoading ? (
          <span className="inline-flex items-center gap-1 text-xs text-black/65 dark:text-white/65">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading profile...
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => void openProfileModal(selfProfileRow)}
          className="cursor-pointer rounded-xl border border-[var(--brand,#b61616)]/55 bg-[var(--brand,#b61616)]/15 px-4 py-2 text-sm font-medium text-[var(--brand,#ff4b4b)]"
        >
          Edit my profile
        </button>
      </div>
    </header>
  )
}
