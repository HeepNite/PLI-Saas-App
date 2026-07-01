import type { PayrollDelayModalState } from "../staffAdminTypes"
import { ModalShell } from "./ModalShell"

export function DelayDetailsModal({
  modal,
  onClose,
  formatMinutesLabel,
}: {
  modal: PayrollDelayModalState | null
  onClose: () => void
  formatMinutesLabel: (minutes: number) => string
}) {
  if (!modal) return null

  return (
    <ModalShell
      title="Delay details"
      heading={modal.row.name}
      description={`Total delay: ${formatMinutesLabel(modal.totalDelayMinutes)} · Late days: ${modal.lateDays}`}
      closeLabel="Close delay details"
      maxWidthClassName="max-w-2xl"
      bodyClassName="p-5"
      onClose={onClose}
    >
      <div className="grid grid-cols-[120px_1fr_1fr_84px] gap-2 rounded-md border border-black/10 bg-black/[0.03] px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-black/55 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/55">
        <span>Date</span>
        <span>Expected</span>
        <span>Checked in</span>
        <span className="text-right">Delay</span>
      </div>
      <div className="mt-2 space-y-2">
        {modal.entries.length === 0 ? (
          <p className="rounded-lg border border-black/10 bg-white/70 px-3 py-2 text-sm text-black/70 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/70">
            No delay records available for this user yet.
          </p>
        ) : (
          modal.entries.map((entry) => (
            <div
              key={entry.id}
              className="grid grid-cols-[120px_1fr_1fr_84px] items-center gap-2 rounded-lg border border-black/10 bg-white/70 px-3 py-2 text-sm text-black dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
            >
              <span className="text-xs text-black/70 dark:text-white/70">{entry.dateLabel}</span>
              <span>{entry.expectedTime}</span>
              <span>{entry.actualTime}</span>
              <span className="text-right text-xs font-semibold text-[var(--brand,#ff4b4b)]">
                {entry.delayMinutes > 0 ? `+${entry.delayMinutes}m` : "On time"}
              </span>
            </div>
          ))
        )}
      </div>
    </ModalShell>
  )
}
