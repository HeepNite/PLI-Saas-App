import React from "react"

import { buildHistoryStudentCards } from "./historyCardAggregates"
import {
  buildCurrentMonthPaymentsSummarySearchParams,
  buildPaymentsRequestSearchParams,
} from "./staffPaymentFilters"
import type {
  HistoryAttendanceFilter,
  HistoryClassOption,
  HistoryEventKindFilter,
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

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

type BoardState = {
  payments: PaymentRow[]
  paymentsMonthlySummaryApi: PaymentsApiSummary | null // null = "use factory on init"
  paymentsMonthlyStudentCount: number
  paymentsMonthlyCheckedInStudents: number
  paymentsLoading: boolean
}

type FilterState = {
  paymentsFilter: "all" | "pending" | "paid"
  paymentCategoryFilter: PaymentCategoryFilter
  historyFrom: string
  historyTo: string
  historyPaymentMethodFilter: HistoryPaymentMethodFilter
  historyAttendanceFilter: HistoryAttendanceFilter
  historyEventKindFilter: HistoryEventKindFilter
  historyClassKey: string
  historyClassOptions: HistoryClassOption[]
  isHistorySearchLoading: boolean
}

type SelectionState = {
  selectedPaymentIds: string[]
  paymentsBulkBusyAction: PaymentsBulkBusyAction
  checkoutMenuPaymentId: string | null
}

type PopoverState = {
  paymentHistoryAnchor: HTMLElement | null
  paymentHistoryStudentId: string | null
  attendanceHistoryAnchor: HTMLElement | null
  attendanceHistoryStudentId: string | null
  auditHistoryAnchor: HTMLElement | null
  auditHistoryStudentId: string | null
  auditHistoryStudentName: string | null
  userHistoryPayments: PaymentRow[]
  userHistoryLoading: boolean
}

// ---------------------------------------------------------------------------
// Action discriminated union
// ---------------------------------------------------------------------------

type BoardAction =
  | { type: "BOARD/SET_PAYMENTS"; payments: PaymentRow[]; summary: PaymentsApiSummary }
  | { type: "BOARD/SET_SUMMARY"; summary: PaymentsApiSummary; studentCount: number; checkedInStudents: number }
  | { type: "BOARD/RESET_PAYMENTS"; emptySummary: PaymentsApiSummary }
  | { type: "BOARD/SET_LOADING"; loading: boolean }

type FilterAction =
  | { type: "FILTER/SET_PAYMENTS_FILTER"; value: "all" | "pending" | "paid" }
  | { type: "FILTER/SET_CATEGORY"; category: PaymentCategoryFilter }
  | { type: "FILTER/CLEAR_HISTORY" }
  | { type: "FILTER/SET_HISTORY_FROM"; value: string }
  | { type: "FILTER/SET_HISTORY_TO"; value: string }
  | { type: "FILTER/SET_HISTORY_PAYMENT_METHOD"; value: HistoryPaymentMethodFilter }
  | { type: "FILTER/SET_HISTORY_ATTENDANCE"; value: HistoryAttendanceFilter }
  | { type: "FILTER/SET_HISTORY_EVENT_KIND"; value: HistoryEventKindFilter }
  | { type: "FILTER/SET_HISTORY_CLASS_KEY"; value: string }
  | { type: "FILTER/SET_HISTORY_CLASS_OPTIONS"; options: HistoryClassOption[] }
  | { type: "FILTER/SET_HISTORY_SEARCH_LOADING"; loading: boolean }

type SelectionAction =
  | { type: "SELECTION/SELECT_IDS"; ids: string[] }
  | { type: "SELECTION/DESELECT_IDS"; ids: string[] }
  | { type: "SELECTION/CLEAR" }
  | { type: "SELECTION/PRUNE"; visibleIds: string[] }
  | { type: "SELECTION/SET_BULK_BUSY"; action: PaymentsBulkBusyAction }
  | { type: "SELECTION/SET_CHECKOUT_MENU_ID"; id: string | null }

type PopoverAction =
  | { type: "POPOVER/SET_PAYMENT_HISTORY_ANCHOR"; value: React.SetStateAction<HTMLElement | null> }
  | { type: "POPOVER/SET_PAYMENT_HISTORY_STUDENT_ID"; value: React.SetStateAction<string | null> }
  | { type: "POPOVER/SET_ATTENDANCE_HISTORY_ANCHOR"; value: React.SetStateAction<HTMLElement | null> }
  | { type: "POPOVER/SET_ATTENDANCE_HISTORY_STUDENT_ID"; value: React.SetStateAction<string | null> }
  | { type: "POPOVER/SET_AUDIT_HISTORY_ANCHOR"; value: React.SetStateAction<HTMLElement | null> }
  | { type: "POPOVER/SET_AUDIT_HISTORY_STUDENT_ID"; value: React.SetStateAction<string | null> }
  | { type: "POPOVER/SET_AUDIT_HISTORY_STUDENT_NAME"; value: React.SetStateAction<string | null> }
  | { type: "POPOVER/SET_USER_HISTORY_PAYMENTS"; payments: PaymentRow[] }
  | { type: "POPOVER/SET_USER_HISTORY_LOADING"; loading: boolean }

// ---------------------------------------------------------------------------
// Reducers
// ---------------------------------------------------------------------------

function boardReducer(state: BoardState, action: BoardAction): BoardState {
  switch (action.type) {
    case "BOARD/SET_PAYMENTS":
      return { ...state, payments: action.payments, paymentsMonthlySummaryApi: action.summary }
    case "BOARD/SET_SUMMARY":
      return {
        ...state,
        paymentsMonthlySummaryApi: action.summary,
        paymentsMonthlyStudentCount: action.studentCount,
        paymentsMonthlyCheckedInStudents: action.checkedInStudents,
      }
    case "BOARD/RESET_PAYMENTS":
      return { ...state, payments: [], paymentsMonthlySummaryApi: action.emptySummary }
    case "BOARD/SET_LOADING":
      return { ...state, paymentsLoading: action.loading }
    default:
      return state
  }
}

function filterReducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case "FILTER/SET_PAYMENTS_FILTER":
      return { ...state, paymentsFilter: action.value }
    case "FILTER/SET_CATEGORY":
      return { ...state, paymentCategoryFilter: action.category }
    case "FILTER/CLEAR_HISTORY":
      return {
        ...state,
        historyFrom: "",
        historyTo: "",
        historyPaymentMethodFilter: "all",
        historyAttendanceFilter: "all",
        historyEventKindFilter: "all",
        historyClassKey: "",
        historyClassOptions: [],
      }
    case "FILTER/SET_HISTORY_FROM":
      return { ...state, historyFrom: action.value }
    case "FILTER/SET_HISTORY_TO":
      return { ...state, historyTo: action.value }
    case "FILTER/SET_HISTORY_PAYMENT_METHOD":
      return { ...state, historyPaymentMethodFilter: action.value }
    case "FILTER/SET_HISTORY_ATTENDANCE":
      return { ...state, historyAttendanceFilter: action.value }
    case "FILTER/SET_HISTORY_EVENT_KIND":
      return { ...state, historyEventKindFilter: action.value }
    case "FILTER/SET_HISTORY_CLASS_KEY":
      return { ...state, historyClassKey: action.value }
    case "FILTER/SET_HISTORY_CLASS_OPTIONS":
      return { ...state, historyClassOptions: action.options }
    case "FILTER/SET_HISTORY_SEARCH_LOADING":
      return { ...state, isHistorySearchLoading: action.loading }
    default:
      return state
  }
}

