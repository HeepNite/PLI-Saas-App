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

const PAGE_SIZE = 9

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
}: UseStaffStudentsBoardAdminOptions) {
  const [currentPage, setCurrentPage] = React.useState(1)

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
          // Preserve original allPayments for tooltip history display
          allPayments: item.allPayments,
          latestPayment: isHistoryMode ? matchingPayments[0] : resolveDailyVisiblePayment(matchingPayments) || matchingPayments[0],
        }
      })
      .filter((item): item is (typeof studentCards)[number] => Boolean(item))
  }, [historyAttendanceFilter, historyClassKey, historyPaymentMethodFilter, isHistoryMode, paymentCategoryFilter, paymentsFilter, studentCards])

  const filteredStudentCards = React.useMemo(() => {
    return boardContextStudentCards
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
          // Preserve original allPayments for tooltip history display
          allPayments: item.allPayments,
          latestPayment: isHistoryMode ? matchingPayments[0] : resolveDailyVisiblePayment(matchingPayments) || matchingPayments[0],
        }
      })
      .filter((item): item is (typeof boardContextStudentCards)[number] => Boolean(item))
  }, [boardContextStudentCards, historyAttendanceFilter, historyClassKey, historyPaymentMethodFilter, isHistoryMode, paymentCategoryFilter, paymentsFilter, studentSearchQuery])

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
    if (paymentCategoryFilter !== "cash") return []
    return [...new Set(filteredStudentCards.flatMap((item) => {
      const openIds = getOpenPaymentIds(item.allPayments)
      return openIds.length > 0 ? openIds : item.allPayments.filter((p) => p.paymentChannel === "cash").map((p) => p.id)
    }))]
  }, [filteredStudentCards, paymentCategoryFilter, searchResultCards])

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
    if (paymentCategoryFilter !== "cash") return []
    return [...new Set(paginatedStudentCards.flatMap((item) => {
      const openIds = getOpenPaymentIds(item.allPayments)
      return openIds.length > 0 ? openIds : item.allPayments.filter((p) => p.paymentChannel === "cash").map((p) => p.id)
    }))]
  }, [paginatedSearchResultCards, paginatedStudentCards, paymentCategoryFilter, searchResultCards])

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
    const studentCount = filteredStudentCards.length
    const paidCount = filteredStudentCards.filter((item) => isPaymentPaidForUi(item.latestPayment)).length
    const checkedInCount = filteredStudentCards.filter((item) => item.allPayments.some(isCompletedClassEvidence)).length
    const totalCollected = filteredStudentCards.reduce((sum, item) => sum + resolveDirectClassRevenueCents(item.allPayments), 0)
    const pendingCount = filteredStudentCards.filter((item) => {
      if (!isPaymentPaidForUi(item.latestPayment)) return true
      const balance = "outstandingBalance" in item && typeof item.outstandingBalance === "number" ? item.outstandingBalance : item.latestPayment.outstandingBalance
      return typeof balance === "number" && balance > 0
    }).length
    const packages = payments.filter((p) => p.purchaseCategory === "package").length
    const dropIn = payments.filter((p) => p.purchaseCategory === "dropin").length
    return { studentCount, paidCount, pendingCount, totalCollected, checkedInCount, packages, dropIn }
  }, [filteredStudentCards, payments])

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

  React.useEffect(() => {
    if (isHistoryMode) return
    const poll = async () => {
      try {
        const res = await fetch(`/api/staff/checkin/web-cash-arrivals?since=${encodeURIComponent(webCashLastPolledRef.current)}`)
        if (!res.ok) return
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
      } catch {
        // Silently ignore polling errors
      }
    }

    void poll()
    const interval = window.setInterval(poll, 10_000)
    return () => window.clearInterval(interval)
  }, [isHistoryMode])

  const dismissWebCashArrival = React.useCallback((attendanceId: string) => {
    setWebCashArrivals((prev) => prev.filter((item) => item.attendanceId !== attendanceId))
  }, [])

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
    historyDerivedStats,
    studentsSummary,
    todayDateIso,
    historyReadableRange,
    shouldPreservePaymentBoard,
    webCashArrivals,
    dismissWebCashArrival,
  }
}
