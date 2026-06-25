import type { CourseEnrollmentData } from "@/components/front/courses/types"

type EnrollCalendarInput = {
  course: CourseEnrollmentData
  serviceLabel: string
  participants: number
  total: number
  date: string
  time: string
  classWord: string
  googleDetails: string
  icsDescription: string
}

export type EnrollCalendarLinks = {
  eventDates: { start: Date; end: Date } | null
  googleCalHref: string
  icsDataUri: string
}

export const toUTCStamp = (date: Date) =>
  `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}T${String(
    date.getUTCHours()
  ).padStart(2, "0")}${String(date.getUTCMinutes()).padStart(2, "0")}${String(date.getUTCSeconds()).padStart(2, "0")}Z`

export const buildEnrollCalendarLinks = ({
  course,
  serviceLabel,
  date,
  time,
  classWord,
  googleDetails,
  icsDescription,
}: EnrollCalendarInput): EnrollCalendarLinks => {
  if (!date || !time) {
    return { eventDates: null, googleCalHref: "#", icsDataUri: "#" }
  }

  const start = new Date(`${date}T${time}:00`)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  const summary = `${course.title} — ${serviceLabel || classWord}`
  const location = course.location?.address || "Palladium Latin Institute"
  const dates = `${toUTCStamp(start)}/${toUTCStamp(end)}`
  const googleUrl = new URL("https://calendar.google.com/calendar/r/eventedit")
  googleUrl.searchParams.set("text", summary)
  googleUrl.searchParams.set("details", googleDetails)
  googleUrl.searchParams.set("location", location)
  googleUrl.searchParams.set("dates", dates)

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PLI//Booking Demo//EN",
    "BEGIN:VEVENT",
    `UID:${Date.now()}@pli.local`,
    `DTSTAMP:${toUTCStamp(new Date())}`,
    `DTSTART:${toUTCStamp(start)}`,
    `DTEND:${toUTCStamp(end)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${icsDescription}`,
    `LOCATION:${location}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]

  return {
    eventDates: { start, end },
    googleCalHref: googleUrl.toString(),
    icsDataUri: `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\n"))}`,
  }
}
