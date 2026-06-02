"use client"

import React from "react"

import {
  REPORT_OBJECTIVE_LABELS,
  REPORT_OBJECTIVE_OPTIONS,
  REPORT_SUGGESTIONS_SOURCE_LABELS,
} from "./staffAdminConstants"
import type { useStaffReportsAdmin } from "./useStaffReportsAdmin"

// Render-only panel for the staff reports view. Owns no state, no effects,
// no fetches. Everything comes from `useStaffReportsAdmin` (passed as `reports`)
// plus the container's shared `setError` for the copy-AI-brief failure banner
// and the shared `formatMoney` formatter to mirror the container's money copy.

type StaffReportsAdmin = ReturnType<typeof useStaffReportsAdmin>

export type StaffReportsPanelProps = {
  isReportsView: boolean
  reports: StaffReportsAdmin
  formatMoney: (cents: number) => string
  setError: React.Dispatch<React.SetStateAction<string | null>>
}

export default function StaffReportsPanel({
  isReportsView,
  reports,
  formatMoney,
  setError,
}: StaffReportsPanelProps) {
  if (!isReportsView) return null

  const {
    reportsDateFrom,
    reportsDateTo,
    reportsObjectiveFilter,
    expandedSuggestionId,
    doneSuggestionIds,
    reportSuggestionsProvider,
    reportSuggestionsLoading,
    reportSuggestionsError,
    setReportsDateFrom,
    setReportsDateTo,
    setReportsObjectiveFilter,
    setExpandedSuggestionId,
    setDoneSuggestionIds,
    reportsRangeLabel,
    reportsData,
    reportsChartMeta,
    filteredReportSuggestions,
    refreshAiSuggestions,
    exportReportsCsv,
    exportReportsPdf,
  } = reports

  return (
    <article className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Reports</p>
          <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Sales and student analytics</h3>
          <p className="mt-1 text-sm text-black/65 dark:text-white/65">
            Base metrics for strategy: top courses, monthly performance, payment behavior and attendance conversion.
          </p>
          <p className="mt-1 text-xs text-black/55 dark:text-white/60">
            Range: <span className="font-semibold text-black/75 dark:text-white/80">{reportsRangeLabel}</span> · Rows:{" "}
            <span className="font-semibold text-black/75 dark:text-white/80">{reportsData.totalRows}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-[140px] flex-col gap-1 text-[11px] text-black/70 dark:text-white/70">
            From
            <input
              type="date"
              value={reportsDateFrom}
              onChange={(event) => setReportsDateFrom(event.target.value)}
              className="rounded-md border border-black/15 bg-white/70 px-2 py-1.5 text-xs text-black focus:outline-none focus:ring-2 focus:ring-[var(--brand,#b61616)]/40 dark:border-white/20 dark:bg-white/[0.06] dark:text-white"
            />
          </label>
          <label className="flex min-w-[140px] flex-col gap-1 text-[11px] text-black/70 dark:text-white/70">
            To
            <input
              type="date"
              value={reportsDateTo}
              onChange={(event) => setReportsDateTo(event.target.value)}
              className="rounded-md border border-black/15 bg-white/70 px-2 py-1.5 text-xs text-black focus:outline-none focus:ring-2 focus:ring-[var(--brand,#b61616)]/40 dark:border-white/20 dark:bg-white/[0.06] dark:text-white"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setReportsDateFrom("")
              setReportsDateTo("")
            }}
            className="cursor-pointer rounded-md border border-black/20 px-3 py-2 text-xs text-black/75 dark:border-white/20 dark:text-white/75"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={exportReportsCsv}
            className="cursor-pointer rounded-md border border-[var(--brand,#b61616)]/65 bg-[var(--brand,#b61616)]/15 px-3 py-2 text-xs font-semibold text-[var(--brand,#ff4b4b)]"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={exportReportsPdf}
            className="cursor-pointer rounded-md border border-white/20 bg-black/20 px-3 py-2 text-xs font-semibold text-white/85"
          >
            Export PDF
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="rounded-lg border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <p className="text-xs text-black/60 dark:text-white/60">Paid revenue</p>
          <p className="mt-1 text-lg font-semibold text-black dark:text-white">{formatMoney(reportsData.totalRevenueCents)}</p>
        </div>
        <div className="rounded-lg border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <p className="text-xs text-black/60 dark:text-white/60">Paid sales</p>
          <p className="mt-1 text-lg font-semibold text-black dark:text-white">{reportsData.totalPaidSales}</p>
        </div>
        <div className="rounded-lg border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <p className="text-xs text-black/60 dark:text-white/60">Avg ticket</p>
          <p className="mt-1 text-lg font-semibold text-black dark:text-white">{formatMoney(reportsData.avgTicketCents)}</p>
        </div>
        <div className="rounded-lg border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <p className="text-xs text-black/60 dark:text-white/60">Unique students</p>
          <p className="mt-1 text-lg font-semibold text-black dark:text-white">{reportsData.uniqueStudents}</p>
        </div>
        <div className="rounded-lg border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <p className="text-xs text-black/60 dark:text-white/60">Check-in rate</p>
          <p className="mt-1 text-lg font-semibold text-black dark:text-white">{reportsData.checkInRate}%</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-black/10 bg-white/55 p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <h4 className="text-sm font-semibold text-black dark:text-white">Monthly paid revenue trend</h4>
          <div className="mt-3">
            {reportsData.monthlyRevenueSeries.length === 0 ? (
              <p className="text-xs text-black/60 dark:text-white/60">No monthly revenue yet.</p>
            ) : (
              <div className="flex h-44 items-end gap-2">
                {reportsData.monthlyRevenueSeries.slice(-10).map((row) => {
                  const heightPct = Math.max(
                    8,
                    Math.round((row.paidRevenueCents / reportsChartMeta.maxMonthlyRevenue) * 100)
                  )
                  return (
                    <div key={`monthly-chart-${row.monthKey}`} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                      <div className="relative flex h-36 w-full items-end">
                        <div
                          className="w-full rounded-t-md bg-[linear-gradient(180deg,rgba(182,22,22,0.9)_0%,rgba(125,15,69,0.95)_100%)]"
                          style={{ height: `${heightPct}%` }}
                          title={`${row.monthLabel}: ${formatMoney(row.paidRevenueCents)}`}
                        />
                      </div>
                      <p className="truncate text-[10px] text-black/65 dark:text-white/65">{row.monthLabel}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-black/10 bg-white/55 p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <h4 className="text-sm font-semibold text-black dark:text-white">Top courses by revenue</h4>
          <div className="mt-3 space-y-2">
            {reportsData.topCourses.slice(0, 6).map((row) => {
              const widthPct = Math.max(8, Math.round((row.paidRevenueCents / reportsChartMeta.maxTopCourseRevenue) * 100))
              return (
                <div key={`top-course-bar-${row.courseTitle}`} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs text-black/80 dark:text-white/80">
                    <p className="truncate">{row.courseTitle}</p>
                    <p className="shrink-0">{formatMoney(row.paidRevenueCents)}</p>
                  </div>
                  <div className="h-2 rounded-full bg-black/10 dark:bg-white/10">
                    <div
                      className="h-2 rounded-full bg-[linear-gradient(90deg,rgba(182,22,22,0.9)_0%,rgba(249,115,22,0.85)_100%)]"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              )
            })}
            {reportsData.topCourses.length === 0 ? (
              <p className="text-xs text-black/60 dark:text-white/60">No paid course sales yet.</p>
            ) : null}
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <section className="rounded-xl border border-black/10 bg-white/55 p-3 dark:border-white/10 dark:bg-white/[0.03] xl:col-span-2">
          <h4 className="text-sm font-semibold text-black dark:text-white">Top courses (paid)</h4>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead>
                <tr className="text-black/60 dark:text-white/60">
                  <th className="px-2 py-1">Course</th>
                  <th className="px-2 py-1">Paid sales</th>
                  <th className="px-2 py-1">Revenue</th>
                  <th className="px-2 py-1">Check-ins</th>
                </tr>
              </thead>
              <tbody>
                {reportsData.topCourses.slice(0, 8).map((row) => (
                  <tr key={`report-course-${row.courseTitle}`} className="border-t border-black/10 dark:border-white/10">
                    <td className="px-2 py-2 text-black/90 dark:text-white/90">{row.courseTitle}</td>
                    <td className="px-2 py-2 text-black/80 dark:text-white/80">{row.paidSales}</td>
                    <td className="px-2 py-2 text-black/80 dark:text-white/80">{formatMoney(row.paidRevenueCents)}</td>
                    <td className="px-2 py-2 text-black/80 dark:text-white/80">{row.checkIns}</td>
                  </tr>
                ))}
                {reportsData.topCourses.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-2 py-3 text-black/60 dark:text-white/60">
                      No paid sales yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-black/10 bg-white/55 p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <h4 className="text-sm font-semibold text-black dark:text-white">Payment channels</h4>
          <div className="mt-2 space-y-2">
            {reportsData.channelBreakdown.map((row) => (
              <div key={`report-channel-${row.key}`} className="rounded-lg border border-black/10 bg-white/70 p-2 dark:border-white/10 dark:bg-white/[0.05]">
                <p className="text-[11px] uppercase tracking-[0.2em] text-black/55 dark:text-white/60">{row.key}</p>
                <p className="mt-1 text-sm font-semibold text-black dark:text-white">
                  {row.sales} sales · {formatMoney(row.paidRevenueCents)}
                </p>
              </div>
            ))}
            <div className="rounded-lg border border-black/10 bg-white/70 p-2 dark:border-white/10 dark:bg-white/[0.05]">
              <p className="text-[11px] uppercase tracking-[0.2em] text-black/55 dark:text-white/60">stripe pending</p>
              <p className="mt-1 text-sm font-semibold text-black dark:text-white">{reportsData.pendingStripeSales}</p>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-black/10 bg-white/55 p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <h4 className="text-sm font-semibold text-black dark:text-white">Time-window ranking</h4>
          <div className="mt-3 space-y-2">
            {reportsData.timeWindowRanking.map((row) => {
              const widthPct = Math.max(8, Math.round((row.paidRevenueCents / reportsChartMeta.maxWindowRevenue) * 100))
              return (
                <div key={`window-rank-${row.window}`} className="rounded-lg border border-black/10 bg-white/70 p-2 dark:border-white/10 dark:bg-white/[0.05]">
                  <div className="flex items-center justify-between gap-2 text-xs text-black/80 dark:text-white/80">
                    <span>{row.window}</span>
                    <span>{row.paidSales} sales</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-black/10 dark:bg-white/10">
                    <div
                      className="h-2 rounded-full bg-[linear-gradient(90deg,rgba(14,165,233,0.9)_0%,rgba(59,130,246,0.85)_100%)]"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs font-semibold text-black dark:text-white">{formatMoney(row.paidRevenueCents)}</p>
                </div>
              )
            })}
            {reportsData.timeWindowRanking.length === 0 ? (
              <p className="text-xs text-black/60 dark:text-white/60">No paid class times available in this range.</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-xl border border-black/10 bg-white/55 p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <h4 className="text-sm font-semibold text-black dark:text-white">Cohort retention (weekly)</h4>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead>
                <tr className="text-black/60 dark:text-white/60">
                  <th className="px-2 py-1">Cohort week</th>
                  <th className="px-2 py-1">Students</th>
                  <th className="px-2 py-1">W0</th>
                  <th className="px-2 py-1">W1</th>
                  <th className="px-2 py-1">W2</th>
                  <th className="px-2 py-1">W3</th>
                  <th className="px-2 py-1">W4</th>
                </tr>
              </thead>
              <tbody>
                {reportsData.cohortRetention.map((cohort) => {
                  const [w0, w1, w2, w3, w4] = cohort.rates
                  return (
                    <tr key={`cohort-row-${cohort.weekStartTs}`} className="border-t border-black/10 dark:border-white/10">
                      <td className="px-2 py-2 text-black/90 dark:text-white/90">{cohort.weekLabel}</td>
                      <td className="px-2 py-2 text-black/80 dark:text-white/80">{cohort.students}</td>
                      <td className="px-2 py-2 text-black/80 dark:text-white/80">{w0.percentage}%</td>
                      <td className="px-2 py-2 text-black/80 dark:text-white/80">{w1.percentage}%</td>
                      <td className="px-2 py-2 text-black/80 dark:text-white/80">{w2.percentage}%</td>
                      <td className="px-2 py-2 text-black/80 dark:text-white/80">{w3.percentage}%</td>
                      <td className="px-2 py-2 text-black/80 dark:text-white/80">{w4.percentage}%</td>
                    </tr>
                  )
                })}
                {reportsData.cohortRetention.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-2 py-3 text-black/60 dark:text-white/60">
                      No cohort data available.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-xl border border-black/10 bg-white/55 p-3 dark:border-white/10 dark:bg-white/[0.03]">
        <h4 className="text-sm font-semibold text-black dark:text-white">Monthly performance</h4>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead>
              <tr className="text-black/60 dark:text-white/60">
                <th className="px-2 py-1">Month</th>
                <th className="px-2 py-1">Paid sales</th>
                <th className="px-2 py-1">Pending</th>
                <th className="px-2 py-1">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {reportsData.monthlyPerformance.map((row) => (
                <tr key={`report-month-${row.monthKey}`} className="border-t border-black/10 dark:border-white/10">
                  <td className="px-2 py-2 text-black/90 dark:text-white/90">{row.monthLabel}</td>
                  <td className="px-2 py-2 text-black/80 dark:text-white/80">{row.paidSales}</td>
                  <td className="px-2 py-2 text-black/80 dark:text-white/80">{row.pendingSales}</td>
                  <td className="px-2 py-2 text-black/80 dark:text-white/80">{formatMoney(row.paidRevenueCents)}</td>
                </tr>
              ))}
              {reportsData.monthlyPerformance.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-2 py-3 text-black/60 dark:text-white/60">
                    No monthly data available.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-black/10 bg-white/55 p-3 dark:border-white/10 dark:bg-white/[0.03]">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-black dark:text-white">Suggestions & proposals</h4>
            <p className="mt-1 text-xs text-black/65 dark:text-white/65">
              Dynamic recommendations based on your live metrics. Use filters by objective and copy AI briefs for your assistant workflow.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <div className="inline-flex flex-wrap items-center gap-2">
              {REPORT_OBJECTIVE_OPTIONS.map((option) => (
                <button
                  key={`reports-objective-${option.key}`}
                  type="button"
                  onClick={() => setReportsObjectiveFilter(option.key)}
                  className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${
                    reportsObjectiveFilter === option.key
                      ? "border-[var(--brand,#b61616)]/60 bg-[var(--brand,#b61616)]/15 text-[var(--brand,#b61616)]"
                      : "border-black/20 text-black/70 dark:border-white/20 dark:text-white/70"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="inline-flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-full border border-black/15 bg-white/65 px-2 py-1 text-black/70 dark:border-white/15 dark:bg-white/[0.05] dark:text-white/70">
                Source: {REPORT_SUGGESTIONS_SOURCE_LABELS[reportSuggestionsProvider]}
              </span>
              <button
                type="button"
                onClick={() => void refreshAiSuggestions()}
                disabled={reportSuggestionsLoading}
                className="cursor-pointer rounded-md border border-[var(--brand,#b61616)]/60 bg-[var(--brand,#b61616)]/12 px-2.5 py-1 text-[11px] font-semibold text-[var(--brand,#ff4b4b)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {reportSuggestionsLoading ? "Generating..." : "Generate AI suggestions"}
              </button>
            </div>
          </div>
        </header>

        {reportSuggestionsError ? (
          <p className="mt-2 rounded-md border border-amber-500/35 bg-amber-500/10 px-2 py-1 text-xs text-amber-200">
            {reportSuggestionsError}
          </p>
        ) : null}

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {filteredReportSuggestions.map((suggestion) => {
            const isExpanded = expandedSuggestionId === suggestion.id
            const done = doneSuggestionIds.includes(suggestion.id)
            return (
              <article
                key={`suggestion-${suggestion.id}`}
                className={`rounded-xl border p-3 ${
                  done
                    ? "border-emerald-400/40 bg-emerald-500/10"
                    : "border-black/10 bg-white/70 dark:border-white/10 dark:bg-white/[0.05]"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2 text-[11px]">
                    <span className="rounded-full border border-white/25 bg-white/10 px-2 py-0.5 uppercase tracking-[0.2em] text-black/70 dark:text-white/80">
                      {REPORT_OBJECTIVE_LABELS[suggestion.objective]}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 font-semibold ${
                        suggestion.priority === "High"
                          ? "border-[var(--brand,#b61616)]/60 bg-[var(--brand,#b61616)]/12 text-[var(--brand,#ff4b4b)]"
                          : suggestion.priority === "Medium"
                            ? "border-amber-500/45 bg-amber-500/10 text-amber-300"
                            : "border-emerald-500/40 bg-emerald-500/12 text-emerald-300"
                      }`}
                    >
                      {suggestion.priority}
                    </span>
                  </div>
                  {done ? (
                    <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                      Done
                    </span>
                  ) : null}
                </div>

                <h5 className="mt-2 text-sm font-semibold text-black dark:text-white">{suggestion.title}</h5>
                <p className="mt-1 text-xs text-black/70 dark:text-white/70">{suggestion.insight}</p>
                <p className="mt-1 text-xs text-black/75 dark:text-white/75">{suggestion.proposal}</p>

                {isExpanded ? (
                  <div className="mt-2 space-y-1 text-xs text-black/80 dark:text-white/80">
                    {suggestion.actions.map((item) => (
                      <p key={`${suggestion.id}-${item}`} className="rounded-md border border-black/10 bg-white/65 px-2 py-1 dark:border-white/10 dark:bg-white/[0.05]">
                        {item}
                      </p>
                    ))}
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setExpandedSuggestionId((prev) => (prev === suggestion.id ? null : suggestion.id))}
                    className="cursor-pointer rounded-md border border-white/20 bg-black/10 px-2 py-1 text-[11px] text-black/80 dark:text-white/85"
                  >
                    {isExpanded ? "Hide steps" : "View steps"}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return
                      try {
                        await navigator.clipboard.writeText(suggestion.aiBrief)
                      } catch {
                        setError("Unable to copy AI brief.")
                      }
                    }}
                    className="cursor-pointer rounded-md border border-[var(--brand,#b61616)]/60 bg-[var(--brand,#b61616)]/12 px-2 py-1 text-[11px] font-semibold text-[var(--brand,#ff4b4b)]"
                  >
                    Copy AI brief
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDoneSuggestionIds((prev) =>
                        prev.includes(suggestion.id) ? prev.filter((id) => id !== suggestion.id) : [...prev, suggestion.id]
                      )
                    }
                    className="cursor-pointer rounded-md border border-black/20 px-2 py-1 text-[11px] text-black/80 dark:border-white/20 dark:text-white/80"
                  >
                    {done ? "Mark open" : "Mark done"}
                  </button>
                </div>
              </article>
            )
          })}
          {filteredReportSuggestions.length === 0 ? (
            <p className="rounded-md border border-black/10 bg-white/70 px-2 py-2 text-xs text-black/65 dark:border-white/10 dark:bg-white/[0.05] dark:text-white/65">
              No suggestions available for this objective yet.
            </p>
          ) : null}
        </div>
      </section>
    </article>
  )
}
