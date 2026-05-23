import React from "react"
import { Music2 } from "lucide-react"
import GlassyCard from "@/components/front/courses/GlassyCard"
import type { ActionRequestItem, ActionRequestType, BookingItem } from "../profile-types"
import {
  formatDateTimeInTimeZone,
  getPendingProcessLabel,
  getProcessTypeTone,
} from "../profile-formatters"
import type { AgendaCalendarState } from "../hooks/useAgendaCalendar"

type AgendaCardProps = {
  mobileAgendaOpenDay: AgendaCalendarState["mobileAgendaOpenDay"]
  setMobileAgendaOpenDay: AgendaCalendarState["setMobileAgendaOpenDay"]
  agendaMonth: AgendaCalendarState["agendaMonth"]
  setAgendaMonth: AgendaCalendarState["setAgendaMonth"]
  agendaYear: AgendaCalendarState["agendaYear"]
  setAgendaYear: AgendaCalendarState["setAgendaYear"]
  calendarDays: AgendaCalendarState["calendarDays"]
  agendaMonthLabel: AgendaCalendarState["agendaMonthLabel"]
  agendaYears: AgendaCalendarState["agendaYears"]
  bookingEventsByDay: AgendaCalendarState["bookingEventsByDay"]
  pendingBookingEventsByDay: AgendaCalendarState["pendingBookingEventsByDay"]
  nextBookedClass: AgendaCalendarState["nextBookedClass"]
  pendingBookings: BookingItem[]
  visibleBookings: BookingItem[]
  classRequestsByAttendance: Map<string, ActionRequestItem>
}

