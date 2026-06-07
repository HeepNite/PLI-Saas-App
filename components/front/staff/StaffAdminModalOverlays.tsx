import React from "react"
import { X } from "lucide-react"

import type {
  PayrollDelayModalState,
  RoomReservationCancelModalState,
  RoomRow,
  RoomSafeDeleteModalState,
  RoomReassignModalState,
  StudentPinModalState,
} from "./staffAdminTypes"

type IssuedStudentPin = {
  value: string
  masked: string
  expiresAt: string | null
}

type StaffAdminModalOverlaysProps = {
  roomSafeDeleteModal: RoomSafeDeleteModalState | null
  roomReassignModal: RoomReassignModalState | null
  roomReservationCancelModal: RoomReservationCancelModalState | null
  delayModal: PayrollDelayModalState | null
  studentPinModal: StudentPinModalState | null
  activeRoomOptions: RoomRow[]
  roomBusyId: string | null
  roomReservationBusyId: string | null
  studentPinReason: string
  studentPinDraft: string
  studentPinSubmitting: boolean
  studentPinError: string | null
  studentPinIssued: IssuedStudentPin | null
  studentPinRevealIssued: boolean
  onCloseRoomSafeDelete: () => void
  onUpdateRoomSafeDeleteReason: (reason: string) => void
  onConfirmRoomSafeDelete: () => void
  onCloseRoomReassign: () => void
  onUpdateRoomReassignTarget: (roomId: string) => void
  onUpdateRoomReassignMoveFutureSessions: (moveFutureSessions: boolean) => void
  onUpdateRoomReassignCourseSelection: (courseId: string, selected: boolean) => void
  onConfirmRoomReassign: () => void
  onCloseRoomReservationCancel: () => void
  onUpdateRoomReservationCancelReason: (reason: string) => void
  onConfirmRoomReservationCancel: () => void
  onCloseDelayDetails: () => void
  onCloseStudentPin: () => void
  onStudentPinReasonChange: (reason: string) => void
  onStudentPinDraftChange: (pin: string) => void
  onToggleStudentPinReveal: () => void
  onCopyStudentPinError: (message: string) => void
  onSubmitStudentPinIssue: () => void
  formatMinutesLabel: (minutes: number) => string
  formatIsoDate: (value: string | null) => string
}

export default function StaffAdminModalOverlays({
  roomSafeDeleteModal,
  roomReassignModal,
  roomReservationCancelModal,
  delayModal,
  studentPinModal,
  activeRoomOptions,
  roomBusyId,
  roomReservationBusyId,
  studentPinReason,
  studentPinDraft,
  studentPinSubmitting,
  studentPinError,
  studentPinIssued,
  studentPinRevealIssued,
  onCloseRoomSafeDelete,
  onUpdateRoomSafeDeleteReason,
  onConfirmRoomSafeDelete,
  onCloseRoomReassign,
  onUpdateRoomReassignTarget,
  onUpdateRoomReassignMoveFutureSessions,
  onUpdateRoomReassignCourseSelection,
  onConfirmRoomReassign,
  onCloseRoomReservationCancel,
  onUpdateRoomReservationCancelReason,
  onConfirmRoomReservationCancel,
  onCloseDelayDetails,
  onCloseStudentPin,
  onStudentPinReasonChange,
  onStudentPinDraftChange,
  onToggleStudentPinReveal,
  onCopyStudentPinError,
  onSubmitStudentPinIssue,
  formatMinutesLabel,
  formatIsoDate,
}: StaffAdminModalOverlaysProps) {
  return (
    <>
      <RoomSafeDeleteModal
        modal={roomSafeDeleteModal}
        busyRoomId={roomBusyId}
        onClose={onCloseRoomSafeDelete}
        onReasonChange={onUpdateRoomSafeDeleteReason}
        onConfirm={onConfirmRoomSafeDelete}
      />
      <RoomReassignModal
        modal={roomReassignModal}
        activeRoomOptions={activeRoomOptions}
        busyRoomId={roomBusyId}
        onClose={onCloseRoomReassign}
        onTargetChange={onUpdateRoomReassignTarget}
        onMoveFutureSessionsChange={onUpdateRoomReassignMoveFutureSessions}
        onCourseSelectionChange={onUpdateRoomReassignCourseSelection}
        onConfirm={onConfirmRoomReassign}
      />
      <RoomReservationCancelModal
        modal={roomReservationCancelModal}
        busyReservationId={roomReservationBusyId}
        onClose={onCloseRoomReservationCancel}
        onReasonChange={onUpdateRoomReservationCancelReason}
        onConfirm={onConfirmRoomReservationCancel}
      />
      <DelayDetailsModal modal={delayModal} onClose={onCloseDelayDetails} formatMinutesLabel={formatMinutesLabel} />
      <StudentPinModal
        modal={studentPinModal}
        reason={studentPinReason}
        draft={studentPinDraft}
        submitting={studentPinSubmitting}
        error={studentPinError}
        issued={studentPinIssued}
        revealIssued={studentPinRevealIssued}
        onClose={onCloseStudentPin}
        onReasonChange={onStudentPinReasonChange}
        onDraftChange={onStudentPinDraftChange}
        onToggleReveal={onToggleStudentPinReveal}
        onCopyError={onCopyStudentPinError}
        onSubmit={onSubmitStudentPinIssue}
        formatIsoDate={formatIsoDate}
      />
    </>
  )
}

