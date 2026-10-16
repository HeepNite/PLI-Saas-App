import React from "react"
import GlassyCard from "@/components/front/courses/GlassyCard"
import CalendarPicker from "@/components/front/ui/CalendarPicker"
import { buildSessionStartsAt, getTodayNewYork } from "@/lib/class-schedule"
import { formatDateTimeInTimeZone } from "../profile-formatters"
import type { ActionRequestItem, AssignablePackage, BookingItem } from "../profile-types"
import type { AssignClassesFlowState } from "../hooks/useAssignClassesFlow"
import type { AgendaCalendarState } from "../hooks/useAgendaCalendar"
import {
  getPendingProcessLabel,
  getProcessTypeTone,
} from "../profile-formatters"

type AssignClassesCardProps = {
  assignPackageId: string
  setAssignPackageId: React.Dispatch<React.SetStateAction<string>>
  assignablePackages: AssignablePackage[]
  todayNyDateKey: string
  assignDate: AssignClassesFlowState["assignDate"]
  setAssignDate: AssignClassesFlowState["setAssignDate"]
  assignTime: AssignClassesFlowState["assignTime"]
  setAssignTime: AssignClassesFlowState["setAssignTime"]
  assignAvailability: AssignClassesFlowState["assignAvailability"]
  assignAvailabilityLoading: AssignClassesFlowState["assignAvailabilityLoading"]
  assignSlots: AssignClassesFlowState["assignSlots"]
  assigning: AssignClassesFlowState["assigning"]
  assignError: AssignClassesFlowState["assignError"]
  setAssignError: AssignClassesFlowState["setAssignError"]
  assignSuccess: AssignClassesFlowState["assignSuccess"]
  setAssignSuccess: AssignClassesFlowState["setAssignSuccess"]
  selectedPackageForAssign: AssignClassesFlowState["selectedPackageForAssign"]
  selectedPackageCourse: AssignClassesFlowState["selectedPackageCourse"]
  selectedPackageAssignmentStats: AssignClassesFlowState["selectedPackageAssignmentStats"]
  assignUnavailableDates: AssignClassesFlowState["assignUnavailableDates"]
  assignBookedTimesForSelectedDate: AssignClassesFlowState["assignBookedTimesForSelectedDate"]
  addAssignSlot: AssignClassesFlowState["addAssignSlot"]
  removeAssignSlot: AssignClassesFlowState["removeAssignSlot"]
  submitAssignClasses: AssignClassesFlowState["submitAssignClasses"]

  // NEW (Change 1 — Calendar Unification)
  agendaState: AgendaCalendarState
  pendingBookings: BookingItem[]
  visibleBookings: BookingItem[]
  classRequestsByAttendance: Map<string, ActionRequestItem>
}

const formatQueuedSlot = (date: string, time: string) => {
  const startsAt = buildSessionStartsAt(date, time)
  return startsAt ? formatDateTimeInTimeZone(startsAt) : `${date} ${time}`
}

