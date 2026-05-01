"use client"

import React, { useEffect, useState } from "react"
import Image from "next/image"
import CheckInQrClient from "@/components/front/checkin/CheckInQrClient"

type TerminalSummary = {
  id: string
  slug: string
  name: string
  location: string | null
  defaultCourseSlug: string | null
}

type TodayClass = {
  slug: string
  name: string
  time: string
  duration: string
  imageUrl: string
}

export default function StaffTerminalShell({
  terminal,
}: {
  terminal: TerminalSummary
}) {
  const [todayClasses, setTodayClasses] = useState<TodayClass[]>([])
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [confirmedSlug, setConfirmedSlug] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function fetchTodayClasses() {
      try {
        const res = await fetch("/api/checkin/terminal/today-classes")
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: TodayClass[] = await res.json()
        if (!cancelled) {
          setTodayClasses(data)
          // Auto-select if exactly 1 class
          if (data.length === 1) {
            setSelectedSlug(data[0].slug)
            setConfirmedSlug(data[0].slug)
          }
          // If 2+ classes, DON'T auto-select even if defaultCourseSlug matches
        }
      } catch {
        // Fallback: render CheckInQrClient with forcedCourseSlug (original behavior)
        if (!cancelled) {
          setTodayClasses([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchTodayClasses()
    return () => {
      cancelled = true
    }
  }, [])

  // Still loading — minimal spinner
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#13141d]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-[var(--brand,#b61616)]" />
      </div>
    )
  }

  // Fetch failed or no classes — original behavior
  if (todayClasses.length === 0) {
    return (
      <CheckInQrClient
        forcedDeviceMode="station"
        forcedCourseSlug={terminal.defaultCourseSlug || ""}
        shellVariant="terminal"
        terminalName={terminal.name}
        terminalLocation={terminal.location || ""}
        qrPathOverride="/checkin"
      />
    )
  }

  // Confirmed selection — show check-in with "Change class" button
  if (confirmedSlug) {
    return (
      <div className="relative h-screen">
        <CheckInQrClient
          forcedDeviceMode="station"
          forcedCourseSlug={confirmedSlug}
          shellVariant="terminal"
          terminalName={terminal.name}
          terminalLocation={terminal.location || ""}
          qrPathOverride="/checkin"
          selectedCourseSlug={confirmedSlug}
        />
        {/* Change class button */}
        <button
          type="button"
          onClick={() => setConfirmedSlug(null)}
          className="absolute left-4 top-4 z-50 flex items-center gap-1 rounded-lg bg-black/40 px-3 py-2 text-sm text-white/80 backdrop-blur-sm transition-all duration-200 hover:bg-black/60 hover:text-white active:scale-95"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Change class
        </button>
      </div>
    )
  }

  // 2+ classes — show picker (with or without selection)
  if (todayClasses.length > 1) {
    return (
      <div className="flex min-h-screen flex-col items-center bg-[#13141d] bg-[radial-gradient(80%_55%_at_50%_0%,rgba(182,22,22,0.2),transparent_70%)] px-6 py-12 text-white">
        {/* Header */}
        <div className="mb-10 flex flex-col items-center">
          <Image
            src="/logo/logo-white.png"
            alt="School logo"
            width={64}
            height={64}
            className="mb-4 h-16 w-auto"
          />
          <h1 className="text-3xl font-bold tracking-tight">Select your class</h1>
          <p className="mt-2 text-lg text-white/60">
            {terminal.name}
            {terminal.location ? ` — ${terminal.location}` : ""}
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid w-full max-w-3xl grid-cols-2 gap-6">
          {todayClasses.map((cls) => {
            const isSelected = cls.slug === selectedSlug
            return (
              <button
                key={cls.slug}
                type="button"
                onClick={() => setSelectedSlug(cls.slug)}
                className={`group flex flex-col overflow-hidden rounded-2xl border-2 text-left transition-all duration-200 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand,#b61616)] ${
                  isSelected
                    ? "border-[var(--brand,#b61616)] bg-[var(--brand,#b61616)]/10 shadow-lg shadow-[var(--brand,#b61616)]/20"
                    : "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10"
                }`}
              >
                {/* Course image */}
                <div className="relative h-40 w-full overflow-hidden bg-white/5">
                  <Image
                    src={cls.imageUrl}
                    alt={cls.name}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  {isSelected && (
                    <div className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand,#b61616)] text-white shadow-md">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
                {/* Info */}
                <div className="flex flex-1 flex-col gap-1 p-5">
                  <span className="text-lg font-semibold leading-tight">{cls.name}</span>
                  <div className="mt-auto flex items-center gap-3 text-sm text-white/60">
                    <span className="flex items-center gap-1">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {cls.time}
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {cls.duration}
                    </span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Continue button — appears after selection */}
        {selectedSlug && (
          <button
            type="button"
            onClick={() => setConfirmedSlug(selectedSlug)}
            className="mt-10 rounded-xl bg-[var(--brand,#b61616)] px-10 py-4 text-lg font-semibold text-white shadow-lg shadow-[var(--brand,#b61616)]/30 transition-all duration-200 active:scale-[0.97] hover:bg-[var(--brand,#b61616)]/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            Continue
          </button>
        )}
      </div>
    )
  }

  // Fallback — should not reach here
  return (
    <CheckInQrClient
      forcedDeviceMode="station"
      forcedCourseSlug={terminal.defaultCourseSlug || ""}
      shellVariant="terminal"
      terminalName={terminal.name}
      terminalLocation={terminal.location || ""}
      qrPathOverride="/checkin"
    />
  )
}
