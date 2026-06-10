import React from "react"
import { X } from "lucide-react"
import CalendarPicker from "@/components/front/ui/CalendarPicker"
import { formatDateTimeInTimeZone } from "../profile-formatters"
import type { AssignablePackage, BookingItem, SlotAvailability } from "../profile-types"

type RescheduleModalProps = {
  isOpen: boolean
  selectedBooking: BookingItem | null
  closeChangeClassModal: () => void
  rescheduleStepItems: Array<{ id: 1 | 2 | 3; label: string }>
  rescheduleStep: 1 | 2 | 3
  setRescheduleStep: (step: 1 | 2 | 3) => void
  rescheduleCourseSlug: string
  setRescheduleCourseSlug: (slug: string) => void
  visibleBookings: BookingItem[]
  setSelectedBookingId: React.Dispatch<React.SetStateAction<string>>
  hydrateRescheduleFromBooking: (booking: BookingItem | null) => void
  rescheduleCourseOptions: Array<{ slug: string; title: string }>
  rescheduleScopedBookings: BookingItem[]
  rescheduleDate: string
  setRescheduleDate: (value: string) => void
  setRescheduleTime: (value: string) => void
  setRescheduleError: (error: string | null) => void
  nyTimezone: string
  todayNyDateKey: string
  selectedBookingCourseAvailableWeekdays?: number[]
  isRescheduleDateBlocked: (dateKey: string) => boolean
  getRescheduleDateBlockReason: (dateKey: string) => string | undefined
  availabilityLoading: boolean
  availability: SlotAvailability[]
  rescheduleBookedTimesForSelectedDate: Set<string>
  isCurrentRescheduleSlot: (date: string, time: string) => boolean
  rescheduleTime: string
  continueRescheduleStep: () => void
  submitPrimaryReschedule: () => void
  rescheduleSaving: boolean
  pendingAssignablePackages: AssignablePackage[]
  sourceCourses: Array<{ slug: string; title: string }>
  rescheduleError: string | null
  rescheduleSuccess: string | null
}

