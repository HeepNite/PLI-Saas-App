import type {
  PayrollDelayModalState,
  RoomReservationCancelModalState,
  RoomRow,
  RoomSafeDeleteModalState,
  RoomReassignModalState,
  StudentPinModalState,
} from "./staffAdminTypes"
import type { IssuedStudentPin } from "./modals/types"
import { RoomSafeDeleteModal } from "./modals/RoomSafeDeleteModal"
import { RoomReassignModal } from "./modals/RoomReassignModal"
import { RoomReservationCancelModal } from "./modals/RoomReservationCancelModal"
import { DelayDetailsModal } from "./modals/DelayDetailsModal"
import { StudentPinModal } from "./modals/StudentPinModal"

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