export function AgendaCard({
  mobileAgendaOpenDay,
  setMobileAgendaOpenDay,
  agendaMonth,
  setAgendaMonth,
  agendaYear,
  setAgendaYear,
  calendarDays,
  agendaMonthLabel,
  agendaYears,
  bookingEventsByDay,
  pendingBookingEventsByDay,
  nextBookedClass,
  pendingBookings,
  visibleBookings,
  classRequestsByAttendance,
}: AgendaCardProps) {
  return (
    <GlassyCard className="order-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Agenda</p>
          <p className="mt-2 text-sm text-zinc-700 dark:text-white/70">
            Your scheduled classes and real-time slots.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const nextMonth = agendaMonth - 1
              if (nextMonth < 0) {
                setAgendaMonth(11)
                setAgendaYear((prev) => prev - 1)
                return
              }
              setAgendaMonth(nextMonth)
            }}
            className="rounded-full border border-black/10 px-2 py-1 text-xs text-zinc-600 dark:border-white/10 dark:text-white/60"
            aria-label="Previous month"
          >
            ‹
          </button>
          <select
            value={agendaYear}
            onChange={(event) => setAgendaYear(Number(event.target.value))}
            className="rounded-full border border-black/10 bg-transparent px-2 py-1 text-xs text-zinc-600 dark:border-white/10 dark:text-white/60"
          >
            {agendaYears.map((year) => (
              <option key={`agenda-year-${year}`} value={year}>
                {year}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              const nextMonth = agendaMonth + 1
              if (nextMonth > 11) {
                setAgendaMonth(0)
                setAgendaYear((prev) => prev + 1)
                return
              }
              setAgendaMonth(nextMonth)
            }}
            className="rounded-full border border-black/10 px-2 py-1 text-xs text-zinc-600 dark:border-white/10 dark:text-white/60"
            aria-label="Next month"
          >
            ›
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-black/10 bg-black/[0.03] p-4 dark:border-white/10 dark:bg-white/5">
        <div className="flex items-center justify-between text-sm font-semibold">
          <span>{agendaMonthLabel} {agendaYear}</span>
          <button
            type="button"
            onClick={() => {
              const now = new Date()
              setAgendaMonth(now.getMonth())
              setAgendaYear(now.getFullYear())
            }}
            className="rounded-full border border-black/10 px-3 py-1 text-xs text-zinc-600 dark:border-white/10 dark:text-white/60"
          >
            Today
          </button>
        </div>
        <div className="mt-3 grid grid-cols-7 text-[11px] uppercase tracking-[0.18em] text-zinc-500 dark:text-white/40">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="py-2 text-center">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px rounded-lg border border-black/10 bg-black/[0.03] text-sm dark:border-white/10 dark:bg-white/5">
          {calendarDays.map((day, idx) => {
            const dayEvents = day.day > 0 ? bookingEventsByDay.get(day.day) || [] : []
            const pendingDayEvents = day.day > 0 ? pendingBookingEventsByDay.get(day.day) || [] : []
            const pendingTypes = Array.from(
              new Set(
                pendingDayEvents
                  .map((entry) => entry.processType)
                  .filter((type): type is ActionRequestType => Boolean(type))
              )
            )
            const pendingTone = pendingTypes.length === 1 ? getProcessTypeTone(pendingTypes[0]) : getProcessTypeTone(null)
            const pendingProcessLabels = Array.from(new Set(pendingDayEvents.map((entry) => entry.processLabel)))
            const pendingBadgeText =
              pendingProcessLabels.length === 1
                ? pendingProcessLabels[0]
                : `${pendingDayEvents.length} processes in progress`
            const mobileOpen = mobileAgendaOpenDay === day.day && dayEvents.length > 0
            return (
              <div
                key={`cal-${idx}`}
                className={`relative min-h-[72px] border border-black/5 px-2 py-2 text-right text-xs dark:border-white/5 ${
                  day.isCurrent ? "text-zinc-700 dark:text-white/80" : "text-zinc-300 dark:text-white/20"
                }`}
              >
                {day.day > 0 && (
                  <>
                    <div>{day.day}</div>
                    {dayEvents.slice(0, 2).map((entry) => (
                      <div
                        key={`calendar-entry-${entry.id}`}
                        className="group relative mt-2 hidden items-center gap-1 rounded-full bg-[var(--brand,#b61616)]/70 px-2 py-1 text-[10px] text-left text-white sm:inline-flex"
                      >
                        Class {entry.time}
                        <div className="pointer-events-none absolute left-1/2 top-0 z-30 w-44 -translate-x-1/2 -translate-y-[108%] rounded-xl border border-white/10 bg-[#16111a]/95 px-3 py-2 text-left text-[11px] opacity-0 shadow-[0_20px_55px_-30px_rgba(0,0,0,0.8)] transition group-hover:opacity-100">
                          <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--brand,#b61616)]">Class</p>
                          <p className="mt-1 text-white">{entry.courseTitle}</p>
                          <p className="mt-1 text-white/70">{entry.time}</p>
                        </div>
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="mt-1 hidden text-[10px] text-[var(--brand,#b61616)] sm:block">
                        +{dayEvents.length - 2} more
                      </div>
                    )}
                    {pendingDayEvents.length > 0 && (
                      <div
                        className="group relative mt-1 hidden sm:inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px]"
                        style={{
                          borderColor: pendingTone.border,
                          background: pendingTone.bg,
                          color: pendingTone.text,
                        }}
                      >
                        {pendingBadgeText}
                        <div
                          className="pointer-events-none absolute left-1/2 top-0 z-30 w-56 -translate-x-1/2 -translate-y-[108%] rounded-xl border bg-[#16111a]/95 px-3 py-2 text-left text-[11px] opacity-0 shadow-[0_20px_55px_-30px_rgba(0,0,0,0.8)] transition group-hover:opacity-100"
                          style={{ borderColor: pendingTone.border }}
                        >
                          {pendingDayEvents.map((entry) => (
                            <p
                              key={`pending-day-${entry.id}`}
                              className="mt-1 first:mt-0"
                              style={{ color: getProcessTypeTone(entry.processType).text }}
                            >
                              {entry.processLabel} · {entry.courseTitle} · {entry.time}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                    {dayEvents.length > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setMobileAgendaOpenDay((prev) => (prev === day.day ? null : day.day))}
                          className="mt-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand,#b61616)]/80 text-white sm:hidden"
                          aria-label={`View classes for day ${day.day}`}
                        >
                          <Music2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        {mobileOpen && (
                          <div className="absolute left-1/2 top-9 z-30 w-[11rem] -translate-x-1/2 rounded-xl border border-white/10 bg-[#16111a]/95 p-2 text-left shadow-[0_20px_55px_-30px_rgba(0,0,0,0.8)] sm:hidden">
                            {dayEvents.map((entry) => (
                              <div key={`mobile-agenda-${entry.id}`} className="rounded-md px-2 py-1.5">
                                <p className="text-[11px] font-semibold text-white">{entry.courseTitle}</p>
                                <p className="text-[10px] text-white/70">{entry.time}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                    {pendingDayEvents.length > 0 && (
                      <div
                        className="mt-1 sm:hidden text-[10px]"
                        style={{ color: pendingTone.text }}
                      >
                        {pendingBadgeText}
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-sm">
        Next class: <strong>{nextBookedClass.scheduleLabel}</strong>
        {nextBookedClass.courseTitle && (
          <span className="ml-2 text-zinc-600 dark:text-white/65">· {nextBookedClass.courseTitle}</span>
        )}
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
      {visibleBookings.length === 0 && (
        <div className="mt-3 rounded-lg border border-[var(--brand,#b61616)]/40 bg-[rgba(182,22,22,0.1)] px-3 py-3 text-sm">
          You do not have scheduled classes. Would you like to book now?
        </div>
      )}
    </GlassyCard>
  )
}
