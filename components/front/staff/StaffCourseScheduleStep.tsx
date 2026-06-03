import React from "react"
import { Clock3, Star } from "lucide-react"

import {
  COURSE_PUBLICATION_MODE_OPTIONS,
  QUICK_SCHEDULE_SLOT_COUNT,
  SCHEDULE_SHORTCUT_TONES,
  WEEKDAY_LABELS,
  type CoursePublicationMode,
} from "./staffAdminConstants"
import { formatClockLabel, normalizeClockTime } from "./staffAdminFormatters"
import { formatCourseSlotLabel, getCourseSlotKey } from "./staffCourseScheduleHelpers"
import type { CourseFormState, CourseScheduleSlot } from "./staffAdminTypes"

type StaffCourseScheduleStepProps = {
  visible: boolean
  schoolLoading: boolean
  isSpecialEventCourse: boolean
  courseForm: CourseFormState
  setCourseForm: React.Dispatch<React.SetStateAction<CourseFormState>>
  courseRecurringWeekdays: number[]
  toggleCourseRecurringWeekday: (weekday: number) => void
  courseMirrorEnabled: boolean
  setCourseMirrorEnabled: React.Dispatch<React.SetStateAction<boolean>>
  courseMirrorWeekdays: number[]
  setCourseMirrorWeekdays: React.Dispatch<React.SetStateAction<number[]>>
  toggleCourseMirrorWeekday: (weekday: number) => void
  courseScheduleDate: string
  setCourseScheduleDate: React.Dispatch<React.SetStateAction<string>>
  courseScheduleDates: string[]
  setCourseScheduleDates: React.Dispatch<React.SetStateAction<string[]>>
  quickScheduleTimes: string[]
  editingQuickTimeIndex: number | null
  quickTimeDraft: string
  setQuickTimeDraft: React.Dispatch<React.SetStateAction<string>>
  setEditingQuickTimeIndex: React.Dispatch<React.SetStateAction<number | null>>
  startEditingQuickTime: (index: number) => void
  commitQuickTimeEdit: () => void
  courseScheduleTime: string
  setCourseScheduleTime: React.Dispatch<React.SetStateAction<string>>
  scheduleTimePickerOpen: boolean
  setScheduleTimePickerOpen: React.Dispatch<React.SetStateAction<boolean>>
  scheduleTimePickerRef: React.RefObject<HTMLDivElement | null>
  scheduleTimeOptions: string[]
  scheduleSlotTimeUsage: Map<string, number>
  scheduleTimeCourseUsage: Map<string, number>
  addCourseScheduleSlot: () => void
  removeCourseScheduleSlot: (slotKey: string) => void
  courseScheduleSlots: CourseScheduleSlot[]
  regularScheduleWarningMessage: string | null
  courseRepeatAllMonth: boolean
  setCourseRepeatAllMonth: React.Dispatch<React.SetStateAction<boolean>>
  courseRecurrenceMode: "indefinite" | "until_date"
  setCourseRecurrenceMode: React.Dispatch<React.SetStateAction<"indefinite" | "until_date">>
  courseRecurrenceEndsAt: string
  setCourseRecurrenceEndsAt: React.Dispatch<React.SetStateAction<string>>
}

