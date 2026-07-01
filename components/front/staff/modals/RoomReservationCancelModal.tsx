import type { RoomReservationCancelModalState } from "../staffAdminTypes"
import { ModalShell, ModalError, ModalActions, SecondaryButton, PrimaryButton } from "./ModalShell"

export function RoomReservationCancelModal({
  modal,
  busyReservationId,
  onClose,
  onReasonChange,
  onConfirm,
}: {
  modal: RoomReservationCancelModalState | null
  busyReservationId: string | null
  onClose: () => void
  onReasonChange: (reason: string) => void
  onConfirm: () => void
}) {
  if (!modal) return null

  const isBusy = busyReservationId === modal.reservation.id

  return (
    <ModalShell
      title="Cancel reservation"
      heading={modal.reservation.title}
      closeLabel="Close room reservation cancel dialog"
      closeDisabled={isBusy}
      onClose={onClose}
    >
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-black dark:text-white">Cancellation reason (optional)</span>
        <textarea
          value={modal.reason}
          onChange={(event) => onReasonChange(event.target.value)}
          rows={3}
          className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
        />
      </label>
      <ModalError message={modal.error} />
      <ModalActions>
        <SecondaryButton onClick={onClose} disabled={isBusy}>Keep reservation</SecondaryButton>
        <PrimaryButton onClick={onConfirm} disabled={isBusy}>{isBusy ? "Cancelling..." : "Confirm cancel"}</PrimaryButton>
      </ModalActions>
    </ModalShell>
  )
}
