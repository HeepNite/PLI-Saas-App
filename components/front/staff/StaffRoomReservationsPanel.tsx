import React from "react"

import StaffRoomReservationForm from "./StaffRoomReservationForm"
import StaffRoomReservationList from "./StaffRoomReservationList"
import type { RoomReservationFormState } from "./staffRoomFormState"
import type { RoomReservationRow, RoomRow } from "./staffAdminTypes"

type RoomOption = Pick<RoomRow, "id" | "name">

type StaffOption = {
  id: string
  label: string
}

type StaffRoomReservationsPanelProps = {
  visible: boolean
  wizard: {
    step: number
    totalSteps: number
    onPrevious: () => void
    onNext: () => void
  }
  form: {
    roomReservationForm: RoomReservationFormState
    reservationRangePreview: string
    roomReservationFormError: string | null
    roomReservationFormSuccess: string | null
    roomReservationSaving: boolean
    activeRoomOptions: RoomOption[]
    reservationAssignableStaff: StaffOption[]
    onDateRangeChange: (start: string, end: string) => void
    onFieldChange: <Field extends keyof RoomReservationFormState>(field: Field, value: RoomReservationFormState[Field]) => void
    onSubmit: (event: React.FormEvent) => void
    formatReservationDateLabel: (value: string) => string
  }
  list: {
    schoolLoading: boolean
    reservations: RoomReservationRow[]
    roomById: Record<string, RoomRow>
    roomReservationBusyId: string | null
    onCancel: (reservation: RoomReservationRow) => void
    formatDateTime: (value: string | number | null | undefined) => string
    resolveAssignedStaffLabel: (staffId: string | null) => string
  }
}

export default function StaffRoomReservationsPanel({ visible, wizard, form, list }: StaffRoomReservationsPanelProps) {
  if (!visible) return null

  return (
    <article className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
      <header className="mb-4">
        <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Private reservations</p>
        <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Current and upcoming room reservations</h3>
        <p className="mt-1 text-sm text-black/65 dark:text-white/65">
          Use active rooms for new reservations and cancel conflicting entries when needed.
        </p>
      </header>

      <StaffRoomReservationForm {...form}>
        <StaffRoomReservationList {...list} />
      </StaffRoomReservationForm>

      <WizardNavigation {...wizard} />
    </article>
  )
}

function WizardNavigation({ step, totalSteps, onPrevious, onNext }: StaffRoomReservationsPanelProps["wizard"]) {
  return (
    <div className="mt-6 flex items-center justify-between border-t border-black/10 pt-4 dark:border-white/10">
      <button
        type="button"
        onClick={onPrevious}
        disabled={step === 0}
        className="rounded-lg border border-black/10 px-4 py-1.5 text-xs font-medium text-black/60 transition hover:bg-black/[0.04] disabled:opacity-30 dark:border-white/10 dark:text-white/60 dark:hover:bg-white/[0.04]"
      >
        ← Previous
      </button>
      <span className="text-[10px] text-black/40 dark:text-white/40">Step {step + 1} of {totalSteps}</span>
      <button
        type="button"
        onClick={onNext}
        disabled={step >= totalSteps - 1}
        className="rounded-lg border border-[var(--brand,#b61616)]/30 bg-[var(--brand,#b61616)]/10 px-4 py-1.5 text-xs font-medium text-[var(--brand,#ff4b4b)] transition hover:bg-[var(--brand,#b61616)]/20 disabled:opacity-30"
      >
        Next →
      </button>
    </div>
  )
}