function selectionReducer(state: SelectionState, action: SelectionAction): SelectionState {
  switch (action.type) {
    case "SELECTION/SELECT_IDS":
      return { ...state, selectedPaymentIds: [...new Set([...state.selectedPaymentIds, ...action.ids])] }
    case "SELECTION/DESELECT_IDS":
      return { ...state, selectedPaymentIds: state.selectedPaymentIds.filter((id) => !action.ids.includes(id)) }
    case "SELECTION/CLEAR":
      return { ...state, selectedPaymentIds: [] }
    case "SELECTION/PRUNE":
      return { ...state, selectedPaymentIds: state.selectedPaymentIds.filter((id) => action.visibleIds.includes(id)) }
    case "SELECTION/SET_BULK_BUSY":
      return { ...state, paymentsBulkBusyAction: action.action }
    case "SELECTION/SET_CHECKOUT_MENU_ID":
      return { ...state, checkoutMenuPaymentId: action.id }
    default:
      return state
  }
}

const resolvePopoverValue = <T,>(value: React.SetStateAction<T>, current: T): T =>
  typeof value === "function" ? (value as (prev: T) => T)(current) : value

function popoverReducer(state: PopoverState, action: PopoverAction): PopoverState {
  // Each field updates independently and resolves updaters against the CURRENT
  // reducer state — combined actions built from same-render closures let one
  // setter resurrect a sibling field's stale value (a closed popover reopened
  // itself). Bail out when nothing changed: cards attach anchors via inline ref
  // callbacks that re-fire on every render, so returning a new state object for
  // an identical anchor re-renders forever (Maximum update depth).
  switch (action.type) {
    case "POPOVER/SET_PAYMENT_HISTORY_ANCHOR": {
      const anchor = resolvePopoverValue(action.value, state.paymentHistoryAnchor)
      if (anchor === state.paymentHistoryAnchor) return state
      return { ...state, paymentHistoryAnchor: anchor }
    }
    case "POPOVER/SET_PAYMENT_HISTORY_STUDENT_ID": {
      const studentId = resolvePopoverValue(action.value, state.paymentHistoryStudentId)
      if (studentId === state.paymentHistoryStudentId) return state
      return { ...state, paymentHistoryStudentId: studentId }
    }
    case "POPOVER/SET_ATTENDANCE_HISTORY_ANCHOR": {
      const anchor = resolvePopoverValue(action.value, state.attendanceHistoryAnchor)
      if (anchor === state.attendanceHistoryAnchor) return state
      return { ...state, attendanceHistoryAnchor: anchor }
    }
    case "POPOVER/SET_ATTENDANCE_HISTORY_STUDENT_ID": {
      const studentId = resolvePopoverValue(action.value, state.attendanceHistoryStudentId)
      if (studentId === state.attendanceHistoryStudentId) return state
      return { ...state, attendanceHistoryStudentId: studentId }
    }
    case "POPOVER/SET_AUDIT_HISTORY_ANCHOR": {
      const anchor = resolvePopoverValue(action.value, state.auditHistoryAnchor)
      if (anchor === state.auditHistoryAnchor) return state
      return { ...state, auditHistoryAnchor: anchor }
    }
    case "POPOVER/SET_AUDIT_HISTORY_STUDENT_ID": {
      const studentId = resolvePopoverValue(action.value, state.auditHistoryStudentId)
      if (studentId === state.auditHistoryStudentId) return state
      return { ...state, auditHistoryStudentId: studentId }
    }
    case "POPOVER/SET_AUDIT_HISTORY_STUDENT_NAME": {
      const studentName = resolvePopoverValue(action.value, state.auditHistoryStudentName)
      if (studentName === state.auditHistoryStudentName) return state
      return { ...state, auditHistoryStudentName: studentName }
    }
    case "POPOVER/SET_USER_HISTORY_PAYMENTS":
      return { ...state, userHistoryPayments: action.payments }
    case "POPOVER/SET_USER_HISTORY_LOADING":
      return { ...state, userHistoryLoading: action.loading }
    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useStaffPaymentsAdmin = (input: StaffPaymentsAdminInput) => {
  const {
    studentSearchQuery,
    createEmptyPaymentsSummary,
    normalizePaymentsSummary,
    ensureMinimumLoadingTime,
    handleStaffAuthFailure,
    setError,
  } = input

  const [board, dispatchBoard] = React.useReducer(boardReducer, undefined, (): BoardState => ({
    payments: [],
    paymentsMonthlySummaryApi: createEmptyPaymentsSummary(),
    paymentsMonthlyStudentCount: 0,
    paymentsMonthlyCheckedInStudents: 0,
    paymentsLoading: false,
  }))

  const [filter, dispatchFilter] = React.useReducer(filterReducer, {
    paymentsFilter: "all",
    paymentCategoryFilter: "all",
    historyFrom: "",
    historyTo: "",
    historyPaymentMethodFilter: "all",
    historyAttendanceFilter: "all",
    historyEventKindFilter: "all",
    historyClassKey: "",
    historyClassOptions: [],
    isHistorySearchLoading: false,
  })

  const [selection, dispatchSelection] = React.useReducer(selectionReducer, {
    selectedPaymentIds: [],
    paymentsBulkBusyAction: null,
    checkoutMenuPaymentId: null,
  })

  const [popover, dispatchPopover] = React.useReducer(popoverReducer, {
    paymentHistoryAnchor: null,
    paymentHistoryStudentId: null,
    attendanceHistoryAnchor: null,
    attendanceHistoryStudentId: null,
    auditHistoryAnchor: null,
    auditHistoryStudentId: null,
    auditHistoryStudentName: null,
    userHistoryPayments: [],
    userHistoryLoading: false,
  })

  // Derived
  const isHistoryMode = filter.paymentCategoryFilter === "history"

  // Stable refs — avoid stale closures in callbacks
  const studentSearchQueryRef = React.useRef("")
  const historyPopoverContextRef = React.useRef({ historyFrom: "", historyTo: "", isHistoryMode: false })
  const historySearchDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    studentSearchQueryRef.current = studentSearchQuery
  }, [studentSearchQuery])

  React.useEffect(() => {
    historyPopoverContextRef.current = { historyFrom: filter.historyFrom, historyTo: filter.historyTo, isHistoryMode }
  }, [filter.historyFrom, filter.historyTo, isHistoryMode])

  const fetchPayments = React.useCallback(async (overrideSearchQuery?: string) => {
    const startedAt = Date.now()
    dispatchBoard({ type: "BOARD/SET_LOADING", loading: true })
    if (isHistoryMode && overrideSearchQuery !== undefined) {
      dispatchFilter({ type: "FILTER/SET_HISTORY_SEARCH_LOADING", loading: true })
    }
    try {
      if (isHistoryMode && (!filter.historyFrom || !filter.historyTo || filter.historyFrom > filter.historyTo)) {
        dispatchBoard({ type: "BOARD/RESET_PAYMENTS", emptySummary: createEmptyPaymentsSummary() })
        dispatchFilter({ type: "FILTER/SET_HISTORY_CLASS_OPTIONS", options: [] })
        return
      }

      const url = new URL("/api/staff/payments", window.location.origin)
      const searchParams = buildPaymentsRequestSearchParams({
        isHistoryMode,
        historyFrom: filter.historyFrom,
        historyTo: filter.historyTo,
        studentSearchQuery: overrideSearchQuery ?? studentSearchQueryRef.current,
      })
      url.search = searchParams.toString()
      const res = await fetch(url.toString(), { headers: { "Content-Type": "application/json" } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        setError(typeof data?.error === "string" ? data.error : "Failed to load payments")
        dispatchBoard({ type: "BOARD/RESET_PAYMENTS", emptySummary: createEmptyPaymentsSummary() })
        dispatchFilter({ type: "FILTER/SET_HISTORY_CLASS_OPTIONS", options: [] })
        return
      }
      dispatchBoard({
        type: "BOARD/SET_PAYMENTS",
        payments: Array.isArray(data?.items) ? data.items : [],
        summary: normalizePaymentsSummary(data?.summary),
      })
      dispatchFilter({
        type: "FILTER/SET_HISTORY_CLASS_OPTIONS",
        options: isHistoryMode ? buildHistoryClassOptionsFromApi(data?.classOptions) : [],
      })
    } catch {
      setError("Network error while loading payments")
      dispatchBoard({ type: "BOARD/RESET_PAYMENTS", emptySummary: createEmptyPaymentsSummary() })
      dispatchFilter({ type: "FILTER/SET_HISTORY_CLASS_OPTIONS", options: [] })
    } finally {
      await ensureMinimumLoadingTime(startedAt)
      dispatchBoard({ type: "BOARD/SET_LOADING", loading: false })
      if (isHistoryMode && overrideSearchQuery !== undefined) {
        dispatchFilter({ type: "FILTER/SET_HISTORY_SEARCH_LOADING", loading: false })
      }
    }
  }, [
    createEmptyPaymentsSummary,
    ensureMinimumLoadingTime,
    handleStaffAuthFailure,
    filter.historyFrom,
    filter.historyTo,
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
        dispatchBoard({
          type: "BOARD/SET_SUMMARY",
          summary: createEmptyPaymentsSummary(),
          studentCount: 0,
          checkedInStudents: 0,
        })
        return
      }

      const monthlyPayments = Array.isArray(data?.items) ? (data.items as PaymentRow[]) : []
      const monthlyStudentCards = buildHistoryStudentCards(monthlyPayments)

      dispatchBoard({
        type: "BOARD/SET_SUMMARY",
        summary: normalizePaymentsSummary(data?.summary),
        studentCount: monthlyStudentCards.length,
        checkedInStudents: monthlyStudentCards.filter((item) => Boolean(item.latestAttendedPayment)).length,
      })
    } catch {
      dispatchBoard({
        type: "BOARD/SET_SUMMARY",
        summary: createEmptyPaymentsSummary(),
        studentCount: 0,
        checkedInStudents: 0,
      })
    }
  }, [createEmptyPaymentsSummary, handleStaffAuthFailure, normalizePaymentsSummary])

  // Reset history class key when its option disappears from the latest class options.
  React.useEffect(() => {
    if (!filter.historyClassKey) return
    if (filter.historyClassOptions.some((option) => option.slug === filter.historyClassKey)) return
    dispatchFilter({ type: "FILTER/SET_HISTORY_CLASS_KEY", value: "" })
  }, [filter.historyClassKey, filter.historyClassOptions])

  // Load user payment history for history-range popovers only.
  // Daily PMT history must remain board-scoped to NY-today rows.
  React.useEffect(() => {
    const { historyFrom: activeHistoryFrom, historyTo: activeHistoryTo, isHistoryMode: activeIsHistoryMode } =
      historyPopoverContextRef.current
    const userId = activeIsHistoryMode
      ? (popover.paymentHistoryStudentId || popover.attendanceHistoryStudentId)
      : (popover.attendanceHistoryStudentId || null)
    if (!userId) {
      dispatchPopover({ type: "POPOVER/SET_USER_HISTORY_PAYMENTS", payments: [] })
      return
    }

    let cancelled = false
    dispatchPopover({ type: "POPOVER/SET_USER_HISTORY_PAYMENTS", payments: [] })
    dispatchPopover({ type: "POPOVER/SET_USER_HISTORY_LOADING", loading: true })

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
          dispatchPopover({ type: "POPOVER/SET_USER_HISTORY_PAYMENTS", payments: data.items as PaymentRow[] })
        }
      })
      .catch(() => {
        // Attendance History fallback in history mode only.
        // Daily PMT History is always board-scoped from `payments` at render time.
        if (!cancelled) {
          if (popover.paymentHistoryStudentId && activeIsHistoryMode) {
            dispatchPopover({
              type: "POPOVER/SET_USER_HISTORY_PAYMENTS",
              payments: board.payments.filter((p) => p.userId === userId),
            })
          } else {
            dispatchPopover({ type: "POPOVER/SET_USER_HISTORY_PAYMENTS", payments: [] })
          }
        }
      })
      .finally(() => {
        if (!cancelled) dispatchPopover({ type: "POPOVER/SET_USER_HISTORY_LOADING", loading: false })
      })

    return () => {
      cancelled = true
    }
  }, [popover.attendanceHistoryStudentId, popover.paymentHistoryStudentId, board.payments])

  const handlePaymentCategoryChange = React.useCallback((nextCategory: PaymentCategoryFilter) => {
    dispatchFilter({ type: "FILTER/SET_CATEGORY", category: nextCategory })
    if (nextCategory !== "history") {
      dispatchFilter({ type: "FILTER/CLEAR_HISTORY" })
    }
  }, [])

  const selectPaymentIds = React.useCallback((ids: string[]) => {
    if (ids.length === 0) return
    dispatchSelection({ type: "SELECTION/SELECT_IDS", ids })
  }, [])

  const deselectPaymentIds = React.useCallback((ids: string[]) => {
    if (ids.length === 0) return
    dispatchSelection({ type: "SELECTION/DESELECT_IDS", ids })
  }, [])

  const clearSelectedPayments = React.useCallback(() => {
    dispatchSelection({ type: "SELECTION/CLEAR" })
  }, [])

  const pruneSelectedPaymentIds = React.useCallback((visibleIds: string[]) => {
    dispatchSelection({ type: "SELECTION/PRUNE", visibleIds })
  }, [])

  const updateSettlementBulk = React.useCallback(async ({ action, ids, onSuccess }: UpdateSettlementBulkOptions) => {
    if (ids.length === 0) return
    dispatchSelection({ type: "SELECTION/SET_BULK_BUSY", action })
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
      if (data?.updatedCount === 0) {
        setError("No selected payments were eligible for cash settlement")
        return
      }
      await onSuccess?.()
      dispatchSelection({ type: "SELECTION/DESELECT_IDS", ids })
    } catch {
      setError("Network error while updating settlement in bulk")
    } finally {
      dispatchSelection({ type: "SELECTION/SET_BULK_BUSY", action: null })
    }
  }, [setError])

  // ---------------------------------------------------------------------------
  // Public setters that mirror the original useState setters
  // ---------------------------------------------------------------------------

  const setPaymentsFilter = React.useCallback((value: "all" | "pending" | "paid") => {
    dispatchFilter({ type: "FILTER/SET_PAYMENTS_FILTER", value })
  }, [])

  const setHistoryFrom = React.useCallback((value: string) => {
    dispatchFilter({ type: "FILTER/SET_HISTORY_FROM", value })
  }, [])

  const setHistoryTo = React.useCallback((value: string) => {
    dispatchFilter({ type: "FILTER/SET_HISTORY_TO", value })
  }, [])

  const setHistoryPaymentMethodFilter = React.useCallback((value: HistoryPaymentMethodFilter) => {
    dispatchFilter({ type: "FILTER/SET_HISTORY_PAYMENT_METHOD", value })
  }, [])

  const setHistoryAttendanceFilter = React.useCallback((value: HistoryAttendanceFilter) => {
    dispatchFilter({ type: "FILTER/SET_HISTORY_ATTENDANCE", value })
  }, [])

  const setHistoryEventKindFilter = React.useCallback((value: HistoryEventKindFilter) => {
    dispatchFilter({ type: "FILTER/SET_HISTORY_EVENT_KIND", value })
  }, [])

  const setHistoryClassKey = React.useCallback((value: string) => {
    dispatchFilter({ type: "FILTER/SET_HISTORY_CLASS_KEY", value })
  }, [])

  const setCheckoutMenuPaymentId = React.useCallback((id: string | null) => {
    dispatchSelection({ type: "SELECTION/SET_CHECKOUT_MENU_ID", id })
  }, [])

  const setPaymentHistoryAnchor: React.Dispatch<React.SetStateAction<HTMLElement | null>> = React.useCallback((value) => {
    dispatchPopover({ type: "POPOVER/SET_PAYMENT_HISTORY_ANCHOR", value })
  }, [])

  const setPaymentHistoryStudentId: React.Dispatch<React.SetStateAction<string | null>> = React.useCallback((value) => {
    dispatchPopover({ type: "POPOVER/SET_PAYMENT_HISTORY_STUDENT_ID", value })
  }, [])

  const setAttendanceHistoryAnchor: React.Dispatch<React.SetStateAction<HTMLElement | null>> = React.useCallback((value) => {
    dispatchPopover({ type: "POPOVER/SET_ATTENDANCE_HISTORY_ANCHOR", value })
  }, [])

  const setAttendanceHistoryStudentId: React.Dispatch<React.SetStateAction<string | null>> = React.useCallback((value) => {
    dispatchPopover({ type: "POPOVER/SET_ATTENDANCE_HISTORY_STUDENT_ID", value })
  }, [])

  const setAuditHistoryAnchor: React.Dispatch<React.SetStateAction<HTMLElement | null>> = React.useCallback((value) => {
    dispatchPopover({ type: "POPOVER/SET_AUDIT_HISTORY_ANCHOR", value })
  }, [])

  const setAuditHistoryStudentId: React.Dispatch<React.SetStateAction<string | null>> = React.useCallback((value) => {
    dispatchPopover({ type: "POPOVER/SET_AUDIT_HISTORY_STUDENT_ID", value })
  }, [])

  const setAuditHistoryStudentName: React.Dispatch<React.SetStateAction<string | null>> = React.useCallback((value) => {
    dispatchPopover({ type: "POPOVER/SET_AUDIT_HISTORY_STUDENT_NAME", value })
  }, [])

  return {
    // State
    payments: board.payments,
    paymentsMonthlySummaryApi: board.paymentsMonthlySummaryApi as PaymentsApiSummary,
    paymentsMonthlyStudentCount: board.paymentsMonthlyStudentCount,
    paymentsMonthlyCheckedInStudents: board.paymentsMonthlyCheckedInStudents,
    paymentsLoading: board.paymentsLoading,
    paymentsFilter: filter.paymentsFilter,
    paymentCategoryFilter: filter.paymentCategoryFilter,
    isHistoryMode,
    historyFrom: filter.historyFrom,
    historyTo: filter.historyTo,
    historyPaymentMethodFilter: filter.historyPaymentMethodFilter,
    historyAttendanceFilter: filter.historyAttendanceFilter,
    historyEventKindFilter: filter.historyEventKindFilter,
    historyClassKey: filter.historyClassKey,
    historyClassOptions: filter.historyClassOptions,
    isHistorySearchLoading: filter.isHistorySearchLoading,
    selectedPaymentIds: selection.selectedPaymentIds,
    paymentsBulkBusyAction: selection.paymentsBulkBusyAction,
    checkoutMenuPaymentId: selection.checkoutMenuPaymentId,
    paymentHistoryAnchor: popover.paymentHistoryAnchor,
    paymentHistoryStudentId: popover.paymentHistoryStudentId,
    attendanceHistoryAnchor: popover.attendanceHistoryAnchor,
    attendanceHistoryStudentId: popover.attendanceHistoryStudentId,
    auditHistoryAnchor: popover.auditHistoryAnchor,
    auditHistoryStudentId: popover.auditHistoryStudentId,
    auditHistoryStudentName: popover.auditHistoryStudentName,
    userHistoryPayments: popover.userHistoryPayments,
    userHistoryLoading: popover.userHistoryLoading,
    // UI state setters
    setPaymentsFilter,
    setHistoryFrom,
    setHistoryTo,
    setHistoryPaymentMethodFilter,
    setHistoryAttendanceFilter,
    setHistoryEventKindFilter,
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
