import React from "react"

import {
  buildHistoryStudentCard,
  buildHistoryStudentCards,
  resolveCardContext,
  resolveCardVariant,
  type CardContext,
  type StudentProfileCard,
} from "@/components/front/staff/historyCardAggregates"
import { useStudentGlobalSearch } from "@/components/front/staff/useStudentGlobalSearch"
import { parseIsoDate } from "@/lib/class-schedule"
import type { StaffRole } from "@/lib/security/staff-role"
import type { StaffCategory } from "@/lib/security/staff-category"
import { canOperateStudentEdits } from "@/lib/security/staff-access"

import {
  isCompletedClassEvidence,
  isPaymentPaidForUi,
  resolveDailyVisiblePayment,
} from "./paymentState"
import {
  getOpenPaymentIds,
  resolveVisibleProfileSettlementIds,
} from "./staffPaymentCardPresentation"
import {
  buildCurrentMonthStudentsSummary,
  matchesStripeStatus,
  resolveDirectClassRevenueCents,
  resolveStudentCardPayments,
} from "./staffPaymentFilters"
import { resolveHistoryDateIso } from "./staffAdminFormatters"
import type {
  HistoryAttendanceFilter,
  HistoryPaymentMethodFilter,
  PaymentCategoryFilter,
  PaymentRow,
  PaymentsApiSummary,
} from "./staffAdminTypes"
import type { StaffAuthedFetch } from "./useStaffPortalShellAdmin"

const PAGE_SIZE = 9
const STAFF_BOARD_POLL_BACKOFF_MAX_MS = 60_000

const nextPollBackoffMs = (response: Response | null, failures: number) => {
  const retryAfterSec = response ? Number(response.headers.get("Retry-After")) : NaN
  if (Number.isFinite(retryAfterSec) && retryAfterSec > 0) {
    return Math.min(retryAfterSec * 1000, STAFF_BOARD_POLL_BACKOFF_MAX_MS)
  }
  return Math.min(5_000 * Math.max(1, 2 ** Math.max(0, failures - 1)), STAFF_BOARD_POLL_BACKOFF_MAX_MS)
}

const isDegradedStaffServiceResponse = (response: Response, payload?: unknown) => {
  if (response.headers.get("X-Staff-Service-Status") === "degraded") return true
  return Boolean(payload && typeof payload === "object" && (payload as { status?: unknown }).status === "degraded")
}

const backOffStaffBoardPoll = (response: Response | null, failuresRef: React.MutableRefObject<number>, backoffUntilRef: React.MutableRefObject<number>) => {
  failuresRef.current += 1
  backoffUntilRef.current = Date.now() + nextPollBackoffMs(response, failuresRef.current)
}

type UpdateSettlementBulk = (options: {
  action: "mark_paid" | "mark_pending"
  ids: string[]
  onSuccess: () => Promise<void>
}) => Promise<void>

type UseStaffStudentsBoardAdminOptions = {
  payments: PaymentRow[]
  isHistoryMode: boolean
  historyClassKey: string
  historyPaymentMethodFilter: HistoryPaymentMethodFilter
  historyAttendanceFilter: HistoryAttendanceFilter
  historyFrom: string
  historyTo: string
  paymentCategoryFilter: PaymentCategoryFilter
  paymentsFilter: "all" | "pending" | "paid"
  studentSearchQuery: string
  selectedPaymentIds: string[]
  paymentsMonthlySummaryApi: PaymentsApiSummary
  paymentsMonthlyStudentCount: number
  paymentsMonthlyCheckedInStudents: number
  nowTs: number
  currentRole: StaffRole
  currentCategory: StaffCategory | null
  usersWithAuditEntries: Set<string>
  checkUserHasAuditEntries: (userId: string) => Promise<void>
  pruneSelectedPaymentIds: (visibleIds: string[]) => void
  updateSettlementBulk: UpdateSettlementBulk
  refreshPaymentsBoard: () => Promise<void>
  handleStaffAuthFailure: (status: number) => boolean
  staffAuthedFetch: StaffAuthedFetch
}