export function RescheduleModal({
  isOpen,
  selectedBooking,
  closeChangeClassModal,
  rescheduleStepItems,
  rescheduleStep,
  setRescheduleStep,
  rescheduleCourseSlug,
  setRescheduleCourseSlug,
  visibleBookings,
  setSelectedBookingId,
  hydrateRescheduleFromBooking,
  rescheduleCourseOptions,
  rescheduleScopedBookings,
  rescheduleDate,
  setRescheduleDate,
  setRescheduleTime,
  setRescheduleError,
  nyTimezone,
  todayNyDateKey,
  selectedBookingCourseAvailableWeekdays,
  isRescheduleDateBlocked,
  getRescheduleDateBlockReason,
  availabilityLoading,
  availability,
  rescheduleBookedTimesForSelectedDate,
  isCurrentRescheduleSlot,
  rescheduleTime,
  continueRescheduleStep,
  submitPrimaryReschedule,
  rescheduleSaving,
  pendingAssignablePackages,
  sourceCourses,
  rescheduleError,
  rescheduleSuccess,
}: RescheduleModalProps) {
  if (!isOpen || !selectedBooking) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm" data-lenis-prevent>
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-gradient-to-br from-[#151118] via-[#0d0b12] to-[#09090d] p-5 shadow-[0_30px_120px_-50px_rgba(0,0,0,0.85)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Change class</p>
            <h3 className="mt-2 text-xl font-semibold text-white">Step-by-step reschedule</h3>
            <p className="mt-1 text-sm text-white/65">Reassign your main class and, if you want, continue with package classes.</p>
          </div>
          <button
            type="button"
            onClick={closeChangeClassModal}
            className="rounded-full border border-white/10 bg-black/40 p-2 text-white/70 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {rescheduleStepItems.map((step) => {
              const active = rescheduleStep === step.id
              const done = rescheduleStep > step.id
              return (
                <div
                  key={`reschedule-step-${step.id}`}
                  className={`rounded-lg border px-3 py-2 text-[11px] uppercase tracking-[0.14em] transition ${
                    active
                      ? "border-[var(--brand,#b61616)] bg-[rgba(182,22,22,0.2)] text-white"
                      : done
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                        : "border-white/10 bg-black/20 text-white/55"
                  }`}
                >
                  Step {step.id}
                  <p className="mt-1 text-[10px] normal-case tracking-normal">{step.label}</p>
                </div>
              )
            })}
          </div>
        </div>

        {rescheduleStep === 1 && (
          <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/50">Selected course</p>
                <select
                  value={rescheduleCourseSlug || selectedBooking.courseSlug}
                  onChange={(event) => {
                    const slug = event.target.value
                    setRescheduleCourseSlug(slug)
                    const nextBooking = visibleBookings.find((item) => item.courseSlug === slug) || null
                    if (!nextBooking) return
                    setSelectedBookingId(nextBooking.id)
                    hydrateRescheduleFromBooking(nextBooking)
                  }}
                  className="mt-2 w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
                >
                  {rescheduleCourseOptions.map((course) => (
                    <option key={`reschedule-course-${course.slug}`} value={course.slug}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/50">Booked class</p>
                <select
                  value={selectedBooking.id}
                  onChange={(event) => {
                    const nextId = event.target.value
                    setSelectedBookingId(nextId)
                    const nextBooking = visibleBookings.find((item) => item.id === nextId) || null
                    hydrateRescheduleFromBooking(nextBooking)
                  }}
                  className="mt-2 w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
                >
                  {rescheduleScopedBookings.map((item) => (
                    <option key={`booking-option-${item.id}`} value={item.id}>
                      Booking: {formatDateTimeInTimeZone(item.startsAt)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/70">
              <p className="font-semibold text-white">{selectedBooking.courseTitle}</p>
              <p className="mt-1">Current booking: {formatDateTimeInTimeZone(selectedBooking.startsAt)}</p>
              {selectedBooking.packageLabel && <p className="mt-1">Package: {selectedBooking.packageLabel}</p>}
            </div>

            <p className="mt-4 text-xs uppercase tracking-[0.2em] text-white/50">New time slot</p>
            <div className="mt-2">
              <CalendarPicker
                value={rescheduleDate}
                onChange={(value) => {
                  setRescheduleDate(value)
                  setRescheduleTime("")
                  setRescheduleError(null)
                }}
                timezone={nyTimezone}
                minDate={todayNyDateKey}
                availableWeekdays={selectedBookingCourseAvailableWeekdays}
                isDateDisabled={isRescheduleDateBlocked}
                getDateDisabledReason={getRescheduleDateBlockReason}
                allowClear
                className="bg-white/5"
              />
            </div>
            <div className="mt-3">
              <p className="text-xs text-white/50">Time</p>
              {availabilityLoading ? (
                <div className="mt-2 h-10 animate-pulse rounded-md border border-white/10 bg-white/5" />
              ) : availability.length > 0 ? (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {availability.map((slot) => {
                    const timeTaken = rescheduleBookedTimesForSelectedDate.has(slot.time)
                    const sameAsCurrent = isCurrentRescheduleSlot(rescheduleDate, slot.time)
                    const isPast = Boolean(slot.isPast)
                    const disabled = slot.isFull || timeTaken || sameAsCurrent || isPast
                    const disabledReason = sameAsCurrent
                      ? "This is already your current booking."
                      : timeTaken
                        ? "That time slot on that day is already taken by another class."
                        : isPast
                          ? "That time slot has already passed."
                          : undefined
                    return (
                      <button
                        key={`reschedule-slot-${slot.time}`}
                        type="button"
                        onClick={() => setRescheduleTime(slot.time)}
                        disabled={disabled}
                        title={disabledReason}
                        className={`rounded-md border px-3 py-2 text-sm transition ${
                          disabled
                            ? "cursor-not-allowed border-white/10 bg-white/5 text-white/35"
                            : rescheduleTime === slot.time
                              ? "border-[var(--brand,#b61616)] bg-[rgba(182,22,22,0.22)] text-white"
                              : "border-white/15 bg-white/5 text-white/80 hover:border-white/35"
                        }`}
                      >
                        <span className="block">{slot.label}</span>
                        <span className="mt-1 block text-[10px] text-white/50">
                          {sameAsCurrent
                            ? "Current"
                            : timeTaken
                              ? "Taken"
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
              ) : (
                <p className="mt-2 text-xs text-white/55">Select a date to view time slots.</p>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={continueRescheduleStep}
                className="rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                disabled={!selectedBooking || !rescheduleDate || !rescheduleTime}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {rescheduleStep === 2 && (
          <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">Confirmation</p>
            <div className="mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-3 text-sm text-white/80">
              <p>
                <span className="text-white/60">Course:</span> {selectedBooking.courseTitle}
              </p>
              <p className="mt-1">
                <span className="text-white/60">Current booking:</span> {formatDateTimeInTimeZone(selectedBooking.startsAt)}
              </p>
              <p className="mt-1">
                <span className="text-white/60">New time slot:</span> {formatDateTimeInTimeZone(`${rescheduleDate}T${rescheduleTime}:00`)}
              </p>
              {selectedBooking.packageLabel && (
                <p className="mt-1">
                  <span className="text-white/60">Package:</span> {selectedBooking.packageLabel}
                </p>
              )}
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setRescheduleStep(1)}
                className="rounded-md border border-white/15 px-4 py-2 text-sm font-semibold text-white/80"
              >
                Back
              </button>
              <button
                type="button"
                onClick={submitPrimaryReschedule}
                disabled={rescheduleSaving}
                className="rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {rescheduleSaving ? "Saving..." : "Confirm main class"}
              </button>
            </div>
          </div>
        )}

        {rescheduleStep === 3 && (
          <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">Pending classes</p>
            <p className="mt-2 text-sm text-white/75">
              {pendingAssignablePackages.length > 0
                ? "These are the package classes you still have left to assign."
                : "You don't have pending credits to assign in active packages."}
            </p>
            {pendingAssignablePackages.length > 0 && (
              <div className="mt-3 max-h-40 space-y-2 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-2">
                {pendingAssignablePackages.map((pkg) => (
                  <div key={`pkg-pending-${pkg.id}`} className="rounded-md border border-white/10 px-3 py-2 text-xs text-white/75">
                    <p className="font-semibold text-white">{pkg.label}</p>
                    <p className="mt-1">Pending: {pkg.isUnlimited ? "Unlimited" : `${pkg.remainingCredits ?? 0} credits`}</p>
                    <p className="mt-1 text-white/60">
                      Course: {sourceCourses.find((course) => course.slug === pkg.courseSlug)?.title || pkg.courseSlug || "No course"}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setRescheduleStep(1)}
                className="rounded-md border border-white/15 px-4 py-2 text-sm font-semibold text-white/80"
              >
                Back
              </button>
              <button
                type="button"
                onClick={closeChangeClassModal}
                className="rounded-md border border-white/15 px-4 py-2 text-sm font-semibold text-white/80"
              >
                Finish
              </button>
              <button
                type="button"
                onClick={() => {
                  closeChangeClassModal()
                  window.setTimeout(() => {
                    document.getElementById("assign-classes-section")?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    })
                  }, 120)
                }}
                disabled={!pendingAssignablePackages.length}
                className="rounded-md border border-white/15 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Assign pending classes
              </button>
            </div>
          </div>
        )}

        {rescheduleError && <p className="mt-3 text-xs text-red-400">{rescheduleError}</p>}
        {rescheduleSuccess && <p className="mt-3 text-xs text-emerald-300">{rescheduleSuccess}</p>}
      </div>
    </div>
  )
}
