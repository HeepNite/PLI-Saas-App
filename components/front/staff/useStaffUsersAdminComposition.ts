import React from "react"

import type { StaffRole } from "@/lib/security/staff-role"
import type { StaffCategory } from "@/lib/security/staff-category"
import type { StepEnabledContext, SchoolWizardState } from "@/components/front/staff/school"
import type { AssignmentCourseOption, CourseLinkRow } from "./staffAdminTypes"
import { getInitials } from "./staffPaymentCardPresentation"
import { buildStaffSchoolWorkspaceProps } from "./buildStaffSchoolWorkspaceProps"
import { buildStaffStudentsBoardPanelProps } from "./buildStaffStudentsBoardPanelProps"
import { buildStaffUsersAdminViewProps } from "./buildStaffUsersAdminViewProps"
import type { StaffUsersAdminViewProps } from "./StaffUsersAdminView"
import type { useStaffAssistantAdmin } from "./useStaffAssistantAdmin"
import type { useStaffCourseLinksAdmin } from "./useStaffCourseLinksAdmin"
import type { useStaffCoursesAdmin } from "./useStaffCoursesAdmin"
import type { useStaffCreateAdmin } from "./useStaffCreateAdmin"
import type { useStaffDirectoryAdmin } from "./useStaffDirectoryAdmin"
import type { useStaffPaymentsAdmin } from "./useStaffPaymentsAdmin"
import type { useStaffPayrollAdmin } from "./useStaffPayrollAdmin"
import type { useStaffPinAdmin } from "./useStaffPinAdmin"
import type { useStaffPortalShellAdmin } from "./useStaffPortalShellAdmin"
import type { useStaffProfileModalAdmin } from "./useStaffProfileModalAdmin"
import type { useStaffProfileScheduleAdmin } from "./useStaffProfileScheduleAdmin"
import type { useStaffReportsAdmin } from "./useStaffReportsAdmin"
import type { useStaffRequestsAdmin } from "./useStaffRequestsAdmin"
import type { useStaffRoomsAdmin } from "./useStaffRoomsAdmin"
import type { useStaffScheduleAdmin } from "./useStaffScheduleAdmin"
import type { useStaffSchoolCatalogAdmin } from "./useStaffSchoolCatalogAdmin"
import type { useStaffSelfProfileAdmin } from "./useStaffSelfProfileAdmin"
import type { useStaffStudentAuditAdmin } from "./useStaffStudentAuditAdmin"
import type { useStaffStudentsBoardAdmin } from "./useStaffStudentsBoardAdmin"
import type { useStaffCreateStudentAdmin } from "./useStaffCreateStudentAdmin"
import type { useStaffTeacherAdmin } from "./useStaffTeacherAdmin"

