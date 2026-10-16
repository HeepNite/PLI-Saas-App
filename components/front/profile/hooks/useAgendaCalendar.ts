import React from "react"
import type { ActionRequestItem, ActionRequestType, ActivityStats, BookingItem } from "../profile-types"
import { formatDateTimeInTimeZone, getPendingProcessLabel } from "../profile-formatters"
import { getDateKeyInTimeZone, getTodayNewYork } from "@/lib/class-schedule"

type CalendarDay = { day: number; isCurrent: boolean }
type BookingEvent = { id: string; time: string; courseTitle: string }
type PendingBookingEvent = BookingEvent & { processLabel: string; processType: ActionRequestType | null }

type UseAgendaCalendarParams = {
  visibleBookings: BookingItem[]
  pendingBookings: BookingItem[]
  classRequestsByAttendance: Map<string, ActionRequestItem>
  activityStats: ActivityStats
}

export type AgendaCalendarState = {
  mobileAgendaOpenDay: number | null
  setMobileAgendaOpenDay: React.Dispatch<React.SetStateAction<number | null>>
  agendaMonth: number
  setAgendaMonth: React.Dispatch<React.SetStateAction<number>>
  agendaYear: number
  setAgendaYear: React.Dispatch<React.SetStateAction<number>>
  calendarDays: CalendarDay[]
  agendaMonthLabel: string
  agendaYears: number[]
  bookingEventsByDay: Map<number, BookingEvent[]>
  pendingBookingEventsByDay: Map<number, PendingBookingEvent[]>
  nextBookedClass: { scheduleLabel: string; courseTitle: string }
}

const buildCalendar = (year: number, monthIndex: number): CalendarDay[] => {
  const firstDay = new Date(Date.UTC(year, monthIndex, 1))
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0))
  const startWeekday = firstDay.getUTCDay()
  const totalDays = lastDay.getUTCDate()
  const days: CalendarDay[] = []
  for (let i = 0; i < startWeekday; i += 1) {
    days.push({ day: 0, isCurrent: false })
  }
  for (let day = 1; day <= totalDays; day += 1) {
    days.push({ day, isCurrent: true })
  }
  while (days.length % 7 !== 0) {
    days.push({ day: 0, isCurrent: false })
  }
  return days
}

export function useAgendaCalendar({
  visibleBookings,
  pendingBookings,
  classRequestsByAttendance,
}: UseAgendaCalendarParams): AgendaCalendarState {
  const currentNewYorkDate = getTodayNewYork().split("-").map(Number)
  const [mobileAgendaOpenDay, setMobileAgendaOpenDay] = React.useState<number | null>(null)
  const [agendaMonth, setAgendaMonth] = React.useState(() => currentNewYorkDate[1] - 1)
  const [agendaYear, setAgendaYear] = React.useState(() => currentNewYorkDate[0])

  const calendarDays = React.useMemo(() => buildCalendar(agendaYear, agendaMonth), [agendaYear, agendaMonth])
  const agendaMonthLabel = React.useMemo(() => {
    const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" })
      .format(new Date(Date.UTC(agendaYear, agendaMonth, 1)))
    return monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)
  }, [agendaMonth, agendaYear])
  const agendaYears = React.useMemo(() => {
    const current = Number(getTodayNewYork().slice(0, 4))
    return Array.from({ length: 7 }, (_, index) => current - 1 + index)
  }, [])
  const bookingEventsByDay = React.useMemo(() => {
    const grouped = new Map<number, BookingEvent[]>()
    for (const booking of visibleBookings) {
      const startsAt = new Date(booking.startsAt)
      if (Number.isNaN(startsAt.getTime())) continue
      const [year, month, day] = getDateKeyInTimeZone(startsAt).split("-").map(Number)
      if (year !== agendaYear || month - 1 !== agendaMonth) continue
      const list = grouped.get(day) || []
      list.push({
        id: booking.id,
        time: formatDateTimeInTimeZone(startsAt, { hour: "numeric", minute: "2-digit" }),
        courseTitle: booking.courseTitle,
      })
      grouped.set(day, list)
    }
    return grouped
  }, [agendaMonth, agendaYear, visibleBookings])
  const pendingBookingEventsByDay = React.useMemo(() => {
    const grouped = new Map<number, PendingBookingEvent[]>()
    for (const booking of pendingBookings) {
      const startsAt = new Date(booking.startsAt)
      if (Number.isNaN(startsAt.getTime())) continue
      const [year, month, day] = getDateKeyInTimeZone(startsAt).split("-").map(Number)
      if (year !== agendaYear || month - 1 !== agendaMonth) continue
      const request = classRequestsByAttendance.get(booking.id)
      const list = grouped.get(day) || []
      list.push({
        id: booking.id,
        time: formatDateTimeInTimeZone(startsAt, { hour: "numeric", minute: "2-digit" }),
        courseTitle: booking.courseTitle,
        processLabel: getPendingProcessLabel(request),
        processType: request?.type || null,
      })
      grouped.set(day, list)
    }
    return grouped
  }, [agendaMonth, agendaYear, classRequestsByAttendance, pendingBookings])
  const nextBookedClass = React.useMemo(() => {
    if (!visibleBookings.length) {
      return { scheduleLabel: "No upcoming class", courseTitle: "" }
    }
    const next = visibleBookings.find((booking) => new Date(booking.startsAt).getTime() >= Date.now()) || visibleBookings[0]
    const startsAt = new Date(next.startsAt)
    if (Number.isNaN(startsAt.getTime())) {
      return { scheduleLabel: "Schedule unavailable", courseTitle: next.courseTitle || "" }
    }
    return {
      scheduleLabel: formatDateTimeInTimeZone(startsAt, {
        weekday: "long",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      }),
      courseTitle: next.courseTitle || "",
    }
  }, [visibleBookings])

  React.useEffect(() => {
    if (mobileAgendaOpenDay === null) return
    const hasEventsForDay = [...visibleBookings, ...pendingBookings].some((booking) => {
      const startsAt = new Date(booking.startsAt)
      if (Number.isNaN(startsAt.getTime())) return false
      const [year, month, day] = getDateKeyInTimeZone(startsAt).split("-").map(Number)
      return year === agendaYear && month - 1 === agendaMonth && day === mobileAgendaOpenDay
    })
    if (!hasEventsForDay) {
      setMobileAgendaOpenDay(null)
    }
  }, [agendaMonth, agendaYear, mobileAgendaOpenDay, pendingBookings, visibleBookings])

  return {
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
  }
}
