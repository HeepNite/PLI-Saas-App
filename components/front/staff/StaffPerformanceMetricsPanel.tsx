"use client"

import React from "react"
import { Sparkles, Star } from "lucide-react"

import type { StaffUserRow } from "./staffAdminTypes"
import { ROLE_LABELS } from "./staffAdminConstants"

export type TeacherMetric = {
  key: string
  label: string
  value: number
  color: string
  valueLabel: string
}

type StaffPerformanceMetricsPanelProps = {
  showStaffOps: boolean
  teacherRows: StaffUserRow[]
  teacherUserId: string
  selectedTeacher: StaffUserRow | null
  teacherRating: number
  teacherAiTips: string[]
  visibleTeacherMetrics: TeacherMetric[]
  metricsView: "current" | "previous_cycle"
  teacherReviewCycleDays: number
  metricsSaving: boolean
  metricsSuccess: string | null
  metricsError: string | null
  teacherDonutStyle: React.CSSProperties
  teacherMetricsAverage: number
  setTeacherUserId: (userId: string) => void
  setMetricsView: (view: "current" | "previous_cycle") => void
  setTeacherReviewCycleDays: (days: number) => void
  saveTeacherReviewCycle: () => void
}

export default function StaffPerformanceMetricsPanel({
  showStaffOps,
  teacherRows,
  teacherUserId,
  selectedTeacher,
  teacherRating,
  teacherAiTips,
  visibleTeacherMetrics,
  metricsView,
  teacherReviewCycleDays,
  metricsSaving,
  metricsSuccess,
  metricsError,
  teacherDonutStyle,
  teacherMetricsAverage,
  setTeacherUserId,
  setMetricsView,
  setTeacherReviewCycleDays,
  saveTeacherReviewCycle,
}: StaffPerformanceMetricsPanelProps) {
  if (!showStaffOps) return null

  return (
    <article className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
      <header className="mb-4">
        <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Performance metrics</p>
        <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Bar and donut analytics</h3>
        <p className="mt-1 text-sm text-black/65 dark:text-white/65">
          Read-only metrics for instructor audits by students and internal reviews.
        </p>
      </header>

      {teacherRows.length === 0 ? (
        <p className="rounded-md border border-black/10 bg-black/5 px-3 py-2 text-sm text-black/65 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/65">
          No teacher metrics available yet.
        </p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]">
          <div className="rounded-xl border border-black/10 bg-black/[0.03] p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-[0.24em] text-black/60 dark:text-white/60">Selected teacher</p>
              <select
                name="metricsTeacherSelect"
                value={teacherUserId}
                onChange={(event) => setTeacherUserId(event.target.value)}
                className="rounded-md border border-black/15 bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
              >
                {teacherRows.map((row) => (
                  <option key={`teacher-metrics-row-${row.id}`} value={row.id}>
                    {`${row.firstName} ${row.lastName}`.trim() || row.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 rounded-lg border border-black/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.02]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-black dark:text-white">
                  {selectedTeacher ? `${selectedTeacher.firstName} ${selectedTeacher.lastName}`.trim() || selectedTeacher.email : "—"}
                </p>
                <span className="rounded-full border border-[var(--brand,#b61616)]/45 bg-[var(--brand,#b61616)]/10 px-2 py-0.5 text-xs font-semibold text-[var(--brand,#ff4b4b)]">
                  {selectedTeacher ? ROLE_LABELS[selectedTeacher.role] : "Staff"}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <p className="text-sm text-black/70 dark:text-white/70">Current rating</p>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, index) => {
                    const value = index + 1
                    const active = value <= teacherRating
                    return (
                      <span
                        key={`teacher-star-metrics-${value}`}
                        className={`rounded-md border p-1 transition ${
                          active
                            ? "border-[var(--brand,#b61616)]/60 bg-[var(--brand,#b61616)]/15 text-[var(--brand,#ff4b4b)]"
                            : "border-black/15 text-black/40 dark:border-white/15 dark:text-white/45"
                        }`}
                      >
                        <Star className={`h-4 w-4 ${active ? "fill-current" : ""}`} />
                      </span>
                    )
                  })}
                </div>
                <span className="text-xs text-black/60 dark:text-white/60">
                  {teacherRating > 0 ? `${teacherRating.toFixed(1)} / 5` : "No ratings yet"} ·{" "}
                  {(selectedTeacher?.performanceReviewsCount || 0)} reviews
                </span>
              </div>

              <div className="mt-4 rounded-md border border-black/10 bg-white/80 p-3 dark:border-white/10 dark:bg-white/[0.02]">
                <p className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.25em] text-black/60 dark:text-white/60">
                  <Sparkles className="h-3.5 w-3.5" />
                  AI recommendations
                </p>
                <div className="mt-2 space-y-1.5 text-sm text-black/75 dark:text-white/75">
                  {teacherAiTips.map((tip, idx) => (
                    <p key={`teacher-ai-tip-metrics-${idx}`}>• {tip}</p>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {visibleTeacherMetrics.map((metric) => (
                <div key={`teacher-metric-${metric.key}`} className="rounded-lg border border-black/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.02]">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-black dark:text-white">{metric.label}</p>
                    <p className="text-xs text-black/65 dark:text-white/65">{metric.valueLabel}</p>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(0, Math.min(100, metric.value))}%`, backgroundColor: metric.color }}
                    />
                  </div>
                  <p className="mt-1 text-right text-xs text-black/60 dark:text-white/60">{metric.value}%</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-black/10 bg-black/[0.03] p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-[0.24em] text-black/60 dark:text-white/60">Distribution</p>
              <select
                name="metricsView"
                value={metricsView}
                onChange={(event) => setMetricsView(event.target.value === "previous_cycle" ? "previous_cycle" : "current")}
                className="rounded-md border border-black/15 bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
              >
                <option value="current">Current cycle</option>
                <option value="previous_cycle">Previous cycle</option>
              </select>
            </div>

            <div className="mt-3 rounded-lg border border-black/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.02]">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <label className="space-y-1">
                  <span className="text-xs text-black/65 dark:text-white/65">Review cycle (internal)</span>
                  <select
                    name="teacherReviewCycleDays"
                    value={teacherReviewCycleDays}
                    onChange={(event) => setTeacherReviewCycleDays(Number(event.target.value) || 30)}
                    className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                  >
                    {[15, 30, 45, 60].map((days) => (
                      <option key={`metrics-review-cycle-${days}`} value={days}>
                        Every {days} days
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={saveTeacherReviewCycle}
                  disabled={metricsSaving || !selectedTeacher}
                  className="inline-flex items-center justify-center rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
                >
                  {metricsSaving ? "Saving..." : "Save"}
                </button>
              </div>
              <p className="mt-2 text-xs text-black/60 dark:text-white/60">
                Internal comparison: the previous cycle is generated from current cycle values.
              </p>
              {metricsSuccess ? (
                <p className="mt-2 text-xs text-emerald-300">{metricsSuccess}</p>
              ) : null}
              {metricsError ? (
                <p className="mt-2 text-xs text-[var(--brand,#ff4b4b)]">{metricsError}</p>
              ) : null}
            </div>

            <div className="mt-4 flex flex-col items-center gap-4">
              <div className="relative h-44 w-44 rounded-full p-3" style={teacherDonutStyle}>
                <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white/80 text-center dark:bg-[#121523]">
                  <p className="text-xs uppercase tracking-[0.2em] text-black/60 dark:text-white/60">Score</p>
                  <p className="text-2xl font-semibold text-black dark:text-white">{teacherMetricsAverage}%</p>
                </div>
              </div>
              <div className="w-full space-y-1.5">
                {visibleTeacherMetrics.map((metric) => (
                  <div key={`teacher-metric-legend-${metric.key}`} className="flex items-center justify-between gap-2 rounded-md border border-black/10 bg-white/70 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/[0.02]">
                    <span className="inline-flex items-center gap-2 text-black/80 dark:text-white/80">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: metric.color }} />
                      {metric.label}
                    </span>
                    <span className="font-semibold text-black dark:text-white">{metric.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </article>
  )
}
