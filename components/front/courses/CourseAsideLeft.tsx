"use client"
import React from "react"
import GlassyCard from "./GlassyCard"
import type { CourseOverviewData } from "./types"
import { demoCourses } from "@/constants/courses"

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const fullDayMap: Record<string, string> = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
}

const normalizeWeekdays = (raw: string) => {
  const abbreviations = raw.match(/\bMon|Tue|Wed|Thu|Fri|Sat|Sun\b/gi)
  if (abbreviations?.length) {
    return Array.from(new Set(abbreviations.map((day) => day[0].toUpperCase() + day.slice(1).toLowerCase())))
  }
  const matches = raw.match(
    /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/gi
  )
  if (!matches?.length) return []
  return Array.from(
    new Set(
      matches.map((day) => {
        const normalized = day[0].toUpperCase() + day.slice(1).toLowerCase()
        return fullDayMap[normalized] || normalized.slice(0, 3)
      })
    )
  )
}

const extractFirstTime = (raw: string) => {
  const match = raw.match(/\d{1,2}:\d{2}/)
  return match ? match[0] : ""
}

const formatTimeShort = (raw: string) => {
  const match = raw.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return raw
  let hours = Number(match[1])
  const minutes = match[2]
  const ampm = hours >= 12 ? "pm" : "am"
  hours = hours % 12
  if (hours === 0) hours = 12
  return `${hours}${minutes === "00" ? "" : `:${minutes}`}${ampm}`
}

const splitTimeLabel = (label: string) => {
  const match = label.match(/^(\d{1,2}(?::\d{2})?)(am|pm)$/i)
  if (!match) return { main: label, suffix: "" }
  return { main: match[1], suffix: match[2].toLowerCase() }
}

