import React from "react"

import { buildCalendar } from "./staffCalendarHelpers"
import type { AssignmentCourseOption, SelfProfileSnapshot } from "./staffAdminTypes"

const toUtcCalendarStamp = (value: Date) =>
  value
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")

type SelfScheduleEntry = {
  id: string
  dateKey: string
  title: string
  startAt: Date
  endAt: Date
  timeLabel: string
}

type UseStaffProfileScheduleAdminOptions = {
  resolvedSelfProfile: SelfProfileSnapshot
  courseOptions: AssignmentCourseOption[]
}

export function useStaffProfileScheduleAdmin({ resolvedSelfProfile, courseOptions }: UseStaffProfileScheduleAdminOptions) {
  const [profileScheduleMonth, setProfileScheduleMonth] = React.useState(() => new Date())

  const profileCalendarCells = React.useMemo(
    () => buildCalendar(profileScheduleMonth.getFullYear(), profileScheduleMonth.getMonth()),
    [profileScheduleMonth]
  )
  const profileScheduleMonthLabel = React.useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "long",
        year: "numeric",
      }).format(profileScheduleMonth),
    [profileScheduleMonth]
  )

  const profileCourseTitleBySlug = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const item of courseOptions) {
      map.set(item.slug, item.title)
    }
    return map
  }, [courseOptions])

  const selfScheduleEntries = React.useMemo(() => {
    const weekdays = resolvedSelfProfile.teaching.teacherWeekdays
    const startTime = resolvedSelfProfile.teaching.teacherShiftStart
    if (!Array.isArray(weekdays) || weekdays.length === 0 || !startTime) return [] as SelfScheduleEntry[]

    const [startHour, startMinute] = startTime.split(":").map((value) => Number.parseInt(value, 10))
    if (!Number.isFinite(startHour) || !Number.isFinite(startMinute)) return []
    const endTime = resolvedSelfProfile.teaching.teacherShiftEnd
    const [endHourRaw, endMinuteRaw] = endTime ? endTime.split(":").map((value) => Number.parseInt(value, 10)) : [NaN, NaN]
    const fallbackTitle =
      resolvedSelfProfile.teaching.teacherCourseSlugs
        .map((slug) => profileCourseTitleBySlug.get(slug) || slug)
        .filter(Boolean)
        .slice(0, 2)
        .join(" / ") || "Staff shift"
    const timeFormatter = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" })

    return profileCalendarCells
      .filter((cell) => cell.inMonth)
      .flatMap((cell, index) => {
        const baseDate = new Date(`${cell.dateKey}T00:00:00`)
        if (!Number.isFinite(baseDate.getTime())) return []
        if (!weekdays.includes(baseDate.getDay())) return []

        const startAt = new Date(baseDate)
        startAt.setHours(startHour, startMinute, 0, 0)

        const endAt = new Date(baseDate)
        if (Number.isFinite(endHourRaw) && Number.isFinite(endMinuteRaw)) {
          endAt.setHours(endHourRaw, endMinuteRaw, 0, 0)
        } else {
          endAt.setTime(startAt.getTime() + 60 * 60 * 1000)
        }
        if (endAt.getTime() <= startAt.getTime()) {
          endAt.setTime(startAt.getTime() + 60 * 60 * 1000)
        }

        return [
          {
            id: `profile-schedule-${cell.dateKey}-${index}`,
            dateKey: cell.dateKey,
            title: fallbackTitle,
            startAt,
            endAt,
            timeLabel: `${timeFormatter.format(startAt)} - ${timeFormatter.format(endAt)}`,
          },
        ]
      })
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
  }, [profileCalendarCells, profileCourseTitleBySlug, resolvedSelfProfile.teaching.teacherCourseSlugs, resolvedSelfProfile.teaching.teacherShiftEnd, resolvedSelfProfile.teaching.teacherShiftStart, resolvedSelfProfile.teaching.teacherWeekdays])

  const selfScheduleByDay = React.useMemo(() => {
    return selfScheduleEntries.reduce<Record<string, SelfScheduleEntry[]>>((acc, item) => {
      if (!acc[item.dateKey]) acc[item.dateKey] = []
      acc[item.dateKey].push(item)
      return acc
    }, {})
  }, [selfScheduleEntries])

  const selfCalendarGoogleHref = React.useMemo(() => {
    if (selfScheduleEntries.length === 0) return "#"
    const first = selfScheduleEntries[0]
    if (!first) return "#"
    const text = `${first.title} — Staff schedule`
    const details = `Staff schedule for ${resolvedSelfProfile.firstName || "team member"} (${profileScheduleMonthLabel}).`
    const location = resolvedSelfProfile.location || "Palladium Latin Institute"
    const dates = `${toUtcCalendarStamp(first.startAt)}/${toUtcCalendarStamp(first.endAt)}`
    const url = new URL("https://calendar.google.com/calendar/r/eventedit")
    url.searchParams.set("text", text)
    url.searchParams.set("details", details)
    url.searchParams.set("location", location)
    url.searchParams.set("dates", dates)
    return url.toString()
  }, [profileScheduleMonthLabel, resolvedSelfProfile.firstName, resolvedSelfProfile.location, selfScheduleEntries])

  const selfCalendarIcsDataUri = React.useMemo(() => {
    if (selfScheduleEntries.length === 0) return "#"
    const location = resolvedSelfProfile.location || "Palladium Latin Institute"
    const ownerName = `${resolvedSelfProfile.firstName} ${resolvedSelfProfile.lastName}`.trim() || "Staff member"
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//PLI//Staff Calendar//EN"]
    selfScheduleEntries.slice(0, 80).forEach((entry, index) => {
      lines.push("BEGIN:VEVENT")
      lines.push(`UID:staff-${entry.dateKey}-${index}@pli.local`)
      lines.push(`DTSTAMP:${toUtcCalendarStamp(new Date())}`)
      lines.push(`DTSTART:${toUtcCalendarStamp(entry.startAt)}`)
      lines.push(`DTEND:${toUtcCalendarStamp(entry.endAt)}`)
      lines.push(`SUMMARY:${entry.title}`)
      lines.push(`DESCRIPTION:Staff schedule for ${ownerName}`)
      lines.push(`LOCATION:${location}`)
      lines.push("END:VEVENT")
    })
    lines.push("END:VCALENDAR")
    return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\n"))}`
  }, [resolvedSelfProfile.firstName, resolvedSelfProfile.lastName, resolvedSelfProfile.location, selfScheduleEntries])

  return {
    profileScheduleMonth,
    setProfileScheduleMonth,
    profileCalendarCells,
    profileScheduleMonthLabel,
    selfScheduleEntries,
    selfScheduleByDay,
    selfCalendarGoogleHref,
    selfCalendarIcsDataUri,
  }
}
