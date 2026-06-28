"use client"

import React from "react"
import { useMounted } from "@/components/front/hooks/useMounted"
import { X, Loader2, Clock, DollarSign, Package, CheckCircle2, ChevronDown, ChevronUp, History, Download, UserCircle } from "lucide-react"
import {
  computePopoverPosition,
  useClickOutside,
  useKeyboardClose,
  getArrowStyle,
  getArrowRotation,
  type PopoverPosition,
} from "./shared/popover-utils"
import { formatRelativeTime } from "./staffAdminFormatters"

// ============================================================
// Types
// ============================================================

type AuditEntry = {
  id: string
  staffClerkId: string
  staffName: string | null
  entity: "attendance" | "payment" | "package" | "stats" | "profile"
  entityId: string | null
  field: string
  valueBefore: unknown
  valueAfter: unknown
  reason: string
  createdAt: string
}

type AuditHistoryPopoverProps = {
  studentId: string
  studentName: string
  anchorEl: HTMLElement | null
  isOpen: boolean
  onClose: () => void
}

// ============================================================
// Helpers
// ============================================================

const ENTITY_ICONS: Record<AuditEntry["entity"], React.ComponentType<{ className?: string }>> = {
  attendance: Clock,
  payment: DollarSign,
  package: Package,
  stats: CheckCircle2,
  profile: UserCircle,
}

const ENTITY_COLORS: Record<AuditEntry["entity"], string> = {
  attendance: "text-blue-400",
  payment: "text-emerald-400",
  package: "text-purple-400",
  stats: "text-amber-400",
  profile: "text-sky-400",
}

const ENTITY_BG: Record<AuditEntry["entity"], string> = {
  attendance: "bg-blue-500/10",
  payment: "bg-emerald-500/10",
  package: "bg-purple-500/10",
  stats: "bg-amber-500/10",
  profile: "bg-sky-500/10",
}

const ENTITY_BORDER: Record<AuditEntry["entity"], string> = {
  attendance: "border-blue-400/20",
  payment: "border-emerald-400/20",
  package: "border-purple-400/20",
  stats: "border-amber-400/20",
  profile: "border-sky-400/20",
}

const ENTITY_DOT_BG: Record<AuditEntry["entity"], string> = {
  attendance: "bg-blue-400",
  payment: "bg-emerald-400",
  package: "bg-purple-400",
  stats: "bg-amber-400",
  profile: "bg-sky-400",
}

type FriendlyAuditValue = {
  label: string
  details: Array<{ label: string; value: string }>
  isMissing: boolean
}

function toTitleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatPrimitiveValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "number") return String(value)
  if (typeof value === "string") return value.trim() ? toTitleCase(value) : "—"
  return String(value)
}

function formatObjectDetails(value: Record<string, unknown>) {
  return Object.entries(value)
    .filter(([key]) => !key.toLowerCase().includes("id"))
    .map(([key, entryValue]) => ({
      label: formatFieldLabel(key),
      value: formatPrimitiveValue(entryValue),
    }))
    .filter((entry) => entry.value !== "—")
}

function parseJsonValue(value: unknown): FriendlyAuditValue {
  if (value === null || value === undefined) {
    return { label: "No value", details: [], isMissing: true }
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return { label: formatPrimitiveValue(value), details: [], isMissing: false }
  }

  if (Array.isArray(value)) {
    const items = value.slice(0, 3).map((item) => formatPrimitiveValue(item)).filter(Boolean)
    return {
      label: items.length > 0 ? items.join(", ") : `${value.length} items`,
      details: value.length > 3 ? [{ label: "Items", value: `${value.length} total` }] : [],
      isMissing: false,
    }
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>
    if (typeof record.status === "string") {
      return {
        label: formatPrimitiveValue(record.status),
        details: formatObjectDetails(record),
        isMissing: false,
      }
    }

    const details = formatObjectDetails(record)
    if (details.length === 1) {
      return { label: details[0].value, details, isMissing: false }
    }
    if (details.length > 1) {
      return {
        label: details.map((detail) => `${detail.label}: ${detail.value}`).slice(0, 2).join(" · "),
        details,
        isMissing: false,
      }
    }

    return { label: "Updated", details: [], isMissing: false }
  }

  return { label: String(value), details: [], isMissing: false }
}

function resolveAuditValueLabel(value: FriendlyAuditValue, side: "before" | "after") {
  if (!value.isMissing) return value.label
  return side === "before" ? "No previous value" : "No current value"
}

function formatFieldLabel(field: string): string {
  return field
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim()
}

// ============================================================
// Tab Types and Date Range Computation
// ============================================================

export type TabKey = "this-month" | "this-quarter" | "this-year" | "all-time"

export const AUDIT_TABS: Array<{ key: TabKey; label: string }> = [
  { key: "this-month", label: "This month" },
  { key: "this-quarter", label: "This quarter" },
  { key: "this-year", label: "This year" },
  { key: "all-time", label: "All time" },
]