export default function StaffCourseScheduleStep({
  visible,
  schoolLoading,
  isSpecialEventCourse,
  courseForm,
  setCourseForm,
  courseRecurringWeekdays,
  toggleCourseRecurringWeekday,
  courseMirrorEnabled,
  setCourseMirrorEnabled,
  courseMirrorWeekdays,
  setCourseMirrorWeekdays,
  toggleCourseMirrorWeekday,
  courseScheduleDate,
  setCourseScheduleDate,
  courseScheduleDates,
  setCourseScheduleDates,
  quickScheduleTimes,
  editingQuickTimeIndex,
  quickTimeDraft,
  setQuickTimeDraft,
  setEditingQuickTimeIndex,
  startEditingQuickTime,
  commitQuickTimeEdit,
  courseScheduleTime,
  setCourseScheduleTime,
  scheduleTimePickerOpen,
  setScheduleTimePickerOpen,
  scheduleTimePickerRef,
  scheduleTimeOptions,
  scheduleSlotTimeUsage,
  scheduleTimeCourseUsage,
  addCourseScheduleSlot,
  removeCourseScheduleSlot,
  courseScheduleSlots,
  regularScheduleWarningMessage,
  courseRepeatAllMonth,
  setCourseRepeatAllMonth,
  courseRecurrenceMode,
  setCourseRecurrenceMode,
  courseRecurrenceEndsAt,
  setCourseRecurrenceEndsAt,
}: StaffCourseScheduleStepProps) {
  if (!visible) return null

  return (
    <div className="space-y-5">
        <div>
          {isSpecialEventCourse ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 dark:border-amber-400/35 dark:bg-amber-500/10">
              <p className="text-[11px] uppercase tracking-[0.2em] text-amber-300">Special event mode</p>
              <p className="mt-1 text-xs text-amber-100/90">
                This course uses unique dates. The weekly builder is disabled and slots are loaded from the calendar.
              </p>
            </div>
          ) : (
            <div>
              <div className="px-1 py-1.5">
                <p className="text-[11px] uppercase tracking-[0.2em] text-black/60 dark:text-white/60">1) Select days</p>
                <div className="mt-1 grid grid-cols-7 gap-1.5">
                  {WEEKDAY_LABELS.map((label, weekday) => {
                    const active = courseRecurringWeekdays.includes(weekday)
                    return (
                      <button
                        key={`course-weekday-toggle-${weekday}`}
                        type="button"
                        onClick={() => toggleCourseRecurringWeekday(weekday)}
                        className={`h-11 rounded-md border text-sm font-semibold transition ${
                          active
                            ? "border-[var(--brand,#b61616)]/70 bg-[var(--brand,#b61616)]/20 text-[var(--brand,#ff4b4b)]"
                            : "border-black/20 text-black/70 hover:border-[var(--brand,#b61616)]/45 dark:border-white/20 dark:text-white/70"
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
                <p className="mt-1 text-xs text-black/55 dark:text-white/55">
                  Selected: {courseRecurringWeekdays.length}
                </p>
              </div>

              {courseRecurringWeekdays.length === 1 ? (
                <div className="px-1 py-1.5 xl:border-l xl:border-black/10 xl:pl-3 dark:xl:border-white/10">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-black/60 dark:text-white/60">
                    2) Repeat this slot on other days?
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCourseMirrorEnabled(true)}
                      className={`h-11 rounded-md border px-3 text-sm font-semibold ${
                        courseMirrorEnabled
                          ? "border-[var(--brand,#b61616)]/70 bg-[var(--brand,#b61616)]/15 text-[var(--brand,#ff4b4b)]"
                          : "border-black/20 text-black/70 dark:border-white/20 dark:text-white/70"
                      }`}
                    >
                      Yes, repeat
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCourseMirrorEnabled(false)
                        setCourseMirrorWeekdays([])
                      }}
                      className={`h-11 rounded-md border px-3 text-sm font-semibold ${
                        !courseMirrorEnabled
                          ? "border-[var(--brand,#b61616)]/70 bg-[var(--brand,#b61616)]/15 text-[var(--brand,#ff4b4b)]"
                          : "border-black/20 text-black/70 dark:border-white/20 dark:text-white/70"
                      }`}
                    >
                      No
                    </button>
                  </div>
                  {courseMirrorEnabled ? (
                    <div className="mt-2 grid grid-cols-7 gap-1.5">
                      {WEEKDAY_LABELS.map((label, weekday) => {
                        const disabled = courseRecurringWeekdays.includes(weekday)
                        const active = courseMirrorWeekdays.includes(weekday)
                        return (
                          <button
                            key={`mirror-weekday-${weekday}`}
                            type="button"
                            onClick={() => toggleCourseMirrorWeekday(weekday)}
                            disabled={disabled}
                            className={`h-9 rounded-md border text-xs font-semibold transition ${
                              active
                                ? "border-[var(--brand,#b61616)]/70 bg-[var(--brand,#b61616)]/15 text-[var(--brand,#ff4b4b)]"
                                : "border-black/20 text-black/70 dark:border-white/20 dark:text-white/70"
                            } ${disabled ? "cursor-not-allowed opacity-35" : ""}`}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}

          <div className="space-y-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-black/60 dark:text-white/60">
              {isSpecialEventCourse
                ? "2) Time slot for event dates · Shortcuts (editable)"
                : "3) Time slot for selected days · Shortcuts (editable)"}
            </p>
            {isSpecialEventCourse ? (
              <div className="mt-3 rounded-md border border-black/10 bg-black/[0.02] p-2.5 dark:border-white/10 dark:bg-white/[0.02]">
                <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-black/55 dark:text-white/55">Event dates</p>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <input
                    type="date"
                    value={courseScheduleDate}
                    onChange={(event) => setCourseScheduleDate(event.target.value)}
                    className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const date = courseScheduleDate.trim()
                      if (!date) return
                      setCourseScheduleDates((prev) => [...new Set([...prev, date])].sort())
                      setCourseScheduleDate("")
                    }}
                    className="rounded-md border border-[var(--brand,#b61616)]/55 bg-[var(--brand,#b61616)]/10 px-3 py-2 text-sm font-semibold text-[var(--brand,#ff4b4b)]"
                  >
                    Add date
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {courseScheduleDates.length === 0 ? (
                    <span className="text-xs text-black/55 dark:text-white/55">No dates selected.</span>
                  ) : (
                    courseScheduleDates.map((date) => (
                      <button
                        key={`special-event-date-chip-${date}`}
                        type="button"
                        onClick={() => setCourseScheduleDates((prev) => prev.filter((item) => item !== date))}
                        className="rounded-full border border-[var(--brand,#b61616)]/35 bg-[var(--brand,#b61616)]/10 px-2 py-0.5 text-xs text-[var(--brand,#ff4b4b)]"
                      >
                        {date} ×
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : null}
            <div className="mt-4">
              <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {quickScheduleTimes.slice(0, QUICK_SCHEDULE_SLOT_COUNT).map((time, index) => {
                  const isEditing = editingQuickTimeIndex === index
                  if (isEditing) {
                    return (
                      <div
                        key={`quick-time-edit-${index}`}
                        className="h-[6.5rem] w-full rounded-md border border-[var(--brand,#b61616)]/35 bg-[var(--brand,#b61616)]/10 p-2"
                      >
                        <input
                          id={`quick-time-edit-${index}`}
                          name={`quickTimeEdit${index}`}
                          type="time"
                          value={quickTimeDraft}
                          onChange={(event) => setQuickTimeDraft(event.target.value)}
                          className="h-7 w-full rounded border border-black/20 bg-white/85 px-1.5 text-[11px] text-black outline-none dark:border-white/20 dark:bg-white/10 dark:text-white"
                        />
                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={commitQuickTimeEdit}
                            className="rounded border border-black/20 px-1.5 py-0.5 text-[10px] font-semibold text-black/80 dark:border-white/20 dark:text-white/80"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingQuickTimeIndex(null)
                              setQuickTimeDraft("")
                            }}
                            className="rounded border border-black/20 px-1.5 py-0.5 text-[10px] text-black/70 dark:border-white/20 dark:text-white/70"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )
                  }
                  const normalizedTime = normalizeClockTime(time)
                  const isActive = normalizedTime === normalizeClockTime(courseScheduleTime)
                  const usageCount = normalizedTime ? scheduleSlotTimeUsage.get(normalizedTime) || 0 : 0
                  const usageCourseCount = normalizedTime ? scheduleTimeCourseUsage.get(normalizedTime) || 0 : 0
                  const isMostUsed = usageCount > 3 || usageCourseCount > 3
                  const usageBadgeLabel =
                    usageCourseCount > 0
                      ? `${usageCourseCount} course${usageCourseCount === 1 ? "" : "s"}`
                      : usageCount > 0
                        ? `${usageCount} uso${usageCount === 1 ? "" : "s"}`
                        : "No usage"
                  const usageBadgeTone =
                    usageCourseCount > 0
                      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                      : usageCount > 0
                        ? "border-[var(--brand,#b61616)]/45 bg-[var(--brand,#b61616)]/18 text-[var(--brand,#ff8a8a)]"
                        : "border-black/20 bg-white/60 text-black/60 dark:border-white/20 dark:bg-white/5 dark:text-white/60"
                  return (
                    <div
                      key={`quick-time-${time}-${index}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => normalizedTime && setCourseScheduleTime(normalizedTime)}
                      onKeyDown={(event) => {
                        if (!normalizedTime) return
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          setCourseScheduleTime(normalizedTime)
                        }
                      }}
                      className={`h-[6.5rem] w-full cursor-pointer rounded-md border p-2 transition ${SCHEDULE_SHORTCUT_TONES[index % SCHEDULE_SHORTCUT_TONES.length]} ${
                        isActive
                          ? "border-[var(--brand,#b61616)]/70 shadow-[0_0_0_1px_rgba(182,22,22,0.35)]"
                          : "border-black/20 dark:border-white/20"
                      }`}
                    >
                      <div className="flex h-full flex-col text-center">
                        <div className="flex items-center justify-center gap-2.5">
                          <Star
                            className={`h-3 w-3 ${
                              isMostUsed
                                ? "fill-current text-[var(--brand,#ff4b4b)]"
                                : "text-black/35 dark:text-white/35"
                            }`}
                          />
                          <span
                            className={`inline-flex max-w-[82px] items-center justify-center truncate rounded-full border px-1.5 py-0.5 text-[9px] font-medium leading-none ${usageBadgeTone}`}
                            title={usageBadgeLabel}
                          >
                            {usageBadgeLabel}
                          </span>
                          <Star
                            className={`h-3 w-3 ${
                              isMostUsed
                                ? "fill-current text-[var(--brand,#ff4b4b)]"
                                : "text-black/35 dark:text-white/35"
                            }`}
                          />
                        </div>
                        <div className="my-auto flex items-center justify-center">
                          <span className="text-[1.12rem] font-bold leading-none text-black dark:text-white">{formatClockLabel(time)}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            startEditingQuickTime(index)
                          }}
                          className="w-full rounded-md border border-black/20 bg-black/5 px-1.5 py-0.5 text-center text-[9px] font-semibold uppercase tracking-[0.09em] text-black/70 transition hover:border-[var(--brand,#b61616)]/50 hover:bg-[var(--brand,#b61616)]/10 hover:text-black dark:border-white/20 dark:bg-white/[0.04] dark:text-white/70 dark:hover:text-white"
                          title="Edit time slot"
                          aria-label="Edit time slot"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-5">
            <div>
              <div ref={scheduleTimePickerRef} className="relative grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <button
                  type="button"
                  onClick={() => setScheduleTimePickerOpen((prev) => !prev)}
                  className="flex w-full items-center justify-between border-b border-black/15 px-1 py-2 text-left text-sm text-black outline-none transition hover:border-[var(--brand,#b61616)] dark:border-white/15 dark:text-white"
                >
                  <span>{formatClockLabel(courseScheduleTime)}</span>
                  <Clock3 className="h-4 w-4 text-black/55 dark:text-white/55" />
                </button>
                <button
                  type="button"
                  onClick={addCourseScheduleSlot}
                  className="rounded-md border border-[var(--brand,#b61616)]/55 bg-[var(--brand,#b61616)]/10 px-3 py-2 text-sm font-semibold text-[var(--brand,#ff4b4b)]"
                >
                  {isSpecialEventCourse
                    ? courseScheduleDates.length > 1
                      ? "Add event slots"
                      : "Add event slot"
                    : courseRecurringWeekdays.length > 0 || courseScheduleDates.length > 1
                      ? "Add slots"
                      : "Add slot"}
                </button>
                {scheduleTimePickerOpen ? (
                  <div className="absolute left-0 top-[calc(100%+0.45rem)] z-30 w-full rounded-md border border-black/10 bg-white/95 p-2 shadow-xl dark:border-white/10 dark:bg-[#141821]/95">
                    <div className="grid max-h-48 grid-cols-3 gap-1 overflow-y-auto sm:grid-cols-4">
                      {scheduleTimeOptions.map((option) => {
                        const active = normalizeClockTime(courseScheduleTime) === option
                        return (
                          <button
                            key={`schedule-time-option-${option}`}
                            type="button"
                            onClick={() => {
                              setCourseScheduleTime(option)
                              setScheduleTimePickerOpen(false)
                            }}
                            className={`rounded-md border px-2 py-1 text-xs font-semibold transition ${
                              active
                                ? "border-[var(--brand,#b61616)]/70 bg-[var(--brand,#b61616)]/15 text-[var(--brand,#ff4b4b)]"
                                : "border-black/15 text-black/80 hover:border-[var(--brand,#b61616)]/50 dark:border-white/15 dark:text-white/80"
                            }`}
                          >
                            {formatClockLabel(option)}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
              {!isSpecialEventCourse && regularScheduleWarningMessage ? (
                <div className="mt-2 rounded-md border border-amber-500/35 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-200">
                  {regularScheduleWarningMessage}
                </div>
              ) : null}
              <div className="mt-3 max-h-52 space-y-1.5 overflow-y-auto text-xs">
                {schoolLoading ? (
                  <div className="space-y-1.5 animate-pulse">
                    <div className="h-7 rounded-md bg-black/10 dark:bg-white/10" />
                    <div className="h-7 rounded-md bg-black/10 dark:bg-white/10" />
                    <div className="h-7 rounded-md bg-black/10 dark:bg-white/10" />
                  </div>
                ) : courseScheduleSlots.length === 0 ? (
                  <p className="text-black/60 dark:text-white/60">No slots selected yet.</p>
                ) : (
                  courseScheduleSlots.map((slot) => {
                    const slotKey = getCourseSlotKey(slot)
                    return (
                      <div
                        key={`course-slot-${slotKey}`}
                        className={`flex items-center justify-between gap-2 px-1 py-1 ${
                          slot.date
                            ? "text-amber-100"
                            : "text-black/80 dark:text-white/80"
                        }`}
                      >
                        <span>{formatCourseSlotLabel(slot)}</span>
                        <button
                          type="button"
                          onClick={() => removeCourseScheduleSlot(slotKey)}
                          className="rounded px-1.5 py-0.5 text-[11px] text-black/65 transition hover:text-[var(--brand,#ff4b4b)] dark:text-white/65"
                        >
                          Remove
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
            <div className="min-w-0">
              {isSpecialEventCourse ? (
                <div className="rounded-lg border border-[var(--brand,#b61616)]/25 bg-[var(--brand,#b61616)]/8 p-2.5">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--brand,#ff8a8a)]">Priority rule</p>
                  <p className="mt-1 text-xs text-[var(--brand,#ffd0d0)]">
                    Special events have priority over regular classes. If there is a conflict, the regular schedule continues on the next available day.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-black/10 bg-white/65 p-2.5 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-black/60 dark:text-white/60">4) Repetition and validity</p>
                  <label className="mt-1 inline-flex items-center gap-2 text-xs text-black/75 dark:text-white/75">
                    <input
                      type="checkbox"
                      checked={courseRepeatAllMonth}
                      onChange={(event) => setCourseRepeatAllMonth(event.target.checked)}
                    />
                    Repeat for the entire visible month
                  </label>
                  <div className="mt-2 grid gap-2">
                    <select
                      name="courseRecurrenceMode"
                      value={courseRecurrenceMode}
                      onChange={(event) => setCourseRecurrenceMode(event.target.value === "until_date" ? "until_date" : "indefinite")}
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    >
                      <option value="indefinite">Indefinite</option>
                      <option value="until_date">With expiration date</option>
                    </select>
                    <input
                      name="courseRecurrenceEndsAt"
                      type="date"
                      value={courseRecurrenceEndsAt}
                      onChange={(event) => setCourseRecurrenceEndsAt(event.target.value)}
                      disabled={courseRecurrenceMode !== "until_date"}
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] disabled:opacity-45 dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                  </div>
                  <div className="mt-4 border-t border-black/10 pt-4 dark:border-white/10">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-black/60 dark:text-white/60">5) Publication status</p>
                    <div className="mt-2 grid gap-2">
                      <select
                        name="coursePublicationMode"
                        value={courseForm.publicationMode}
                        onChange={(event) =>
                          setCourseForm((prev) => ({
                            ...prev,
                            publicationMode: event.target.value as CoursePublicationMode,
                            launchDate: event.target.value === "launch_date" ? prev.launchDate : "",
                          }))
                        }
                        className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                      >
                        {COURSE_PUBLICATION_MODE_OPTIONS.map((option) => (
                          <option key={`course-publication-mode-${option.value}`} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {courseForm.publicationMode === "launch_date" ? (
                        <input
                          name="courseLaunchDate"
                          type="date"
                          value={courseForm.launchDate}
                          onChange={(event) => setCourseForm((prev) => ({ ...prev, launchDate: event.target.value }))}
                          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                        />
                      ) : (
                        <div className="rounded-md border border-black/10 bg-black/[0.03] px-3 py-2 text-xs text-black/60 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/60">
                          {courseForm.publicationMode === "coming_soon"
                            ? "Course will appear as coming soon."
                            : "Course will publish immediately after save."}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
    </div>
  )
}
