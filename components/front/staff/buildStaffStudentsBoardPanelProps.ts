import type React from "react"

import type StaffStudentsBoardPanel from "./StaffStudentsBoardPanel"
import type { useStaffDirectoryAdmin } from "./useStaffDirectoryAdmin"
import type { useStaffPaymentsAdmin } from "./useStaffPaymentsAdmin"
import type { useStaffPinAdmin } from "./useStaffPinAdmin"
import type { useStaffPortalShellAdmin } from "./useStaffPortalShellAdmin"
import type { useStaffStudentAuditAdmin } from "./useStaffStudentAuditAdmin"
import type { useStaffStudentsBoardAdmin } from "./useStaffStudentsBoardAdmin"
import type { useStaffCreateStudentAdmin } from "./useStaffCreateStudentAdmin"
import type { StaffRole } from "@/lib/security/staff-role"
import type { StaffCategory } from "@/lib/security/staff-category"
import { canOperateStudentEdits } from "@/lib/security/staff-access"
import { resolveHistoryRangeState } from "./staffAdminFormatters"

type StaffStudentsBoardPanelProps = React.ComponentProps<typeof StaffStudentsBoardPanel>

type BuildStaffStudentsBoardPanelPropsInput = {
  isStudentsView: boolean
  currentRole: StaffRole
  currentCategory: StaffCategory | null
  studentSearchQuery: string
  setStudentSearchQuery: React.Dispatch<React.SetStateAction<string>>
  portalShellAdmin: ReturnType<typeof useStaffPortalShellAdmin>
  staffDirectoryAdmin: ReturnType<typeof useStaffDirectoryAdmin>
  paymentsAdmin: ReturnType<typeof useStaffPaymentsAdmin>
  pinAdmin: ReturnType<typeof useStaffPinAdmin>
  studentsBoardAdmin: ReturnType<typeof useStaffStudentsBoardAdmin>
  studentAuditAdmin: ReturnType<typeof useStaffStudentAuditAdmin>
  createStudentAdmin?: ReturnType<typeof useStaffCreateStudentAdmin>
  formatMoney: (amount: number, currency?: string) => string
}

