import type { RoomSafeDeleteModalState } from "../staffAdminTypes"
import { ModalShell, ModalError, ModalActions, SecondaryButton, PrimaryButton } from "./ModalShell"

export function RoomSafeDeleteModal({
  modal,
  busyRoomId,
  onClose,
  onReasonChange,
  onConfirm,
}: {
  modal: RoomSafeDeleteModalState | null
  busyRoomId: string | null
  onClose: () => void
  onReasonChange: (reason: string) => void
  onConfirm: () => void
}) {
  if (!modal) return null

  const isBusy = busyRoomId === modal.room.id

  return (
    <ModalShell
      title="Room safe delete"
      heading={modal.room.name}
      description="This action is permanent when allowed by blockers."
      closeLabel="Close room safe-delete dialog"
      closeDisabled={isBusy}
      onClose={onClose}
    >
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-black dark:text-white">Deletion reason (required)</span>
        <textarea
          value={modal.reason}
          onChange={(event) => onReasonChange(event.target.value)}
          rows={3}
          placeholder="Example: Room permanently removed from service"
          className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
        />
      </label>
      <ModalError message={modal.error} />
      <ModalActions>
        <SecondaryButton onClick={onClose} disabled={isBusy}>Cancel</SecondaryButton>
        <PrimaryButton onClick={onConfirm} disabled={isBusy || !modal.reason.trim()}>
          {isBusy ? "Deleting..." : "Confirm safe delete"}
        </PrimaryButton>
      </ModalActions>
    </ModalShell>
  )
}
