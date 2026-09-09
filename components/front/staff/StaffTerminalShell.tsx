"use client"

import React, { useEffect, useState, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import CheckInQrClient from "@/components/front/checkin/CheckInQrClient"
import { useKioskDeployRefresh } from "@/components/front/checkin/hooks/useKioskDeployRefresh"
import { getEtHourMinute } from "@/lib/checkin/et-time"
import { areAllClassesEnded } from "@/components/front/staff/CompletedClassesSelector"

type CompletedClassSelection = {
  courseSlug: string
  date: string
  time: string
}

type TerminalSessionIdentity = {
  courseSlug: string
  date: string
  time: string
}

export function excludeSelectedTerminalPastClass<T extends TerminalSessionIdentity>(
  classes: T[],
  selectedClass: TerminalSessionIdentity,
): T[] {
  return classes.filter((classItem) =>
    classItem.courseSlug !== selectedClass.courseSlug
    || classItem.date !== selectedClass.date
    || classItem.time !== selectedClass.time,
  )
}

export function sortTerminalSessions<T extends TerminalSessionIdentity>(sessions: T[]): T[] {
  return [...sessions].sort((left, right) =>
    left.time.localeCompare(right.time)
    || left.courseSlug.localeCompare(right.courseSlug)
    || left.date.localeCompare(right.date),
  )
}

export function resolveActiveTerminalSession<T extends TerminalSessionIdentity>(
  sessions: T[],
  selectedSession: TerminalSessionIdentity | null,
): T | null {
  if (!selectedSession) return sortTerminalSessions(sessions)[0] ?? null

  return sessions.find((session) =>
    session.courseSlug === selectedSession.courseSlug
    && session.date === selectedSession.date
    && session.time === selectedSession.time,
  ) ?? null
}

type TerminalSummary = {
  id: string
  slug: string
  name: string
  location: string | null
  defaultCourseSlug: string | null
}

type TodayClassItem = {
  kind?: "special"
  slug: string
  specialClassSlug?: string
  title: string
  category: string | null
  level: string | null
  durationMinutes: number | null
  availableTimes: string[]
  dayLabel: string
  dropInPriceCents: number | null
  firstClassPriceCents: number | null
  coverImageUrl: string | null
  currency?: string
}

const STUDIO_TZ = "America/New_York"

function getStudioDateKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: STUDIO_TZ }).format(date)
}

function getMsUntilNextStudioDay(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: STUDIO_TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now)
  const valueFor = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0)
  const elapsedSeconds = (valueFor("hour") * 60 * 60) + (valueFor("minute") * 60) + valueFor("second")
  return Math.max(((24 * 60 * 60) - elapsedSeconds) * 1000, 1_000)
}

// ─── Auto-rotation algorithm ──────────────────────────────────

function computeCurrentSession(now: Date, sessions: TerminalSession[]): TerminalSession | null {
  const slots = sortTerminalSessions(sessions)
  if (slots.length === 0) return null

  const { hour, minute } = getEtHourMinute(now)
  const nowMinutes = hour * 60 + minute

  for (const session of slots) {
    const { time } = session
    const [h, m] = time.split(":").map(Number)
    const startMinutes = h * 60 + m
    const duration = session.durationMinutes ?? 55
    const endMinutes = startMinutes + duration
    const rotationMinutes = endMinutes - 15 // rotate 15 min before end

    if (nowMinutes < rotationMinutes) {
      return session
    }
  }

  // All classes past rotation time → show the last one
  return slots[slots.length - 1]
}

// ─── Test mode hook ───────────────────────────────────────────

