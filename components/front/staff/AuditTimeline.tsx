"use client"

import React from "react"
import { Loader2, Clock, DollarSign, Package, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react"

// ============================================================
// Types
// ============================================================

type AuditEntry = {
  id: string
  staffClerkId: string
  staffName: string | null
  entity: "attendance" | "payment" | "package" | "stats"
  entityId: string | null
  field: string
  valueBefore: unknown
  valueAfter: unknown
  reason: string
  createdAt: string
}

type AuditTimelineProps = {
  studentId: string
  studentName: string
  initialEntries?: AuditEntry[]
  entityFilter?: "attendance" | "payment" | "package" | "stats" | "all"
  /** Called when entries are loaded and found to be empty — allows parent to hide the timeline */
  onEmpty?: () => void
}

type ParsedValue = {
  label: string
  isNull: boolean
}

// ============================================================
// Helpers
// ============================================================

const ENTITY_ICONS: Record<AuditEntry["entity"], React.ComponentType<{ className?: string }>> = {
  attendance: Clock,
  payment: DollarSign,
  package: Package,
  stats: CheckCircle2,
}

const ENTITY_COLORS: Record<AuditEntry["entity"], string> = {
  attendance: "text-blue-500",
  payment: "text-emerald-500",
  package: "text-purple-500",
  stats: "text-amber-500",
}

const ENTITY_BG: Record<AuditEntry["entity"], string> = {
  attendance: "bg-blue-500/10",
  payment: "bg-emerald-500/10",
  package: "bg-purple-500/10",
  stats: "bg-amber-500/10",
}

function parseJsonValue(value: unknown): ParsedValue {
  if (value === null || value === undefined) {
    return { label: "—", isNull: true }
  }
  if (typeof value === "string") {
    return { label: value, isNull: false }
  }
  if (typeof value === "number") {
    return { label: String(value), isNull: false }
  }
  if (typeof value === "boolean") {
    return { label: value ? "true" : "false", isNull: false }
  }
  try {
    const str = JSON.stringify(value)
    if (str.length > 100) {
      return { label: str.slice(0, 100) + "…", isNull: false }
    }
    return { label: str, isNull: false }
  } catch {
    return { label: String(value), isNull: false }
  }
}

function formatFieldLabel(field: string): string {
  return field
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim()
}

function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso)
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date)
  } catch {
    return iso
  }
}

function formatRelativeTime(iso: string): string {
  try {
    const date = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return formatTimestamp(iso)
  } catch {
    return iso
  }
}

// ============================================================
// Entry Row Component
// ============================================================

