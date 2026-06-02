import React from "react"

import type { ScheduleEvent } from "./staffAdminTypes"
import { buildCalendar, monthKey } from "./staffCalendarHelpers"

type UseStaffScheduleAdminInput = {
  canAccessSchoolNav: boolean
  ensureMinimumLoadingTime: (startedAt: number) => Promise<void>
  handleStaffAuthFailure: (status: number) => boolean
}

export const useStaffScheduleAdmin = ({
  canAccessSchoolNav,
  ensureMinimumLoadingTime,
  handleStaffAuthFailure,
}: UseStaffScheduleAdminInput) => {
  const [scheduleMonth, setScheduleMonth] = React.useState(() => new Date())
  const [scheduleLoading, setScheduleLoading] = React.useState(false)
  const [scheduleEventsByDay, setScheduleEventsByDay] = React.useState<Record<string, ScheduleEvent[]>>({})

  const fetchSchedule = React.useCallback(async (month: Date) => {
    const startedAt = Date.now()
    setScheduleLoading(true)
    try {
      const url = new URL("/api/staff/schedule", window.location.origin)
      url.searchParams.set("month", monthKey(month))
      const res = await fetch(url.toString(), { headers: { "Content-Type": "application/json" } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        return
      }
      setScheduleEventsByDay((data?.eventsByDay as Record<string, ScheduleEvent[]>) || {})
    } catch {
      setScheduleEventsByDay({})
    } finally {
      await ensureMinimumLoadingTime(startedAt)
      setScheduleLoading(false)
    }
  }, [ensureMinimumLoadingTime, handleStaffAuthFailure])

  React.useEffect(() => {
    if (!canAccessSchoolNav) return
    void fetchSchedule(scheduleMonth)
  }, [canAccessSchoolNav, fetchSchedule, scheduleMonth])

  const calendarCells = React.useMemo(
    () => buildCalendar(scheduleMonth.getFullYear(), scheduleMonth.getMonth()),
    [scheduleMonth]
  )

  const scheduleMonthLabel = React.useMemo(
    () => new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
    }).format(scheduleMonth),
    [scheduleMonth]
  )

  const goToPreviousMonth = React.useCallback(() => {
    setScheduleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }, [])

  const goToNextMonth = React.useCallback(() => {
    setScheduleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }, [])

  return {
    scheduleMonth,
    scheduleLoading,
    scheduleEventsByDay,
    calendarCells,
    scheduleMonthLabel,
    fetchSchedule,
    goToPreviousMonth,
    goToNextMonth,
  }
}
