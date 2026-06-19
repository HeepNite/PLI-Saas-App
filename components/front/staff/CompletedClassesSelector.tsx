"use client"

import React from "react"
import Image from "next/image"
import { getEtHourMinute } from "@/lib/checkin/et-time"

type TodayClassItem = {
  slug: string
  title: string
  category: string | null
  level: string | null
  durationMinutes: number | null
  availableTimes: string[]
  coverImageUrl: string | null
}

export type CompletedClassSelection = {
  courseSlug: string
  time: string
}

/**
 * Returns true when ALL of today's classes have ended based on ET time.
 * Uses the LAST availableTime per class for end-time calculation.
 * Returns false when the list is empty (no classes = nothing ended).
 */
export function areAllClassesEnded(classes: TodayClassItem[], now: Date): boolean {
  if (classes.length === 0) return false
  const { hour, minute } = getEtHourMinute(now)
  const nowMinutes = hour * 60 + minute
  return classes.every((cls) => {
    const times = cls.availableTimes ?? []
    if (times.length === 0) return true
    // Use the LAST time slot (latest class of the day for this course)
    const lastTime = times[times.length - 1]
    const [h, m] = lastTime.split(":").map(Number)
    if (!Number.isFinite(h) || !Number.isFinite(m)) return true
    const endMinutes = h * 60 + m + (cls.durationMinutes ?? 55)
    return nowMinutes > endMinutes
  })
}

type CompletedClassesSelectorProps = {
  classes: TodayClassItem[]
  onSelect: (selection: CompletedClassSelection) => void
  terminalName: string
}

function formatTimeLabel(time: string): string {
  const [h, m] = time.split(":").map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return time
  const suffix = h >= 12 ? "PM" : "AM"
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${displayHour}:${String(m).padStart(2, "0")} ${suffix}`
}

export default function CompletedClassesSelector({
  classes,
  onSelect,
  terminalName,
}: CompletedClassesSelectorProps) {
  // Sort by first available time
  const sorted = [...classes].sort((a, b) => {
    const timeA = a.availableTimes?.[0] ?? "99:99"
    const timeB = b.availableTimes?.[0] ?? "99:99"
    return timeA.localeCompare(timeB)
  })

  return (
    <section className="mx-[1.25rem] rounded-2xl border border-white/15 bg-white/[0.02] p-4 lg:p-5">
      <div className="mb-5 grid items-start gap-4 md:grid-cols-[minmax(0,0.68fr)_minmax(15rem,0.72fr)_minmax(12.5rem,0.5fr)]">
        <p className="text-xs uppercase tracking-[0.2em] text-white/60">Previous classes</p>
        <p className="text-center text-xs uppercase tracking-[0.2em] text-white/60">Select class</p>
        <p className="text-right text-xs uppercase tracking-[0.2em] text-white/60">{terminalName}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {sorted.map((cls) => {
          const firstTime = cls.availableTimes[0] ?? ""
          return (
          <button
            key={cls.slug}
            type="button"
            onClick={() => onSelect({ courseSlug: cls.slug, time: firstTime })}
            disabled={!firstTime}
            className="group overflow-hidden rounded-2xl border border-white/15 bg-[linear-gradient(150deg,rgba(3,5,12,0.96),rgba(10,14,28,0.96))] text-left transition hover:border-[var(--brand,#b61616)]/60 hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="grid min-h-[190px] grid-cols-[0.92fr_1.08fr]">
              <span className="relative min-h-[190px]">
                <Image
                  src={cls.coverImageUrl || "/images/hero-menu/live-academy.JPG"}
                  alt={cls.title}
                  fill
                  sizes="(max-width: 768px) 42vw, 24vw"
                  className="object-cover"
                />
                <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.12)_0%,rgba(0,0,0,0.12)_32%,rgba(0,0,0,0.42)_62%,rgba(0,0,0,0.94)_100%)]" />
                <span className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-sky-300/25 bg-sky-950/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-sky-100/90">
                    {cls.durationMinutes ? `${cls.durationMinutes} min` : "Class"}
                  </span>
                  {cls.level && (
                    <span className="rounded-full border border-emerald-300/25 bg-emerald-950/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-emerald-100/90">
                      {cls.level}
                    </span>
                  )}
                </span>
              </span>
              <span className="flex flex-col justify-between p-4">
                <span>
                  <span className="block text-lg font-semibold leading-tight text-white">{cls.title}</span>
                  <span className="mt-2 block text-sm text-white/70">
                    {cls.availableTimes.map(formatTimeLabel).join(", ")}
                    {cls.durationMinutes ? ` · ${cls.durationMinutes} min` : ""}
                  </span>
                  {cls.category && (
                    <span className="mt-1 block text-xs text-white/42">{cls.category}{cls.level ? ` · ${cls.level}` : ""}</span>
                  )}
                </span>
                <span className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand,#b61616)] transition group-hover:text-red-300">
                  Open terminal →
                </span>
              </span>
            </span>
          </button>
          )
        })}
      </div>
    </section>
  )
}
