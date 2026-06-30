"use client"

import React from "react"
import { useSearchParams } from "next/navigation"
import {
  Bot,
  CircleDollarSign,
  GraduationCap,
  Monitor,
  School,
  Settings,
  UserCircle,
  Users,
} from "lucide-react"
import { demoCourses } from "@/constants/courses"
import type { StaffRole } from "@/lib/security/staff-role"
import {
  type StaffCategory,
} from "@/lib/security/staff-category"
import { useSchoolWizard } from "@/components/front/staff/school"
import type { StepEnabledContext } from "@/components/front/staff/school"
import { useStaffRoomsAdmin } from "./useStaffRoomsAdmin"
import { useStaffCoursesAdmin } from "./useStaffCoursesAdmin"
import { useStaffPaymentsAdmin } from "./useStaffPaymentsAdmin"
import { useStaffReportsAdmin } from "./useStaffReportsAdmin"
import { type StaffPortalNavItem } from "./StaffPortalNavButton"
import StaffUsersAdminView from "./StaffUsersAdminView"
import { useStaffAssistantAdmin } from "./useStaffAssistantAdmin"
import { useStaffDirectoryAdmin } from "./useStaffDirectoryAdmin"
import { useStaffTeacherAdmin } from "./useStaffTeacherAdmin"
import { useStaffScheduleAdmin } from "./useStaffScheduleAdmin"
import { useStaffPinAdmin } from "./useStaffPinAdmin"
import { useStaffSchoolCatalogAdmin } from "./useStaffSchoolCatalogAdmin"
import { useStaffCourseLinksAdmin } from "./useStaffCourseLinksAdmin"
import { useStaffProfileScheduleAdmin } from "./useStaffProfileScheduleAdmin"
import { useStaffCreateAdmin } from "./useStaffCreateAdmin"
import { useStaffPayrollAdmin } from "./useStaffPayrollAdmin"
import { useStaffRequestsAdmin } from "./useStaffRequestsAdmin"
import { useStaffSelfProfileAdmin } from "./useStaffSelfProfileAdmin"
import { useStaffProfileModalAdmin } from "./useStaffProfileModalAdmin"
import { useStaffStudentsBoardAdmin } from "./useStaffStudentsBoardAdmin"
import { useStaffStudentAuditAdmin } from "./useStaffStudentAuditAdmin"
import { useStaffCreateStudentAdmin } from "./useStaffCreateStudentAdmin"
import { useStaffPortalShellAdmin } from "./useStaffPortalShellAdmin"
import { useStaffPortalDataLifecycle } from "./useStaffPortalDataLifecycle"
import { useStaffUsersAdminComposition } from "./useStaffUsersAdminComposition"
import { useStaffAssistantRailLayout } from "./useStaffAssistantRailLayout"

import {
  PROFILE_REQUEST_TYPE_OPTIONS,
} from "./staffAdminConstants"

import type {
  AssignmentCourseOption,
  CourseLinkRow,
  PaymentsApiSummary,
  ScheduleEvent,
} from "./staffAdminTypes"

import {
  centsToUsdInput,
  formatClockLabel,
  formatDateTime,
  formatDurationLabel,
  formatIsoDate,
  formatMinutesLabel,
  formatMoney,
  formatUsdInputLabel,
  resolveHistoryDateIso,
} from "./staffAdminFormatters"
import {
  buildAssignmentCourseKindLabel,
  buildAssignmentCourseScheduleLabel,
} from "./staffCourseScheduleHelpers"
const NAV_ITEMS: StaffPortalNavItem[] = [
  { key: "users", label: "User Management", icon: Users },
  { key: "students", label: "Students", icon: GraduationCap },
  { key: "schedule", label: "School", icon: School },
  { key: "terminals", label: "Terminal Manager", icon: Monitor },
  { key: "reports", label: "Reports", icon: CircleDollarSign },
  { key: "assistant", label: "AI Assistant", icon: Bot },
  { key: "settings", label: "Settings", icon: Settings },
  { key: "profile", label: "My Profile", icon: UserCircle },
]