function useTestMode(classes: TodayClassItem[], enabled: boolean) {
  const [simulatedNow, setSimulatedNow] = useState<Date | null>(null)

  useEffect(() => {
    if (!enabled || classes.length === 0) {
      setSimulatedNow(null)
      return
    }

    // Sort classes by start time and stable slug tie-breaker.
    const sorted = [...classes].sort((a, b) => {
      const timeA = a.availableTimes?.[0] ?? "99:99"
      const timeB = b.availableTimes?.[0] ?? "99:99"
      return timeA.localeCompare(timeB) || a.slug.localeCompare(b.slug)
    })

    // Test preview must be fast: start shortly before the first rotation and
    // accelerate studio time so staff can reach the after-hours UI quickly.
    const firstClass = sorted[0]
    const firstStart = firstClass.availableTimes?.[0]
    if (!firstStart) {
      setSimulatedNow(null)
      return
    }

    const [h, m] = firstStart.split(":").map(Number)
    const duration = firstClass.durationMinutes ?? 55
    const rotationMinutes = h * 60 + m + duration - 15
    const startSimMinutes = rotationMinutes - 10

    // Create a simulated date using the rotation times
    const simDate = new Date()
    simDate.setHours(Math.floor(startSimMinutes / 60), startSimMinutes % 60, 0, 0)

    setSimulatedNow(simDate)

    // Advance 10 studio minutes every 5 seconds.
    // This keeps /staff/terminal?testRotation=true usable for manual review:
    // current class → rotation → completed classes should happen well under 3 minutes.
    const interval = setInterval(() => {
      setSimulatedNow((prev) => {
        if (!prev) return prev
        const next = new Date(prev)
        next.setMinutes(next.getMinutes() + 10)
        return next
      })
    }, 5_000)

    return () => clearInterval(interval)
  }, [enabled, classes])

  return simulatedNow
}

// ─── Main component ───────────────────────────────────────────