function ScheduledClassesCalendar({ agendaState }: { agendaState: AgendaCalendarState }) {
  const {
    mobileAgendaOpenDay,
    setMobileAgendaOpenDay,
    agendaMonth,
    setAgendaMonth,
    agendaYear,
    setAgendaYear,
    calendarDays,
    agendaMonthLabel,
    bookingEventsByDay,
    pendingBookingEventsByDay,
  } = agendaState

  const changeMonth = (delta: number) => {
    const next = new Date(Date.UTC(agendaYear, agendaMonth + delta, 1))
    setAgendaMonth(next.getUTCMonth())
    setAgendaYear(next.getUTCFullYear())
  }

  const showToday = () => {
    const [year, month] = getTodayNewYork().split("-").map(Number)
    setAgendaYear(year)
    setAgendaMonth(month - 1)
  }

  return (
    <div className="mt-3 rounded-xl border border-black/10 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center justify-between gap-2 text-sm font-semibold">
        <span>{agendaMonthLabel} {agendaYear}</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous scheduled classes month" className="rounded-full border border-black/10 px-2 py-1 dark:border-white/10">‹</button>
          <button type="button" onClick={showToday} className="rounded-full border border-black/10 px-2 py-1 text-xs dark:border-white/10">Today</button>
          <button type="button" onClick={() => changeMonth(1)} aria-label="Next scheduled classes month" className="rounded-full border border-black/10 px-2 py-1 dark:border-white/10">›</button>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-7 text-center text-[10px] uppercase tracking-[0.12em] text-zinc-500 dark:text-white/40">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => <span key={label}>{label}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-px rounded-lg border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
        {calendarDays.map((calendarDay, index) => {
          const events = calendarDay.day ? bookingEventsByDay.get(calendarDay.day) || [] : []
          const pendingEvents = calendarDay.day ? pendingBookingEventsByDay.get(calendarDay.day) || [] : []
          const hasDayEvents = events.length > 0 || pendingEvents.length > 0
          const mobileOpen = mobileAgendaOpenDay === calendarDay.day && hasDayEvents
          return (
            <div key={`scheduled-day-${index}`} className="relative min-h-16 bg-white/60 p-1 text-xs dark:bg-[#16111a]/80">
              {calendarDay.isCurrent && (
                <>
                  <button
                    type="button"
                    disabled={!hasDayEvents}
                    onClick={() => setMobileAgendaOpenDay((openDay) => openDay === calendarDay.day ? null : calendarDay.day)}
                    aria-label={hasDayEvents ? `View scheduled classes for day ${calendarDay.day}` : undefined}
                    aria-expanded={hasDayEvents ? mobileOpen : undefined}
                    className="w-full text-right disabled:cursor-default"
                  >
                    {calendarDay.day}
                  </button>
                  {events.map((event) => (
                    <div key={event.id} className="mt-1 rounded bg-[var(--brand,#b61616)]/80 px-1 py-0.5 text-[9px] leading-tight text-white" title={event.courseTitle}>
                      <span className="block truncate">Class {event.time}</span>
                      <span className="block truncate opacity-80">{event.courseTitle}</span>
                    </div>
                  ))}
                  {pendingEvents.map((event) => {
                    const tone = getProcessTypeTone(event.processType)
                    return (
                      <div key={`pending-${event.id}`} className="mt-1 truncate rounded border px-1 py-0.5 text-[9px]" style={{ borderColor: tone.border, background: tone.bg, color: tone.text }}>
                        {event.processLabel}
                      </div>
                    )
                  })}
                  {mobileOpen && (
                    <div className="absolute left-1/2 top-8 z-30 w-44 -translate-x-1/2 rounded-lg border border-white/10 bg-[#16111a] p-2 text-left shadow-xl sm:hidden">
                      {events.map((event) => <p key={`mobile-${event.id}`} className="text-[10px] text-white">{event.courseTitle} · {event.time}</p>)}
                      {pendingEvents.map((event) => (
                        <p key={`mobile-pending-${event.id}`} className="text-[10px] text-white">
                          {event.processLabel} · {event.courseTitle} · {event.time}
                        </p>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function AssignClassesCard({
  assignPackageId,
  setAssignPackageId,
  assignablePackages,
  todayNyDateKey,
  assignDate,
  setAssignDate,
  assignTime,
  setAssignTime,
  assignAvailability,
  assignAvailabilityLoading,
  assignSlots,
  assigning,
  assignError,
  setAssignError,
  assignSuccess,
  setAssignSuccess,
  selectedPackageForAssign,
  selectedPackageCourse,
  selectedPackageAssignmentStats,
  assignUnavailableDates,
  assignBookedTimesForSelectedDate,
  addAssignSlot,
  removeAssignSlot,
  submitAssignClasses,
  agendaState,
  pendingBookings,
  visibleBookings,
  classRequestsByAttendance,
}: AssignClassesCardProps) {
  const { nextBookedClass } = agendaState

  return (
    <GlassyCard id="assign-classes-section" className="order-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Assign classes</p>
          <p className="mt-2 text-sm text-zinc-700 dark:text-white/70">
            Organize your remaining classes with available package time slots.
          </p>
        </div>
        {selectedPackageForAssign && (
          <span className="rounded-full border border-black/10 bg-black/[0.03] px-3 py-1 text-xs text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
            {selectedPackageForAssign.isUnlimited
              ? "Unlimited"
              : `${selectedPackageForAssign.remainingCredits ?? 0} credits`}
          </span>
        )}
      </div>

      {/* Scheduled classes — next class summary + pending processes */}
      <div className="mt-4 rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Scheduled classes</p>
        <p className="mt-2">
          Next class: <strong>{nextBookedClass.scheduleLabel}</strong>
          {nextBookedClass.courseTitle && (
            <span className="ml-2 text-zinc-600 dark:text-white/65">· {nextBookedClass.courseTitle}</span>
          )}
        </p>
        <ScheduledClassesCalendar agendaState={agendaState} />
      </div>
      {pendingBookings.length > 0 && (
        <div className="mt-3 rounded-lg border border-black/10 bg-black/[0.03] px-3 py-3 text-sm dark:border-white/10 dark:bg-white/5">
          <p className="font-semibold text-zinc-800 dark:text-white">Processes for assigned classes</p>
          <div className="mt-2 space-y-2 text-xs">
            {pendingBookings.slice(0, 3).map((booking) => {
              const request = classRequestsByAttendance.get(booking.id)
              const tone = getProcessTypeTone(request?.type)
              return (
                <div
                  key={`pending-booking-inline-${booking.id}`}
                  className="rounded-md border px-2 py-1.5"
                  style={{ borderColor: tone.border, background: tone.bg }}
                >
                  <p style={{ color: tone.text }}>
                    <span className="font-semibold">{getPendingProcessLabel(request)}</span> · {booking.courseTitle} ·{" "}
                    {formatDateTimeInTimeZone(booking.startsAt)}
                  </p>
                </div>
              )
            })}
            {pendingBookings.length > 3 && (
              <p className="text-zinc-700 dark:text-white/65">+{pendingBookings.length - 3} more in progress.</p>
            )}
          </div>
        </div>
      )}
      {visibleBookings.length === 0 && pendingBookings.length === 0 && (
        <div className="mt-3 rounded-lg border border-[var(--brand,#b61616)]/40 bg-[rgba(182,22,22,0.1)] px-3 py-3 text-sm">
          You do not have scheduled classes. Would you like to book now?
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-3">
          <label className="text-xs uppercase tracking-[0.16em] text-zinc-600 dark:text-white/50">Package</label>
          <select
            value={assignPackageId}
            onChange={(event) => setAssignPackageId(event.target.value)}
            className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm text-zinc-900 dark:text-white"
          >
            <option value="">Select a package</option>
            {assignablePackages.map((pkg) => (
              <option key={pkg.id} value={pkg.id}>
                {pkg.label} {pkg.isUnlimited ? "(Unlimited)" : `(${pkg.remainingCredits ?? 0} credits)`}
              </option>
            ))}
          </select>
          {selectedPackageForAssign && (
            <div className="rounded-lg border border-white/10 bg-black/[0.04] px-3 py-2 text-xs text-zinc-700 dark:bg-white/5 dark:text-white/65">
              <p>
                Class:{" "}
                <strong className="text-zinc-900 dark:text-white">
                  {selectedPackageCourse?.title || selectedPackageForAssign.courseSlug || "No class"}
                </strong>
              </p>
              <p className="mt-1">
                Schedule: {selectedPackageCourse?.schedule.day || "According to calendar"}
              </p>
              {selectedPackageAssignmentStats && (
                <div className="mt-2 rounded-md border border-black/10 bg-black/[0.03] px-2 py-2 text-[11px] dark:border-white/10 dark:bg-white/5">
                  <p>
                    Assigned package classes:{" "}
                    <strong className="text-zinc-900 dark:text-white">
                      {selectedPackageAssignmentStats.assigned}
                    </strong>
                  </p>
                  <p className="mt-1">
                    Package classes left to assign:{" "}
                    <strong className="text-zinc-900 dark:text-white">
                      {selectedPackageAssignmentStats.isUnlimited
                        ? "No limit"
                        : selectedPackageAssignmentStats.remaining ?? 0}
                    </strong>
                  </p>
                  {selectedPackageAssignmentStats.queued > 0 && (
                    <p className="mt-1 text-[10px] text-zinc-600 dark:text-white/55">
                      Includes {selectedPackageAssignmentStats.queued} class(es) in &quot;Classes to confirm&quot;.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-600 dark:text-white/50">New time slot</p>
          <div className="mt-3">
            <CalendarPicker
              value={assignDate}
              onChange={(value) => {
                setAssignDate(value)
                setAssignTime("")
                setAssignError(null)
                setAssignSuccess(null)
              }}
              timezone="America/New_York"
              minDate={todayNyDateKey}
              availableWeekdays={selectedPackageCourse?.schedule.availableWeekdays}
              unavailableDates={assignUnavailableDates}
              allowClear
              compact
              className="bg-white/5"
            />
          </div>
          <p className="mt-3 text-xs text-zinc-600 dark:text-white/50">Available time slots</p>
          {assignAvailabilityLoading ? (
            <div className="mt-2 h-10 animate-pulse rounded-md border border-white/10 bg-white/5" />
          ) : assignAvailability.length > 0 ? (
            <div className="mt-2">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {assignAvailability.map((slot) => {
                  const alreadyBooked = assignBookedTimesForSelectedDate.has(slot.time)
                  const isPast = Boolean(slot.isPast)
                  const disabled = slot.isFull || alreadyBooked || isPast
                  return (
                    <button
                      key={`assign-availability-${slot.time}`}
                      type="button"
                      onClick={() => setAssignTime(slot.time)}
                      disabled={disabled}
                      className={`rounded-md border px-2 py-2 text-xs transition ${
                        disabled
                          ? "cursor-not-allowed border-white/10 bg-white/5 text-zinc-500 dark:text-white/35"
                          : assignTime === slot.time
                            ? "border-[var(--brand,#b61616)] bg-[rgba(182,22,22,0.22)] text-zinc-900 dark:text-white"
                            : "border-white/15 bg-white/10 text-zinc-800 dark:bg-white/5 dark:text-white/80 hover:border-white/35"
                      }`}
                    >
                      <span className="block">{slot.label}</span>
                      <span className="mt-1 block text-[10px] text-zinc-500 dark:text-white/55">
                        {alreadyBooked
                          ? "Already booked"
                          : isPast
                            ? "Past time slot"
                            : slot.isFull
                              ? "Full"
                              : `${slot.spotsLeft} spots`}
                      </span>
                    </button>
                  )
                })}
              </div>
              {assignAvailability.every(
                (slot) => slot.isFull || Boolean(slot.isPast) || assignBookedTimesForSelectedDate.has(slot.time)
              ) && (
                <p className="mt-2 text-xs text-zinc-600 dark:text-white/55">
                  No available time slots for that date.
                </p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-xs text-zinc-600 dark:text-white/55">
              Select a package and a date to view time slots.
            </p>
          )}

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={addAssignSlot}
              disabled={!assignDate || !assignTime}
              className="rounded-md border border-[var(--brand,#b61616)]/60 px-3 py-2 text-xs font-semibold text-[var(--brand,#b61616)] disabled:opacity-50"
            >
              Add class
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-600 dark:text-white/50">Classes to confirm</p>
        {assignSlots.length > 0 ? (
          <div className="mt-3 space-y-2">
            {assignSlots.map((slot, idx) => (
              <div
                key={`assign-list-${slot.date}-${slot.time}-${idx}`}
                className="flex items-center justify-between gap-2 rounded-md border border-white/10 bg-black/[0.04] px-3 py-2 text-sm dark:bg-white/5"
              >
                <span>{formatQueuedSlot(slot.date, slot.time)}</span>
                <button
                  type="button"
                  onClick={() => removeAssignSlot(idx)}
                  className="rounded-md border border-white/15 px-2 py-1 text-xs font-semibold text-zinc-700 dark:text-white/80"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-zinc-600 dark:text-white/55">
            You have not added classes for this package yet.
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-zinc-600 dark:text-white/60">
            You earn 2.5 points for assigning this package for the first time.
          </p>
          <button
            type="button"
            onClick={submitAssignClasses}
            disabled={assigning || !assignSlots.length || !assignPackageId}
            className="rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {assigning ? "Assigning..." : "Assign classes"}
          </button>
        </div>
      </div>
      {assignError && <p className="mt-3 text-xs text-red-400">{assignError}</p>}
      {assignSuccess && <p className="mt-3 text-xs text-emerald-300">{assignSuccess}</p>}
    </GlassyCard>
  )
}