const createEmptyPaymentsSummary = (): PaymentsApiSummary => ({
  totalItems: 0,
  totalCollected: 0,
  pendingSettlement: 0,
  paidSettlement: 0,
  pendingStripe: 0,
  paidStripe: 0,
})

const normalizePaymentsSummary = (summary: unknown): PaymentsApiSummary => {
  if (!summary || typeof summary !== "object") return createEmptyPaymentsSummary()

  const value = summary as Partial<PaymentsApiSummary>
  return {
    totalItems: typeof value.totalItems === "number" ? value.totalItems : 0,
    totalCollected: typeof value.totalCollected === "number" ? value.totalCollected : 0,
    pendingSettlement: typeof value.pendingSettlement === "number" ? value.pendingSettlement : 0,
    paidSettlement: typeof value.paidSettlement === "number" ? value.paidSettlement : 0,
    pendingStripe: typeof value.pendingStripe === "number" ? value.pendingStripe : 0,
    paidStripe: typeof value.paidStripe === "number" ? value.paidStripe : 0,
  }
}

const CRITICAL_WINDOW_BEFORE_MS = 15 * 60 * 1000
const CRITICAL_WINDOW_AFTER_MS = 15 * 60 * 1000

export const isInsideCriticalClassWindow = (
  eventsByDay: Record<string, ScheduleEvent[]>,
  nowMs: number = Date.now()
): boolean => {
  for (const events of Object.values(eventsByDay)) {
    for (const event of events) {
      const startsAt = Date.parse(event.startsAtIso)
      if (Number.isNaN(startsAt)) continue
      if (nowMs >= startsAt - CRITICAL_WINDOW_BEFORE_MS && nowMs <= startsAt + CRITICAL_WINDOW_AFTER_MS) {
        return true
      }
    }
  }
  return false
}

type StaffUsersAdminClientProps = {
  currentRole: StaffRole
  currentCategory: StaffCategory | null
  currentUserId: string
}

