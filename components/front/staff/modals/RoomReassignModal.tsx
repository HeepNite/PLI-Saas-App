import type { RoomReassignModalState, RoomRow } from "../staffAdminTypes"
import { ModalShell, ModalError, ModalActions, SecondaryButton, PrimaryButton } from "./ModalShell"

export function RoomReassignModal({
  modal,
  activeRoomOptions,
  busyRoomId,
  onClose,
  onTargetChange,
  onMoveFutureSessionsChange,
  onCourseSelectionChange,
  onConfirm,
}: {
  modal: RoomReassignModalState | null
  activeRoomOptions: RoomRow[]
  busyRoomId: string | null
  onClose: () => void
  onTargetChange: (roomId: string) => void
  onMoveFutureSessionsChange: (moveFutureSessions: boolean) => void
  onCourseSelectionChange: (courseId: string, selected: boolean) => void
  onConfirm: () => void
}) {
  if (!modal) return null

  const isBusy = busyRoomId === modal.room.id
  const requiresCourseSelection = modal.availableCourses.length > 0 && modal.selectedCourseIds.length === 0

  return (
    <ModalShell
      title="Room reassignment"
      heading={modal.room.name}
      description="Move course defaults and optionally future sessions to another active room."
      closeLabel="Close room reassignment dialog"
      closeDisabled={isBusy}
      onClose={onClose}
    >
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-black dark:text-white">Target active room</span>
        <select
          value={modal.targetRoomId}
          onChange={(event) => onTargetChange(event.target.value)}
          className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
        >
          <option value="">Select target room</option>
          {activeRoomOptions
            .filter((room) => room.id !== modal.room.id)
            .map((room) => (
              <option key={`reassign-target-room-${room.id}`} value={room.id}>{room.name}</option>
            ))}
        </select>
      </label>
      <label className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white/60 px-3 py-2 text-sm text-black/80 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/80">
        <input
          type="checkbox"
          checked={modal.moveFutureSessions}
          onChange={(event) => onMoveFutureSessionsChange(event.target.checked)}
        />
        Also move future sessions (all-or-nothing if any conflict exists)
      </label>
      <div className="space-y-2 rounded-xl border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-black dark:text-white">Affected courses in source room</p>
          <p className="text-xs text-black/60 dark:text-white/60">{modal.selectedCourseIds.length} selected</p>
        </div>
        {modal.availableCourses.length === 0 ? (
          <p className="text-xs text-black/60 dark:text-white/60">No course defaults are currently assigned to this room.</p>
        ) : (
          <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
            {modal.availableCourses.map((course) => {
              const checked = modal.selectedCourseIds.includes(course.id)
              return (
                <label
                  key={`reassign-course-${course.id}`}
                  className="flex items-center gap-2 rounded-lg border border-black/10 bg-white/80 px-2.5 py-2 text-sm text-black dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => onCourseSelectionChange(course.id, event.target.checked)}
                  />
                  <div className="flex min-w-0 flex-col">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="font-medium">{course.title}</span>
                      <span className="text-xs text-black/60 dark:text-white/60">({course.slug})</span>
                    </div>
                    <span className="text-xs text-black/65 dark:text-white/65">
                      {course.scheduleLabel ? course.scheduleLabel : "Schedule not configured"}
                    </span>
                  </div>
                </label>
              )
            })}
          </div>
        )}
      </div>
      <ModalError message={modal.error} />
      <ModalActions>
        <SecondaryButton onClick={onClose} disabled={isBusy}>Cancel</SecondaryButton>
        <PrimaryButton onClick={onConfirm} disabled={isBusy || !modal.targetRoomId || requiresCourseSelection}>
          {isBusy ? "Reassigning..." : "Confirm reassignment"}
        </PrimaryButton>
      </ModalActions>
    </ModalShell>
  )
}
