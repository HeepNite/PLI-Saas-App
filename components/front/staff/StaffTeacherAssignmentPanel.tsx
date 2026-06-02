"use client"

import React from "react"
import { Loader2 } from "lucide-react"

import type {
  AssignmentCourseOption,
  StaffUserRow,
} from "./staffAdminTypes"
import { normalizeRecurrenceIntervalInput } from "./staffTeacherAssignmentHelpers"

export type StaffTeacherAssignmentSelection = {
  teacherRows: StaffUserRow[]
  teacherUserId: string
  setTeacherUserId: (value: string) => void
  teacherAssignedUserId: string
  setTeacherAssignedUserId: (value: string) => void
  selectedTeacher: StaffUserRow | null
  assignedTeacher: StaffUserRow | null
}

export type StaffTeacherAssignmentRecurrence = {
  unit: "month" | "year"
  setUnit: (value: "month" | "year") => void
  interval: number
  setInterval: (value: number) => void
  helperText: string
}

export type StaffTeacherAssignmentCourses = {
  options: AssignmentCourseOption[]
  selectedSlugs: string[]
  toggle: (slug: string) => void
}

export type StaffTeacherAssignmentStatus = {
  dirty: boolean
  saving: boolean
  success: string | null
  error: string | null
}

type StaffTeacherAssignmentPanelProps = {
  showStaffOps: boolean
  selection: StaffTeacherAssignmentSelection
  recurrence: StaffTeacherAssignmentRecurrence
  courses: StaffTeacherAssignmentCourses
  status: StaffTeacherAssignmentStatus
  onSave: () => void
}