/**
 * Compute fromDate/toDate for a given tab key.
 * Returns { fromDate, toDate } as ISO8601 strings, or { fromDate: undefined, toDate: undefined } for "all-time".
 */
export function getDateRange(tab: TabKey): { fromDate?: string; toDate?: string } {
  const now = new Date()

  if (tab === "all-time") {
    return { fromDate: undefined, toDate: undefined }
  }

  // toDate: end of today (23:59:59.999 UTC)
  const toDate = new Date(now)
  toDate.setUTCHours(23, 59, 59, 999)

  let fromDate: Date

  if (tab === "this-month") {
    fromDate = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1)
  } else if (tab === "this-quarter") {
    const quarterMonth = Math.floor(now.getUTCMonth() / 3) * 3
    fromDate = new Date(now.getUTCFullYear(), quarterMonth, 1)
  } else {
    // this-year
    fromDate = new Date(now.getUTCFullYear(), 0, 1)
  }

  fromDate.setUTCHours(0, 0, 0, 0)

  return { fromDate: fromDate.toISOString(), toDate: toDate.toISOString() }
}

// ============================================================
// Entry Row Component
// ============================================================

function AuditEntryRow({ entry, isLast }: { entry: AuditEntry; isLast: boolean }) {
  const [expanded, setExpanded] = React.useState(false)
  const Icon = ENTITY_ICONS[entry.entity]
  const before = parseJsonValue(entry.valueBefore)
  const after = parseJsonValue(entry.valueAfter)

  return (
    <div className="relative pl-8 pb-6 group">
      {/* Timeline dot */}
      <div
        className={`absolute left-0 top-1 h-3.5 w-3.5 rounded-full ${ENTITY_DOT_BG[entry.entity]} ring-4 ring-zinc-900 group-hover:scale-125 transition-transform`}
        aria-hidden
      />

      {/* Timeline line (not on last item) */}
      {!isLast && (
        <div
          className="absolute left-[7px] top-5 bottom-0 w-px bg-gradient-to-b from-white/20 to-transparent"
          aria-hidden
        />
      )}

      {/* Card */}
      <div
        className={`rounded-xl border ${ENTITY_BORDER[entry.entity]} bg-white/5 p-4 backdrop-blur-sm hover:bg-white/8 transition-colors cursor-pointer`}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            setExpanded(!expanded)
          }
        }}
        tabIndex={0}
        role="button"
        aria-expanded={expanded}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${ENTITY_COLORS[entry.entity]}`} />
            <span className="text-xs font-medium text-white truncate">
              {formatFieldLabel(entry.field)}
            </span>
            <span className={`px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide rounded ${ENTITY_BG[entry.entity]} ${ENTITY_COLORS[entry.entity]}`}>
              {entry.entity}
            </span>
          </div>
          <div className="text-white/40">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </div>
        </div>

        {/* Value diff */}
        <div className="flex items-center gap-2 text-xs mb-2">
          <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-red-300 line-through">
            {resolveAuditValueLabel(before, "before")}
          </span>
          <span className="text-white/30">→</span>
          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-300">
            {resolveAuditValueLabel(after, "after")}
          </span>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2 text-[10px] text-white/50">
          <span>{entry.staffName || "Unknown staff"}</span>
          <span>·</span>
          <span>{formatRelativeTime(entry.createdAt)}</span>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-white/10 text-xs">
            <p className="text-white/50 mb-1">Reason:</p>
            <p className="text-white/80">{entry.reason}</p>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                <p className="text-white/45 mb-1">Before</p>
                <p className="text-white/85">{resolveAuditValueLabel(before, "before")}</p>
                {before.details.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {before.details.map((detail) => (
                      <p key={`before-${detail.label}`} className="text-white/55">
                        <span className="text-white/35">{detail.label}:</span> {detail.value}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                <p className="text-white/45 mb-1">After</p>
                <p className="text-white/85">{resolveAuditValueLabel(after, "after")}</p>
                {after.details.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {after.details.map((detail) => (
                      <p key={`after-${detail.label}`} className="text-white/55">
                        <span className="text-white/35">{detail.label}:</span> {detail.value}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Main Component
// ============================================================

export default function AuditHistoryPopover({
  studentId,
  studentName,
  anchorEl,
  isOpen,
  onClose,
}: AuditHistoryPopoverProps) {
  const popoverRef = React.useRef<HTMLDivElement>(null)
  const [position, setPosition] = React.useState<PopoverPosition | null>(null)
  const mounted = useMounted()
  const [entries, setEntries] = React.useState<AuditEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Tab state (Phase 3)
  const [activeTab, setActiveTab] = React.useState<TabKey>("this-month")

  // Download state (Phase 4)
  const [downloading, setDownloading] = React.useState(false)
  const [downloadError, setDownloadError] = React.useState<string | null>(null)

  const handleClose = React.useCallback(() => {
    if (!isOpen) return
    onClose()
  }, [isOpen, onClose])

  useClickOutside(popoverRef, handleClose)
  useKeyboardClose(handleClose)

  // Compute position when opened
  React.useEffect(() => {
    if (!isOpen || !anchorEl) return

    const updatePosition = () => {
      setPosition(computePopoverPosition(anchorEl, 408, 560, 8))
    }

    updatePosition()
    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)

    return () => {
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
    }
  }, [isOpen, anchorEl])

  // Fetch entries when opened or tab changes
  React.useEffect(() => {
    if (!isOpen || !studentId) return

    const fetchEntries = async () => {
      try {
        setLoading(true)
        setError(null)
        const { fromDate, toDate } = getDateRange(activeTab)
        const params = new URLSearchParams({ pageSize: "50" })
        if (fromDate) params.set("fromDate", fromDate)
        if (toDate) params.set("toDate", toDate)
        const res = await fetch(`/api/staff/students/${encodeURIComponent(studentId)}/audit-log?${params.toString()}`)
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: "Failed to load" }))
          setError(data.error || "Failed to load audit log")
          return
        }
        const json = await res.json()
        const payload = json.data ?? json
        setEntries(payload.entries || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error")
      } finally {
        setLoading(false)
      }
    }

    void fetchEntries()
  }, [isOpen, studentId, activeTab])

  // Download CSV handler (Phase 4)
  const handleDownload = React.useCallback(async () => {
    if (!studentId) return
    try {
      setDownloading(true)
      setDownloadError(null)
      const { fromDate, toDate } = getDateRange(activeTab)
      const params = new URLSearchParams()
      if (fromDate) params.set("fromDate", fromDate)
      if (toDate) params.set("toDate", toDate)
      const res = await fetch(
        `/api/staff/students/${encodeURIComponent(studentId)}/audit-log/export?${params.toString()}`
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to export" }))
        if (res.status === 401 || res.status === 403) {
          setDownloadError("You don't have permission to export audit logs.")
        } else {
          setDownloadError(data.error || "Failed to export audit log")
        }
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const dateStr = new Date().toISOString().slice(0, 10)
      a.download = `audit-log-${studentId}-${dateStr}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Network error during download")
    } finally {
      setDownloading(false)
    }
  }, [studentId, activeTab])

  if (!mounted || !isOpen) return null

  const arrowStyle = getArrowStyle(position)
  const arrowRotation = getArrowRotation(position)

  return (
    <div className="fixed inset-0 z-50 pointer-events-none" aria-hidden={!isOpen}>
      {/* Backdrop */}
      <div className="absolute inset-0 pointer-events-auto" aria-hidden />

      {/* Popover */}
      <div
        ref={popoverRef}
        role="dialog"
        aria-modal="true"
        aria-label="Audit history"
        className="pointer-events-auto absolute"
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
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-white/60" />
              <h3 className="text-sm font-semibold text-white">Change History</h3>
              {!loading && (
                <span className="text-xs text-white/40 bg-white/5 px-2 py-0.5 rounded-full">
                  {entries.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {/* Download button */}
              <button
                onClick={handleDownload}
                disabled={downloading || entries.length === 0}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Download CSV"
                title="Download CSV"
              >
                {downloading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                aria-label="Close audit history"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tab bar */}
          <div className="px-4 pt-2 border-b border-white/10">
            <nav className="-mb-px flex gap-1" aria-label="Date range tabs">
              {AUDIT_TABS.map((tab) => {
                const isActive = activeTab === tab.key
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-2.5 py-2 text-xs font-medium transition border-b-2 ${
                      isActive
                        ? "border-white/60 text-white"
                        : "border-transparent text-white/40 hover:text-white/60"
                    }`}
                    aria-selected={isActive}
                    role="tab"
                  >
                    {tab.label}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Subheader with student name */}
          <div className="px-4 py-2 border-b border-white/5 bg-white/[0.02]">
            <p className="text-xs text-white/50 truncate">{studentName}</p>
          </div>

          {/* Download error message */}
          {downloadError && (
            <div className="px-4 py-2 border-b border-red-500/20 bg-red-500/5">
              <p className="text-xs text-red-400">{downloadError}</p>
            </div>
          )}

          {/* Content */}
          <div className="min-h-0 flex-1 overflow-y-scroll overscroll-contain px-5 py-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Loader2 className="w-6 h-6 text-white/40 animate-spin mb-2" />
                <p className="text-xs text-white/50">Loading history...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <History className="w-8 h-8 text-white/20 mb-2" />
                <p className="text-xs text-white/50">No changes recorded yet</p>
              </div>
            ) : (
              <div className="relative" role="list" aria-label="Change history timeline">
                {entries.map((entry, idx) => (
                  <AuditEntryRow key={entry.id} entry={entry} isLast={idx === entries.length - 1} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
