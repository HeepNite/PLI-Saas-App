"use client"

import React, { useRef, useEffect, useCallback, useState } from "react"
import { useMounted } from "@/components/front/hooks/useMounted"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  Calendar,
  User,
  Package,
  PencilLine,
  X,
} from "lucide-react"
import {
  computePopoverPosition,
  useClickOutside,
  useKeyboardClose,
  getArrowStyle,
  getArrowRotation,
  type PopoverPosition,
} from "./shared/popover-utils"

gsap.registerPlugin(useGSAP)

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AttendanceModification {
  date: Date
  description: string
}

export interface AttendanceEvent {
  id: string
  date: Date
  time: string
  className: string
  classType: string
  instructor?: string
  packageName?: string
  status: "attended" | "no-show" | "cancelled" | "booked"
  modifications?: AttendanceModification[]
}

export interface AttendanceSummary {
  totalAttended: number
  noShows: number
  cancelled: number
  activePackage?: {
    name: string
    totalClasses: number | null
    classesUsed: number
    classesRemaining: number | null
    isUnlimited: boolean
  }
}

export interface AttendanceHistoryTimelineProps {
  attendance: AttendanceEvent[]
  summary: AttendanceSummary
  anchorEl: HTMLElement | null
  isOpen: boolean
  onClose: () => void
  loading?: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  attended: {
    label: "Attended",
    icon: CheckCircle2,
    color: "text-green-400",
    bg: "bg-green-400/10",
    border: "border-green-400/20",
    dot: "bg-green-400",
  },
  "no-show": {
    label: "No-show",
    icon: XCircle,
    color: "text-red-400",
    bg: "bg-red-400/10",
    border: "border-red-400/20",
    dot: "bg-red-400",
  },
  cancelled: {
    label: "Cancelled",
    icon: Ban,
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    border: "border-amber-400/20",
    dot: "bg-amber-400",
  },
  booked: {
    label: "Booked",
    icon: Calendar,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    border: "border-blue-400/20",
    dot: "bg-blue-400",
  },
} as const

export function formatDate(date: Date): string {
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

export function formatTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number)
  return new Date(0, 0, 0, hours, minutes).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

// ─── Summary Component ───────────────────────────────────────────────────────

interface SummaryPanelProps {
  summary: AttendanceSummary
}