export default function StaffTerminalShell({
  terminal,
}: {
  terminal: TerminalSummary
}) {
  const searchParams = useSearchParams()
  const testModeEnabled =
    process.env.NODE_ENV !== "production" && searchParams?.get("testRotation") === "true"

  const [todayClasses, setTodayClasses] = useState<TodayClassItem[]>([])
  const [loading, setLoading] = useState(true)
  const origin = typeof window !== "undefined" ? window.location.origin : ""

  const fetchDateKeyRef = React.useRef<string | null>(null)

  const fetchTodayClasses = React.useCallback(async () => {
    try {
      const res = await fetch("/api/checkin/terminal/today-classes")
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const envelope = await res.json()
      const classes: TodayClassItem[] = Array.isArray(envelope.classes) ? envelope.classes : []
      fetchDateKeyRef.current = typeof envelope.date === "string" ? envelope.date : null
      setTodayClasses(classes)
      setSelectedCompletedClass(null)
    } catch {
      setTodayClasses([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch on mount
  useEffect(() => {
    void fetchTodayClasses()
  }, [fetchTodayClasses])

  // Re-fetch when the day changes (single timeout to next midnight ET) + on wake from sleep
  useEffect(() => {
    let midnightTimer = setTimeout(function scheduleMidnight() {
      void fetchTodayClasses()
      midnightTimer = setTimeout(scheduleMidnight, getMsUntilNextStudioDay())
    }, getMsUntilNextStudioDay())

    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return
      const currentDateKey = getStudioDateKey()
      if (fetchDateKeyRef.current && currentDateKey !== fetchDateKeyRef.current) {
        void fetchTodayClasses()
      }
    }
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      clearTimeout(midnightTimer)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [fetchTodayClasses])

  // Auto-rotation: re-evaluate every 30 seconds
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (testModeEnabled) return // test mode has its own interval
    const interval = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(interval)
  }, [testModeEnabled])

  // Test mode: simulated time advances 5 min every 10 seconds
  const simulatedNow = useTestMode(todayClasses, testModeEnabled)
  const effectiveNow = useMemo(() => {
    void tick
    return simulatedNow ?? new Date()
  }, [simulatedNow, tick])

  const terminalSessions = useMemo<TerminalSession[]>(
    () => {
      const date = fetchDateKeyRef.current ?? getStudioDateKey(effectiveNow)
      return sortTerminalSessions(todayClasses.flatMap((cls) => cls.availableTimes.map((time) => ({
        courseSlug: cls.slug,
        title: cls.title,
        date,
        time,
        durationMinutes: cls.durationMinutes,
        level: cls.level,
        category: cls.category,
        imageUrl: cls.coverImageUrl,
        qrImageUrl: buildCheckInQrImageUrl({ origin, courseSlug: cls.slug, date, time, durationMinutes: cls.durationMinutes ?? 60 }),
      }))))
    },
    [effectiveNow, origin, todayClasses],
  )

  // ─── Deferred session computation (rotation guard) ──────────
  // Compute the target session every tick, but only apply it when no
  // active flow is in progress inside CheckInQrClient.
  const computedSession = useMemo(
    () => computeCurrentSession(effectiveNow, terminalSessions),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [terminalSessions, effectiveNow, tick]
  )

  const [currentSession, setCurrentSession] = useState<TerminalSession | null>(computedSession)
  const pendingSessionRef = React.useRef<TerminalSession | null>(null)
  const flowActiveRef = React.useRef(false)

  // Apply the computed session immediately or defer if flow is active
  useEffect(() => {
    if (!flowActiveRef.current) {
      setCurrentSession(computedSession)
    } else {
      pendingSessionRef.current = computedSession
    }
  }, [computedSession])

  // Callback passed to CheckInQrClient to track active flow state
  const handleFlowActiveChange = React.useCallback((active: boolean) => {
    flowActiveRef.current = active
    if (!active && pendingSessionRef.current !== null) {
      setCurrentSession(pendingSessionRef.current)
      pendingSessionRef.current = null
    }
  }, [])

  // Auto-reload on new deploy: the 24/7 kiosk otherwise keeps a stale bundle.
  // flowActiveRef mirrors hasTerminalSensitiveCustomerState (via
  // onFlowActiveChange), so the reload only happens while the kiosk is idle.
  const isFlowActive = React.useCallback(() => flowActiveRef.current, [])
  useKioskDeployRefresh({ enabled: true, isFlowActive })

  const [selectedCompletedClass, setSelectedCompletedClass] = React.useState<CompletedClassSelection | null>(null)
  const allClassesEnded = useMemo(
    () => areAllClassesEnded(todayClasses, effectiveNow),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [todayClasses, effectiveNow, tick]
  )

  const activeCompletedClass = selectedCompletedClass
    ? resolveActiveTerminalSession(terminalSessions, selectedCompletedClass)
    : currentSession ?? terminalSessions[terminalSessions.length - 1] ?? null
  const terminalPastClassesExcludingActiveClass = useMemo(
    () => activeCompletedClass
      ? excludeSelectedTerminalPastClass(terminalSessions, activeCompletedClass)
      : terminalSessions,
    [activeCompletedClass, terminalSessions],
  )
  const currentSessionIndex = currentSession ? terminalSessions.indexOf(currentSession) : -1
  const rotatedPastClasses = currentSessionIndex > 0
    ? terminalSessions.slice(0, currentSessionIndex)
    : []

  // Loading state
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#13141d]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-[var(--brand,#b61616)]" />
      </div>
    )
  }

  // After-hours: keep the SAME terminal layout. The left column becomes a
  // Past Courses list; center/right stay as Continue Here + QR.
  if (allClassesEnded && activeCompletedClass) {
    return (
      <div className="relative h-screen">
        <CheckInQrClient
          key={`completed-${activeCompletedClass.courseSlug}-${activeCompletedClass.date}-${activeCompletedClass.time}`}
          forcedDeviceMode="station"
          forcedCourseSlug={activeCompletedClass.courseSlug}
          forcedClassContext={{
            courseSlug: activeCompletedClass.courseSlug,
            date: activeCompletedClass.date,
            time: activeCompletedClass.time,
            durationMinutes: activeCompletedClass.durationMinutes ?? 55,
          }}
          shellVariant="terminal"
          terminalName={terminal.name}
          terminalLocation={terminal.location || ""}
          qrPathOverride="/checkin"
          selectedCourseSlug={activeCompletedClass.courseSlug}
          terminalActiveClass={activeCompletedClass}
          terminalPastClasses={terminalPastClassesExcludingActiveClass}
          selectedTerminalPastClass={activeCompletedClass}
          onTerminalPastClassSelect={setSelectedCompletedClass}
          simulatedNowTick={simulatedNow ?? undefined}
          onFlowActiveChange={handleFlowActiveChange}
        />
      </div>
    )
  }

  // No classes today — fallback to default course, allow future lookahead
  if (todayClasses.length === 0) {
    return (
      <CheckInQrClient
        key="default"
        forcedDeviceMode="station"
        forcedCourseSlug={terminal.defaultCourseSlug || ""}
        terminalTodayOnly={false}
        shellVariant="terminal"
        terminalName={terminal.name}
        terminalLocation={terminal.location || ""}
        qrPathOverride="/checkin"
        simulatedNowTick={simulatedNow ?? undefined}
        onFlowActiveChange={handleFlowActiveChange}
      />
    )
  }

  // Auto-rotated class — CheckInQrClient remounts when its session changes
  if (currentSession) {
    return (
      <div className="relative h-screen">
        <CheckInQrClient
          key={`current-${currentSession.courseSlug}-${currentSession.date}-${currentSession.time}`}
          forcedDeviceMode="station"
          forcedCourseSlug={currentSession.courseSlug}
          forcedClassContext={{
            courseSlug: currentSession.courseSlug,
            date: currentSession.date,
            time: currentSession.time,
            durationMinutes: currentSession.durationMinutes ?? 55,
          }}
          forcedCoursePresentation={currentSlot.item.kind === "special" && currentSlot.item.specialClassSlug && currentSlot.item.dropInPriceCents !== null && currentSlot.item.currency ? {
            kind: "special",
            title: currentSlot.item.title,
            imageUrl: currentSlot.item.coverImageUrl,
            durationMinutes: currentSlot.item.durationMinutes,
            category: currentSlot.item.category,
            level: currentSlot.item.level,
            specialClassSlug: currentSlot.item.specialClassSlug,
            priceCents: currentSlot.item.dropInPriceCents,
            currency: currentSlot.item.currency,
          } : undefined}
          shellVariant="terminal"
          terminalName={terminal.name}
          terminalLocation={terminal.location || ""}
          qrPathOverride="/checkin"
          selectedCourseSlug={currentSession.courseSlug}
          terminalActiveClass={currentSession}
          terminalPastClasses={rotatedPastClasses}
          simulatedNowTick={simulatedNow ?? undefined}
          onFlowActiveChange={handleFlowActiveChange}
        />

        {/* Test mode debug overlay */}
        {testModeEnabled && simulatedNow && (
          <div className="absolute right-4 top-4 z-50 rounded bg-black/60 p-2 text-xs text-white">
            <div>TEST MODE — Simulated time: {pad(simulatedNow.getHours())}:{pad(simulatedNow.getMinutes())}</div>
            <div>Current class: {currentSession.courseSlug}</div>
            {(() => {
              const [h, m] = currentSession.time.split(":").map(Number)
              const dur = currentSession.durationMinutes ?? 55
              const rotMin = h * 60 + m + dur - 15
              return (
                <div>
                  Rotation at: {pad(Math.floor(rotMin / 60))}:{pad(rotMin % 60)}
                </div>
              )
            })()}
          </div>
        )}
      </div>
    )
  }

  // Fallback — no current slug computed
  return (
    <CheckInQrClient
      key="fallback"
      forcedDeviceMode="station"
      forcedCourseSlug={terminal.defaultCourseSlug || ""}
      shellVariant="terminal"
      terminalName={terminal.name}
      terminalLocation={terminal.location || ""}
      qrPathOverride="/checkin"
      simulatedNowTick={simulatedNow ?? undefined}
      onFlowActiveChange={handleFlowActiveChange}
    />
  )
}

type TerminalSession = TerminalSessionIdentity & {
  title: string
  durationMinutes: number | null
  level: string | null
  category: string | null
  imageUrl: string | null
  qrImageUrl: string
}

function buildCheckInQrImageUrl({
  origin,
  courseSlug,
  date,
  time,
  durationMinutes,
}: {
  origin: string
  courseSlug: string
  date: string
  time: string
  durationMinutes: number
}) {
  if (!origin || !courseSlug || !date || !time) return ""
  const params = new URLSearchParams()
  params.set("courseSlug", courseSlug)
  params.set("date", date)
  params.set("time", time)
  params.set("durationMinutes", String(durationMinutes))
  params.set("fromQr", "1")
  const link = `${origin}/checkin?${params.toString()}`
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&format=png&data=${encodeURIComponent(link)}`
}

function pad(n: number) {
  return String(n).padStart(2, "0")
}