export function useStaffStudentsBoardAdmin({
  payments,
  isHistoryMode,
  historyClassKey,
  historyPaymentMethodFilter,
  historyAttendanceFilter,
  historyFrom,
  historyTo,
  paymentCategoryFilter,
  paymentsFilter,
  studentSearchQuery,
  selectedPaymentIds,
  paymentsMonthlySummaryApi,
  paymentsMonthlyStudentCount,
  paymentsMonthlyCheckedInStudents,
  nowTs,
  currentRole,
  currentCategory,
  usersWithAuditEntries,
  checkUserHasAuditEntries,
  pruneSelectedPaymentIds,
  updateSettlementBulk,
  refreshPaymentsBoard,
  handleStaffAuthFailure,
  staffAuthedFetch,
}: UseStaffStudentsBoardAdminOptions) {
  const [currentPage, setCurrentPage] = React.useState(1)
  const [isCollectedOrdering, setIsCollectedOrdering] = React.useState(false)

  const studentCards = React.useMemo(
    () => buildHistoryStudentCards(payments, { mode: isHistoryMode ? "history" : "daily" }),
    [isHistoryMode, payments]
  )
  const currentDateNY = React.useMemo(
    () => resolveHistoryDateIso(new Date(nowTs), "America/New_York"),
    [nowTs]
  )

  const boardContextStudentCards = React.useMemo(() => {
    return studentCards
      .map((item) => {
        const matchingPayments = resolveStudentCardPayments(item.allPayments, {
          isHistoryMode,
          historyClassKey,
          historyPaymentMethodFilter,
          historyAttendanceFilter,
          paymentCategoryFilter,
          paymentsFilter,
          studentSearchQuery: "",
        })
        if (matchingPayments.length === 0) return null

        return {
          ...(isHistoryMode ? buildHistoryStudentCard(matchingPayments, item.key, { mode: "history" }) : item),
          allPayments: isHistoryMode ? matchingPayments : item.allPayments,
          latestPayment: isHistoryMode ? matchingPayments[0] : resolveDailyVisiblePayment(matchingPayments) || matchingPayments[0],
        }
      })
      .filter((item): item is (typeof studentCards)[number] => Boolean(item))
  }, [historyAttendanceFilter, historyClassKey, historyPaymentMethodFilter, isHistoryMode, paymentCategoryFilter, paymentsFilter, studentCards])

  const filteredStudentCards = React.useMemo(() => {
    const cards = boardContextStudentCards
      .map((item) => {
        const matchingPayments = resolveStudentCardPayments(item.allPayments, {
          isHistoryMode,
          historyClassKey,
          historyPaymentMethodFilter,
          historyAttendanceFilter,
          paymentCategoryFilter,
          paymentsFilter,
          studentSearchQuery,
        })
        if (matchingPayments.length === 0) return null

        return {
          ...(isHistoryMode ? buildHistoryStudentCard(matchingPayments, item.key, { mode: "history" }) : item),
          allPayments: isHistoryMode ? matchingPayments : item.allPayments,
          latestPayment: isHistoryMode ? matchingPayments[0] : resolveDailyVisiblePayment(matchingPayments) || matchingPayments[0],
        }
      })
      .filter((item): item is (typeof boardContextStudentCards)[number] => Boolean(item))
    if (!isCollectedOrdering) return cards

    return cards
      .map((item, index) => ({
        item,
        index,
        spend: resolveStudentCardPayments(item.allPayments, {
          isHistoryMode,
          historyClassKey,
          historyPaymentMethodFilter,
          historyAttendanceFilter,
          paymentCategoryFilter,
          paymentsFilter,
          studentSearchQuery,
        }).reduce((sum, payment) => sum + payment.amount, 0),
      }))
      .sort((left, right) => right.spend - left.spend || left.index - right.index)
      .map(({ item }) => item)
  }, [boardContextStudentCards, historyAttendanceFilter, historyClassKey, historyPaymentMethodFilter, isCollectedOrdering, isHistoryMode, paymentCategoryFilter, paymentsFilter, studentSearchQuery])

  const {
    searchResultCards,
    isGlobalSearchLoading,
    globalSearchError,
    triggerGlobalSearch,
  } = useStudentGlobalSearch({
    query: studentSearchQuery,
    isHistoryMode,
    hasClientMatches: filteredStudentCards.length > 0,
    onAuthFailure: handleStaffAuthFailure,
  })

  const handleSettlementBulkUpdate = React.useCallback(async (action: "mark_paid" | "mark_pending", ids: string[]) => {
    await updateSettlementBulk({
      action,
      ids,
      onSuccess: async () => {
        await refreshPaymentsBoard()
        if (searchResultCards !== null && studentSearchQuery.trim().length >= 2) {
          await triggerGlobalSearch(studentSearchQuery.trim())
        }
      },
    })
  }, [refreshPaymentsBoard, searchResultCards, studentSearchQuery, triggerGlobalSearch, updateSettlementBulk])

  const filteredPaymentIds = React.useMemo(() => {
    if (searchResultCards !== null) {
      return resolveVisibleProfileSettlementIds(searchResultCards)
    }
    if (paymentCategoryFilter !== "cash" && !isHistoryMode) return []
    return [...new Set(filteredStudentCards.flatMap((item) => {
      if (isHistoryMode) {
        return item.allPayments
          .filter((p) => p.paymentChannel === "cash" && p.settlementStatus !== "paid")
          .map((p) => p.id)
      }
      const openIds = getOpenPaymentIds(item.allPayments)
      return openIds.length > 0 ? openIds : item.allPayments.filter((p) => p.paymentChannel === "cash").map((p) => p.id)
    }))]
  }, [filteredStudentCards, isHistoryMode, paymentCategoryFilter, searchResultCards])

  const cardContext = React.useMemo<CardContext>(
    () => resolveCardContext(isHistoryMode, searchResultCards !== null),
    [isHistoryMode, searchResultCards]
  )
  const cardVariant = React.useMemo(
    () => resolveCardVariant(cardContext),
    [cardContext]
  )

  const totalPages = React.useMemo(() => {
    const activeCount = searchResultCards !== null ? searchResultCards.length : filteredStudentCards.length
    return Math.max(1, Math.ceil(activeCount / PAGE_SIZE))
  }, [filteredStudentCards.length, searchResultCards])

  const paginatedStudentCards = React.useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredStudentCards.slice(start, start + PAGE_SIZE)
  }, [currentPage, filteredStudentCards])

  const paginatedBoardContextStudentCards = React.useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return boardContextStudentCards.slice(start, start + PAGE_SIZE)
  }, [boardContextStudentCards, currentPage])

  const paginatedSearchResultCards = React.useMemo(() => {
    if (searchResultCards === null) return []
    const start = (currentPage - 1) * PAGE_SIZE
    return searchResultCards.slice(start, start + PAGE_SIZE)
  }, [currentPage, searchResultCards])

  const shouldPreservePaymentBoard = !isHistoryMode && studentSearchQuery.trim().length >= 2 && filteredStudentCards.length === 0 && searchResultCards === null

  const displayedStudentCards = React.useMemo<Array<(typeof studentCards)[number] | StudentProfileCard>>(() => {
    if (searchResultCards !== null) return paginatedSearchResultCards
    if (shouldPreservePaymentBoard) return paginatedBoardContextStudentCards
    return paginatedStudentCards
  }, [paginatedBoardContextStudentCards, paginatedSearchResultCards, paginatedStudentCards, searchResultCards, shouldPreservePaymentBoard])

  const visiblePaymentIds = React.useMemo(() => {
    if (searchResultCards !== null) {
      return resolveVisibleProfileSettlementIds(paginatedSearchResultCards)
    }
    if (paymentCategoryFilter !== "cash" && !isHistoryMode) return []
    return [...new Set(paginatedStudentCards.flatMap((item) => {
      if (isHistoryMode) {
        return item.allPayments
          .filter((p) => p.paymentChannel === "cash" && p.settlementStatus !== "paid")
          .map((p) => p.id)
      }
      const openIds = getOpenPaymentIds(item.allPayments)
      return openIds.length > 0 ? openIds : item.allPayments.filter((p) => p.paymentChannel === "cash").map((p) => p.id)
    }))]
  }, [isHistoryMode, paginatedSearchResultCards, paginatedStudentCards, paymentCategoryFilter, searchResultCards])

  const selectedFilteredPaymentIds = React.useMemo(
    () => selectedPaymentIds.filter((id) => filteredPaymentIds.includes(id)),
    [filteredPaymentIds, selectedPaymentIds]
  )

  // Cash selections (checkboxes only appear for cash payments)
  const cashSelectedCount = selectedPaymentIds.length

  React.useEffect(() => {
    pruneSelectedPaymentIds(filteredPaymentIds)
  }, [filteredPaymentIds, pruneSelectedPaymentIds])

  React.useEffect(() => {
    setCurrentPage(1)
  }, [historyAttendanceFilter, historyClassKey, historyPaymentMethodFilter, isHistoryMode, paymentCategoryFilter, paymentsFilter, searchResultCards, studentSearchQuery])

  // Check which displayed students have audit entries in the current month.
  // Runs for all callers that can view the Change history button (owner, admin,
  // front_desk) so the audit badge appears correctly for each allowed role.
  React.useEffect(() => {
    if (!canOperateStudentEdits(currentRole, currentCategory)) return

    const userIds = displayedStudentCards
      .map((card) => ("source" in card && card.source === "profile" ? card.userId : card.latestPayment?.userId))
      .filter((id): id is string => Boolean(id) && !usersWithAuditEntries.has(id))

    // Check in batches to avoid too many requests
    const uniqueIds = [...new Set(userIds)].slice(0, 10)
    uniqueIds.forEach((userId) => {
      void checkUserHasAuditEntries(userId)
    })
  }, [displayedStudentCards, currentRole, currentCategory, checkUserHasAuditEntries, usersWithAuditEntries])

  React.useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages))
  }, [totalPages])

  const historyDerivedStats = React.useMemo(() => {
    const scopedPayments = filteredStudentCards.flatMap((item) => item.allPayments)
    const isHistoryPaymentPaid = (payment: PaymentRow) =>
      payment.paymentChannel === "cash" ? payment.settlementStatus === "paid" : isPaymentPaidForUi(payment)
    const studentCount = filteredStudentCards.length
    const paidCount = filteredStudentCards.filter((item) => isHistoryPaymentPaid(item.latestPayment)).length
    const checkedInCount = filteredStudentCards.filter((item) => item.allPayments.some(isCompletedClassEvidence)).length
    const totalCollected = filteredStudentCards.reduce((sum, item) => sum + resolveDirectClassRevenueCents(item.allPayments), 0)
    // Count exactly the students the Pending status filter would keep, so
    // clicking the Pending card never disagrees with the list it filters.
    const pendingCount = filteredStudentCards.filter((item) =>
      item.allPayments.some((payment) => matchesStripeStatus(payment, "pending"))
    ).length
    const packages = scopedPayments.filter((p) => p.purchaseCategory === "package").length
    const dropIn = scopedPayments.filter((p) => p.purchaseCategory === "dropin").length
    return { studentCount, paidCount, pendingCount, totalCollected, checkedInCount, packages, dropIn }
  }, [filteredStudentCards])

  const currentMonthStudentsSummary = React.useMemo(
    () =>
      buildCurrentMonthStudentsSummary({
        summary: paymentsMonthlySummaryApi,
        studentCount: paymentsMonthlyStudentCount,
        checkedInStudents: paymentsMonthlyCheckedInStudents,
      }),
    [paymentsMonthlyCheckedInStudents, paymentsMonthlyStudentCount, paymentsMonthlySummaryApi]
  )

  const studentsSummary = React.useMemo(() => {
    if (paymentCategoryFilter === "history") {
      return currentMonthStudentsSummary
    }
    return {
      totalStudents: filteredStudentCards.length,
      paidStudents: filteredStudentCards.filter((item) => isPaymentPaidForUi(item.latestPayment)).length,
      checkedInStudents: filteredStudentCards.filter((item) => item.allPayments.some(isCompletedClassEvidence)).length,
      totalRevenueCents: filteredStudentCards.reduce((sum, item) => sum + resolveDirectClassRevenueCents(item.allPayments), 0),
      pendingByContext: filteredStudentCards.filter((item) => {
        if (paymentCategoryFilter === "cash") return item.latestPayment.settlementStatus === "pending"
        if (!isPaymentPaidForUi(item.latestPayment)) return true
        const balance = "outstandingBalance" in item && typeof item.outstandingBalance === "number" ? item.outstandingBalance : item.latestPayment.outstandingBalance
        return typeof balance === "number" && balance > 0
      }).length,
    }
  }, [currentMonthStudentsSummary, filteredStudentCards, paymentCategoryFilter])

  const todayDateIso = React.useMemo(
    () => resolveHistoryDateIso(new Date(nowTs), "America/New_York"),
    [nowTs]
  )

  // Short date format for history range badge: "wed 25 mar 26"
  const formatShortDate = (dateIso: string) => {
    const parsed = parseIsoDate(dateIso)
    if (!parsed) return dateIso
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "2-digit",
      }).formatToParts(parsed)
      const weekday = parts.find((p) => p.type === "weekday")?.value ?? ""
      const day = parts.find((p) => p.type === "day")?.value ?? ""
      const month = parts.find((p) => p.type === "month")?.value ?? ""
      const year = parts.find((p) => p.type === "year")?.value ?? ""
      return `${weekday} ${day} ${month} ${year}`
    } catch {
      return dateIso
    }
  }

  const historyReadableRange = React.useMemo(() => {
    if (!historyFrom || !historyTo) return ""
    if (historyFrom === historyTo) return formatShortDate(historyFrom)
    return `${formatShortDate(historyFrom)} → ${formatShortDate(historyTo)}`
  }, [historyFrom, historyTo])

  // ─── Web-cash arrival polling ─────────────────────────────
  const [webCashArrivals, setWebCashArrivals] = React.useState<Array<{
    attendanceId: string
    userName: string
    courseTitle: string
    cashAmountCents: number
    checkedInAt: string
  }>>([])
  const webCashLastPolledRef = React.useRef<string>(new Date().toISOString())
  const webCashSeenIdsRef = React.useRef<Set<string>>(new Set())
  const webCashBackoffUntilRef = React.useRef(0)
  const webCashFailuresRef = React.useRef(0)
  const webCashInFlightRef = React.useRef(false)

  React.useEffect(() => {
    if (isHistoryMode) return
    const poll = async () => {
      if (webCashInFlightRef.current || Date.now() < webCashBackoffUntilRef.current) return
      webCashInFlightRef.current = true
      try {
        const res = await staffAuthedFetch(`/api/staff/checkin/web-cash-arrivals?since=${encodeURIComponent(webCashLastPolledRef.current)}`)
        if (!res.ok) {
          if (handleStaffAuthFailure(res.status)) return
          backOffStaffBoardPoll(res, webCashFailuresRef, webCashBackoffUntilRef)
          return
        }
        if (isDegradedStaffServiceResponse(res)) {
          backOffStaffBoardPoll(res, webCashFailuresRef, webCashBackoffUntilRef)
          return
        }
        webCashFailuresRef.current = 0
        webCashBackoffUntilRef.current = 0
        const data = await res.json()
        if (!Array.isArray(data) || data.length === 0) return

        const newArrivals = data.filter(
          (item: { attendanceId: string }) => !webCashSeenIdsRef.current.has(item.attendanceId)
        )
        if (newArrivals.length === 0) return

        for (const arrival of newArrivals) {
          webCashSeenIdsRef.current.add(arrival.attendanceId)
        }
        setWebCashArrivals((prev) => [...newArrivals, ...prev].slice(0, 10))
        webCashLastPolledRef.current = new Date().toISOString()
        // Refresh the board so new arrivals appear as cards
        void refreshPaymentsBoard()
      } catch {
        backOffStaffBoardPoll(null, webCashFailuresRef, webCashBackoffUntilRef)
        // Silently ignore polling errors
      } finally {
        webCashInFlightRef.current = false
      }
    }

    void poll()
    const interval = window.setInterval(poll, 10_000)
    return () => window.clearInterval(interval)
  }, [handleStaffAuthFailure, isHistoryMode, refreshPaymentsBoard, staffAuthedFetch])

  const dismissWebCashArrival = React.useCallback((attendanceId: string) => {
    setWebCashArrivals((prev) => prev.filter((item) => item.attendanceId !== attendanceId))
  }, [])

  // ─── Smart board refresh via lightweight pulse endpoint ────────────────
  const pulseRef = React.useRef<{ purchaseCount: number; attendanceCount: number; latestPurchaseAt: string | null } | null>(null)
  const pulseBackoffUntilRef = React.useRef(0)
  const pulseFailuresRef = React.useRef(0)
  const pulseInFlightRef = React.useRef(false)

  React.useEffect(() => {
    if (isHistoryMode) return
    const poll = async () => {
      if (pulseInFlightRef.current || Date.now() < pulseBackoffUntilRef.current) return
      pulseInFlightRef.current = true
      try {
        const res = await staffAuthedFetch("/api/staff/payments/pulse")
        if (!res.ok) {
          if (handleStaffAuthFailure(res.status)) return
          backOffStaffBoardPoll(res, pulseFailuresRef, pulseBackoffUntilRef)
          return
        }
        const data = await res.json()
        if (isDegradedStaffServiceResponse(res, data)) {
          backOffStaffBoardPoll(res, pulseFailuresRef, pulseBackoffUntilRef)
          return
        }
        pulseFailuresRef.current = 0
        pulseBackoffUntilRef.current = 0
        const prev = pulseRef.current
        if (prev && (
          data.purchaseCount !== prev.purchaseCount ||
          data.attendanceCount !== prev.attendanceCount ||
          data.latestPurchaseAt !== prev.latestPurchaseAt
        )) {
          void refreshPaymentsBoard()
        }
        pulseRef.current = data
      } catch {
        backOffStaffBoardPoll(null, pulseFailuresRef, pulseBackoffUntilRef)
        // Silently ignore pulse errors
      } finally {
        pulseInFlightRef.current = false
      }
    }

    // Initial pulse (no refresh, just cache baseline)
    void poll()
    const interval = window.setInterval(poll, 15_000)
    return () => window.clearInterval(interval)
  }, [handleStaffAuthFailure, isHistoryMode, refreshPaymentsBoard, staffAuthedFetch])

  return {
    currentPage,
    setCurrentPage,
    studentCards,
    currentDateNY,
    boardContextStudentCards,
    filteredStudentCards,
    searchResultCards,
    isGlobalSearchLoading,
    globalSearchError,
    handleSettlementBulkUpdate,
    filteredPaymentIds,
    cardContext,
    cardVariant,
    totalPages,
    displayedStudentCards,
    visiblePaymentIds,
    selectedFilteredPaymentIds,
    cashSelectedCount,
    isCollectedOrdering,
    activateCollectedOrdering: () => setIsCollectedOrdering(true),
    deactivateCollectedOrdering: () => setIsCollectedOrdering(false),
    historyDerivedStats,
    studentsSummary,
    todayDateIso,
    historyReadableRange,
    shouldPreservePaymentBoard,
    webCashArrivals,
    dismissWebCashArrival,
  }
}