function AuditEntryRow({ entry }: { entry: AuditEntry }) {
  const [expanded, setExpanded] = React.useState(false)
  const Icon = ENTITY_ICONS[entry.entity]
  const before = parseJsonValue(entry.valueBefore)
  const after = parseJsonValue(entry.valueAfter)

  return (
    <div className="rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-[#141722]">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-3 p-4 text-left"
        aria-expanded={expanded}
      >
        {/* Icon */}
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${ENTITY_BG[entry.entity]}`}>
          <Icon className={`h-4 w-4 ${ENTITY_COLORS[entry.entity]}`} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-black dark:text-white">
              {formatFieldLabel(entry.field)}
            </span>
            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${ENTITY_BG[entry.entity]} ${ENTITY_COLORS[entry.entity]}`}>
              {entry.entity}
            </span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-black/60 dark:text-white/60">
            <span>{entry.staffName || "Unknown staff"}</span>
            <span>·</span>
            <span title={formatTimestamp(entry.createdAt)}>{formatRelativeTime(entry.createdAt)}</span>
          </div>

          {/* Inline diff preview */}
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-700 line-through dark:bg-red-900/20 dark:text-red-300">
              {before.label}
            </span>
            <span className="text-black/30 dark:text-white/30">→</span>
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
              {after.label}
            </span>
          </div>
        </div>

        {/* Expand indicator */}
        <div className="mt-1 text-black/40 dark:text-white/40">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-black/10 px-4 pb-4 dark:border-white/10">
          <div className="mt-3 space-y-2 text-sm">
            <div>
              <p className="text-xs text-black/50 dark:text-white/50">Reason</p>
              <p className="mt-0.5 text-black dark:text-white">{entry.reason}</p>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <div className="rounded-lg border border-black/10 bg-black/[0.02] p-2 dark:border-white/10 dark:bg-white/[0.02]">
                <p className="text-xs text-black/50 dark:text-white/50">Before</p>
                <p className="mt-0.5 font-mono text-xs text-black dark:text-white">
                  {before.isNull ? "—" : JSON.stringify(entry.valueBefore, null, 2)}
                </p>
              </div>
              <div className="rounded-lg border border-black/10 bg-black/[0.02] p-2 dark:border-white/10 dark:bg-white/[0.02]">
                <p className="text-xs text-black/50 dark:text-white/50">After</p>
                <p className="mt-0.5 font-mono text-xs text-black dark:text-white">
                  {after.isNull ? "—" : JSON.stringify(entry.valueAfter, null, 2)}
                </p>
              </div>
            </div>

            {entry.entityId && (
              <div>
                <p className="text-xs text-black/50 dark:text-white/50">Entity ID</p>
                <p className="mt-0.5 font-mono text-xs text-black/70 dark:text-white/70">{entry.entityId}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Main Component
// ============================================================

export default function AuditTimeline({
  studentId,
  studentName,
  initialEntries,
  entityFilter = "all",
  onEmpty,
}: AuditTimelineProps) {
  const [entries, setEntries] = React.useState<AuditEntry[]>(initialEntries || [])
  const [loading, setLoading] = React.useState(!initialEntries)
  const [error, setError] = React.useState<string | null>(null)
  const [page, setPage] = React.useState(1)
  const [hasMore, setHasMore] = React.useState(true)
  const [total, setTotal] = React.useState<number | null>(null)

  const pageSize = 20

  const fetchEntries = React.useCallback(
    async (pageNum: number, append = false) => {
      try {
        setLoading(true)
        setError(null)

        const params = new URLSearchParams({
          page: String(pageNum),
          pageSize: String(pageSize),
        })
        if (entityFilter !== "all") {
          params.set("entity", entityFilter)
        }

        const res = await fetch(`/api/staff/students/${encodeURIComponent(studentId)}/audit-log?${params}`)

        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: "Failed to load" }))
          setError(data.error || "Failed to load audit log")
          return
        }

        const json = await res.json()
        // API returns { ok: true, data: { entries, pagination } }
        const payload = json.data ?? json
        const newEntries: AuditEntry[] = payload.entries || []

        if (append) {
          setEntries((prev) => [...prev, ...newEntries])
        } else {
          setEntries(newEntries)
        }

        setTotal(payload.pagination?.total ?? null)
        setHasMore(payload.pagination?.hasNext ?? false)
        setPage(pageNum)

        // Notify parent if no entries exist
        if (!append && newEntries.length === 0 && onEmpty) {
          onEmpty()
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error")
      } finally {
        setLoading(false)
      }
    },
    [studentId, entityFilter, onEmpty]
  )

  React.useEffect(() => {
    if (!initialEntries) {
      void fetchEntries(1)
    }
  }, [initialEntries, fetchEntries])

  const handleLoadMore = () => {
    void fetchEntries(page + 1, true)
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-black dark:text-white">
          Audit timeline — {studentName}
        </h4>
        {total !== null && (
          <span className="text-xs text-black/50 dark:text-white/50">
            {total} {total === 1 ? "entry" : "entries"}
          </span>
        )}
      </div>

      {/* Loading state */}
      {loading && entries.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-black/40 dark:text-white/40" />
        </div>
      ) : error && entries.length === 0 ? (
        <div className="rounded-lg border border-[var(--brand,#b61616)]/40 bg-[var(--brand,#b61616)]/10 px-3 py-2 text-sm text-[var(--brand,#b61616)]">
          {error}
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/20 px-4 py-8 text-center dark:border-white/20">
          <p className="text-sm text-black/50 dark:text-white/50">
            No audit entries yet for this student.
          </p>
          <p className="mt-1 text-xs text-black/40 dark:text-white/40">
            Manual overrides will appear here with full before/after values.
          </p>
        </div>
      ) : (
        <>
          {entries.map((entry) => (
            <AuditEntryRow key={entry.id} entry={entry} />
          ))}

          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loading}
                className="rounded-lg border border-black/20 px-4 py-2 text-sm font-medium text-black transition hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:text-white dark:hover:bg-white/5"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading...
                  </span>
                ) : (
                  "Load more"
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Re-export types for consumers
export type { AuditEntry }
