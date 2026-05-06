"use client"

import React, { useEffect, useState, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import Image from "next/image"
import CheckInQrClient from "@/components/front/checkin/CheckInQrClient"

type TerminalSummary = {
  id: string
  slug: string
  name: string
  location: string | null
  defaultCourseSlug: string | null
}

type TodayClassItem = {
  slug: string
  title: string
  category: string | null
  level: string | null
  durationMinutes: number | null
  availableTimes: string[]
  dayLabel: string
  dropInPriceCents: number | null
  firstClassPriceCents: number | null
  coverImageUrl: string | null
}

// ─── Auto-rotation algorithm ──────────────────────────────────

function computeCurrentSlug(now: Date, classes: TodayClassItem[]): string | null {
  if (classes.length === 0) return null
  if (classes.length === 1) return classes[0].slug

  // Sort by first available time
  const sorted = [...classes].sort((a, b) => {
    const timeA = a.availableTimes?.[0] ?? "99:99"
    const timeB = b.availableTimes?.[0] ?? "99:99"
    return timeA.localeCompare(timeB)
  })

  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  for (const cls of sorted) {
    const startTime = cls.availableTimes?.[0]
    if (!startTime) continue
    const [h, m] = startTime.split(":").map(Number)
    const startMinutes = h * 60 + m
    const duration = cls.durationMinutes ?? 55
    const endMinutes = startMinutes + duration
    const rotationMinutes = endMinutes - 15 // rotate 15 min before end

    if (nowMinutes < rotationMinutes) {
      return cls.slug
    }
  }

  // All classes past rotation time → show the last one
  return sorted[sorted.length - 1].slug
}

// ─── Test mode hook ───────────────────────────────────────────

function useTestMode(classes: TodayClassItem[], enabled: boolean) {
  const [simulatedNow, setSimulatedNow] = useState<Date | null>(null)

  useEffect(() => {
    if (!enabled || classes.length === 0) {
      setSimulatedNow(null)
      return
    }

    // Sort classes by start time
    const sorted = [...classes].sort((a, b) => {
      const timeA = a.availableTimes?.[0] ?? "99:99"
      const timeB = b.availableTimes?.[0] ?? "99:99"
      return timeA.localeCompare(timeB)
    })

    // Start 5 minutes before the first class's rotation time
    const firstClass = sorted[0]
    const firstStart = firstClass.availableTimes?.[0]
    if (!firstStart) {
      setSimulatedNow(null)
      return
    }

    const [h, m] = firstStart.split(":").map(Number)
    const duration = firstClass.durationMinutes ?? 55
    const rotationMinutes = h * 60 + m + duration - 15
    const startSimMinutes = rotationMinutes - 5 // 5 min before first rotation

    // Create a simulated date using the rotation times
    const simDate = new Date()
    simDate.setHours(Math.floor(startSimMinutes / 60), startSimMinutes % 60, 0, 0)

    setSimulatedNow(simDate)

    // Advance 5 minutes every 10 seconds
    const interval = setInterval(() => {
      setSimulatedNow((prev) => {
        if (!prev) return prev
        const next = new Date(prev)
        next.setMinutes(next.getMinutes() + 5)
        return next
      })
    }, 10_000)

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

  useEffect(() => {
    let cancelled = false
    async function fetchTodayClasses() {
      try {
        const res = await fetch("/api/checkin/terminal/today-classes")
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const envelope = await res.json()
        const classes: TodayClassItem[] = Array.isArray(envelope.classes) ? envelope.classes : []
        if (!cancelled) {
          setTodayClasses(classes)
        }
      } catch {
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

  // Test mode: simulated time advances 5 min every 10 seconds
  const simulatedNow = useTestMode(todayClasses, testModeEnabled)
  const effectiveNow = simulatedNow ?? new Date()

  // Auto-rotation: re-evaluate every 30 seconds
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (testModeEnabled) return // test mode has its own interval
    const interval = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(interval)
  }, [testModeEnabled])

  // ─── Deferred slug computation (rotation guard) ─────────────
  // Compute the target slug every tick, but only apply it when no
  // active flow is in progress inside CheckInQrClient.
  const computedSlug = useMemo(
    () => computeCurrentSlug(effectiveNow, todayClasses),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [todayClasses, effectiveNow, tick]
  )

  const [currentSlug, setCurrentSlug] = useState<string | null>(computedSlug)
  const pendingSlugRef = React.useRef<string | null>(null)
  const flowActiveRef = React.useRef(false)

  // Apply computed slug immediately or defer if flow is active
  useEffect(() => {
    if (!flowActiveRef.current) {
      setCurrentSlug(computedSlug)
    } else {
      pendingSlugRef.current = computedSlug
    }
  }, [computedSlug])

  // Callback passed to CheckInQrClient to track active flow state
  const handleFlowActiveChange = React.useCallback((active: boolean) => {
    flowActiveRef.current = active
    if (!active && pendingSlugRef.current !== null) {
      setCurrentSlug(pendingSlugRef.current)
      pendingSlugRef.current = null
    }
  }, [])

  // Loading state
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#13141d]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-[var(--brand,#b61616)]" />
      </div>
    )
  }

  // No classes today — fallback to default course
  if (todayClasses.length === 0) {
    return (
      <CheckInQrClient
        key="default"
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

  // Auto-rotated class — CheckInQrClient remounts when slug changes
  if (currentSlug) {
    return (
      <div className="relative h-screen">
        <CheckInQrClient
          key={currentSlug}
          forcedDeviceMode="station"
          forcedCourseSlug={currentSlug}
          shellVariant="terminal"
          terminalName={terminal.name}
          terminalLocation={terminal.location || ""}
          qrPathOverride="/checkin"
          selectedCourseSlug={currentSlug}
          simulatedNowTick={simulatedNow ?? undefined}
          onFlowActiveChange={handleFlowActiveChange}
        />

        {/* Test mode debug overlay */}
        {testModeEnabled && simulatedNow && (
          <div className="absolute right-4 top-4 z-50 rounded bg-black/60 p-2 text-xs text-white">
            <div>TEST MODE — Simulated time: {pad(simulatedNow.getHours())}:{pad(simulatedNow.getMinutes())}</div>
            <div>Current class: {currentSlug}</div>
            {(() => {
              const cls = todayClasses.find((c) => c.slug === currentSlug)
              if (!cls) return null
              const start = cls.availableTimes?.[0]
              if (!start) return null
              const [h, m] = start.split(":").map(Number)
              const dur = cls.durationMinutes ?? 55
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

function pad(n: number) {
  return String(n).padStart(2, "0")
}
