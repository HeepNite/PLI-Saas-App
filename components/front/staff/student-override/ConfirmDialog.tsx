"use client"

import React from "react"
import { AlertTriangle } from "lucide-react"

type ConfirmDialogProps = {
  studentName: string
  entityType: string
  reason: string
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({
  studentName,
  entityType,
  reason,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-md rounded-2xl border border-black/15 bg-white p-6 shadow-2xl dark:border-white/15 dark:bg-[#10131d]">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-1 h-6 w-6 shrink-0 text-amber-500" />
          <div>
            <h4 className="text-lg font-semibold text-black dark:text-white">Confirm override</h4>
            <p className="mt-1 text-sm text-black/65 dark:text-white/65">
              You are about to manually override <strong>{entityType}</strong> data for <strong>{studentName}</strong>.
              This action cannot be undone and will be permanently recorded in the audit log.
            </p>
          </div>
        </div>

        {reason && (
          <div className="mt-4 rounded-lg border border-black/10 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.03]">
            <p className="text-xs text-black/50 dark:text-white/50">Reason:</p>
            <p className="mt-1 text-sm text-black dark:text-white">{reason}</p>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-black/20 px-4 py-2 text-sm font-medium text-black transition hover:bg-black/5 dark:border-white/20 dark:text-white dark:hover:bg-white/5"
          >
            Go back
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand,#b61616)]/90"
          >
            Confirm override
          </button>
        </div>
      </div>
    </div>
  )
}