function RoomSafeDeleteModal({
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

function RoomReassignModal({
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

function RoomReservationCancelModal({
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

function DelayDetailsModal({
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

function StudentPinModal({
  modal,
  reason,
  draft,
  submitting,
  error,
  issued,
  revealIssued,
  onClose,
  onReasonChange,
  onDraftChange,
  onToggleReveal,
  onCopyError,
  onSubmit,
  formatIsoDate,
}: {
  modal: StudentPinModalState | null
  reason: string
  draft: string
  submitting: boolean
  error: string | null
  issued: IssuedStudentPin | null
  revealIssued: boolean
  onClose: () => void
  onReasonChange: (reason: string) => void
  onDraftChange: (pin: string) => void
  onToggleReveal: () => void
  onCopyError: (message: string) => void
  onSubmit: () => void
  formatIsoDate: (value: string | null) => string
}) {
  if (!modal) return null

  return (
    <ModalShell
      title="Student PIN"
      heading={modal.name}
      description={`${modal.email || "No email on file"} · ${modal.needsEnrollment ? "PIN setup" : "Same-day recovery"}`}
      closeLabel="Close student PIN dialog"
      maxWidthClassName="max-w-xl"
      onClose={onClose}
    >
      <div className="rounded-xl border border-cyan-400/25 bg-cyan-400/10 p-3 text-sm text-cyan-950 dark:text-cyan-100">
        Provisional PINs stay valid until end of day. Use them only for front-desk assisted enrollment or same-day recovery.
      </div>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-black dark:text-white">Reason</span>
        <textarea
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          rows={3}
          placeholder="Example: Walk-in recovery before class starts"
          className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-black dark:text-white">Custom PIN (optional)</span>
        <input
          value={draft}
          onChange={(event) => onDraftChange(event.target.value.replace(/\D+/g, "").slice(0, 4))}
          inputMode="numeric"
          placeholder="Leave blank to auto-generate"
          className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
        />
      </label>
      {modal.provisionalActive || modal.provisionalExpiresAt ? (
        <p className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
          Existing provisional PIN {modal.provisionalActive ? "is active" : "was created"}. Expiry: {formatIsoDate(modal.provisionalExpiresAt)}.
        </p>
      ) : null}
      {error ? <p className="text-sm text-[var(--brand,#ff4b4b)]">{error}</p> : null}
      {issued?.value ? (
        <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm text-emerald-950 dark:text-emerald-100">
          <p className="text-xs uppercase tracking-[0.2em]">Issued</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="rounded-md bg-black/10 px-3 py-2 text-base font-semibold tracking-[0.35em] dark:bg-black/20">
              {revealIssued ? issued.value : issued.masked}
            </code>
            <SecondaryMiniButton onClick={onToggleReveal}>{revealIssued ? "Hide" : "Reveal"}</SecondaryMiniButton>
            <SecondaryMiniButton onClick={() => void copyIssuedPin(issued.value, onCopyError)}>Copy PIN</SecondaryMiniButton>
          </div>
          <p className="mt-2 text-xs">Expires: {formatIsoDate(issued.expiresAt)}</p>
        </div>
      ) : null}
      <ModalActions>
        <SecondaryButton onClick={onClose}>Close</SecondaryButton>
        <PrimaryButton onClick={onSubmit} disabled={submitting}>
          {submitting ? "Saving..." : issued ? "Reissue PIN" : "Create provisional PIN"}
        </PrimaryButton>
      </ModalActions>
    </ModalShell>
  )
}

async function copyIssuedPin(value: string, onCopyError: (message: string) => void) {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return
  try {
    await navigator.clipboard.writeText(value)
  } catch {
    onCopyError("Unable to copy provisional PIN.")
  }
}

function ModalShell({
  title,
  heading,
  description,
  closeLabel,
  closeDisabled,
  maxWidthClassName = "max-w-lg",
  bodyClassName = "space-y-4 p-5",
  onClose,
  children,
}: {
  title: string
  heading: string
  description?: string
  closeLabel: string
  closeDisabled?: boolean
  maxWidthClassName?: string
  bodyClassName?: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <div className={`w-full ${maxWidthClassName} rounded-2xl border border-black/15 bg-white shadow-[0_40px_90px_-40px_rgba(0,0,0,0.75)] dark:border-white/15 dark:bg-[#10131d]`}>
        <div className="flex items-start justify-between border-b border-black/10 px-5 py-4 dark:border-white/10">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--brand,#b61616)]">{title}</p>
            <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">{heading}</h3>
            {description ? <p className="mt-1 text-xs text-black/65 dark:text-white/65">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/20 text-black/70 transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/20 dark:text-white/70 dark:hover:bg-white/5"
            aria-label={closeLabel}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className={bodyClassName}>{children}</div>
      </div>
    </div>
  )
}

function ModalError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p className="rounded-md border border-[var(--brand,#b61616)]/35 bg-[var(--brand,#b61616)]/10 px-3 py-2 text-sm text-[var(--brand,#ff4b4b)]">
      {message}
    </p>
  )
}

function ModalActions({ children }: { children: React.ReactNode }) {
  return <div className="flex justify-end gap-2">{children}</div>
}

function SecondaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-xl border border-black/15 px-4 py-2 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/15 dark:text-white"
    >
      {children}
    </button>
  )
}

function PrimaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-xl bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
    >
      {children}
    </button>
  )
}

function SecondaryMiniButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-black/15 px-3 py-1.5 text-xs font-semibold text-black dark:border-white/15 dark:text-white"
    >
      {children}
    </button>
  )
}
