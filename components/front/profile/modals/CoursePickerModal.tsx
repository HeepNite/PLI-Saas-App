import React from "react"
import { X } from "lucide-react"
import type { CourseData } from "@/constants/courses"
import {
  getAvailableTimesForCourseDateFromCourse,
  formatTime12h,
  getDateKeyInTimeZone,
} from "@/lib/class-schedule"

type UpcomingClass = {
  course: CourseData
  date: string
  time: string
  dayLabel: string
  timeLabel: string
}

type CoursePickerModalProps = {
  coursePickerOpen: boolean
  setCoursePickerOpen: (open: boolean) => void
  orderedCourses: CourseData[]
  preferredSet: Set<string>
  onClassSelected: (course: CourseData, date: string, time: string) => Promise<void> | void
}

const TZ = "America/New_York"

function getDateLabel(dateIso: string, todayIso: string, tomorrowIso: string): string {
  if (dateIso === todayIso) return "Today"
  if (dateIso === tomorrowIso) return "Tomorrow"
  const [year, month, day] = dateIso.split("-").map(Number)
  const date = new Date(year, month - 1, day)
  return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date)
}

function formatShortDate(dateIso: string): string {
  const [year, month, day] = dateIso.split("-").map(Number)
  const date = new Date(year, month - 1, day)
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date)
}

function addDays(dateIso: string, days: number): string {
  const [year, month, day] = dateIso.split("-").map(Number)
  const d = new Date(year, month - 1, day + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${dd}`
}

export function CoursePickerModal({
  coursePickerOpen,
  setCoursePickerOpen,
  orderedCourses,
  preferredSet,
  onClassSelected,
}: CoursePickerModalProps) {
  const [busy, setBusy] = React.useState(false)
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null)
  const todayIso = getDateKeyInTimeZone(new Date(), TZ)

  const upcomingClasses = React.useMemo<UpcomingClass[]>(() => {
    const tomorrowIso = addDays(todayIso, 1)

    const results: UpcomingClass[] = []

    for (const course of orderedCourses) {
      for (let d = 0; d < 7; d++) {
        const dateIso = addDays(todayIso, d)
        const times = getAvailableTimesForCourseDateFromCourse(course, dateIso)
        for (const time of times) {
          results.push({
            course,
            date: dateIso,
            time,
            dayLabel: getDateLabel(dateIso, todayIso, tomorrowIso),
            timeLabel: formatTime12h(time),
          })
        }
      }
    }

    results.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date)
      if (dateCompare !== 0) return dateCompare
      return a.time.localeCompare(b.time)
    })

    return results
  }, [orderedCourses, todayIso])

  // Group by date
  const groupedByDay = React.useMemo(() => {
    const groups: Array<{ date: string; dayLabel: string; classes: UpcomingClass[] }> = []
    const seen = new Map<string, number>()
    for (const cls of upcomingClasses) {
      if (!seen.has(cls.date)) {
        seen.set(cls.date, groups.length)
        groups.push({ date: cls.date, dayLabel: cls.dayLabel, classes: [] })
      }
      groups[seen.get(cls.date)!].classes.push(cls)
    }
    return groups
  }, [upcomingClasses])

  if (!coursePickerOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm" data-lenis-prevent>
      <div className="relative w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#141017] via-[#0d0b12] to-[#09090d] p-6 shadow-[0_30px_120px_-50px_rgba(0,0,0,0.85)] flex flex-col">
        <button
          className="absolute right-5 top-5 rounded-full border border-white/10 bg-black/40 p-2 text-white/70 hover:text-white"
          onClick={() => setCoursePickerOpen(false)}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Book</p>
          <h3 className="mt-2 text-lg font-semibold text-white">Upcoming classes</h3>
          <p className="mt-1 text-sm text-white/60">Select a class to book.</p>
        </div>

        <div className="mt-6 flex-1 min-h-0 overflow-y-auto pr-1">
          {groupedByDay.length === 0 ? (
            <p className="text-sm text-white/50 text-center py-8">No upcoming classes found in the next 7 days.</p>
          ) : (
            <div className="flex flex-col gap-6">
              {groupedByDay.map((group) => (
                <div key={group.date}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-white/40">
                    {group.dayLabel} · {formatShortDate(group.date)}
                  </p>
                  <div className="flex flex-col gap-2">
                    {group.classes.map((cls) => (
                      <button
                        key={`${cls.course.slug}-${cls.date}-${cls.time}`}
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          const key = `${cls.course.slug}-${cls.date}-${cls.time}`
                          setBusy(true)
                          setSelectedKey(key)
                          try {
                            await onClassSelected(cls.course, cls.date, cls.time)
                          } finally {
                            setBusy(false)
                            setSelectedKey(null)
                          }
                        }}
                        className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition hover:border-[var(--brand,#b61616)]/60 hover:bg-white/10 disabled:opacity-50"
                      >
                        {/* Thumbnail */}
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={cls.course.heroMedia?.image ?? "/images/carousel/_DSC1079.JPG"}
                            alt={cls.course.title}
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.05]"
                          />
                        </div>

                        {/* Time block */}
                        <div className="shrink-0 text-center">
                          <p className="whitespace-nowrap text-base font-bold text-white leading-tight">{cls.timeLabel}</p>
                        </div>

                        {/* Course info */}
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{cls.course.title}</p>
                          <p className="mt-0.5 text-xs text-white/50">{cls.course.level}</p>
                        </div>

                        {/* Loading / Preferred badge */}
                        {busy && selectedKey === `${cls.course.slug}-${cls.date}-${cls.time}` ? (
                          <span className="shrink-0 h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        ) : preferredSet.has(cls.course.slug) ? (
                          <span className="shrink-0 rounded-full border border-[var(--brand,#b61616)]/60 bg-[rgba(182,22,22,0.15)] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--brand,#b61616)]">
                            Preferred
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