export default function StaffTeacherAssignmentPanel({
  showStaffOps,
  selection,
  recurrence,
  courses,
  status,
  onSave,
}: StaffTeacherAssignmentPanelProps) {
  if (!showStaffOps) return null

  const {
    teacherRows,
    teacherUserId,
    setTeacherUserId,
    teacherAssignedUserId,
    setTeacherAssignedUserId,
    selectedTeacher,
    assignedTeacher,
  } = selection
  const {
    unit: recurrenceUnit,
    setUnit: setRecurrenceUnit,
    interval: recurrenceInterval,
    setInterval: setRecurrenceInterval,
    helperText: recurrenceHelperText,
  } = recurrence
  const { options: courseOptions, selectedSlugs, toggle: toggleCourse } = courses
  const { dirty, saving, success, error } = status

  return (
    <article className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
      <header className="mb-4">
        <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Staff assignment</p>
        <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Teacher-course assignment</h3>
        <p className="mt-1 text-sm text-black/65 dark:text-white/65">
          Assign teachers to programs and courses. Shift, hours, bonus and operational schedules are managed in Courses/Programs.
        </p>
      </header>

      {teacherRows.length === 0 ? (
        <p className="rounded-md border border-black/10 bg-black/5 px-3 py-2 text-sm text-black/65 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/65">
          No teacher-capable staff found yet.
        </p>
      ) : (
        <div className="rounded-lg border border-black/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.02]">
          <p className="text-xs uppercase tracking-[0.25em] text-black/60 dark:text-white/60">Teaching assignment</p>

          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(220px,0.85fr)] md:items-end">
            <label className="space-y-1">
              <span className="text-xs text-black/65 dark:text-white/65">Selected teacher</span>
              <select
                id="teacherSelect"
                name="teacherSelect"
                value={teacherUserId}
                onChange={(event) => setTeacherUserId(event.target.value)}
                className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
              >
                {teacherRows.map((row) => (
                  <option key={`teacher-row-${row.id}`} value={row.id}>
                    {`${row.firstName} ${row.lastName}`.trim() || row.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-black/65 dark:text-white/65">Assigned teacher (program)</span>
              <select
                name="teacherAssignedUserId"
                value={teacherAssignedUserId}
                onChange={(event) => setTeacherAssignedUserId(event.target.value)}
                className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
              >
                {teacherRows.map((row) => (
                  <option key={`assigned-teacher-${row.id}`} value={row.id}>
                    {`${row.firstName} ${row.lastName}`.trim() || row.email}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-2">
              <label className="space-y-1">
                <span className="text-xs text-black/65 dark:text-white/65">Recurrence</span>
                <select
                  name="teacherRecurrenceUnit"
                  value={recurrenceUnit}
                  onChange={(event) => setRecurrenceUnit(event.target.value === "year" ? "year" : "month")}
                  className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                >
                  <option value="month">Monthly</option>
                  <option value="year">Yearly</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-black/65 dark:text-white/65">Repeat every</span>
                <input
                  name="teacherRecurrenceInterval"
                  type="number"
                  min={1}
                  max={12}
                  step={1}
                  value={recurrenceInterval}
                  onChange={(event) => setRecurrenceInterval(normalizeRecurrenceIntervalInput(event.target.value))}
                  className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-black/60 dark:text-white/60 md:col-span-3">{recurrenceHelperText}</p>
          </div>

          <div className="mt-3 rounded-lg border border-black/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.02]">
            <p className="text-xs uppercase tracking-[0.2em] text-black/60 dark:text-white/60">Program courses</p>
            <p className="mt-1 text-xs text-black/60 dark:text-white/60">
              Add one or many classes to this program template. You can re-assign another teacher later without recreating the program.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {courseOptions.map((course, index) => {
                const active = selectedSlugs.includes(course.slug)
                const shouldSpanFullWidth = courseOptions.length % 2 === 1 && index === courseOptions.length - 1
                return (
                  <button
                    key={`teacher-course-${course.slug}`}
                    type="button"
                    onClick={() => toggleCourse(course.slug)}
                    className={`rounded-xl border px-3 py-3 text-left text-sm transition ${shouldSpanFullWidth ? "col-span-2" : ""} ${
                      active
                        ? "border-[var(--brand,#b61616)]/60 bg-[var(--brand,#b61616)]/12 text-[var(--brand,#ff4b4b)] shadow-[0_10px_24px_-18px_rgba(182,22,22,0.85)]"
                        : "border-black/15 bg-white/80 text-black/80 dark:border-white/15 dark:bg-white/5 dark:text-white/80"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {course.imageUrl ? (
                        <div
                          role="img"
                          aria-label={course.title}
                          className="h-12 w-12 rounded-xl bg-cover bg-center ring-1 ring-black/10 dark:ring-white/10"
                          style={{ backgroundImage: `url("${course.imageUrl}")` }}
                        />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-black/5 text-xs font-semibold uppercase text-black/50 ring-1 ring-black/10 dark:bg-white/10 dark:text-white/55 dark:ring-white/10">
                          {course.title
                            .split(" ")
                            .slice(0, 2)
                            .map((part) => part[0])
                            .join("")}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className={`font-semibold ${active ? "text-[var(--brand,#b61616)] dark:text-[var(--brand,#ff7b7b)]" : "text-black dark:text-white"}`}>
                              {course.title}
                            </p>
                            {course.kindLabel ? (
                              <p className="mt-0.5 text-[11px] uppercase tracking-[0.18em] text-black/45 dark:text-white/45">{course.kindLabel}</p>
                            ) : null}
                          </div>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                              active
                                ? "border-[var(--brand,#b61616)]/40 bg-[var(--brand,#b61616)]/10 text-[var(--brand,#ff4b4b)]"
                                : "border-black/10 bg-black/[0.04] text-black/55 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/55"
                            }`}
                          >
                            {active ? "Selected" : "Available"}
                          </span>
                        </div>

                        {course.scheduleLabel ? (
                          <p className="mt-2 text-xs text-black/65 dark:text-white/65">{course.scheduleLabel}</p>
                        ) : null}
                        {course.description ? (
                          <p className="mt-1 line-clamp-2 text-xs text-black/60 dark:text-white/60">{course.description}</p>
                        ) : null}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-black/60 dark:text-white/60">
              {selectedSlugs.length > 0
                ? `${selectedSlugs.length} classes assigned to this program.`
                : "No classes selected yet."}
            </p>
          </div>

          <div className="mt-3 rounded-lg border border-black/10 bg-white/70 px-3 py-2 text-xs text-black/70 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/70">
            Selected teacher: <span className="font-semibold text-black dark:text-white">{selectedTeacher ? `${selectedTeacher.firstName} ${selectedTeacher.lastName}`.trim() || selectedTeacher.email : "—"}</span> · Assigned teacher:{" "}
            <span className="font-semibold text-black dark:text-white">
              {assignedTeacher ? `${assignedTeacher.firstName} ${assignedTeacher.lastName}`.trim() || assignedTeacher.email : "—"}
            </span>
            {dirty ? <span className="ml-2 font-semibold text-[var(--brand,#b61616)]">Unsaved local changes</span> : null}
          </div>

          <button
            type="button"
            onClick={onSave}
            disabled={saving || !selectedTeacher}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save assignment"
            )}
          </button>
        </div>
      )}

      {success ? (
        <p className="mt-3 rounded-md border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {success}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-md border border-[var(--brand,#b61616)]/35 bg-[var(--brand,#b61616)]/10 px-3 py-2 text-sm text-[var(--brand,#ff4b4b)]">
          {error}
        </p>
      ) : null}
    </article>
  )
}