type StaffUsersAdminCompositionInput = {
  currentRole: StaffRole
  currentCategory: StaffCategory | null
  currentUserId: string
  error: string | null
  setError: React.Dispatch<React.SetStateAction<string | null>>
  refs: {
    gridRef: React.RefObject<HTMLDivElement | null>
    leftRailRef: React.RefObject<HTMLDivElement | null>
    rightRailRef: React.RefObject<HTMLDivElement | null>
  }
  studentSearchQuery: string
  setStudentSearchQuery: React.Dispatch<React.SetStateAction<string>>
  showRightRail: boolean
  showInlineRightRail: boolean
  reserveAssistantColumn: boolean
  schoolWizard: SchoolWizardState
  wizardEnabledCtx: StepEnabledContext
  reviewPreviewHover: "home" | "single" | null
  setReviewPreviewHover: React.Dispatch<React.SetStateAction<"home" | "single" | null>>
  courseOptions: AssignmentCourseOption[]
  selectedProfileRequestType: (typeof import("./staffAdminConstants").PROFILE_REQUEST_TYPE_OPTIONS)[number]
  portalShellAdmin: ReturnType<typeof useStaffPortalShellAdmin>
  assistantAdmin: ReturnType<typeof useStaffAssistantAdmin>
  scheduleAdmin: ReturnType<typeof useStaffScheduleAdmin>
  staffDirectoryAdmin: ReturnType<typeof useStaffDirectoryAdmin>
  createAdmin: ReturnType<typeof useStaffCreateAdmin>
  teacherAdmin: ReturnType<typeof useStaffTeacherAdmin>
  paymentsAdmin: ReturnType<typeof useStaffPaymentsAdmin>
  courseLinksAdmin: ReturnType<typeof useStaffCourseLinksAdmin>
  pinAdmin: ReturnType<typeof useStaffPinAdmin>
  reportsAdmin: ReturnType<typeof useStaffReportsAdmin>
  requestsAdmin: ReturnType<typeof useStaffRequestsAdmin>
  profileModalAdmin: ReturnType<typeof useStaffProfileModalAdmin>
  selfProfileAdmin: ReturnType<typeof useStaffSelfProfileAdmin>
  studentAuditAdmin: ReturnType<typeof useStaffStudentAuditAdmin>
  schoolCatalogAdmin: ReturnType<typeof useStaffSchoolCatalogAdmin>
  coursesAdmin: ReturnType<typeof useStaffCoursesAdmin>
  roomsAdmin: ReturnType<typeof useStaffRoomsAdmin>
  profileScheduleAdmin: ReturnType<typeof useStaffProfileScheduleAdmin>
  payrollAdmin: ReturnType<typeof useStaffPayrollAdmin>
  studentsBoardAdmin: ReturnType<typeof useStaffStudentsBoardAdmin>
  createStudentAdmin?: ReturnType<typeof useStaffCreateStudentAdmin>
  saveCourseLink: (event: React.FormEvent) => void
  deleteCourseLink: (linkId: string) => void
  toggleCourseLinkActive: (link: CourseLinkRow) => void
  openPendingPayments: () => void
  formatters: {
    centsToUsdInput: (cents: number | null | undefined) => string
    formatClockLabel: (value: string) => string
    formatDateTime: (value: string | number | null | undefined) => string
    formatDurationLabel: (minutes: number) => string
    formatIsoDate: (value: string | null) => string
    formatMinutesLabel: (minutes: number) => string
    formatMoney: (amount: number, currency?: string) => string
    formatUsdInputLabel: (value: string) => string
    resolveHistoryDateIso: () => string
  }
}