export default function CourseAsideLeft({ course }: { course: CourseOverviewData }) {
  const mainInstructor = course.instructors?.[0]
  const otherInstructors = course.instructors?.slice(1) ?? []
  const isKidsCourse = course.slug === "musica-bebes"
  const focusItems = (course.benefits?.length ? course.benefits : course.syllabus ?? []).slice(0, 4)
  const instructorCourses = React.useMemo(() => {
    if (!mainInstructor?.name) return []
    return demoCourses.filter((item) =>
      item.instructors?.some((ins) => ins.name === mainInstructor.name)
    )
  }, [mainInstructor?.name])
  const otherCourses = instructorCourses.filter((item) => item.slug !== course.slug)

  return (
    <div className="space-y-4">
      <GlassyCard className="p-4">
        <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--brand)]">
          {isKidsCourse ? "Class for babies" : "Main instructor"}
        </p>
        <div className="mt-3 overflow-hidden rounded-2xl border border-black/10 bg-black/30 dark:border-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={isKidsCourse ? course.heroMedia?.image || "/images/Kids/Artboard 1.jpg" : mainInstructor?.photo || course.heroMedia?.image || "/images/Teaches/Mariano.jpg"}
            alt={isKidsCourse ? course.title : mainInstructor?.name || "Instructor"}
            className="w-full object-contain"
            style={{ height: "calc(var(--spacing) * 92)" }}
          />
        </div>
        {isKidsCourse ? (
          <>
            <h3 className="mt-4 text-lg font-semibold">{course.title}</h3>
            <p className="text-xs text-neutral-500">Sensory and musical program</p>
          </>
        ) : (
          <>
            <h3 className="mt-4 text-lg font-semibold">{mainInstructor?.name || "Instructor PLI"}</h3>
            <p className="text-xs text-neutral-500">{mainInstructor?.role || "Instructor"}</p>
          </>
        )}
        <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore
          magna aliqua. Focused on technique, musicality, and real progress.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md border border-black/10 dark:border-white/10 px-3 py-2">
            <p className="text-[color:var(--brand)]">Class</p>
            <p className="font-semibold">{course.title}</p>
          </div>
          <div className="rounded-md border border-black/10 dark:border-white/10 px-3 py-2">
            <p className="text-[color:var(--brand)]">Schedule</p>
            <p className="font-semibold">{stripAgeNotes(course.schedule.time).replace(/\s*\/\s*/g, " · ")}</p>
          </div>
          <div className="rounded-md border border-black/10 dark:border-white/10 px-3 py-2">
            <p className="text-[color:var(--brand)]">Days</p>
            <p className="font-semibold">{course.schedule.day}</p>
          </div>
          <div className="rounded-md border border-black/10 dark:border-white/10 px-3 py-2">
            <p className="text-[color:var(--brand)]">Level</p>
            <p className="font-semibold">{course.level}</p>
          </div>
        </div>

        {!!focusItems.length && (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--brand)]">Focus</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {focusItems.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-[color:var(--brand)]/60 px-3 py-1 text-xs text-white/90"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}

        {!!otherCourses.length && (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--brand)]">Classs con este instructor</p>
            <div className="mt-3 space-y-3">
              {otherCourses.map((item) => {
                const days =
                  item.schedule.availableWeekdays?.length
                    ? item.schedule.availableWeekdays.map((idx) => weekdayLabels[idx]).filter(Boolean)
                    : normalizeWeekdays(item.schedule.day || "")
                const safeDays = days.length ? days : ["—"]
                const baseTime = item.schedule.availableTimes?.length
                  ? formatTimeShort(item.schedule.availableTimes[0])
                  : formatTimeShort(extractFirstTime(item.schedule.time || "")) || item.schedule.time || "—"
                const timeLabels = item.schedule.availableTimes?.length && item.schedule.availableTimes.length >= safeDays.length
                  ? item.schedule.availableTimes.slice(0, safeDays.length).map(formatTimeShort)
                  : Array(safeDays.length).fill(baseTime)

                return (
                  <div key={item.slug} className="rounded-2xl border border-[color:var(--brand)]/50">
                    <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-xs uppercase tracking-[0.2em] text-[color:var(--brand)]">
                      <span>{item.title}</span>
                      <span className="text-white/70">{item.level}</span>
                    </div>
                    <div
                      className="grid bg-[color:var(--brand-dark)] text-[11px] uppercase tracking-[0.2em] text-white"
                      style={{ gridTemplateColumns: `repeat(${safeDays.length}, minmax(0, 1fr))` }}
                    >
                      {safeDays.map((day) => (
                        <div
                          key={`${item.slug}-${day}`}
                          className="border-r border-white/15 px-2 py-2 text-center last:border-r-0"
                        >
                          {day}
                        </div>
                      ))}
                    </div>
                    <div
                      className="grid bg-[#1a0a0a] text-sm font-semibold text-white"
                      style={{ gridTemplateColumns: `repeat(${safeDays.length}, minmax(0, 1fr))` }}
                    >
                      {timeLabels.map((time, idx) => {
                        const parts = splitTimeLabel(time)
                        return (
                        <div
                          key={`${item.slug}-${time}-${idx}`}
                          className="border-r border-white/10 px-2 py-3 text-center last:border-r-0"
                        >
                          <span className="block text-base leading-none">{parts.main}</span>
                          {parts.suffix ? (
                            <span className="mt-1 block text-xs uppercase tracking-[0.18em] text-white/70">
                              {parts.suffix}
                            </span>
                          ) : null}
                        </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </GlassyCard>

      {!!(isKidsCourse ? course.instructors?.length : otherInstructors.length) && (
        <GlassyCard className="p-4">
          <h4 className="text-sm font-semibold text-[color:var(--brand)]">Instructors</h4>
          <ul className="mt-3 space-y-2">
            {(isKidsCourse ? course.instructors : otherInstructors).map((ins, idx) => (
              <li key={`${ins.name}-${idx}`} className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ins.photo || "/images/Teaches/Mariano.jpg"}
                  alt={ins.name}
                  className="h-10 w-10 rounded-full object-cover"
                />
                <div>
                  <p className="text-sm font-semibold">{ins.name}</p>
                  <p className="text-xs text-neutral-500">{ins.role || "Instructor"}</p>
                </div>
              </li>
            ))}
          </ul>
        </GlassyCard>
      )}
    </div>
  )
}
const stripAgeNotes = (value: string) => value.replace(/\([^)]*\)/g, "").replace(/\s{2,}/g, " ").trim()
