import React from "react"

import { buildHistoryStudentCards } from "./historyCardAggregates"
import {
  buildCurrentMonthPaymentsSummarySearchParams,
  buildPaymentsRequestSearchParams,
} from "./staffPaymentFilters"
import type {
  HistoryAttendanceFilter,
  HistoryClassOption,
  HistoryPaymentMethodFilter,
  PaymentCategoryFilter,
  PaymentRow,
  PaymentsApiSummary,
} from "./staffAdminTypes"

export type PaymentsApiSummaryFactory = () => PaymentsApiSummary

export type PaymentsBulkBusyAction = "mark_paid" | "mark_pending" | null

export type UpdateSettlementBulkOptions = {
  action: Exclude<PaymentsBulkBusyAction, null>
  ids: string[]
  onSuccess?: () => Promise<void>
}

export type StaffPaymentsAdminInput = {
  studentSearchQuery: string
  createEmptyPaymentsSummary: PaymentsApiSummaryFactory
  normalizePaymentsSummary: (summary: unknown) => PaymentsApiSummary
  ensureMinimumLoadingTime: (startedAt: number) => Promise<void>
  handleStaffAuthFailure: (status: number) => boolean
  setError: (error: string | null) => void
}

const buildHistoryClassOptionsFromApi = (input: unknown): HistoryClassOption[] => {
  if (!Array.isArray(input)) return []
  return input
    .map((item) => {
      const option = item as Partial<HistoryClassOption>
      return typeof option?.slug === "string" && typeof option?.title === "string"
        ? { slug: option.slug, title: option.title }
        : null
    })
    .filter((item): item is HistoryClassOption => Boolean(item))
}