function SummaryPanel({ summary }: SummaryPanelProps) {
  const pkg = summary.activePackage

  return (
    <div
      className="summary-section mb-4 p-3 rounded-xl bg-white/5 border border-white/10"
      role="region"
      aria-label="Attendance summary"
    >
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="text-center">
          <div className="text-lg font-semibold text-green-400 tabular-nums">
            {summary.totalAttended}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Attended</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-red-400 tabular-nums">
            {summary.noShows}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">No-shows</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-amber-400 tabular-nums">
            {summary.cancelled}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Cancelled</div>
        </div>
      </div>

      {pkg && (
        <div className="pt-3 border-t border-white/10">
          <div className="flex items-center gap-1.5 text-xs text-white/60 mb-1.5">
            <Package className="w-3 h-3 text-white/40" />
            <span className="font-medium text-white/80">{pkg.name}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/40">Classes</span>
            <span className="text-white/70 font-medium tabular-nums">
              {pkg.isUnlimited ? (
                <span className="text-blue-400">Unlimited</span>
              ) : (
                `${pkg.classesUsed} of ${pkg.totalClasses}`
              )}
            </span>
          </div>
          {!pkg.isUnlimited && pkg.classesRemaining != null && (
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-white/40">Remaining</span>
              <span className="text-blue-400 font-medium tabular-nums">
                {pkg.classesRemaining}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Timeline Item Component ─────────────────────────────────────────────────

interface TimelineItemProps {
  event: AttendanceEvent
  isLast: boolean
}

function TimelineItem({ event, isLast }: TimelineItemProps) {
  const [expanded, setExpanded] = useState(false)
  const statusCfg = STATUS_CONFIG[event.status]
  const StatusIcon = statusCfg.icon
  const hasModifications = event.modifications && event.modifications.length > 0

  return (
    <div
      className="timeline-item relative pl-8 pb-6 group"
      role="listitem"
      aria-label={`${statusCfg.label}: ${event.className} on ${formatDate(event.date)}`}
    >
      {/* Timeline dot */}
      <div
        className={`absolute left-0 top-1 w-3.5 h-3.5 rounded-full ${statusCfg.dot} ring-4 ring-zinc-900 group-hover:scale-125 transition-transform`}
        aria-hidden
      />

      {/* Timeline line (not on last item) */}
      {!isLast && (
        <div
          className="timeline-line absolute left-[7px] top-5 bottom-0 w-px bg-gradient-to-b from-white/20 to-transparent"
          aria-hidden
        />
      )}

      {/* Card */}
      <div
        className={`rounded-xl border ${statusCfg.border} bg-white/5 backdrop-blur-sm p-4 hover:bg-white/8 transition-colors ${hasModifications ? "cursor-pointer" : ""}`}
        onClick={() => hasModifications && setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            hasModifications && setExpanded(!expanded)
          }
        }}
        tabIndex={hasModifications ? 0 : -1}
        role={hasModifications ? "button" : undefined}
        aria-expanded={hasModifications ? expanded : undefined}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <StatusIcon className={`w-4 h-4 flex-shrink-0 ${statusCfg.color}`} />
            <span className={`text-xs font-medium ${statusCfg.color} uppercase tracking-wider`}>
              {statusCfg.label}
            </span>
          </div>
          <span className="text-xs text-white/40 tabular-nums">
            {formatTime(event.time)}
          </span>
        </div>

        {/* Class name */}
        <div className="flex items-center gap-2 mb-2 text-white/80">
          <CalendarDays className="w-3.5 h-3.5 flex-shrink-0 text-white/50" />
          <span className="text-sm font-medium truncate">{event.className}</span>
        </div>

        {/* Class type badge */}
        <div className="mb-2">
          <span className="text-[10px] uppercase tracking-wider text-white/40 bg-white/5 px-2 py-0.5 rounded-full">
            {event.classType}
          </span>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/50">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            {formatDate(event.date)}
          </span>
          {event.instructor && (
            <span className="flex items-center gap-1.5">
              <User className="w-3 h-3" />
              {event.instructor}
            </span>
          )}
          {event.packageName && (
            <span className="flex items-center gap-1.5">
              <Package className="w-3 h-3" />
              {event.packageName}
            </span>
          )}
        </div>

        {/* Modifications expandable */}
        {hasModifications && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
              <PencilLine className="w-3 h-3" />
              <span>
                {event.modifications!.length} change{event.modifications!.length > 1 ? "s" : ""}
              </span>
              <span className="ml-auto text-white/40">{expanded ? "▼" : "▶"}</span>
            </div>
            {expanded && (
              <ul className="space-y-2" aria-label="Booking modifications">
                {event.modifications!.map((mod, idx) => (
                  <li key={idx} className="text-xs text-white/60 pl-3 border-l-2 border-gray-400/30">
                    <span className="text-white/40">{formatDate(mod.date)}</span>
                    <span className="mx-1.5">—</span>
                    {mod.description}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AttendanceHistoryTimeline({
  attendance,
  summary,
  anchorEl,
  isOpen,
  onClose,
  loading = false,
}: AttendanceHistoryTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const lineRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<PopoverPosition | null>(null)
  const mounted = useMounted()

  const handleClose = useCallback(() => {
    if (!isOpen) return
    onClose()
  }, [isOpen, onClose])

  const containPopoverWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.stopPropagation()
    if (!(event.target as HTMLElement | null)?.closest("[data-history-scroll-body]")) {
      event.preventDefault()
    }
  }, [])

  useClickOutside(popoverRef, handleClose)
  useKeyboardClose(handleClose)

  // Compute position when opened
  useEffect(() => {
    if (!isOpen || !anchorEl) return

    const updatePosition = () => {
      setPosition(computePopoverPosition(anchorEl, 408, 560, 8))
    }

    // Initial position
    updatePosition()

    // Update on resize/scroll
    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)

    return () => {
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
    }
  }, [isOpen, anchorEl])

  // GSAP animations - entrance
  useGSAP(
    () => {
      if (!isOpen || !popoverRef.current) return

      const tl = gsap.timeline({ defaults: { ease: "power2.out" } })

      // 1. Popover container fades in (no scale to avoid creating a containing block that breaks child overflow)
      tl.fromTo(
        popoverRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.2, clearProps: "opacity" }
      )

      // 2. Summary section fades in
      const summaryEl = containerRef.current?.querySelector(".summary-section")
      if (summaryEl) {
        tl.fromTo(
          summaryEl,
          { y: -10, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.25 },
          "-=0.1"
        )
      }

      // 3. Timeline vertical line draws itself
      if (lineRef.current) {
        tl.fromTo(
          lineRef.current,
          { scaleY: 0, transformOrigin: "top" },
          { scaleY: 1, duration: 0.4 },
          "-=0.1"
        )
      }

      // 4. Items stagger in
      tl.fromTo(
        ".timeline-item",
        { x: -20, opacity: 0 },
        { x: 0, opacity: 1, stagger: 0.08, duration: 0.3 },
        "-=0.2"
      )
    },
    { scope: containerRef, dependencies: [isOpen] }
  )

  // Exit animation
  useGSAP(
    () => {
      if (isOpen || !popoverRef.current) return

      const tl = gsap.timeline({
        defaults: { ease: "power2.in" },
        onComplete: () => onClose(),
      })

      // Reverse stagger: items fade out first
      tl.to(".timeline-item", {
        x: -20,
        opacity: 0,
        stagger: 0.04,
        duration: 0.15,
      })

      // Line shrinks
      if (lineRef.current) {
        tl.to(
          lineRef.current,
          { scaleY: 0, duration: 0.2 },
          "-=0.1"
        )
      }

      // Summary fades out
      const summaryEl = containerRef.current?.querySelector(".summary-section")
      if (summaryEl) {
        tl.to(summaryEl, { y: -10, opacity: 0, duration: 0.15 }, "-=0.15")
      }

      // Popover fades out
      tl.to(
        popoverRef.current,
        { opacity: 0, duration: 0.15 },
        "-=0.15"
      )
    },
    { scope: containerRef, dependencies: [isOpen, onClose] }
  )

  // Don't render anything if not open and not mounted (SSR safety)
  if (!mounted) return null
  if (!isOpen) return null

  const sortedAttendance = [...attendance].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  const arrowStyle = getArrowStyle(position)
  const arrowRotation = getArrowRotation(position)

  return (
    <div ref={containerRef} className="fixed inset-0 z-[150] pointer-events-none" aria-hidden={!isOpen}>
      {/* Backdrop (transparent, captures clicks) */}
      <div className="absolute inset-0 pointer-events-auto" aria-hidden />

      {/* Popover */}
      <div
        ref={popoverRef}
        role="dialog"
        aria-modal="true"
        aria-label="Attendance history timeline"
        className="pointer-events-auto absolute"
        onWheel={containPopoverWheel}
        style={
          position
            ? {
                top: position.top,
                left: position.left,
                width: "min(408px, calc(100vw - 24px))",
                maxHeight: "calc(100vh - 32px)",
                height: "min(560px, calc(100vh - 32px))",
              }
            : { visibility: "hidden" }
        }
      >
        {/* Arrow */}
        <div
          className={`absolute w-3 h-3 bg-zinc-900 border border-zinc-700/50 ${arrowRotation}`}
          style={arrowStyle}
          aria-hidden
        />

        <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-zinc-700/70 bg-zinc-950 shadow-2xl shadow-black/65 ring-1 ring-black/60 backdrop-blur-md">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between px-5 py-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-white/60" />
              <h3 className="text-sm font-semibold text-white">Attendance History</h3>
              <span className="text-xs text-white/40 bg-white/5 px-2 py-0.5 rounded-full">
                {sortedAttendance.length}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
              aria-label="Close attendance history"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Timeline content */}
          <div data-history-scroll-body className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 no-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin mb-3" />
                <p className="text-sm text-white/50">Loading history...</p>
              </div>
            ) : sortedAttendance.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CalendarDays className="w-10 h-10 text-white/20 mb-3" />
                <p className="text-sm text-white/50">No attendance history found</p>
              </div>
            ) : (
              <div>
                {/* Summary at top */}
                <SummaryPanel summary={summary} />

                {/* Timeline events */}
                <div ref={lineRef} className="relative" role="list" aria-label="Attendance timeline">
                  {sortedAttendance.map((event, idx) => (
                    <TimelineItem
                      key={event.id}
                      event={event}
                      isLast={idx === sortedAttendance.length - 1}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer summary */}
          {sortedAttendance.length > 0 && (
            <div className="shrink-0 px-5 py-3 border-t border-white/10 bg-white/5">
              <div className="flex items-center justify-between text-xs text-white/50">
                <span>Total classes</span>
                <span className="text-white/70 font-medium tabular-nums">
                  {sortedAttendance.length}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-white/50 mt-1">
                <span>Attendance rate</span>
                <span className="text-green-400 font-medium tabular-nums">
                  {summary.totalAttended > 0
                    ? Math.round((summary.totalAttended / sortedAttendance.length) * 100)
                    : 0}%
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
