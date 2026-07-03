"use client"

import React from "react"
import { CalendarPlus, ChevronLeft, ChevronRight, Download, ExternalLink } from "lucide-react"
import { WEEKDAY_LABELS } from "../staffAdminConstants"
import { monthKey } from "../staffCalendarHelpers"
import type { ProfileCalendarCell, ProfileScheduleEntry } from "./profileTypes"

type ProfileScheduleSectionProps = {
  profileScheduleMonth: Date
  profileScheduleMonthLabel: string
  profileCalendarCells: ProfileCalendarCell[]
  selfScheduleEntries: ProfileScheduleEntry[]
  selfScheduleByDay: Record<string, ProfileScheduleEntry[]>
  selfCalendarGoogleHref: string
  selfCalendarIcsDataUri: string
  setProfileScheduleMonth: React.Dispatch<React.SetStateAction<Date>>
}

export default function ProfileScheduleSection(props: ProfileScheduleSectionProps) {
  const {
    profileScheduleMonth,
    profileScheduleMonthLabel,
    profileCalendarCells,
    selfScheduleEntries,
    selfScheduleByDay,
    selfCalendarGoogleHref,
    selfCalendarIcsDataUri,
    setProfileScheduleMonth,
  } = props

  return (
    <section className="mt-5 rounded-xl border border-black/10 bg-white/65 p-3 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--brand,#b61616)]">My schedule</p>
          <h4 className="mt-1 text-base font-semibold text-black dark:text-white">Current calendar</h4>
          <p className="text-xs text-black/60 dark:text-white/60">
            Connect this monthly schedule to your preferred calendar provider.
          </p>
        </div>
        <div className="inline-flex items-center gap-2">
          <button
            type="button"
            onClick={() => setProfileScheduleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
            className="rounded-md border border-black/20 p-1.5 dark:border-white/20"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-black dark:text-white">{profileScheduleMonthLabel}</span>
          <button
            type="button"
            onClick={() => setProfileScheduleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
            className="rounded-md border border-black/20 p-1.5 dark:border-white/20"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {(() => {
          const icsDownload = `pli-staff-schedule-${monthKey(profileScheduleMonth)}.ics`
          const linkClass = `inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
            selfScheduleEntries.length > 0
              ? "cursor-pointer border-black/20 bg-white/70 text-black hover:border-[var(--brand,#b61616)]/45 dark:border-white/20 dark:bg-white/[0.05] dark:text-white"
              : "pointer-events-none border-black/10 bg-black/[0.04] text-black/45 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/45"
          }`
          const calendarLinks: Array<{
            label: string
            href: string
            icon: React.ReactNode
            openInNewTab?: boolean
            downloadAs?: string
          }> = [
            {
              label: "Google",
              href: selfCalendarGoogleHref,
              icon: <ExternalLink className="h-3.5 w-3.5" />,
              openInNewTab: true,
            },
            {
              label: "Outlook",
              href: selfCalendarIcsDataUri,
              icon: <CalendarPlus className="h-3.5 w-3.5" />,
              downloadAs: icsDownload,
            },
            {
              label: "Yahoo",
              href: selfCalendarIcsDataUri,
              icon: <Download className="h-3.5 w-3.5" />,
              downloadAs: icsDownload,
            },
            {
              label: "Apple",
              href: selfCalendarIcsDataUri,
              icon: <Download className="h-3.5 w-3.5" />,
              downloadAs: icsDownload,
            },
          ]
          return calendarLinks.map((link) => (
            <a
              key={`profile-calendar-link-${link.label}`}
              href={link.href}
              {...(link.openInNewTab ? { target: "_blank", rel: "noreferrer" } : {})}
              {...(link.downloadAs ? { download: link.downloadAs } : {})}
              className={linkClass}
            >
              {link.icon}
              {link.label}
            </a>
          ))
        })()}
      </div>

      <div className="mt-3 rounded-xl border border-black/10 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="grid grid-cols-7 gap-2 text-center text-[11px] uppercase tracking-[0.2em] text-black/55 dark:text-white/55">
          {WEEKDAY_LABELS.map((label) => (
            <span key={`profile-weekday-${label}`}>{label}</span>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-2">
          {profileCalendarCells.map((cell, idx) => {
            const events = selfScheduleByDay[cell.dateKey] || []
            return (
              <div
                key={`profile-calendar-cell-${cell.dateKey}-${idx}`}
                className={`min-h-[84px] rounded-md border p-1.5 ${
                  cell.inMonth
                    ? "border-black/10 bg-white/70 dark:border-white/10 dark:bg-white/[0.02]"
                    : "border-black/5 bg-black/[0.02] opacity-60 dark:border-white/5 dark:bg-white/[0.01]"
                }`}
              >
                <p className="mb-1 text-right text-xs text-black/70 dark:text-white/70">{cell.day}</p>
                <div className="space-y-1">
                  {events.slice(0, 2).map((event) => (
                    <p
                      key={`profile-calendar-event-${event.id}`}
                      className="truncate rounded-full bg-[var(--brand,#b61616)]/85 px-2 py-0.5 text-[11px] text-white"
                      title={`${event.title} · ${event.timeLabel}`}
                    >
                      {event.timeLabel}
                    </p>
                  ))}
                  {events.length > 2 ? (
                    <p className="text-[11px] text-black/60 dark:text-white/60">+{events.length - 2} more</p>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {selfScheduleEntries.length === 0 ? (
        <p className="mt-2 text-xs text-black/60 dark:text-white/60">
          No recurring schedule configured yet. Set weekdays and shift times in your profile.
        </p>
      ) : null}
    </section>
  )
}
