import React from "react"
import type { StudentPinClientStatus } from "@/components/front/hooks/useStudentPinStatus"

type StudentPinCardProps = {
  pinStatus: StudentPinClientStatus
  pinLoading: boolean
  pinStatusError: string | null
  pinRecoveryMode: boolean
  pinCurrentValue: string
  pinNextValue: string
  pinConfirmValue: string
  pinSaving: boolean
  pinFormError: string | null
  pinFormSuccess: string | null
  onPinCurrentChange: (value: string) => void
  onPinNextChange: (value: string) => void
  onPinConfirmChange: (value: string) => void
  onToggleRecoveryMode: () => void
  onSubmit: () => void
}

export function StudentPinCard({
  pinStatus,
  pinLoading,
  pinStatusError,
  pinRecoveryMode,
  pinCurrentValue,
  pinNextValue,
  pinConfirmValue,
  pinSaving,
  pinFormError,
  pinFormSuccess,
  onPinCurrentChange,
  onPinNextChange,
  onPinConfirmChange,
  onToggleRecoveryMode,
  onSubmit,
}: StudentPinCardProps) {
  if (!(pinStatus.enabled || pinLoading || pinStatusError)) return null

  return (
    <section className="order-[1.5] rounded-2xl border border-black/10 bg-white/70 p-4 shadow-[0_10px_24px_-18px_rgba(0,0,0,0.28)] dark:border-white/10 dark:bg-white/[0.03]">
      {/* Desktop header: original two-column layout */}
      <div className="hidden flex-wrap items-start justify-between gap-3 border-b border-black/8 pb-4 dark:border-white/10 lg:flex">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--brand,#b61616)]">Student PIN</p>
          <h3 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-white">
            {pinStatus.needsEnrollment ? "Set your kiosk PIN" : "Manage your kiosk PIN"}
          </h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-white/60">
            Use a personal 4-digit PIN for kiosk identification and recovery.
          </p>
        </div>
        <div className="text-right text-xs text-zinc-500 dark:text-white/55">
          <p>{pinStatus.locked ? "Locked" : pinStatus.needsEnrollment ? "Not enrolled" : "Active"}</p>
          <p className="mt-1">{pinStatus.permanent.failedAttempts} / 5 failed attempts</p>
        </div>
      </div>

      {/* Desktop status row */}
      <div className="hidden flex-col gap-1 border-b border-black/8 py-3 text-sm dark:border-white/10 lg:flex lg:flex-row lg:items-center lg:justify-between">
        <p className="font-medium text-zinc-900 dark:text-white">Status</p>
        <p className="text-zinc-600 dark:text-white/65">
          {pinStatus.needsEnrollment ? "Enrollment required" : pinStatus.locked ? "Locked after failed attempts" : "Ready for kiosk use"}
        </p>
      </div>

      {/* Mobile header: compact single-column */}
      <div className="border-b border-black/8 pb-3 dark:border-white/10 lg:hidden">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--brand,#b61616)]">Student PIN</p>
        <h3 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-white">
          {pinStatus.needsEnrollment ? "Set your kiosk PIN" : "Manage your kiosk PIN"}
        </h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-white/60">
          Use a personal 4-digit PIN for kiosk identification and recovery.
        </p>
        <p className="mt-2 text-xs">
          <span className="text-white/50">Status:</span> <strong>{pinStatus.locked ? "Locked" : pinStatus.needsEnrollment ? "Not enrolled" : "Active"}</strong>
          <span className="mx-1.5 text-[var(--brand,#b61616)]">·</span>
          <span className="text-white/50">Attempts:</span> <strong>{pinStatus.permanent.failedAttempts} / 5</strong>
          <span className="mx-1.5 text-[var(--brand,#b61616)]">·</span>
          <span className="text-zinc-600 dark:text-white/50">{pinStatus.needsEnrollment ? "Enrollment required" : pinStatus.locked ? "Locked after failed attempts" : "Ready for kiosk use"}</span>
        </p>
      </div>

      {/* Inputs grid: 3 cols on mobile, 4 cols on desktop (with Update PIN button) */}
      <div className={`mt-4 grid items-end gap-3 ${!pinRecoveryMode && pinStatus.enrolled ? "grid-cols-3 lg:grid-cols-4" : "grid-cols-2 lg:grid-cols-3"}`}>
        {!pinRecoveryMode && pinStatus.enrolled && (
          <fieldset className="space-y-1.5">
            <label className="text-xs font-medium">Current PIN</label>
            <input
              inputMode="numeric"
              maxLength={4}
              type="password"
              value={pinCurrentValue}
              onChange={(e) => onPinCurrentChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:border-white/15 dark:text-white/90"
              placeholder="Current PIN"
            />
          </fieldset>
        )}
        <fieldset className="space-y-1.5">
          <label className="text-xs font-medium">New PIN</label>
          <input
            inputMode="numeric"
            maxLength={4}
            type="password"
            value={pinNextValue}
            onChange={(e) => onPinNextChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
            className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:border-white/15 dark:text-white/90"
            placeholder="4 digits"
          />
        </fieldset>
        <fieldset className="space-y-1.5">
          <label className="text-xs font-medium">Confirm PIN</label>
          <input
            inputMode="numeric"
            maxLength={4}
            type="password"
            value={pinConfirmValue}
            onChange={(e) => onPinConfirmChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
            className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:border-white/15 dark:text-white/90"
            placeholder="Repeat PIN"
          />
        </fieldset>
        {/* Desktop: button inline in grid */}
        <button
          type="button"
          onClick={onSubmit}
          disabled={pinSaving || pinLoading}
          className="hidden w-full rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 lg:block"
        >
          {pinSaving ? "Saving..." : pinStatus.needsEnrollment ? "Enroll PIN" : pinRecoveryMode ? "Recover PIN" : "Update PIN"}
        </button>
      </div>

      {/* Mobile: two buttons side by side like Book/Change and Suspend/Cancel */}
      <div className="mt-4 grid grid-cols-2 gap-2 lg:hidden">
        <button
          type="button"
          onClick={onSubmit}
          disabled={pinSaving || pinLoading}
          className="rounded-md bg-[var(--brand,#b61616)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pinSaving ? "Saving..." : pinStatus.needsEnrollment ? "Enroll PIN" : pinRecoveryMode ? "Recover PIN" : "Update PIN"}
        </button>
        {pinStatus.enrolled && (
          <button
            type="button"
            onClick={onToggleRecoveryMode}
            className="rounded-md border border-[var(--brand,#b61616)]/50 px-3 py-2 text-sm font-semibold text-zinc-700 dark:text-white/80"
          >
            {pinRecoveryMode ? "Use current PIN" : "Forgot your PIN?"}
          </button>
        )}
      </div>

      {/* Desktop: forgot pin left-aligned */}
      {pinStatus.enrolled && (
        <p className="mt-3 hidden text-xs lg:block">
          <span
            role="button"
            tabIndex={0}
            onClick={onToggleRecoveryMode}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggleRecoveryMode() }}
            className="cursor-pointer text-[var(--brand,#b61616)]/80 underline-offset-2 hover:underline"
          >
            {pinRecoveryMode ? "Use current PIN instead" : "Forgot your PIN?"}
          </span>
        </p>
      )}

      {pinStatusError && <p className="mt-3 text-sm text-red-400">{pinStatusError}</p>}
      {pinFormError && <p className="mt-3 text-sm text-red-400">{pinFormError}</p>}
      {pinFormSuccess && !pinFormError && <p className="mt-3 text-sm text-emerald-300">{pinFormSuccess}</p>}
    </section>
  )
}