export function buildStaffStudentsBoardPanelProps({
  isStudentsView,
  currentRole,
  currentCategory,
  studentSearchQuery,
  setStudentSearchQuery,
  portalShellAdmin,
  staffDirectoryAdmin,
  paymentsAdmin,
  pinAdmin,
  studentsBoardAdmin,
  studentAuditAdmin,
  createStudentAdmin,
  formatMoney,
}: BuildStaffStudentsBoardPanelPropsInput): StaffStudentsBoardPanelProps {
  const {
    nowTs,
    canManageClerkSync,
    canOperateStudentPins,
  } = portalShellAdmin
  const {
    clerkSyncHealth,
    clerkSyncLoading,
    clerkSyncRepairing,
    clerkSyncError,
    directoryStatusMessage,
    clerkSyncMessage,
    clerkSyncUserBusyId,
    clerkMismatchByUserId,
    fetchClerkSyncHealth,
    repairClerkSync,
    syncClerkUser,
  } = staffDirectoryAdmin
  const {
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
    paymentHistoryStudentId,
    attendanceHistoryStudentId,
    setPaymentsFilter,
    setHistoryFrom,
    setHistoryTo,
    setHistoryPaymentMethodFilter,
    setHistoryAttendanceFilter,
    setHistoryClassKey,
    setPaymentHistoryAnchor,
    setPaymentHistoryStudentId,
    setAttendanceHistoryAnchor,
    setAttendanceHistoryStudentId,
    setAuditHistoryAnchor,
    setAuditHistoryStudentId,
    setAuditHistoryStudentName,
    handlePaymentCategoryChange,
    selectPaymentIds,
    deselectPaymentIds,
    clearSelectedPayments,
  } = paymentsAdmin
  const {
    prioritizedTerminalPinAlerts,
    hasAnyTerminalPinAlerts,
    refreshPaymentsBoard,
    openStudentPinModal,
    openStudentPinModalForProfile,
  } = pinAdmin
  const {
    currentPage,
    setCurrentPage,
    filteredStudentCards,
    searchResultCards,
    isGlobalSearchLoading,
    globalSearchError,
    handleSettlementBulkUpdate,
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
  } = studentsBoardAdmin
  const {
    usersWithAuditEntries,
    openOverrideModal,
  } = studentAuditAdmin

  return {
    isStudentsView,
    loadingStatus: {
      paymentsLoading,
      onRefreshPaymentsBoard: () => void refreshPaymentsBoard(),
    },
    clerkSync: {
      canManageClerkSync,
      clerkSyncLoading,
      clerkSyncRepairing,
      clerkSyncError: clerkSyncError || directoryStatusMessage,
      clerkSyncMessage,
      clerkSyncHealth,
      onCheckClerkSync: () => void fetchClerkSyncHealth(),
      onRepairClerkSync: () => void repairClerkSync(),
      clerkMismatchByUserId,
      clerkSyncUserBusyId,
      onSyncClerkUser: (userId) => void syncClerkUser(userId),
    },
    terminalAlerts: {
      prioritizedTerminalPinAlerts,
      hasAnyTerminalPinAlerts,
      nowTs,
    },
    controls: {
      studentsSummary,
      paymentCategoryFilter,
      onPaymentCategoryChange: handlePaymentCategoryChange,
      studentSearchQuery,
      setStudentSearchQuery,
      isGlobalSearchLoading,
      isHistorySearchLoading,
      globalSearchError,
      paymentsFilter,
      setPaymentsFilter,
      isHistoryMode,
      historyFrom,
      historyTo,
      onHistoryRangeChange: (start, end) => {
        const nextRange = resolveHistoryRangeState(start, end)
        setHistoryFrom(nextRange.historyFrom)
        setHistoryTo(nextRange.historyTo)
        setHistoryClassKey("")
      },
      todayDateIso,
      historyReadableRange,
      historyClassKey,
      setHistoryClassKey,
      historyClassOptions,
      historyPaymentMethodFilter,
      setHistoryPaymentMethodFilter,
      historyAttendanceFilter,
      setHistoryAttendanceFilter,
      historyDerivedStats,
      filteredStudentCardsLength: filteredStudentCards.length,
      visiblePaymentIds,
      selectPaymentIds,
      clearSelectedPayments,
      selectedFilteredPaymentIdsLength: selectedFilteredPaymentIds.length,
      cashSelectedCount,
      paymentsBulkBusyAction,
      selectedPaymentIds,
      onSettlementBulkUpdate: (action, ids) => void handleSettlementBulkUpdate(action, ids),
      hasGlobalSearchResults: searchResultCards !== null,
    },
    cards: {
      displayedStudentCards,
      filteredStudentCardsCount: filteredStudentCards.length,
      searchResultCards,
      shouldPreservePaymentBoard,
      cardContext,
      cardVariant,
      studentSearchQuery,
      historyFrom,
      historyTo,
      selectedPaymentIds,
      selectPaymentIds,
      deselectPaymentIds,
      onSettlementBulkUpdate: (action, ids) => void handleSettlementBulkUpdate(action, ids),
      paymentHistoryStudentId,
      attendanceHistoryStudentId,
      setPaymentHistoryAnchor,
      setAttendanceHistoryAnchor,
      setPaymentHistoryStudentId,
      setAttendanceHistoryStudentId,
      setAuditHistoryAnchor,
      setAuditHistoryStudentId,
      setAuditHistoryStudentName,
      usersWithAuditEntries,
      canOperateStudentPins,
      openStudentPinModal,
      openStudentPinModalForProfile,
      openOverrideModal,
      currentRole,
      currentCategory,
      formatMoney,
    },
    pagination: {
      currentPage,
      totalPages,
      setCurrentPage,
    },
    createStudent: createStudentAdmin && canOperateStudentEdits(currentRole, currentCategory)
      ? createStudentAdmin
      : null,
  }
}
