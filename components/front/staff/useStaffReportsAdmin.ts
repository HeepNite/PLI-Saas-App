import React from "react"

import type { ReportsObjectiveFilter } from "./staffAdminConstants"
import type {
  PaymentRow,
  ReportsSuggestion,
  ReportsSuggestionsApiResponse,
} from "./staffAdminTypes"
import {
  buildLocalReportSuggestions,
  buildReportSuggestionsMetrics,
  buildReportsChartMeta,
  buildReportsData,
  buildReportsRangeLabel,
  filterPaymentsByDateRange,
} from "./staffReportsAggregations"
import {
  buildReportsCsv,
  buildReportsCsvFilename,
  buildReportsPdfHtml,
} from "./staffReportsExports"

export type StaffReportsAdminInput = {
  payments: PaymentRow[]
  setError: React.Dispatch<React.SetStateAction<string | null>>
}

// Owns reports state and lifecycle. Pure derivations live in
// `staffReportsAggregations`; export string builders live in
// `staffReportsExports`. This hook only wires them together and runs effects.
export const useStaffReportsAdmin = ({ payments, setError }: StaffReportsAdminInput) => {
  const [reportsDateFrom, setReportsDateFrom] = React.useState("")
  const [reportsDateTo, setReportsDateTo] = React.useState("")
  const [reportsObjectiveFilter, setReportsObjectiveFilter] = React.useState<ReportsObjectiveFilter>("all")
  const [expandedSuggestionId, setExpandedSuggestionId] = React.useState<string | null>(null)
  const [doneSuggestionIds, setDoneSuggestionIds] = React.useState<string[]>([])
  const [remoteReportSuggestions, setRemoteReportSuggestions] = React.useState<ReportsSuggestion[] | null>(null)
  const [reportSuggestionsProvider, setReportSuggestionsProvider] = React.useState<"local" | "mock" | "custom-http">("local")
  const [reportSuggestionsLoading, setReportSuggestionsLoading] = React.useState(false)
  const [reportSuggestionsError, setReportSuggestionsError] = React.useState<string | null>(null)

  const reportFilteredPayments = React.useMemo(
    () => filterPaymentsByDateRange(payments, reportsDateFrom, reportsDateTo),
    [payments, reportsDateFrom, reportsDateTo]
  )

  const reportsRangeLabel = React.useMemo(
    () => buildReportsRangeLabel(reportsDateFrom, reportsDateTo),
    [reportsDateFrom, reportsDateTo]
  )

  const reportsData = React.useMemo(() => buildReportsData(reportFilteredPayments), [reportFilteredPayments])

  const reportsChartMeta = React.useMemo(() => buildReportsChartMeta(reportsData), [reportsData])

  const localReportSuggestions = React.useMemo<ReportsSuggestion[]>(
    () => buildLocalReportSuggestions(reportsData),
    [reportsData]
  )

  const reportSuggestionsMetrics = React.useMemo(
    () => buildReportSuggestionsMetrics(reportsData, reportsRangeLabel),
    [reportsData, reportsRangeLabel]
  )

  const refreshAiSuggestions = React.useCallback(async () => {
    setReportSuggestionsLoading(true)
    setReportSuggestionsError(null)
    try {
      const response = await fetch("/api/staff/reports/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectiveFilter: reportsObjectiveFilter,
          metrics: reportSuggestionsMetrics,
          suggestions: localReportSuggestions,
        }),
      })
      const payload = (await response.json()) as ReportsSuggestionsApiResponse
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Unable to fetch AI suggestions.")
      }

      const remoteSuggestions = Array.isArray(payload.suggestions) ? payload.suggestions : []
      if (remoteSuggestions.length > 0) {
        setRemoteReportSuggestions(remoteSuggestions)
      } else {
        setRemoteReportSuggestions(null)
      }
      setReportSuggestionsProvider(payload.provider || "mock")
      setReportSuggestionsError(payload.warning || null)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load AI suggestions."
      setRemoteReportSuggestions(null)
      setReportSuggestionsProvider("local")
      setReportSuggestionsError(message)
    } finally {
      setReportSuggestionsLoading(false)
    }
  }, [localReportSuggestions, reportSuggestionsMetrics, reportsObjectiveFilter])

  const reportSuggestions = React.useMemo(
    () => remoteReportSuggestions ?? localReportSuggestions,
    [localReportSuggestions, remoteReportSuggestions]
  )

  const filteredReportSuggestions = React.useMemo(() => {
    if (reportsObjectiveFilter === "all") return reportSuggestions
    return reportSuggestions.filter((item) => item.objective === reportsObjectiveFilter)
  }, [reportSuggestions, reportsObjectiveFilter])

  React.useEffect(() => {
    if (filteredReportSuggestions.length === 0) {
      setExpandedSuggestionId(null)
      return
    }
    setExpandedSuggestionId((prev) => {
      if (prev && filteredReportSuggestions.some((item) => item.id === prev)) return prev
      return filteredReportSuggestions[0]?.id || null
    })
  }, [filteredReportSuggestions])

  const exportReportsCsv = React.useCallback(() => {
    if (typeof window === "undefined") return
    const csv = buildReportsCsv(reportsData, reportsRangeLabel)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = buildReportsCsvFilename()
    anchor.click()
    window.URL.revokeObjectURL(url)
  }, [reportsData, reportsRangeLabel])

  const exportReportsPdf = React.useCallback(() => {
    if (typeof window === "undefined") return
    const popup = window.open("", "_blank", "noopener,noreferrer,width=980,height=740")
    if (!popup) {
      setError("Popup blocked. Allow popups to export PDF.")
      return
    }

    const html = buildReportsPdfHtml(reportsData, reportsRangeLabel)
    popup.document.open()
    popup.document.write(html)
    popup.document.close()
    popup.focus()
    window.setTimeout(() => {
      popup.print()
    }, 250)
  }, [reportsData, reportsRangeLabel, setError])

  return {
    // State
    reportsDateFrom,
    reportsDateTo,
    reportsObjectiveFilter,
    expandedSuggestionId,
    doneSuggestionIds,
    reportSuggestionsProvider,
    reportSuggestionsLoading,
    reportSuggestionsError,
    // Setters
    setReportsDateFrom,
    setReportsDateTo,
    setReportsObjectiveFilter,
    setExpandedSuggestionId,
    setDoneSuggestionIds,
    // Derived consumed by the panel plus testable reports internals.
    reportFilteredPayments,
    reportsRangeLabel,
    reportsData,
    reportsChartMeta,
    localReportSuggestions,
    reportSuggestionsMetrics,
    reportSuggestions,
    filteredReportSuggestions,
    // Callbacks
    refreshAiSuggestions,
    exportReportsCsv,
    exportReportsPdf,
  }
}
