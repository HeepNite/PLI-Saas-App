"use client"

import React from "react"
import { Loader2 } from "lucide-react"
import {
  FormState,
  SessionItem,
  CourseOption,
  ATTENDANCE_ACTIONS,
  ATTENDANCE_STATUSES,
  formatAttendanceBadge,
} from "./types"

type AttendanceTabFormProps = {
  form: FormState
  allCourses: CourseOption[]
  coursesLoading: boolean
  availableSessions: SessionItem[]
  sessionsLoading: boolean
  sessionsError: string | null
  visibleAttendanceSessions: SessionItem[]
  selectedCourseSlug: string
  onCourseChange: (slug: string) => void
  onActionChange: (action: FormState["attendanceAction"]) => void
  onStatusChange: (status: string) => void
  onToggleSession: (sessionId: string) => void
}

export function AttendanceTabForm({
  form,
  allCourses,
  coursesLoading,
  sessionsLoading,
  sessionsError,
  visibleAttendanceSessions,
  selectedCourseSlug,
  onCourseChange,
  onActionChange,
  onStatusChange,
  onToggleSession,
}: AttendanceTabFormProps) {
  return (
    <div className="space-y-4">
      <label className="block space-y-1">
        <span className="text-xs text-black/65 dark:text-white/65">Action</span>
        <select
          value={form.attendanceAction}
          onChange={(e) => onActionChange(e.target.value as FormState["attendanceAction"])}
          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
        >
          {ATTENDANCE_ACTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </label>

      {/* Course selector - allows choosing any course */}
      <label className="block space-y-1">
        <span className="text-xs text-black/65 dark:text-white/65">Course</span>
        <select
          value={selectedCourseSlug}
          onChange={(e) => onCourseChange(e.target.value)}
          disabled={coursesLoading}
          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white disabled:opacity-50"
        >
          <option value="">Student&apos;s courses (default)</option>
          {allCourses.map((course) => (
            <option key={course.slug} value={course.slug}>{course.title}</option>
          ))}
        </select>
        <p className="text-[11px] text-black/40 dark:text-white/40">
          Select a specific course or leave empty to show sessions from courses the student has interacted with.
        </p>
      </label>

      {/* Session multi-select */}
      <div className="space-y-1">
        <span className="text-xs text-black/65 dark:text-white/65">
          Sessions ({form.attendanceSessionIds.length} selected)
        </span>
        {sessionsLoading ? (
          <div className="flex items-center gap-2 rounded-md border border-black/10 bg-black/[0.02] px-3 py-6 text-sm text-black/50 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/50">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading sessions...
          </div>
        ) : sessionsError ? (
          <div className="rounded-md border border-[var(--brand,#b61616)]/30 bg-[var(--brand,#b61616)]/5 px-3 py-2 text-sm text-[var(--brand,#b61616)]">
            {sessionsError}
          </div>
        ) : visibleAttendanceSessions.length === 0 ? (
          <div className="rounded-md border border-black/10 bg-black/[0.02] px-3 py-6 text-center text-sm text-black/50 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/50">
            {form.attendanceAction === "add"
              ? "No sessions without existing attendance found in the current date range."
              : "No existing attendance records found in the current date range."}
          </div>
        ) : (
          <div className="max-h-52 overflow-y-auto rounded-md border border-black/15 bg-white dark:border-white/15 dark:bg-white/5">
            {(() => {
              const todayDateStr = new Date().toLocaleDateString()
              return visibleAttendanceSessions.map((session) => {
                const isSelected = form.attendanceSessionIds.includes(session.id)
                const isToday = new Date(session.startsAt).toLocaleDateString() === todayDateStr

                return (
                  <label
                    key={session.id}
                    className={`flex items-start gap-3 border-b border-black/5 px-3 py-2.5 last:border-b-0 transition-colors dark:border-white/5 ${
                      isSelected
                        ? "bg-[var(--brand,#b61616)]/5 dark:bg-[var(--brand,#b61616)]/10"
                        : "hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                    } cursor-pointer`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSession(session.id)}
                      className="mt-0.5 h-4 w-4 rounded border-black/30 text-[var(--brand,#b61616)] focus:ring-[var(--brand,#b61616)] dark:border-white/30"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-medium text-black dark:text-white truncate">
                          {session.title || session.courseSlug}
                        </span>
                        {isToday && (
                          <span className="inline-flex items-center rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                            Today
                          </span>
                        )}
                        {session.existingAttendanceStatus && (
                          <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                            session.existingAttendancePaymentSource === "package"
                              ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                              : session.existingAttendancePaymentSource === "dropin" || session.existingAttendanceStatus === "checked_in_no_package"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                              : session.existingAttendanceStatus === "no_show"
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                          }`}>
                            {formatAttendanceBadge(session)}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-black/50 dark:text-white/50">
                        {new Date(session.startsAt).toLocaleString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {session.location ? ` · ${session.location}` : ""}
                        <span className="ml-1.5 text-black/30 dark:text-white/30">
                          {session.id.slice(0, 8)}
                        </span>
                      </div>
                    </div>
                  </label>
                )
              })
            })()}
          </div>
        )}
        {form.attendanceAction === "add" && (
          <p className="text-[11px] text-black/40 dark:text-white/40">
            Sessions with existing attendance are hidden for &quot;add&quot; action.
          </p>
        )}
        {(form.attendanceAction === "remove" || form.attendanceAction === "update") && (
          <p className="text-[11px] text-black/40 dark:text-white/40">
            Only sessions with an existing attendance record are shown.
          </p>
        )}
      </div>

      {form.attendanceAction !== "remove" ? <label className="block space-y-1">
        <span className="text-xs text-black/65 dark:text-white/65">Status</span>
        <select
          value={form.attendanceStatus}
          onChange={(e) => onStatusChange(e.target.value)}
          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
        >
          {ATTENDANCE_STATUSES.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </label> : null}
    </div>
  )
}
