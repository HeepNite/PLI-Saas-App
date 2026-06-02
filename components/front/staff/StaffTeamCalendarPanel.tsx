"use client"

import React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import type { ScheduleEvent } from "./staffAdminTypes"
import { WEEKDAY_LABELS } from "./staffAdminConstants"

type CalendarCell = {
  dateKey: string
  day: number
  inMonth: boolean
}

type StaffTeamCalendarPanelProps = {
  showStaffOps: boolean
  scheduleMonthLabel: string
  scheduleLoading: boolean
  calendarCells: CalendarCell[]
  scheduleEventsByDay: Record<string, ScheduleEvent[]>
  onPreviousMonth: () => void
  onNextMonth: () => void
}

export default function StaffTeamCalendarPanel({
  showStaffOps,
  scheduleMonthLabel,
  scheduleLoading,
  calendarCells,
  scheduleEventsByDay,
  onPreviousMonth,
  onNextMonth,
}: StaffTeamCalendarPanelProps) {
  if (!showStaffOps) return null

  return (
    <article className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
      <header className="mb-4 flex items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Team calendar</p>
          <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Who is coming and when</h3>
        </div>
        <div className="inline-flex items-center gap-2">
          <button
            type="button"
            onClick={onPreviousMonth}
            className="rounded-md border border-black/20 p-1.5 dark:border-white/20"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-black dark:text-white">{scheduleMonthLabel}</span>
          <button
            type="button"
            onClick={onNextMonth}
            className="rounded-md border border-black/20 p-1.5 dark:border-white/20"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="rounded-xl border border-black/10 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="grid grid-cols-7 gap-2 text-center text-[11px] uppercase tracking-[0.2em] text-black/55 dark:text-white/55">
          {WEEKDAY_LABELS.map((label) => (
            <span key={`weekday-${label}`}>{label}</span>
          ))}
        </div>
        {scheduleLoading ? (
          <div className="mt-2 grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }).map((_, index) => (
              <div
                key={`calendar-skeleton-${index}`}
                className="min-h-[92px] rounded-md border border-black/10 bg-white/60 shimmer dark:border-white/10 dark:bg-white/[0.02]"
              />
            ))}
          </div>
        ) : (
          <div className="mt-2 grid grid-cols-7 gap-2">
            {calendarCells.map((cell, idx) => {
              const events = scheduleEventsByDay[cell.dateKey] || []
              return (
                <div
                  key={`calendar-cell-${cell.dateKey}-${idx}`}
                  className={`min-h-[92px] rounded-md border p-1.5 ${
                    cell.inMonth
                      ? "border-black/10 bg-white/70 dark:border-white/10 dark:bg-white/[0.02]"
                      : "border-black/5 bg-black/[0.02] opacity-60 dark:border-white/5 dark:bg-white/[0.01]"
                  }`}
                >
                  <p className="mb-1 text-right text-xs text-black/70 dark:text-white/70">{cell.day}</p>
                  <div className="space-y-1">
                    {events.slice(0, 2).map((event) => (
                      <div key={`day-event-${event.attendanceId}`} className="group relative">
                        <div className="truncate rounded-full bg-[var(--brand,#b61616)]/90 px-2 py-0.5 text-[11px] text-white">
                          {event.timeLabel}
                        </div>
                        <div className="pointer-events-none absolute left-0 top-full z-30 mt-1 hidden w-72 rounded-md border border-black/15 bg-white p-2 text-xs text-black shadow-xl group-hover:block dark:border-white/15 dark:bg-[#11131a] dark:text-white">
                          <p className="font-semibold">{event.userName}</p>
                          <p className="mt-0.5 text-black/70 dark:text-white/70">{event.courseTitle}</p>
                          <p className="mt-0.5">Time: {event.timeLabel}</p>
                          <p className="mt-0.5">Email: {event.userEmail || "—"}</p>
                          <p className="mt-0.5">Phone: {event.userPhone || "—"}</p>
                          <p className="mt-0.5 capitalize">Status: {event.status.replaceAll("_", " ")}</p>
                        </div>
                      </div>
                    ))}
                    {events.length > 2 ? (
                      <p className="text-[11px] text-black/60 dark:text-white/60">+{events.length - 2} more</p>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </article>
  )
}