export const useStaffPaymentsAdmin = (input: StaffPaymentsAdminInput) => {
  const {
    studentSearchQuery,
    createEmptyPaymentsSummary,
    normalizePaymentsSummary,
    ensureMinimumLoadingTime,
    handleStaffAuthFailure,
    setError,
  } = input

  // Payments board state
  const [payments, setPayments] = React.useState<PaymentRow[]>([])
  const [paymentsMonthlySummaryApi, setPaymentsMonthlySummaryApi] = React.useState<PaymentsApiSummary>(
    () => createEmptyPaymentsSummary()
  )
  const [paymentsMonthlyStudentCount, setPaymentsMonthlyStudentCount] = React.useState(0)
  const [paymentsMonthlyCheckedInStudents, setPaymentsMonthlyCheckedInStudents] = React.useState(0)
  const [paymentsLoading, setPaymentsLoading] = React.useState(false)

  // Filters
  const [paymentsFilter, setPaymentsFilter] = React.useState<"all" | "pending" | "paid">("all")
  const [paymentCategoryFilter, setPaymentCategoryFilter] = React.useState<PaymentCategoryFilter>("all")
  const isHistoryMode = paymentCategoryFilter === "history"

  // History filters
  const [historyFrom, setHistoryFrom] = React.useState("")
  const [historyTo, setHistoryTo] = React.useState("")
  const [historyPaymentMethodFilter, setHistoryPaymentMethodFilter] = React.useState<HistoryPaymentMethodFilter>("all")
  const [historyAttendanceFilter, setHistoryAttendanceFilter] = React.useState<HistoryAttendanceFilter>("all")
  const [historyClassKey, setHistoryClassKey] = React.useState("")
  const [historyClassOptions, setHistoryClassOptions] = React.useState<HistoryClassOption[]>([])
  const [isHistorySearchLoading, setIsHistorySearchLoading] = React.useState(false)

  // Bulk + checkout state
  const [selectedPaymentIds, setSelectedPaymentIds] = React.useState<string[]>([])
  const [paymentsBulkBusyAction, setPaymentsBulkBusyAction] = React.useState<PaymentsBulkBusyAction>(null)
  const [checkoutMenuPaymentId, setCheckoutMenuPaymentId] = React.useState<string | null>(null)

  // Timeline popover anchors
  const [paymentHistoryAnchor, setPaymentHistoryAnchor] = React.useState<HTMLElement | null>(null)
  const [paymentHistoryStudentId, setPaymentHistoryStudentId] = React.useState<string | null>(null)
  const [attendanceHistoryAnchor, setAttendanceHistoryAnchor] = React.useState<HTMLElement | null>(null)
  const [attendanceHistoryStudentId, setAttendanceHistoryStudentId] = React.useState<string | null>(null)
  const [auditHistoryAnchor, setAuditHistoryAnchor] = React.useState<HTMLElement | null>(null)
  const [auditHistoryStudentId, setAuditHistoryStudentId] = React.useState<string | null>(null)
  const [auditHistoryStudentName, setAuditHistoryStudentName] = React.useState<string | null>(null)
  const [userHistoryPayments, setUserHistoryPayments] = React.useState<PaymentRow[]>([])
  const [userHistoryLoading, setUserHistoryLoading] = React.useState(false)

  const studentSearchQueryRef = React.useRef("")
  const historyPopoverContextRef = React.useRef({ historyFrom: "", historyTo: "", isHistoryMode: false })
  const historySearchDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep ref in sync with search query so fetchPayments stays stable across renders.
  React.useEffect(() => {
    studentSearchQueryRef.current = studentSearchQuery
  }, [studentSearchQuery])

  React.useEffect(() => {
    historyPopoverContextRef.current = { historyFrom, historyTo, isHistoryMode }
  }, [historyFrom, historyTo, isHistoryMode])

  const fetchPayments = React.useCallback(async (overrideSearchQuery?: string) => {
    const startedAt = Date.now()
    setPaymentsLoading(true)
    if (isHistoryMode && overrideSearchQuery !== undefined) {
      setIsHistorySearchLoading(true)
    }
    try {
      if (isHistoryMode && (!historyFrom || !historyTo || historyFrom > historyTo)) {
        setPayments([])
        setPaymentsMonthlySummaryApi(createEmptyPaymentsSummary())
        setHistoryClassOptions([])
        return
      }

      const url = new URL("/api/staff/payments", window.location.origin)
      const searchParams = buildPaymentsRequestSearchParams({
        isHistoryMode,
        historyFrom,
        historyTo,
        studentSearchQuery: overrideSearchQuery ?? studentSearchQueryRef.current,
      })
      url.search = searchParams.toString()
      const res = await fetch(url.toString(), { headers: { "Content-Type": "application/json" } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        setError(typeof data?.error === "string" ? data.error : "Failed to load payments")
        setPayments([])
        setPaymentsMonthlySummaryApi(createEmptyPaymentsSummary())
        setHistoryClassOptions([])
        return
      }
      setPayments(Array.isArray(data?.items) ? data.items : [])
      setPaymentsMonthlySummaryApi(normalizePaymentsSummary(data?.summary))
      setHistoryClassOptions(isHistoryMode ? buildHistoryClassOptionsFromApi(data?.classOptions) : [])
    } catch {
      setError("Network error while loading payments")
      setPayments([])
      setPaymentsMonthlySummaryApi(createEmptyPaymentsSummary())
      setHistoryClassOptions([])
    } finally {
      await ensureMinimumLoadingTime(startedAt)
      setPaymentsLoading(false)
      if (isHistoryMode && overrideSearchQuery !== undefined) {
        setIsHistorySearchLoading(false)
      }
    }
  }, [
    createEmptyPaymentsSummary,
    ensureMinimumLoadingTime,
    handleStaffAuthFailure,
    historyFrom,
    historyTo,
    isHistoryMode,
    normalizePaymentsSummary,
    setError,
  ])

  // Debounced server-side search for history mode
  React.useEffect(() => {
    if (historySearchDebounceRef.current) {
      clearTimeout(historySearchDebounceRef.current)
      historySearchDebounceRef.current = null
    }

    const trimmedQuery = studentSearchQuery.trim()

    if (isHistoryMode) {
      if (trimmedQuery.length < 2) {
        void fetchPayments("")
        return
      }

      historySearchDebounceRef.current = setTimeout(() => {
        void fetchPayments(trimmedQuery)
      }, 350)

      return () => {
        if (historySearchDebounceRef.current) {
          clearTimeout(historySearchDebounceRef.current)
          historySearchDebounceRef.current = null
        }
      }
    }
  }, [isHistoryMode, studentSearchQuery, fetchPayments])

  const fetchPaymentsMonthlySummary = React.useCallback(async () => {
    try {
      const url = new URL("/api/staff/payments", window.location.origin)
      url.search = buildCurrentMonthPaymentsSummarySearchParams().toString()
      const res = await fetch(url.toString(), { headers: { "Content-Type": "application/json" } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        setPaymentsMonthlySummaryApi(createEmptyPaymentsSummary())
        setPaymentsMonthlyStudentCount(0)
        setPaymentsMonthlyCheckedInStudents(0)
        return
      }

      const monthlyPayments = Array.isArray(data?.items) ? (data.items as PaymentRow[]) : []
      const monthlyStudentCards = buildHistoryStudentCards(monthlyPayments)

      setPaymentsMonthlySummaryApi(normalizePaymentsSummary(data?.summary))
      setPaymentsMonthlyStudentCount(monthlyStudentCards.length)
      setPaymentsMonthlyCheckedInStudents(
        monthlyStudentCards.filter((item) => Boolean(item.latestAttendedPayment)).length
      )
    } catch {
      setPaymentsMonthlySummaryApi(createEmptyPaymentsSummary())
      setPaymentsMonthlyStudentCount(0)
      setPaymentsMonthlyCheckedInStudents(0)
    }
  }, [createEmptyPaymentsSummary, handleStaffAuthFailure, normalizePaymentsSummary])

  // Reset history class key when its option disappears from the latest class options.
  React.useEffect(() => {
    if (!historyClassKey) return
    if (historyClassOptions.some((option) => option.slug === historyClassKey)) return
    setHistoryClassKey("")
  }, [historyClassKey, historyClassOptions])

  // Load user payment history for history-range popovers only.
  // Daily PMT history must remain board-scoped to NY-today rows.
  React.useEffect(() => {
    const { historyFrom: activeHistoryFrom, historyTo: activeHistoryTo, isHistoryMode: activeIsHistoryMode } =
      historyPopoverContextRef.current
    const userId = activeIsHistoryMode
      ? (paymentHistoryStudentId || attendanceHistoryStudentId)
      : (attendanceHistoryStudentId || null)
    if (!userId) {
      setUserHistoryPayments([])
      return
    }

    let cancelled = false
    setUserHistoryPayments([])
    setUserHistoryLoading(true)

    const params = new URLSearchParams()
    params.set("userId", userId)
    if (activeHistoryFrom && activeHistoryTo) {
      params.set("from", activeHistoryFrom)
      params.set("to", activeHistoryTo)
    }

    fetch(`/api/staff/payments?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (data.items && Array.isArray(data.items)) {
          setUserHistoryPayments(data.items as PaymentRow[])
        }
      })
      .catch(() => {
        // Attendance History fallback in history mode only.
        // Daily PMT History is always board-scoped from `payments` at render time.
        if (!cancelled) {
          if (paymentHistoryStudentId && activeIsHistoryMode) {
            setUserHistoryPayments(payments.filter((p) => p.userId === userId))
          } else {
            setUserHistoryPayments([])
          }
        }
      })
      .finally(() => {
        if (!cancelled) setUserHistoryLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [attendanceHistoryStudentId, paymentHistoryStudentId, payments])

  const handlePaymentCategoryChange = React.useCallback((nextCategory: PaymentCategoryFilter) => {
    setPaymentCategoryFilter(nextCategory)
    if (nextCategory !== "history") {
      setHistoryFrom("")
      setHistoryTo("")
      setHistoryPaymentMethodFilter("all")
      setHistoryAttendanceFilter("all")
      setHistoryClassKey("")
      setHistoryClassOptions([])
    }
  }, [])

  const selectPaymentIds = React.useCallback((ids: string[]) => {
    if (ids.length === 0) return
    setSelectedPaymentIds((prev) => [...new Set([...prev, ...ids])])
  }, [])

  const deselectPaymentIds = React.useCallback((ids: string[]) => {
    if (ids.length === 0) return
    setSelectedPaymentIds((prev) => prev.filter((id) => !ids.includes(id)))
  }, [])

  const clearSelectedPayments = React.useCallback(() => {
    setSelectedPaymentIds([])
  }, [])

  const pruneSelectedPaymentIds = React.useCallback((visibleIds: string[]) => {
    setSelectedPaymentIds((prev) => prev.filter((id) => visibleIds.includes(id)))
  }, [])

  const updateSettlementBulk = React.useCallback(async ({ action, ids, onSuccess }: UpdateSettlementBulkOptions) => {
    if (ids.length === 0) return
    setPaymentsBulkBusyAction(action)
    setError(null)
    try {
      const res = await fetch("/api/staff/payments/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Failed to update settlement in bulk")
        return
      }
      await onSuccess?.()
      deselectPaymentIds(ids)
    } catch {
      setError("Network error while updating settlement in bulk")
    } finally {
      setPaymentsBulkBusyAction(null)
    }
  }, [deselectPaymentIds, setError])

  return {
    // State
    payments,
    paymentsMonthlySummaryApi,
    paymentsMonthlyStudentCount,
    paymentsMonthlyCheckedInStudents,
    paymentsLoading,
    paymentsFilter,
    paymentCategoryFilter,
    isHistoryMode,
    historyFrom,
    historyTo,
    historyPaymentMethodFilter,
    historyAttendanceFilter,
    historyClassKey,
    historyClassOptions,
    isHistorySearchLoading,
    selectedPaymentIds,
    paymentsBulkBusyAction,
    checkoutMenuPaymentId,
    paymentHistoryAnchor,
    paymentHistoryStudentId,
    attendanceHistoryAnchor,
    attendanceHistoryStudentId,
    auditHistoryAnchor,
    auditHistoryStudentId,
    auditHistoryStudentName,
    userHistoryPayments,
    userHistoryLoading,
    // UI state setters
    setPaymentsFilter,
    setHistoryFrom,
    setHistoryTo,
    setHistoryPaymentMethodFilter,
    setHistoryAttendanceFilter,
    setHistoryClassKey,
    setCheckoutMenuPaymentId,
    setPaymentHistoryAnchor,
    setPaymentHistoryStudentId,
    setAttendanceHistoryAnchor,
    setAttendanceHistoryStudentId,
    setAuditHistoryAnchor,
    setAuditHistoryStudentId,
    setAuditHistoryStudentName,
    // Behavior
    fetchPayments,
    fetchPaymentsMonthlySummary,
    handlePaymentCategoryChange,
    selectPaymentIds,
    deselectPaymentIds,
    clearSelectedPayments,
    pruneSelectedPaymentIds,
    updateSettlementBulk,
  }
}