export function useStaffUsersAdminComposition(input: StaffUsersAdminCompositionInput): StaffUsersAdminViewProps {
  const { portalShellAdmin, assistantAdmin, scheduleAdmin, staffDirectoryAdmin, createAdmin, teacherAdmin, paymentsAdmin } = input
  const { pinAdmin, requestsAdmin, profileModalAdmin, selfProfileAdmin, studentAuditAdmin, profileScheduleAdmin, payrollAdmin } = input
  const { studentsBoardAdmin } = input

  const schoolWorkspaceProps = buildStaffSchoolWorkspaceProps({
    isSchoolView: portalShellAdmin.isSchoolView,
    schoolWizard: input.schoolWizard,
    wizardEnabledCtx: input.wizardEnabledCtx,
    schoolCatalogAdmin: input.schoolCatalogAdmin,
    coursesAdmin: input.coursesAdmin,
    roomsAdmin: input.roomsAdmin,
    courseLinksAdmin: input.courseLinksAdmin,
    currentRole: input.currentRole,
    courseOptions: input.courseOptions,
    reviewPreviewHover: input.reviewPreviewHover,
    setReviewPreviewHover: input.setReviewPreviewHover,
    saveCourseLink: input.saveCourseLink,
    deleteCourseLink: input.deleteCourseLink,
    toggleCourseLinkActive: input.toggleCourseLinkActive,
    formatDateTime: input.formatters.formatDateTime,
    formatClockLabel: input.formatters.formatClockLabel,
    formatMoney: input.formatters.formatMoney,
    formatUsdInputLabel: input.formatters.formatUsdInputLabel,
    centsToUsdInput: input.formatters.centsToUsdInput,
  })

  const studentsBoardPanelProps = buildStaffStudentsBoardPanelProps({
    isStudentsView: portalShellAdmin.isStudentsView,
    currentRole: input.currentRole,
    currentCategory: input.currentCategory,
    studentSearchQuery: input.studentSearchQuery,
    setStudentSearchQuery: input.setStudentSearchQuery,
    portalShellAdmin,
    staffDirectoryAdmin,
    paymentsAdmin,
    pinAdmin,
    studentsBoardAdmin,
    studentAuditAdmin,
    createStudentAdmin: input.createStudentAdmin,
    formatMoney: input.formatters.formatMoney,
  })

  return buildStaffUsersAdminViewProps({
    shell: {
      gridRef: input.refs.gridRef,
      leftRailRef: input.refs.leftRailRef,
      showInlineRightRail: input.showInlineRightRail,
      reserveAssistantColumn: input.reserveAssistantColumn,
      visibleNavItems: portalShellAdmin.visibleNavItems,
      activeNav: portalShellAdmin.activeNav,
      handleNavSelection: portalShellAdmin.handleNavSelection,
    },
    boards: {
      profileView: {
        isProfileView: portalShellAdmin.isProfileView,
        resolvedSelfProfile: selfProfileAdmin.resolvedSelfProfile,
        selfProfileRow: selfProfileAdmin.selfProfileRow,
        selfProfileLoading: selfProfileAdmin.selfProfileLoading,
        selfIsOnline: payrollAdmin.selfIsOnline,
        selfLiveSessionMinutes: payrollAdmin.selfLiveSessionMinutes,
        selfPerformanceScore: selfProfileAdmin.selfPerformanceScore,
        selfRecommendations: selfProfileAdmin.selfRecommendations,
        profilePaymentExpanded: selfProfileAdmin.profilePaymentExpanded,
        profilePaymentSummaryCards: selfProfileAdmin.profilePaymentSummaryCards,
        profilePaymentForm: selfProfileAdmin.profilePaymentForm,
        profilePaymentSaving: selfProfileAdmin.profilePaymentSaving,
        profilePaymentError: selfProfileAdmin.profilePaymentError,
        profilePaymentSuccess: selfProfileAdmin.profilePaymentSuccess,
        profileScheduleMonth: profileScheduleAdmin.profileScheduleMonth,
        profileScheduleMonthLabel: profileScheduleAdmin.profileScheduleMonthLabel,
        profileCalendarCells: profileScheduleAdmin.profileCalendarCells,
        selfScheduleEntries: profileScheduleAdmin.selfScheduleEntries,
        selfScheduleByDay: profileScheduleAdmin.selfScheduleByDay,
        selfCalendarGoogleHref: profileScheduleAdmin.selfCalendarGoogleHref,
        selfCalendarIcsDataUri: profileScheduleAdmin.selfCalendarIcsDataUri,
        profileRequestForm: selfProfileAdmin.profileRequestForm,
        profileRequestSubmitting: selfProfileAdmin.profileRequestSubmitting,
        profileRequestError: selfProfileAdmin.profileRequestError,
        profileRequestSuccess: selfProfileAdmin.profileRequestSuccess,
        profileRequestStatusFilter: selfProfileAdmin.profileRequestStatusFilter,
        selectedProfileRequestType: input.selectedProfileRequestType,
        requestsSummary: requestsAdmin.requestsSummary,
        requestsLoading: requestsAdmin.requestsLoading,
        staffRequests: requestsAdmin.staffRequests,
        setProfilePaymentExpanded: selfProfileAdmin.setProfilePaymentExpanded,
        setProfilePaymentError: selfProfileAdmin.setProfilePaymentError,
        setProfilePaymentSuccess: selfProfileAdmin.setProfilePaymentSuccess,
        setProfilePaymentForm: selfProfileAdmin.setProfilePaymentForm,
        setProfileScheduleMonth: profileScheduleAdmin.setProfileScheduleMonth,
        setProfileRequestForm: selfProfileAdmin.setProfileRequestForm,
        setProfileRequestStatusFilter: selfProfileAdmin.setProfileRequestStatusFilter,
        openProfileModal: profileModalAdmin.openProfileModal,
        saveProfilePaymentInfo: selfProfileAdmin.saveProfilePaymentInfo,
        submitProfileRequest: selfProfileAdmin.submitProfileRequest,
        getInitials,
        formatDurationLabel: input.formatters.formatDurationLabel,
        formatIsoDate: input.formatters.formatIsoDate,
      },
      accessCreate: {
        showStaffOps: portalShellAdmin.showStaffOps,
        form: createAdmin,
        assignableRoles: portalShellAdmin.assignableRoles,
        status: { createBusy: createAdmin.createBusy, createMessage: createAdmin.createMessage, error: input.error },
        createStaff: createAdmin.createStaff,
      },
      utilityPanels: {
        terminal: { isVisible: portalShellAdmin.isTerminalView, canManageSetup: portalShellAdmin.canManageTerminalSetup },
        assistant: { isVisible: portalShellAdmin.isAssistantView, config: assistantAdmin.config, setConfig: assistantAdmin.setConfig, message: assistantAdmin.configMessage, onSubmit: assistantAdmin.saveConfig },
        settings: { isVisible: portalShellAdmin.isSettingsView },
      },
      teamBoard: {
        showStaffOps: portalShellAdmin.showStaffOps,
        filters: { categoryFilter: staffDirectoryAdmin.categoryFilter, setCategoryFilter: staffDirectoryAdmin.setCategoryFilter },
        search: { query: staffDirectoryAdmin.query, setQuery: staffDirectoryAdmin.setQuery, submitSearch: () => staffDirectoryAdmin.fetchRows(staffDirectoryAdmin.query, staffDirectoryAdmin.categoryFilter), refresh: () => staffDirectoryAdmin.fetchRows(staffDirectoryAdmin.query, staffDirectoryAdmin.categoryFilter) },
        data: { loading: staffDirectoryAdmin.loading, rows: staffDirectoryAdmin.rows, payrollRows: payrollAdmin.payrollRows },
        currentUserId: input.currentUserId,
        canManageTarget: portalShellAdmin.canManageTarget,
        setError: input.setError,
        payrollModels: { options: staffDirectoryAdmin.payrollModelOptions, loading: staffDirectoryAdmin.payrollModelLoading, error: staffDirectoryAdmin.payrollModelError, actionByUserId: staffDirectoryAdmin.payrollModelActionByUserId, updateStaffPayrollModel: staffDirectoryAdmin.updateStaffPayrollModel },
        presence: { busyUserId: staffDirectoryAdmin.busyUserId, presenceMenuUserId: staffDirectoryAdmin.presenceMenuUserId, setPresenceMenuUserId: staffDirectoryAdmin.setPresenceMenuUserId, getLiveSessionMinutes: payrollAdmin.getLiveSessionMinutes, formatMinutesLabel: input.formatters.formatMinutesLabel, getInitials },
        openProfileModal: profileModalAdmin.openProfileModal,
        openDelayDetails: payrollAdmin.openDelayDetails,
        runAction: staffDirectoryAdmin.runAction,
        revokeStaff: staffDirectoryAdmin.revokeStaff,
      },
      teacherAssignment: {
        showStaffOps: portalShellAdmin.showStaffOps,
        selection: { teacherRows: teacherAdmin.teacherRows, teacherUserId: teacherAdmin.teacherUserId, setTeacherUserId: teacherAdmin.setTeacherUserId, teacherAssignedUserId: teacherAdmin.teacherAssignedUserId, setTeacherAssignedUserId: teacherAdmin.setTeacherAssignedUserId, selectedTeacher: teacherAdmin.selectedTeacher, assignedTeacher: teacherAdmin.assignedTeacher },
        recurrence: { unit: teacherAdmin.teacherRecurrenceUnit, setUnit: teacherAdmin.setTeacherRecurrenceUnit, interval: teacherAdmin.teacherRecurrenceInterval, setInterval: teacherAdmin.setTeacherRecurrenceInterval, helperText: teacherAdmin.teacherRecurrenceIntervalHelperText },
        courses: { options: input.courseOptions, selectedSlugs: teacherAdmin.teacherCourseSlugs, toggle: teacherAdmin.toggleTeacherCourse },
        status: { dirty: teacherAdmin.teacherAssignmentDirty, saving: teacherAdmin.teacherSaving, success: teacherAdmin.teacherSuccess, error: teacherAdmin.teacherError },
        saveTeacherPerformance: teacherAdmin.saveTeacherPerformance,
      },
      schoolWorkspace: schoolWorkspaceProps,
      payrollControl: { showStaffOps: portalShellAdmin.showStaffOps, currentRole: input.currentRole, payrollRows: payrollAdmin.payrollRows, payrollSummary: payrollAdmin.payrollSummary, rowById: payrollAdmin.rowById, busyUserId: staffDirectoryAdmin.busyUserId, formatMoney: input.formatters.formatMoney, formatMinutesLabel: input.formatters.formatMinutesLabel, getLiveSessionMinutes: payrollAdmin.getLiveSessionMinutes, openDelayDetails: payrollAdmin.openDelayDetails, openPendingPayments: input.openPendingPayments, runAction: staffDirectoryAdmin.runAction },
      studentsBoard: studentsBoardPanelProps,
      reports: { isReportsView: portalShellAdmin.isReportsView, reports: input.reportsAdmin, formatMoney: input.formatters.formatMoney, setError: input.setError },
      approvals: { showStaffOps: portalShellAdmin.showStaffOps, requestStatusFilter: requestsAdmin.requestStatusFilter, approvalsSummary: requestsAdmin.approvalsSummary, approvalsLoading: requestsAdmin.approvalsLoading, approvalFeed: requestsAdmin.approvalFeed, requestBusyId: requestsAdmin.requestBusyId, paymentChangeRequestBusyId: requestsAdmin.paymentChangeRequestBusyId, setRequestStatusFilter: requestsAdmin.setRequestStatusFilter, updateRequestStatus: requestsAdmin.updateRequestStatus, updatePaymentChangeRequestStatus: requestsAdmin.updatePaymentChangeRequestStatus, formatIsoDate: input.formatters.formatIsoDate },
      teamCalendar: { showStaffOps: portalShellAdmin.showStaffOps, scheduleMonthLabel: scheduleAdmin.scheduleMonthLabel, scheduleLoading: scheduleAdmin.scheduleLoading, calendarCells: scheduleAdmin.calendarCells, scheduleEventsByDay: scheduleAdmin.scheduleEventsByDay, onPreviousMonth: scheduleAdmin.goToPreviousMonth, onNextMonth: scheduleAdmin.goToNextMonth },
      performanceMetrics: { showStaffOps: portalShellAdmin.showStaffOps, teacherRows: teacherAdmin.teacherRows, teacherUserId: teacherAdmin.teacherUserId, selectedTeacher: teacherAdmin.selectedTeacher, teacherRating: teacherAdmin.teacherRating, teacherAiTips: teacherAdmin.teacherAiTips, visibleTeacherMetrics: teacherAdmin.visibleTeacherMetrics, metricsView: teacherAdmin.metricsView, teacherReviewCycleDays: teacherAdmin.teacherReviewCycleDays, metricsSaving: teacherAdmin.metricsSaving, metricsSuccess: teacherAdmin.metricsSuccess, metricsError: teacherAdmin.metricsError, teacherDonutStyle: teacherAdmin.teacherDonutStyle, teacherMetricsAverage: teacherAdmin.teacherMetricsAverage, setTeacherUserId: teacherAdmin.setTeacherUserId, setMetricsView: teacherAdmin.setMetricsView, setTeacherReviewCycleDays: teacherAdmin.setTeacherReviewCycleDays, saveTeacherReviewCycle: teacherAdmin.saveTeacherReviewCycle },
    },
    assistant: {
      rightRail: { showRightRail: input.showRightRail, showInlineRightRail: input.showInlineRightRail, isRailCollapsed: assistantAdmin.isRailCollapsed, rightRailRef: input.refs.rightRailRef, onCloseOverlay: assistantAdmin.collapseRail, onToggleRail: assistantAdmin.toggleRail },
      content: { isRailCollapsed: assistantAdmin.isRailCollapsed, activeNavLabel: portalShellAdmin.activeNavLabel, chatMessages: assistantAdmin.chatMessages, chatInput: assistantAdmin.chatInput, onToggleRail: assistantAdmin.toggleRail, onOpenAssistantConfig: () => {}, onChatInputChange: assistantAdmin.setChatInput, onSendChatMessage: assistantAdmin.sendChatMessage },
    },
    modals: {
      adminModalOverlays: { roomSafeDeleteModal: input.roomsAdmin.roomSafeDeleteModal, roomReassignModal: input.roomsAdmin.roomReassignModal, roomReservationCancelModal: input.roomsAdmin.roomReservationCancelModal, delayModal: payrollAdmin.delayModal, studentPinModal: pinAdmin.studentPinModal, activeRoomOptions: input.roomsAdmin.activeRoomOptions, roomBusyId: input.roomsAdmin.roomBusyId, roomReservationBusyId: input.roomsAdmin.roomReservationBusyId, studentPinReason: pinAdmin.studentPinReason, studentPinDraft: pinAdmin.studentPinDraft, studentPinSubmitting: pinAdmin.studentPinSubmitting, studentPinError: pinAdmin.studentPinError, studentPinIssued: pinAdmin.studentPinIssued, studentPinRevealIssued: pinAdmin.studentPinRevealIssued, onCloseRoomSafeDelete: input.roomsAdmin.closeRoomSafeDeleteModal, onUpdateRoomSafeDeleteReason: input.roomsAdmin.updateRoomSafeDeleteReason, onConfirmRoomSafeDelete: () => void input.roomsAdmin.confirmRoomSafeDelete(), onCloseRoomReassign: input.roomsAdmin.closeRoomReassignModal, onUpdateRoomReassignTarget: input.roomsAdmin.updateRoomReassignTarget, onUpdateRoomReassignMoveFutureSessions: input.roomsAdmin.updateRoomReassignMoveFutureSessions, onUpdateRoomReassignCourseSelection: input.roomsAdmin.updateRoomReassignCourseSelection, onConfirmRoomReassign: () => void input.roomsAdmin.confirmRoomReassign(), onCloseRoomReservationCancel: input.roomsAdmin.closeRoomReservationCancelModal, onUpdateRoomReservationCancelReason: input.roomsAdmin.updateRoomReservationCancelReason, onConfirmRoomReservationCancel: () => void input.roomsAdmin.confirmRoomReservationCancel(), onCloseDelayDetails: payrollAdmin.closeDelayDetails, onCloseStudentPin: pinAdmin.closeStudentPinModal, onStudentPinReasonChange: pinAdmin.setStudentPinReason, onStudentPinDraftChange: pinAdmin.setStudentPinDraft, onToggleStudentPinReveal: () => pinAdmin.setStudentPinRevealIssued((prev) => !prev), onCopyStudentPinError: pinAdmin.setStudentPinError, onSubmitStudentPinIssue: () => void pinAdmin.submitStudentPinIssue(), formatMinutesLabel: input.formatters.formatMinutesLabel, formatIsoDate: input.formatters.formatIsoDate },
      profileModal: profileModalAdmin,
      assignableRoles: portalShellAdmin.assignableRoles,
      adminHistoryOverlays: { payments: paymentsAdmin.payments, userHistoryPayments: paymentsAdmin.userHistoryPayments, isHistoryMode: paymentsAdmin.isHistoryMode, currentDateNY: studentsBoardAdmin.currentDateNY, historyFrom: paymentsAdmin.historyFrom, historyTo: paymentsAdmin.historyTo, userHistoryLoading: paymentsAdmin.userHistoryLoading, paymentHistoryStudentId: paymentsAdmin.paymentHistoryStudentId, paymentHistoryAnchor: paymentsAdmin.paymentHistoryAnchor, attendanceHistoryStudentId: paymentsAdmin.attendanceHistoryStudentId, attendanceHistoryAnchor: paymentsAdmin.attendanceHistoryAnchor, auditHistoryStudentId: paymentsAdmin.auditHistoryStudentId, auditHistoryStudentName: paymentsAdmin.auditHistoryStudentName, auditHistoryAnchor: paymentsAdmin.auditHistoryAnchor, overrideModalOpen: studentAuditAdmin.overrideModalOpen, overrideModalStudent: studentAuditAdmin.overrideModalStudent, onCloseOverrideModal: studentAuditAdmin.closeOverrideModal },
    },
    actions: { handleNavSelection: portalShellAdmin.handleNavSelection, setPaymentHistoryStudentId: paymentsAdmin.setPaymentHistoryStudentId, setPaymentHistoryAnchor: paymentsAdmin.setPaymentHistoryAnchor, setAttendanceHistoryStudentId: paymentsAdmin.setAttendanceHistoryStudentId, setAttendanceHistoryAnchor: paymentsAdmin.setAttendanceHistoryAnchor, setAuditHistoryAnchor: paymentsAdmin.setAuditHistoryAnchor, setAuditHistoryStudentId: paymentsAdmin.setAuditHistoryStudentId, setAuditHistoryStudentName: paymentsAdmin.setAuditHistoryStudentName, markUserHasAuditEntries: studentAuditAdmin.markUserHasAuditEntries, refreshPaymentsBoard: pinAdmin.refreshPaymentsBoard },
    formatters: { resolveHistoryDateIso: input.formatters.resolveHistoryDateIso },
    statusBanners: { currentRole: input.currentRole },
  })
}

export type { StaffUsersAdminCompositionInput }
