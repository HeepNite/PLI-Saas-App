import React from "react"
import CalendarPicker from "@/components/front/ui/CalendarPicker"
import { ROOM_RESERVATION_TIME_OPTIONS, type RoomReservationFormState } from "./staffRoomFormState"

type RoomOption = {
  id: string
  name: string
}

type StaffOption = {
  id: string
  label: string
}

type StaffRoomReservationFormProps = {
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
  children?: React.ReactNode
}

export default function StaffRoomReservationForm({
  roomReservationForm,
  reservationRangePreview,
  roomReservationFormError,
  roomReservationFormSuccess,
  roomReservationSaving,
  activeRoomOptions,
  reservationAssignableStaff,
  onDateRangeChange,
  onFieldChange,
  onSubmit,
  formatReservationDateLabel,
  children,
}: StaffRoomReservationFormProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <div className="rounded-lg border border-black/10 bg-white/45 p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <p className="text-[11px] uppercase tracking-[0.24em] text-black/60 dark:text-white/60">Reservation date range</p>
          <div className="mt-2">
            <CalendarPicker
              rangeMode={true}
              rangeStart={roomReservationForm.startDate}
              rangeEnd={roomReservationForm.endDate || undefined}
              onRangeChange={(start, end) => {
                onDateRangeChange(start, end || "")
              }}
              compact
            />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <label className="space-y-1.5">
            <span className="text-[11px] uppercase tracking-[0.18em] text-black/60 dark:text-white/60">Start time</span>
            <select
              value={roomReservationForm.startTime}
              onChange={(event) => onFieldChange("startTime", event.target.value)}
              className="w-full appearance-none rounded-lg border border-black/15 bg-white px-3 py-2.5 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
              required
            >
              <option value="">--:-- --</option>
              {ROOM_RESERVATION_TIME_OPTIONS.map((option) => (
                <option key={`res-start-${option.value}`} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] uppercase tracking-[0.18em] text-black/60 dark:text-white/60">End time</span>
            <select
              value={roomReservationForm.endTime}
              onChange={(event) => onFieldChange("endTime", event.target.value)}
              className="w-full appearance-none rounded-lg border border-black/15 bg-white px-3 py-2.5 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
              required
            >
              <option value="">--:-- --</option>
              {ROOM_RESERVATION_TIME_OPTIONS.map((option) => (
                <option key={`res-end-${option.value}`} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 px-1 text-xs text-black/60 dark:text-white/50">
          <p>Start: {formatReservationDateLabel(roomReservationForm.startDate) || "Select date"} · End: {formatReservationDateLabel(roomReservationForm.endDate || roomReservationForm.startDate) || "Select date"}</p>
          <p className="mt-0.5 text-[var(--brand,#b61616)] dark:text-[var(--brand,#ffb3b3)]">{reservationRangePreview || "Choose start/end time and a valid date range."}</p>
        </div>
      </div>
      <div className="space-y-3">
        <form onSubmit={onSubmit} className="space-y-3">
          <select
            value={roomReservationForm.roomId}
            onChange={(event) => onFieldChange("roomId", event.target.value)}
            className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
            required
          >
            <option value="">Select active room</option>
            {activeRoomOptions.map((room) => (
              <option key={`reservation-room-${room.id}`} value={room.id}>{room.name}</option>
            ))}
          </select>
          <input
            value={roomReservationForm.title}
            onChange={(event) => onFieldChange("title", event.target.value)}
            placeholder="Reservation title"
            className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
            required
          />
          <textarea
            value={roomReservationForm.reason}
            onChange={(event) => onFieldChange("reason", event.target.value)}
            rows={2}
            placeholder="Reason"
            className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
            required
          />
          <select
            value={roomReservationForm.assignedStaffClerkUserId}
            onChange={(event) => onFieldChange("assignedStaffClerkUserId", event.target.value)}
            className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
          >
            <option value="">Assign to staff/professor (optional)</option>
            {reservationAssignableStaff.map((item) => (
              <option key={`reservation-staff-${item.id}`} value={item.id}>{item.label}</option>
            ))}
          </select>
          {roomReservationFormError ? <p className="rounded-md border border-[var(--brand,#b61616)]/35 bg-[var(--brand,#b61616)]/10 px-3 py-2 text-sm text-[var(--brand,#ff4b4b)]">{roomReservationFormError}</p> : null}
          {roomReservationFormSuccess ? <p className="rounded-md border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{roomReservationFormSuccess}</p> : null}
          <button
            type="submit"
            disabled={roomReservationSaving || activeRoomOptions.length === 0}
            className="inline-flex w-full items-center justify-center rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60"
          >
            {roomReservationSaving ? "Saving..." : "Create reservation"}
          </button>
        </form>
        {children}
      </div>
    </div>
  )
}