export default function StaffUsersAdminClient({ currentRole, currentCategory, currentUserId }: StaffUsersAdminClientProps) {
  const searchParams = useSearchParams()
  const resolvedCurrentCategory: StaffCategory =
    currentCategory || (currentRole === "owner" ? "partner" : currentRole === "admin" ? "manager" : "guest")
  const gridRef = React.useRef<HTMLDivElement>(null)
  const leftRailRef = React.useRef<HTMLDivElement>(null)
  const rightRailRef = React.useRef<HTMLDivElement>(null)
  const expandAssistantRailRef = React.useRef<() => void>(() => {})
  const [error, setError] = React.useState<string | null>(null)
  const [studentSearchQuery, setStudentSearchQuery] = React.useState("")

  const schoolWizard = useSchoolWizard()
  const [reviewPreviewHover, setReviewPreviewHover] = React.useState<"home" | "single" | null>(null)
  const portalShellAdmin = useStaffPortalShellAdmin({
    currentRole,
    resolvedCurrentCategory,
    navItems: NAV_ITEMS,
    searchParams,
    expandAssistantRail: () => expandAssistantRailRef.current(),
    setError,
  })

  const {
    nowTs,
    setActiveNav,
    canAccessUsersNav,
    canAccessStudentsNav,
    canAccessSchoolNav,
    canAccessProfileNav,
    canManageClerkSync,
    isStudentsView,
    isSchoolView,
    isProfileView,
    showStaffOps,
    activeNavLabel,
    ensureMinimumLoadingTime,
    handleStaffAuthFailure,
  } = portalShellAdmin
  const assistantAdmin = useStaffAssistantAdmin(activeNavLabel)
  expandAssistantRailRef.current = assistantAdmin.expandRail
  const showRightRail = true
  const showInlineRightRail = showRightRail && !assistantAdmin.isRailCollapsed
  const assistantRailLayout = useStaffAssistantRailLayout(assistantAdmin.isRailCollapsed)
  const reserveAssistantColumn = showRightRail && assistantRailLayout.shouldReserveAssistantColumn

  const scheduleAdmin = useStaffScheduleAdmin({
    canAccessSchoolNav,
    ensureMinimumLoadingTime,
    handleStaffAuthFailure,
  })

  const {
    scheduleEventsByDay,
  } = scheduleAdmin

  const staffDirectoryAdmin = useStaffDirectoryAdmin({
    canAccessUsersNav,
    canManageClerkSync,
    shouldFetchClerkSyncHealth: false,
    scheduleEventsByDay,
    ensureMinimumLoadingTime,
    handleStaffAuthFailure,
    isInsideCriticalClassWindow,
    setError,
  })

  const {
    rows,
    query,
    categoryFilter,
    fetchRows,
    updateRowAvatar,
  } = staffDirectoryAdmin

  const createAdmin = useStaffCreateAdmin({
    refreshRows: () => fetchRows(query, categoryFilter),
    setError,
  })

  const teacherAdmin = useStaffTeacherAdmin({
    rows,
    refreshRows: () => fetchRows(query, categoryFilter, { showLoader: false, enforceMinDelay: false }),
  })

  const paymentsAdmin = useStaffPaymentsAdmin({
    studentSearchQuery,
    createEmptyPaymentsSummary,
    normalizePaymentsSummary,
    ensureMinimumLoadingTime,
    handleStaffAuthFailure,
    setError,
  })

  const {
    payments,
    paymentsMonthlySummaryApi,
    paymentsMonthlyStudentCount,
    paymentsMonthlyCheckedInStudents,
    paymentsFilter,
    paymentCategoryFilter,
    isHistoryMode,
    historyFrom,
    historyTo,
    historyPaymentMethodFilter,
    historyAttendanceFilter,
    historyClassKey,
    selectedPaymentIds,
    checkoutMenuPaymentId,
    setPaymentsFilter,
    setCheckoutMenuPaymentId,
    fetchPayments,
    fetchPaymentsMonthlySummary,
    pruneSelectedPaymentIds,
    updateSettlementBulk,
  } = paymentsAdmin

  const courseLinksAdmin = useStaffCourseLinksAdmin()

  const {
    setAllCourseLinksMap,
    resetCourseLinkForm,
    loadCourseLinks,
    clearCourseLinks,
    saveCourseLink: saveCourseLinkForSlug,
    saveDraftCourseLinkForCourse,
    deleteCourseLink: deleteCourseLinkForSlug,
    toggleCourseLinkActive: toggleCourseLinkActiveForSlug,
  } = courseLinksAdmin

  const pinAdmin = useStaffPinAdmin({
    canAccessStudentsNav,
    isStudentsView,
    scheduleEventsByDay,
    fetchPayments,
    fetchPaymentsMonthlySummary,
    handleStaffAuthFailure,
    isInsideCriticalClassWindow,
  })

  const {
    refreshPaymentsBoard,
  } = pinAdmin

  const reportsAdmin = useStaffReportsAdmin({ payments, setError })

  const requestsAdmin = useStaffRequestsAdmin({
    ensureMinimumLoadingTime,
    handleStaffAuthFailure,
    setError,
  })

  const {
    requestStatusFilter,
    fetchStaffRequests,
    fetchPaymentChangeRequests,
  } = requestsAdmin

  const refreshRowsRef = React.useRef<() => Promise<void>>(async () => {})
  const refreshSelfProfileRef = React.useRef<() => Promise<void>>(async () => {})
  const updateRowAvatarRef = React.useRef<(userId: string, imageUrl: string) => void>(() => {})

  const refreshRowsCallback = React.useCallback(() => refreshRowsRef.current(), [])
  const refreshSelfProfileCallback = React.useCallback(() => refreshSelfProfileRef.current(), [])
  const updateRowAvatarCallback = React.useCallback(
    (userId: string, imageUrl: string) => updateRowAvatarRef.current(userId, imageUrl),
    []
  )

  const profileModalAdmin = useStaffProfileModalAdmin({
    currentUserId,
    ensureMinimumLoadingTime,
    canAccessUsersNav,
    refreshRows: refreshRowsCallback,
    refreshSelfProfile: refreshSelfProfileCallback,
    updateRowAvatar: updateRowAvatarCallback,
  })

  const {
    profileForm,
    setProfileForm,
  } = profileModalAdmin

  const selfProfileAdmin = useStaffSelfProfileAdmin({
    currentRole,
    currentUserId,
    resolvedCurrentCategory,
    profileForm,
    setProfileForm,
    ensureMinimumLoadingTime,
    handleStaffAuthFailure,
    fetchStaffRequests,
  })

  const {
    profileRequestStatusFilter,
    resolvedSelfProfile,
    profileRequestForm,
    fetchSelfProfile,
  } = selfProfileAdmin
  const studentAuditAdmin = useStaffStudentAuditAdmin()

  const {
    usersWithAuditEntries,
    checkUserHasAuditEntries,
  } = studentAuditAdmin

  const selectedProfileRequestType = React.useMemo(
    () => PROFILE_REQUEST_TYPE_OPTIONS.find((item) => item.value === profileRequestForm.type) || PROFILE_REQUEST_TYPE_OPTIONS[0],
    [profileRequestForm.type]
  )

  React.useEffect(() => {
    refreshRowsRef.current = () => fetchRows(query, categoryFilter)
  }, [fetchRows, query, categoryFilter])

  React.useEffect(() => {
    refreshSelfProfileRef.current = fetchSelfProfile
  }, [fetchSelfProfile])

  React.useEffect(() => {
    updateRowAvatarRef.current = updateRowAvatar
  }, [updateRowAvatar])

  const handleCourseLinksMapLoaded = React.useCallback((map: Record<string, { asA: CourseLinkRow[]; asB: CourseLinkRow[] }>) => {
    setAllCourseLinksMap(map)
  }, [setAllCourseLinksMap])

  const schoolCatalogAdmin = useStaffSchoolCatalogAdmin({
    canAccessSchoolNav,
    isSchoolView,
    showStaffOps,
    ensureMinimumLoadingTime,
    handleStaffAuthFailure,
    onCourseLinksMapLoaded: handleCourseLinksMapLoaded,
  })

  const {
    schoolCourses,
    schoolRooms,
    roomReservations,
    setSchoolBusy,
    setSchoolError,
    setSchoolSuccess,
    fetchSchoolData,
  } = schoolCatalogAdmin

  const coursesAdmin = useStaffCoursesAdmin({
    schoolCourses,
    isSchoolView,
    searchParams,
    schoolWizard,
    fetchSchoolData,
    loadCourseLinks,
    clearCourseLinks,
    resetCourseLinkForm,
    saveDraftCourseLinkForCourse,
    handleStaffAuthFailure,
    setSchoolError,
    setSchoolSuccess,
    setSchoolBusy,
  })

  const {
    courseForm,
    courseEditingSlug,
  } = coursesAdmin

  const wizardEnabledCtx: StepEnabledContext = { courseEditingSlug }

  const roomsAdmin = useStaffRoomsAdmin({
    rooms: schoolRooms,
    reservations: roomReservations,
    courses: schoolCourses,
    staffRows: rows,
    selectedCourseDefaultRoomId: courseForm.defaultRoomId,
    fetchSchoolData,
    handleStaffAuthFailure,
  })

  useStaffPortalDataLifecycle({
    checkoutMenuPaymentId,
    setCheckoutMenuPaymentId,
    canAccessUsersNav,
    showStaffOps,
    isProfileView,
    canAccessProfileNav,
    requestStatusFilter,
    profileRequestStatusFilter,
    fetchStaffRequests,
    fetchPaymentChangeRequests,
    fetchSelfProfile,
  })

  const openPendingPayments = () => {
    setActiveNav("students")
    setPaymentsFilter("pending")
    requestAnimationFrame(() => {
      const el = document.getElementById("students-payments")
      el?.scrollIntoView({ block: "start", behavior: "smooth" })
    })
  }

  const courseOptions = React.useMemo<AssignmentCourseOption[]>(() => {
    const base = new Map<string, AssignmentCourseOption>()
    for (const course of demoCourses) {
      base.set(course.slug, {
        slug: course.slug,
        title: course.title,
        description: course.description || null,
        imageUrl: course.heroMedia?.image || null,
        scheduleLabel: [course.schedule.day, course.schedule.time].filter(Boolean).join(" · ") || null,
        kindLabel: null,
      })
    }
    for (const course of schoolCourses) {
      const existing = base.get(course.slug)
      base.set(course.slug, {
        slug: course.slug,
        title: course.title || existing?.title || course.slug,
        description: course.description ?? existing?.description ?? null,
        imageUrl: course.coverImageUrl ?? existing?.imageUrl ?? null,
        scheduleLabel: buildAssignmentCourseScheduleLabel(course) || existing?.scheduleLabel || null,
        kindLabel: buildAssignmentCourseKindLabel(course) || existing?.kindLabel || null,
      })
    }
    return [...base.values()]
  }, [schoolCourses])

  const profileScheduleAdmin = useStaffProfileScheduleAdmin({
    resolvedSelfProfile,
    courseOptions,
  })

  const payrollAdmin = useStaffPayrollAdmin({
    rows,
    nowTs,
    currentUserId,
    resolvedSelfProfile,
  })

  const saveCourseLink = React.useCallback(
    (event: React.FormEvent) => saveCourseLinkForSlug(event, courseEditingSlug),
    [courseEditingSlug, saveCourseLinkForSlug]
  )

  const deleteCourseLink = React.useCallback(
    (linkId: string) => deleteCourseLinkForSlug(linkId, courseEditingSlug),
    [courseEditingSlug, deleteCourseLinkForSlug]
  )

  const toggleCourseLinkActive = React.useCallback(
    (link: CourseLinkRow) => toggleCourseLinkActiveForSlug(link, courseEditingSlug),
    [courseEditingSlug, toggleCourseLinkActiveForSlug]
  )

  const studentsBoardAdmin = useStaffStudentsBoardAdmin({
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
  })

  const createStudentAdmin = useStaffCreateStudentAdmin({
    onSuccess: refreshPaymentsBoard,
    handleStaffAuthFailure,
  })

  const staffUsersAdminViewProps = useStaffUsersAdminComposition({
    currentRole,
    currentCategory,
    currentUserId,
    error,
    setError,
    refs: { gridRef, leftRailRef, rightRailRef },
    studentSearchQuery,
    setStudentSearchQuery,
    showRightRail,
    showInlineRightRail,
    reserveAssistantColumn,
    isAssistantLayoutSettling: assistantRailLayout.isAssistantLayoutSettling,
    schoolWizard,
    wizardEnabledCtx,
    reviewPreviewHover,
    setReviewPreviewHover,
    courseOptions,
    selectedProfileRequestType,
    portalShellAdmin,
    assistantAdmin,
    scheduleAdmin,
    staffDirectoryAdmin,
    createAdmin,
    teacherAdmin,
    paymentsAdmin,
    courseLinksAdmin,
    pinAdmin,
    reportsAdmin,
    requestsAdmin,
    profileModalAdmin,
    selfProfileAdmin,
    studentAuditAdmin,
    schoolCatalogAdmin,
    coursesAdmin,
    roomsAdmin,
    profileScheduleAdmin,
    payrollAdmin,
    studentsBoardAdmin,
    createStudentAdmin,
    saveCourseLink,
    deleteCourseLink,
    toggleCourseLinkActive,
    openPendingPayments,
    formatters: {
      centsToUsdInput,
      formatClockLabel,
      formatDateTime,
      formatDurationLabel,
      formatIsoDate,
      formatMinutesLabel,
      formatMoney,
      formatUsdInputLabel,
      resolveHistoryDateIso,
    },
  })

  return <StaffUsersAdminView {...staffUsersAdminViewProps} />
}
