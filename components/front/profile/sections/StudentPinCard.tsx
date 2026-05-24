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
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-black/8 pb-4 dark:border-white/10">
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

      <div className="divide-y divide-black/8 dark:divide-white/10">
        <div className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="font-medium text-zinc-900 dark:text-white">Status</p>
          <p className="text-zinc-600 dark:text-white/65">
            {pinStatus.needsEnrollment ? "Enrollment required" : pinStatus.locked ? "Locked after failed attempts" : "Ready for kiosk use"}
          </p>
        </div>
        <div className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="font-medium text-zinc-900 dark:text-white">Recovery</p>
          <p className="text-zinc-600 dark:text-white/65">
            {pinStatus.provisional.active ? "Staff provisional PIN active" : "Account recovery available"}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {!pinRecoveryMode && pinStatus.enrolled && (
          <fieldset className="space-y-2">
            <label className="text-sm font-medium">Current PIN</label>
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
        <fieldset className="space-y-2">
          <label className="text-sm font-medium">New PIN</label>
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
        <fieldset className="space-y-2">
          <label className="text-sm font-medium">Confirm PIN</label>
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
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {pinStatus.enrolled && (
          <button
            type="button"
            onClick={onToggleRecoveryMode}
            className="rounded-md border border-black/10 bg-black/[0.03] px-3 py-2 text-xs font-semibold text-zinc-800 dark:border-white/10 dark:bg-white/5 dark:text-white/80"
          >
            {pinRecoveryMode ? "Use current PIN instead" : "Forgot your PIN? Recover from account"}
          </button>
        )}
        <button
          type="button"
          onClick={onSubmit}
          disabled={pinSaving || pinLoading}
          className="rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pinSaving ? "Saving..." : pinStatus.needsEnrollment ? "Enroll PIN" : pinRecoveryMode ? "Recover PIN" : "Update PIN"}
        </button>
      </div>

      {pinStatusError && <p className="mt-3 text-sm text-red-400">{pinStatusError}</p>}
      {pinFormError && <p className="mt-3 text-sm text-red-400">{pinFormError}</p>}
      {pinFormSuccess && !pinFormError && <p className="mt-3 text-sm text-emerald-300">{pinFormSuccess}</p>}
    </section>
  )
}
