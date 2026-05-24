"use client"

import React from "react"
import Image from "next/image"
import { useSearchParams } from "next/navigation"
import {
  Bot,
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  ExternalLink,
  GraduationCap,
  ImagePlus,
  Loader2,
  Mail,
  MapPin,
  MoreHorizontal,
  Monitor,
  Phone,
  RefreshCw,
  Search,
  School,
  Settings,
  Sparkles,
  Star,
  Trash2,
  Users,
  X,
} from "lucide-react"
import { demoCourses } from "@/constants/courses"
import CalendarPicker from "@/components/front/ui/CalendarPicker"
import StaffTerminalSetupClient from "@/components/front/staff/StaffTerminalSetupClient"
import StaffPaymentMethodConfigPanel from "@/components/front/staff/payroll/StaffPaymentMethodConfigPanel"
import {
  buildHistoryStudentCard,
  buildHistoryStudentCards,
  buildHistoryStudentPaidEntries,
  resolveCardContext,
  resolveHistoryStudentCardAmountPaidCents,
  resolveCardVariant,
  type StudentProfileCard,
  type CardContext,
} from "@/components/front/staff/historyCardAggregates"
import { useStudentGlobalSearch } from "@/components/front/staff/useStudentGlobalSearch"
import { parseIsoDate } from "@/lib/class-schedule"
import {
  normalizeStaffProfilePaymentInfo,
  resolveStaffProfilePaymentSummaryCards,
  toStaffProfilePaymentInfoPayload,
} from "@/lib/staff/profile-payment"
import type { StaffRole } from "@/lib/security/staff-role"
import {
  PAYMENT_PREFERENCES,
  type StaffCategory,
  type StaffPaymentInfo,
  type StaffPaymentPreference,
} from "@/lib/security/staff-category"
import type { StaffRequestStatus, StaffRequestType } from "@/lib/security/staff-request"
import {
  getDefaultStaffPortalSection,
  hasExplicitStaffPermission,
  resolveStaffPortalSections,
  type StaffPortalSection,
} from "@/lib/security/staff-access"
import { POINTS_RULE_DEFINITIONS } from "@/lib/points/constants"
import PaymentHistoryTimeline from "@/components/front/staff/PaymentHistoryTimeline"
import AttendanceHistoryTimeline, {
  type AttendanceEvent,
  type AttendanceSummary,
} from "@/components/front/staff/AttendanceHistoryTimeline"
import StudentDataOverrideModal from "@/components/front/staff/StudentDataOverrideModal"
import AuditHistoryPopover from "@/components/front/staff/AuditHistoryPopover"
import { ClerkSyncMismatchBanner } from "@/components/front/staff/ClerkSyncMismatchBanner"
import { useSchoolWizard, SchoolWizardPanel } from "@/components/front/staff/school"
import type { StepEnabledContext } from "@/components/front/staff/school"
import {
  checkInStateTone,
  isCheckedInStatus,
  isCompletedClassEvidence,
  isDirectPaidClassEvidence,
  isPaymentPaidForUi,
  resolveDailyVisiblePayment,
  resolveStudentPinTone,
} from "./paymentState"
import {
  resolveAttendanceHistoryRows,
  resolvePaymentHistoryRows,
  transformPaymentRowsToAttendance,
  transformPaymentRowsToEvents,
} from "./paymentTimelineTransforms"
import {
  formatIsoDateLong,
  formatStudentPaymentCardDateTimeLabel,
  formatStudentPaymentCardSlotLabel,
} from "./studentPaymentCardFormatters"
import {
  buildCourseRoomOptions,
  buildRoomLookup,
  filterVisibleRooms,
  resolveRoomCatalogErrorMessage,
  resolveRoomDisableActionState,
} from "./staffRoomCatalogHelpers"
import {
  createEmptyRoomReservationForm,
  createInitialRoomForm,
  createRoomFormFromRoom,
  type RoomFormState,
  type RoomReservationFormState,
} from "./staffRoomFormState"
import StaffPortalNavButton, { type StaffPortalNavItem } from "./StaffPortalNavButton"
import StaffAssistantRightRail from "./StaffAssistantRightRail"
import StaffRoomReservationForm from "./StaffRoomReservationForm"
import StaffRoomReservationList from "./StaffRoomReservationList"
import StaffProfilePaymentSection from "./StaffProfilePaymentSection"
import StaffProfileRequestsSection from "./StaffProfileRequestsSection"
import StaffCatalogSection from "./StaffCatalogSection"
import {
  CATEGORY_LABELS,
  CATEGORY_OPTIONS,
  COURSE_KIND_DATE_TONE,
  COURSE_KIND_LABELS,
  COURSE_KIND_REVIEW_HINTS,
  COURSE_PUBLICATION_MODE_OPTIONS,
  COURSE_SPECIAL_DISCOUNT_OPTIONS,
  DEFAULT_QUICK_SCHEDULE_TIMES,
  getFixedCategoryForRole,
  ISO_DATE_REGEX,
  normalizeCategoryForRole,
  PAYMENT_PREFERENCE_LABELS,
  PROFILE_REQUEST_STATUS_OPTIONS,
  PROFILE_REQUEST_TYPE_OPTIONS,
  QUICK_SCHEDULE_SLOT_COUNT,
  REPORT_OBJECTIVE_LABELS,
  REPORT_OBJECTIVE_OPTIONS,
  REPORT_SUGGESTIONS_SOURCE_LABELS,
  REQUEST_STATUS_OPTIONS,
  REQUEST_TYPE_LABELS,
  ROLE_FORM_LABELS,
  ROLE_LABELS,
  SCHOOL_COURSE_KINDS,
  SCHOOL_SCHEDULE_SHORTCUTS_STORAGE_KEY,
  SCHEDULE_SHORTCUT_TONES,
  SPECIAL_EVENT_COURSE_KINDS,
  WEEKDAY_LABELS,
  WEEKDAY_LABELS_LONG,
  type CoursePublicationMode,
  type CourseSpecialDiscountType,
  type ReportsObjectiveFilter,
} from "./staffAdminConstants"

import type {
  AssignmentCourseOption,
  CourseFormState,
  CourseLinkFormState,
  CourseLinkRow,
  CoursePublicationSettings,
  CourseScheduleRulesPayload,
  CourseScheduleSlot,
  CourseSpecialDiscountSettings,
  HistoryAttendanceFilter,
  HistoryClassOption,
  HistoryPaymentMethodFilter,
  PackageFormState,
  PackagePlanStatus,
  PackageStatusFilter,
  PaymentCategoryFilter,
  PaymentChangeRequestStatus,
  PaymentRow,
  PaymentsApiSummary,
  PayrollDelayModalState,
  PayrollModelActionState,
  PayrollStaffRow,
  PointsAssignFormState,
  PointsRuleFormState,
  PointsRuleRow,
  ProfileRequestFormState,
  ReportsSuggestion,
  ReportsSuggestionsApiResponse,
  RoomReassignModalState,
  RoomReservationCancelModalState,
  RoomReservationRow,
  RoomRow,
  RoomSafeDeleteModalState,
  ScheduleEvent,
  SchoolCourseRow,
  SchoolPackageRow,
  SelfProfileSnapshot,
  StaffApprovalFeedItem,
  StaffPaymentChangeRequestRow,
  StaffPaymentForm,
  StaffPaymentModelOption,
  StaffProfileForm,
  StaffRequestRow,
  StaffRequestSummary,
  StaffUserRow,
  StudentPinModalState,
  TeacherAssignmentFormState,
} from "./staffAdminTypes"

import {
  centsToUsdInput,
  formatClockLabel,
  formatDateTime,
  formatDurationLabel,
  formatIsoDate,
  formatMinutesLabel,
  formatMoney,
  formatReservationDateLabel,
  formatUsdInputLabel,
  normalizeClockTime,
  toLocalIsoDate,
} from "./staffAdminFormatters"
import {
  buildAssignmentCourseKindLabel,
  buildAssignmentCourseScheduleLabel,
  buildSlotsFromScheduleRules,
  compareCourseSlots,
  deriveCourseScheduleData,
  deriveRulesFromScheduleSlots,
  deriveSpecialEventsFromScheduleSlots,
  formatCourseSlotLabel,
  getCourseSlotKey,
  normalizeCourseScheduleRules,
  normalizeQuickScheduleTimes,
  parseMinutesFromClassTime,
  resolveTimeWindowByMinute,
  toCourseScheduleWeekday,
} from "./staffCourseScheduleHelpers"
import {
  buildCurrentMonthPaymentsSummarySearchParams,
  buildCurrentMonthStudentsSummary,
  buildPaymentsRequestSearchParams,
  createEmptyPackageForm,
  duplicatePackageRowToFormState,
  getPackageLifecycleStatus,
  packageRowToFormState,
  resolveDirectClassRevenueCents,
  resolveStudentCardPayments,
} from "./staffPaymentFilters"
import { resolveRoomActionErrorMessage } from "./staffRoomHelpers"
import {
  buildSelfRecommendations,
  computeSelfPerformanceScore,
} from "./staffSelfProfileMetrics"
import {
  buildCalendar,
  monthKey,
  previousWeekday,
  startOfDay,
} from "./staffCalendarHelpers"

const COURSE_IMAGE_MAX_BYTES = 2 * 1024 * 1024
const COURSE_VIDEO_MAX_BYTES = 15 * 1024 * 1024
const COURSE_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const COURSE_VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm"])

const NAV_ITEMS: StaffPortalNavItem[] = [
  { key: "users", label: "User Management", icon: Users },
  { key: "students", label: "Students", icon: GraduationCap },
  { key: "schedule", label: "School", icon: School },
  { key: "terminals", label: "Terminal Manager", icon: Monitor },
  { key: "reports", label: "Reports", icon: CircleDollarSign },
  { key: "assistant", label: "AI Assistant", icon: Bot },
  { key: "settings", label: "Settings", icon: Settings },
]


const statusLabel = (row: StaffUserRow) => {
  if (row.banned) return "Banned"
  if (row.locked) return "Locked"
  if (row.online) return "Checked in"
  if (row.authOnline) return "Signed in"
  return "Offline"
}

const normalizeTeacherAssignmentCourseSlugs = (value: string[] | null | undefined) =>
  [...new Set((Array.isArray(value) ? value : []).filter(Boolean))].sort((a, b) => a.localeCompare(b))

const buildTeacherAssignmentFormState = (row: StaffUserRow): TeacherAssignmentFormState => ({
  assignedUserId: row.teacherAssignedUserId || row.id,
  recurrenceUnit: row.teacherRecurrenceUnit === "year" ? "year" : "month",
  recurrenceInterval:
    typeof row.teacherRecurrenceInterval === "number" && Number.isFinite(row.teacherRecurrenceInterval)
      ? Math.max(1, Math.min(12, Math.round(row.teacherRecurrenceInterval)))
      : 1,
  courseSlugs: normalizeTeacherAssignmentCourseSlugs(row.teacherCourseSlugs),
})

const areTeacherAssignmentStatesEqual = (a: TeacherAssignmentFormState, b: TeacherAssignmentFormState) =>
  a.assignedUserId === b.assignedUserId &&
  a.recurrenceUnit === b.recurrenceUnit &&
  a.recurrenceInterval === b.recurrenceInterval &&
  a.courseSlugs.length === b.courseSlugs.length &&
  a.courseSlugs.every((slug, index) => slug === b.courseSlugs[index])

const formatDate = (value: number | null) => {
  if (!value) return "—"
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value))
  } catch {
    return "—"
  }
}

const toEmbedVideoUrl = (input: string) => {
  const value = input.trim()
  if (!value) return ""
  if (value.includes("youtube.com/watch?v=")) {
    const id = value.split("watch?v=")[1]?.split("&")[0]
    return id ? `https://www.youtube.com/embed/${id}` : value
  }
  if (value.includes("youtu.be/")) {
    const id = value.split("youtu.be/")[1]?.split("?")[0]
    return id ? `https://www.youtube.com/embed/${id}` : value
  }
  if (value.includes("vimeo.com/")) {
    const id = value.split("vimeo.com/")[1]?.split("?")[0]
    return id ? `https://player.vimeo.com/video/${id}` : value
  }
  return value
}

const isEmbedVideoUrl = (value: string) =>
  value.includes("youtube.com/embed/") || value.includes("player.vimeo.com/video/")

const toAutoplayEmbedUrl = (value: string) => {
  const base = value.trim()
  if (!base) return ""
  const hasQuery = base.includes("?")
  if (base.includes("youtube.com/embed/")) {
    return `${base}${hasQuery ? "&" : "?"}autoplay=1&mute=1&controls=0&rel=0&playsinline=1`
  }
  if (base.includes("player.vimeo.com/video/")) {
    return `${base}${hasQuery ? "&" : "?"}autoplay=1&muted=1&background=1`
  }
  return base
}

export const resolveHistoryMaxSelectableDateIso = (referenceDate = new Date(), timeZone = "America/New_York") => {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(referenceDate)
  } catch {
    return toLocalIsoDate(referenceDate)
  }
}

const buildReservationDateTime = (date: string, time: string) => {
  if (!ISO_DATE_REGEX.test(date) || !normalizeClockTime(time)) return null
  const parsed = new Date(`${date}T${time}:00`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

const PAYMENT_CHANGE_REQUEST_STATUS_LABELS: Record<StaffPaymentChangeRequestRow["status"], string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
}

const PAYMENT_CHANGE_REQUEST_STATUS_TO_STAFF_STATUS: Record<
  Exclude<StaffPaymentChangeRequestRow["status"], "cancelled">,
  Exclude<StaffRequestStatus, "IN_REVIEW">
> = {
  pending: "PENDING",
  approved: "APPROVED",
  rejected: "REJECTED",
}

const PAYMENT_CHANGE_REQUEST_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  direct_deposit: "Direct deposit",
  mercadopago: "Mercado Pago",
  stripe: "Stripe payouts",
  zelle: "Zelle / Venmo",
  credits: "Internal credits",
}

const PAYMENT_CHANGE_REQUEST_INFO_LABELS: Record<string, string> = {
  alias: "Alias",
  accountHolder: "Account holder",
  accountNumber: "Account number",
  accountType: "Account type",
  bankName: "Bank name",
  cbu: "CBU",
  mercadoPagoId: "Mercado Pago ID",
  routingNumber: "Routing number",
  venmoUser: "Venmo username",
  zelleId: "Zelle ID",
}

const isVisiblePaymentChangeRequest = (
  request: StaffPaymentChangeRequestRow,
  statusFilter: StaffRequestStatus | "all"
) => {
  if (request.status === "cancelled") return false
  if (statusFilter === "all") return true
  return PAYMENT_CHANGE_REQUEST_STATUS_TO_STAFF_STATUS[request.status] === statusFilter
}

export const buildStaffApprovalsSummary = (
  summary: StaffRequestSummary,
  paymentChangeRequests: StaffPaymentChangeRequestRow[]
): StaffRequestSummary => {
  const visiblePaymentChangeRequests = paymentChangeRequests.filter((request) => request.status !== "cancelled")

  return visiblePaymentChangeRequests.reduce(
    (nextSummary, request) => {
      nextSummary.total += 1
      if (request.status === "pending") nextSummary.pending += 1
      if (request.status === "approved") nextSummary.approved += 1
      if (request.status === "rejected") nextSummary.rejected += 1
      return nextSummary
    },
    { ...summary }
  )
}

export const buildStaffApprovalsFeed = (
  staffRequests: StaffRequestRow[],
  paymentChangeRequests: StaffPaymentChangeRequestRow[]
): StaffApprovalFeedItem[] => {
  const staffRequestItems: StaffApprovalFeedItem[] = staffRequests.map((request) => ({
    id: request.id,
    createdAt: request.createdAt,
    kind: "staff_request",
    request,
  }))

  const paymentChangeRequestItems: StaffApprovalFeedItem[] = paymentChangeRequests
    .filter((request) => request.status !== "cancelled")
    .map((request) => ({
      id: request.id,
      createdAt: request.createdAt,
      kind: "payment_change_request",
      request,
    }))

  return [...staffRequestItems, ...paymentChangeRequestItems].sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)
  )
}

export const formatPaymentChangeRequestMethodLabel = (requestedMethod: string) =>
  PAYMENT_CHANGE_REQUEST_METHOD_LABELS[requestedMethod] || requestedMethod.replaceAll("_", " ")

export const formatPaymentChangeRequestInfoRows = (requestedInfo: StaffPaymentChangeRequestRow["requestedInfo"]) => {
  if (!requestedInfo) return []

  return Object.entries(requestedInfo)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
    .map(([key, value]) => {
      const rawValue = String(value)
      const lowKey = key.toLowerCase()
      const displayValue =
        (lowKey.includes("number") || lowKey === "cbu") && rawValue.length > 3 ? `•••• ${rawValue.slice(-3)}` : rawValue

      return {
        key,
        label: PAYMENT_CHANGE_REQUEST_INFO_LABELS[key] || key,
        value: displayValue,
      }
    })
}

const parseDateInputStart = (value: string) => {
  if (!value) return null
  const ts = Date.parse(`${value}T00:00:00`)
  if (!Number.isFinite(ts)) return null
  return ts
}

const parseDateInputEnd = (value: string) => {
  if (!value) return null
  const ts = Date.parse(`${value}T23:59:59.999`)
  if (!Number.isFinite(ts)) return null
  return ts
}

const getWeekStartTs = (input: Date) => {
  const value = new Date(input)
  value.setHours(0, 0, 0, 0)
  const weekdayMondayZero = (value.getDay() + 6) % 7
  value.setDate(value.getDate() - weekdayMondayZero)
  return value.getTime()
}

const formatWeekRangeLabel = (weekStartTs: number) => {
  const start = new Date(weekStartTs)
  const end = new Date(weekStartTs)
  end.setDate(end.getDate() + 6)
  const startLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(start)
  const endLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(end)
  return `${startLabel} – ${endLabel}`
}

const usdInputToCents = (value: string) => {
  const clean = value.trim().replace(",", ".")
  if (!clean) return null
  const parsed = Number(clean)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.round(parsed * 100)
}

function getPackageLifecycleBadgeClass(status: PackagePlanStatus) {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
    case "SCHEDULED":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300"
    case "DELETED":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-300"
    default:
      return "bg-black/10 text-black/60 dark:bg-white/10 dark:text-white/60"
  }
}

function formatPackageLaunchLabel(value: string | null | undefined) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed)
}

const toUtcCalendarStamp = (value: Date) =>
  `${value.getUTCFullYear()}${String(value.getUTCMonth() + 1).padStart(2, "0")}${String(value.getUTCDate()).padStart(2, "0")}T${String(
    value.getUTCHours()
  ).padStart(2, "0")}${String(value.getUTCMinutes()).padStart(2, "0")}${String(value.getUTCSeconds()).padStart(2, "0")}Z`

const sanitizeWeekdays = (value: unknown): number[] => {
  if (!Array.isArray(value)) return []
  const out = value
    .map((day) => (typeof day === "number" && Number.isInteger(day) && day >= 0 && day <= 6 ? day : null))
    .filter((day): day is number => day !== null)
  return Array.from(new Set(out)).sort((a, b) => a - b)
}

const sanitizeCourseSlugs = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  const out = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0)
  return Array.from(new Set(out)).slice(0, 12)
}

const sanitizeTimeValue = (value: unknown): string => {
  if (typeof value !== "string") return ""
  const trimmed = value.trim()
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(trimmed) ? trimmed : ""
}

const parsePaymentPreferenceValue = (value: unknown): StaffPaymentPreference | null => {
  if (typeof value !== "string") return null
  const normalized = value.trim().toLowerCase()
  return PAYMENT_PREFERENCES.includes(normalized as StaffPaymentPreference)
    ? (normalized as StaffPaymentPreference)
    : null
}

const createEmptyStaffPaymentForm = (): StaffPaymentForm => ({
  paymentPreference: "",
  cbu: "",
  alias: "",
  accountHolder: "",
  mercadoPagoId: "",
  bankName: "",
  routingNumber: "",
  accountNumber: "",
  zelleId: "",
  venmoUser: "",
  accountType: "",
})

const createStaffPaymentForm = (
  paymentPreference: StaffPaymentPreference | null,
  paymentInfo: StaffPaymentInfo | null
): StaffPaymentForm => ({
  paymentPreference: paymentPreference ?? "",
  cbu: paymentInfo?.cbu ?? "",
  alias: paymentInfo?.alias ?? "",
  accountHolder: paymentInfo?.accountHolder ?? "",
  mercadoPagoId: paymentInfo?.mercadoPagoId ?? "",
  bankName: paymentInfo?.bankName ?? "",
  routingNumber: paymentInfo?.routingNumber ?? "",
  accountNumber: paymentInfo?.accountNumber ?? "",
  zelleId: paymentInfo?.zelleId ?? "",
  venmoUser: paymentInfo?.venmoUser ?? "",
  accountType: paymentInfo?.accountType ?? "",
})

const toPaymentInfoPayload = (form: StaffPaymentForm): StaffPaymentInfo | null => {
  const paymentInfo = toStaffProfilePaymentInfoPayload({
    cbu: form.cbu,
    alias: form.alias,
    accountHolder: form.accountHolder,
    mercadoPagoId: form.mercadoPagoId,
    bankName: form.bankName,
    routingNumber: form.routingNumber,
    accountNumber: form.accountNumber,
    zelleId: form.zelleId,
    venmoUser: form.venmoUser,
    accountType: form.accountType,
  })
  return paymentInfo && Object.keys(paymentInfo).length > 0 ? paymentInfo : null
}

const getInitials = (firstName: string, lastName: string, email: string) => {
  const a = firstName?.trim()?.[0] || ""
  const b = lastName?.trim()?.[0] || ""
  const initials = `${a}${b}`.toUpperCase()
  if (initials) return initials
  return (email?.trim()?.[0] || "S").toUpperCase()
}

const getStatusTone = (row: StaffUserRow) => {
  if (row.banned) return "text-red-300 border-red-500/40 bg-red-500/10"
  if (row.locked) return "text-amber-300 border-amber-500/40 bg-amber-500/10"
  if (row.online) return "text-emerald-300 border-emerald-500/40 bg-emerald-500/10"
  if (row.authOnline) return "text-sky-300 border-sky-500/40 bg-sky-500/10"
  return "text-zinc-300 border-zinc-500/40 bg-zinc-500/10"
}

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

export const resolveHistoryRangeState = (start: string, end?: string | null) => ({
  historyFrom: start,
  historyTo: end ?? "",
})

const paymentStateTone = (row: PaymentRow) => {
  if (row.paymentChannel === "cash") {
    if (row.settlementStatus === "paid") return "border-emerald-500/40 bg-emerald-500/12 text-emerald-300"
    return "border-amber-500/45 bg-amber-500/10 text-amber-300"
  }
  if (isPaymentPaidForUi(row)) return "border-emerald-500/40 bg-emerald-500/12 text-emerald-300"
  return "border-[var(--brand,#b61616)]/45 bg-[var(--brand,#b61616)]/12 text-[var(--brand,#ff4b4b)]"
}

const checkInStateLabel = (row: PaymentRow, options?: { includePurchaseCategory?: boolean }) => {
  const suffix = options?.includePurchaseCategory
    ? row.purchaseCategory === "package" ? " (pkg)" : " (drop-in)"
    : ""
  if (row.checkInStatus === "checked_in") return `Check-in${suffix}`
  if (row.checkInStatus === "checked_in_no_package") return `Check-in${suffix}`
  if (row.checkInStatus === "checked_out") return `Checked out${suffix}`
  if (row.checkInStatus === "scheduled") return `Scheduled${suffix}`
  if (isDirectPaidClassEvidence(row)) return `Attended${suffix}`
  return `Complete class${suffix}`
}

const profileBalanceStatusLabel = (outstandingBalance: StudentProfileCard["outstandingBalance"]) => {
  return typeof outstandingBalance === "number" && outstandingBalance > 0 ? "Payment due" : "Paid in full"
}

const profileBalanceStatusTone = (outstandingBalance: StudentProfileCard["outstandingBalance"]) => {
  if (typeof outstandingBalance === "number" && outstandingBalance > 0) {
    return "border-[var(--brand,#b61616)]/45 bg-[var(--brand,#b61616)]/12 text-[var(--brand,#ff4b4b)]"
  }
  return "border-emerald-500/40 bg-emerald-500/12 text-emerald-300"
}

const profilePinBadgeTone = (status: StudentProfileCard["pinStatus"]) => {
  if (status === "provisional") return "border-cyan-400/35 bg-cyan-400/10 text-cyan-200"
  if (status === "enrolled") return "border-emerald-500/40 bg-emerald-500/12 text-emerald-300"
  return "border-white/20 bg-white/[0.03] text-white/70"
}

const LAST_CHECK_IN_BADGE_TONE = "border-sky-400/40 bg-sky-400/12 text-sky-200"
const PROFILE_CARD_BADGE_CLASS = "w-full flex items-center justify-center rounded-md border px-2 py-1.5 text-xs font-semibold"

const profilePinBadgeLabel = (status: StudentProfileCard["pinStatus"]) => {
  if (status === "provisional") return "Provisional PIN"
  if (status === "enrolled") return "PIN enrolled"
  return "No PIN"
}

type ProfileBadge = {
  key: string
  label: string
  tone: string
  title?: string
}

export const resolveProfileCardBadges = (student: StudentProfileCard) => {
  const details = resolveProfileCardDetails(student)
  return [
    {
      key: "points",
      label: `Points: ${student.pointsBalance}`,
      tone: "border-amber-400/35 bg-amber-400/10 text-amber-200",
    },
    {
      key: "payment",
      label: details.paymentStatusLabel,
      tone: details.paymentStatusTone,
    },
    {
      key: "check-in",
      label: "Last check-in",
      tone: LAST_CHECK_IN_BADGE_TONE,
      ...(student.latestCheckInAt ? { title: formatStudentPaymentCardDateTimeLabel(student.latestCheckInAt) } : {}),
    },
    {
      key: "pin",
      label: details.pinStatusLabel,
      tone: details.pinStatusTone,
    },
  ] satisfies ProfileBadge[]
}

export const resolveProfileCashSettlementControl = (student: StudentProfileCard) => {
  if (!student.cashSettlement) return null
  if (student.cashSettlement.settlementStatus !== "pending") return null
  return {
    paymentId: student.cashSettlement.paymentId,
    settlementStatus: student.cashSettlement.settlementStatus,
    settlementNote: student.cashSettlement.settlementNote,
  }
}

export const resolveProfileSettlementControl = (student: StudentProfileCard) => {
  const cash = resolveProfileCashSettlementControl(student)
  if (cash) return cash
  if (!student.pendingSettlement) return null
  if (student.pendingSettlement.settlementStatus !== "pending") return null
  return {
    paymentId: student.pendingSettlement.paymentId,
    settlementStatus: student.pendingSettlement.settlementStatus,
    settlementNote: student.pendingSettlement.settlementNote,
  }
}

const resolveVisibleProfileSettlementIds = (students: StudentProfileCard[]) =>
  [
    ...new Set(
      students
        .map((student) => resolveProfileSettlementControl(student)?.paymentId)
        .filter((paymentId): paymentId is string => Boolean(paymentId))
    ),
  ]

const getOpenPaymentIds = (allPayments: PaymentRow[]): string[] => {
  return allPayments
    .filter((payment) => {
      const hasOutstandingBalance = typeof payment.outstandingBalance === "number" && payment.outstandingBalance > 0
      const isPending = payment.settlementStatus === "pending"
      return hasOutstandingBalance || isPending
    })
    .map((payment) => payment.id)
}

export const resolveProfileCardDetailRows = (student: StudentProfileCard) => {
  const details = resolveProfileCardDetails(student)
  return [
    { key: "location", label: "Location", value: details.latestLocationLabel },
    { key: "email", label: "Email", value: student.email || "—" },
    { key: "phone", label: "Phone", value: student.phone || "—" },
    ...(student.provisionalPinExpiresAt
      ? [{ key: "provisional-pin-expiry", label: "Provisional PIN expiry", value: formatIsoDate(student.provisionalPinExpiresAt) }]
      : []),
    { key: "package", label: "Package", value: details.packageLabel },
    { key: "credits", label: "Credits", value: details.packageValue },
    ...(details.outstandingBalanceLabel
      ? [{ key: "outstanding-balance", label: "Outstanding balance", value: details.outstandingBalanceLabel, tone: "danger" as const }]
      : []),
    { key: "last-payment", label: "Last payment", value: details.lastPaymentLabel },
    { key: "last-course", label: "Last course", value: details.lastCourseLabel },
  ]
}

export const resolveProfileCardDetails = (student: StudentProfileCard) => {
  const packageLabel = student.activePackage?.label || "No active package"
  const packageValue = student.activePackage
    ? student.activePackage.isUnlimited
      ? "Unlimited"
      : `${Math.max(0, student.remainingCredits || 0)} credits`
    : "No package credits"
  const paymentStatusLabel = profileBalanceStatusLabel(student.outstandingBalance)
  const paymentStatusTone = profileBalanceStatusTone(student.outstandingBalance)
  const checkInStatusLabel = checkInStateLabel({ checkInStatus: student.checkInStatus } as PaymentRow)
  const checkInStatusTone = checkInStateTone({ checkInStatus: student.checkInStatus } as PaymentRow)
  const pinStatusLabel = profilePinBadgeLabel(student.pinStatus)
  const pinStatusTone = profilePinBadgeTone(student.pinStatus)
  const lastPaymentLabel = student.lastPayment
    ? `${formatMoney(student.lastPayment.amountCents)} · ${formatIsoDateLong(student.lastPayment.date)}`
    : "No successful payments"
  const outstandingBalanceLabel = typeof student.outstandingBalance === "number" && student.outstandingBalance > 0
    ? formatMoney(student.outstandingBalance)
    : null
  const latestLocationLabel = student.latestClassAttended?.location || "No class location"
  const lastCourseLabel = student.lastCourse?.courseTitle || student.lastCourse?.courseSlug || "No registered course"

  return {
    packageLabel,
    packageValue,
    paymentStatusLabel,
    paymentStatusTone,
    checkInStatusLabel,
    checkInStatusTone,
    pinStatusLabel,
    pinStatusTone,
    lastPaymentLabel,
    lastCourseLabel,
    outstandingBalanceLabel,
    latestLocationLabel,
  }
}

const splitCustomerName = (name: string, email: string) => {
  const source = name.trim() || email.trim()
  const parts = source.split(/\s+/).filter(Boolean)
  const firstName = parts[0] || ""
  const lastName = parts.slice(1).join(" ")
  return { firstName, lastName, fullName: source || "Student" }
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

const MIN_LOADING_DELAY_MS = 3000
const STAFF_USERS_CRITICAL_REFRESH_MS = 15_000
const STAFF_USERS_NORMAL_REFRESH_MS = 60_000
const STAFF_PRESENCE_BACKOFF_MAX_MS = 300_000
const TERMINAL_ALERTS_CRITICAL_REFRESH_MS = 5_000
const TERMINAL_ALERTS_NORMAL_REFRESH_MS = 30_000
const TERMINAL_ALERT_PRIORITY: Record<"warning" | "cooldown" | "emergency", number> = {
  emergency: 0,
  cooldown: 1,
  warning: 2,
}
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const formatTerminalAlertDateTime = (value: string | null) => {
  if (!value) return "—"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/New_York",
  }).format(parsed)
}

const formatTerminalAlertRelative = (value: string | null, nowTs: number) => {
  if (!value) return null
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return null
  const diffMs = parsed - nowTs
  if (diffMs <= 0) return "ending now"
  const diffMinutes = Math.max(1, Math.ceil(diffMs / 60_000))
  return diffMinutes === 1 ? "ends in 1 min" : `ends in ${diffMinutes} min`
}

type StaffUsersAdminClientProps = {
  currentRole: StaffRole
  currentCategory: StaffCategory | null
  currentUserId: string
}

type ClerkSyncMismatch = {
  userId: string
  clerkId: string
  email: string | null
  fields: Array<"name" | "email" | "phone">
  clerk: { name: string | null; email: string | null; phone: string | null }
  db: { name: string | null; email: string | null; phone: string | null }
}

type ClerkSyncHealth = {
  clerkUsers: number
  dbUsersWithClerkId: number
  missingCount: number
  missingUsers: Array<{ clerkId: string; email: string | null }>
  mismatchedCount?: number
  mismatchedUsers?: ClerkSyncMismatch[]
}

export default function StaffUsersAdminClient({ currentRole, currentCategory, currentUserId }: StaffUsersAdminClientProps) {
  const searchParams = useSearchParams()
  const resolvedCurrentCategory: StaffCategory =
    currentCategory || (currentRole === "owner" ? "partner" : currentRole === "admin" ? "manager" : "guest")
  const defaultNav = getDefaultStaffPortalSection(currentRole, resolvedCurrentCategory) || "profile"
  const gridRef = React.useRef<HTMLDivElement>(null)
  const leftRailRef = React.useRef<HTMLDivElement>(null)
  const rightRailRef = React.useRef<HTMLDivElement>(null)
  const fetchInFlightRef = React.useRef(false)
  const backoffUntilRef = React.useRef(0)
  const consecutiveFailuresRef = React.useRef(0)

  const [rows, setRows] = React.useState<StaffUserRow[]>([])
  const [payrollModelOptions, setPayrollModelOptions] = React.useState<StaffPaymentModelOption[]>([])
  const [payrollModelLoading, setPayrollModelLoading] = React.useState(false)
  const [payrollModelError, setPayrollModelError] = React.useState<string | null>(null)
  const [payrollModelActionByUserId, setPayrollModelActionByUserId] = React.useState<Record<string, PayrollModelActionState>>({})
  const [nowTs, setNowTs] = React.useState(() => Date.now())
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [query, setQuery] = React.useState("")
  const [busyUserId, setBusyUserId] = React.useState<string | null>(null)
  const [activeNav, setActiveNav] = React.useState<StaffPortalSection>(defaultNav)
  const [categoryFilter, setCategoryFilter] = React.useState<StaffCategory | "all">("all")
  const [assistantConfig, setAssistantConfig] = React.useState({
    tone: "balanced",
    searchMode: "hybrid",
    workflow: "operations",
    includeSources: true,
    suggestActions: true,
    requireConfirmation: true,
  })
  const [assistantConfigMessage, setAssistantConfigMessage] = React.useState<string | null>(null)
  const [assistantChatMessages, setAssistantChatMessages] = React.useState<Array<{ id: string; role: "assistant" | "user"; text: string }>>([
    {
      id: "assistant-welcome",
      role: "assistant",
      text: "Puedo ayudarte con staff, reportes, cursos y terminales. Decime qué necesitás revisar.",
    },
  ])
  const [assistantChatInput, setAssistantChatInput] = React.useState("")
  const [isRailCollapsed, setIsRailCollapsed] = React.useState(false)

  const [email, setEmail] = React.useState("")
  const [firstName, setFirstName] = React.useState("")
  const [lastName, setLastName] = React.useState("")
  const [newRole, setNewRole] = React.useState<StaffRole>("staff")
  const [newCategory, setNewCategory] = React.useState<StaffCategory>("guest")
  const [newPin, setNewPin] = React.useState("")
  const [createBusy, setCreateBusy] = React.useState(false)
  const [createMessage, setCreateMessage] = React.useState<string | null>(null)

  const [scheduleMonth, setScheduleMonth] = React.useState(() => new Date())
  const [profileScheduleMonth, setProfileScheduleMonth] = React.useState(() => new Date())
  const [scheduleLoading, setScheduleLoading] = React.useState(false)
  const [scheduleEventsByDay, setScheduleEventsByDay] = React.useState<Record<string, ScheduleEvent[]>>({})

  const [payments, setPayments] = React.useState<PaymentRow[]>([])
  const [paymentsMonthlySummaryApi, setPaymentsMonthlySummaryApi] = React.useState<PaymentsApiSummary>(() => createEmptyPaymentsSummary())
  const [paymentsMonthlyStudentCount, setPaymentsMonthlyStudentCount] = React.useState(0)
  const [paymentsMonthlyCheckedInStudents, setPaymentsMonthlyCheckedInStudents] = React.useState(0)
  const [paymentsLoading, setPaymentsLoading] = React.useState(false)
  const [terminalPinAlerts, setTerminalPinAlerts] = React.useState<Array<{
    terminalId: string
    terminalName: string
    terminalLocation: string | null
    severity: "warning" | "cooldown" | "emergency"
    label: string
    message: string
    blockedUntil: string | null
    missCount: number
  }>>([])
  const [paymentsFilter, setPaymentsFilter] = React.useState<"all" | "pending" | "paid">("all")
  const [paymentCategoryFilter, setPaymentCategoryFilter] = React.useState<PaymentCategoryFilter>("all")
  const isHistoryMode = paymentCategoryFilter === "history"
  const [historyFrom, setHistoryFrom] = React.useState("")
  const [historyTo, setHistoryTo] = React.useState("")
  const [historyPaymentMethodFilter, setHistoryPaymentMethodFilter] = React.useState<HistoryPaymentMethodFilter>("all")
  const [historyAttendanceFilter, setHistoryAttendanceFilter] = React.useState<HistoryAttendanceFilter>("all")
  const [historyClassKey, setHistoryClassKey] = React.useState("")
  const [historyClassOptions, setHistoryClassOptions] = React.useState<HistoryClassOption[]>([])
  const [studentSearchQuery, setStudentSearchQuery] = React.useState("")
  const studentSearchQueryRef = React.useRef("")
  const [isHistorySearchLoading, setIsHistorySearchLoading] = React.useState(false)
  const historySearchDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep ref in sync with state for stable fetchPayments dependency
  const loadCourseLinks = React.useCallback(async (courseSlug: string) => {
    try {
      const res = await fetch(`/api/staff/school/course-links?courseSlug=${encodeURIComponent(courseSlug)}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "Unable to load course links.")
      const asA = Array.isArray(data?.asA) ? data.asA : []
      const asB = Array.isArray(data?.asB) ? data.asB : []
      setCourseLinksAsA(asA as CourseLinkRow[])
      setCourseLinksAsB(asB as CourseLinkRow[])
    } catch {
      // Silently fail — links are optional
      setCourseLinksAsA([])
      setCourseLinksAsB([])
    }
  }, [])

  React.useEffect(() => {
    studentSearchQueryRef.current = studentSearchQuery
  }, [studentSearchQuery])
  const [reportsDateFrom, setReportsDateFrom] = React.useState("")
  const [reportsDateTo, setReportsDateTo] = React.useState("")
  const [reportsObjectiveFilter, setReportsObjectiveFilter] = React.useState<ReportsObjectiveFilter>("all")
  const [expandedSuggestionId, setExpandedSuggestionId] = React.useState<string | null>(null)
  const [doneSuggestionIds, setDoneSuggestionIds] = React.useState<string[]>([])
  const [remoteReportSuggestions, setRemoteReportSuggestions] = React.useState<ReportsSuggestion[] | null>(null)
  const [reportSuggestionsProvider, setReportSuggestionsProvider] = React.useState<"local" | "mock" | "custom-http">("local")
  const [reportSuggestionsLoading, setReportSuggestionsLoading] = React.useState(false)
  const [reportSuggestionsError, setReportSuggestionsError] = React.useState<string | null>(null)
  const [selectedPaymentIds, setSelectedPaymentIds] = React.useState<string[]>([])
  const [paymentsBulkBusyAction, setPaymentsBulkBusyAction] = React.useState<"mark_paid" | "mark_pending" | null>(null)
  const [currentPage, setCurrentPage] = React.useState(1)
  const [checkoutMenuPaymentId, setCheckoutMenuPaymentId] = React.useState<string | null>(null)

  // Timeline popover state
  const [paymentHistoryAnchor, setPaymentHistoryAnchor] = React.useState<HTMLElement | null>(null)
  const [paymentHistoryStudentId, setPaymentHistoryStudentId] = React.useState<string | null>(null)
  const [attendanceHistoryAnchor, setAttendanceHistoryAnchor] = React.useState<HTMLElement | null>(null)
  const [attendanceHistoryStudentId, setAttendanceHistoryStudentId] = React.useState<string | null>(null)
  const [auditHistoryAnchor, setAuditHistoryAnchor] = React.useState<HTMLElement | null>(null)
  const [auditHistoryStudentId, setAuditHistoryStudentId] = React.useState<string | null>(null)
  const [auditHistoryStudentName, setAuditHistoryStudentName] = React.useState<string | null>(null)
  const [userHistoryPayments, setUserHistoryPayments] = React.useState<PaymentRow[]>([])
  const [userHistoryLoading, setUserHistoryLoading] = React.useState(false)

  const [staffRequests, setStaffRequests] = React.useState<StaffRequestRow[]>([])
  const [requestsSummary, setRequestsSummary] = React.useState<StaffRequestSummary>({
    total: 0,
    pending: 0,
    inReview: 0,
    approved: 0,
    rejected: 0,
  })
  const [requestsLoading, setRequestsLoading] = React.useState(false)
  const [requestStatusFilter, setRequestStatusFilter] = React.useState<StaffRequestStatus | "all">("PENDING")
  const [profileRequestStatusFilter, setProfileRequestStatusFilter] = React.useState<StaffRequestStatus | "all">("all")
  const [requestBusyId, setRequestBusyId] = React.useState<string | null>(null)
  const [paymentChangeRequests, setPaymentChangeRequests] = React.useState<StaffPaymentChangeRequestRow[]>([])
  const [paymentChangeRequestsLoading, setPaymentChangeRequestsLoading] = React.useState(false)
  const [paymentChangeRequestBusyId, setPaymentChangeRequestBusyId] = React.useState<string | null>(null)
  const [selfProfileLoading, setSelfProfileLoading] = React.useState(false)
  const [selfProfileSnapshot, setSelfProfileSnapshot] = React.useState<SelfProfileSnapshot | null>(null)
  const [profilePaymentExpanded, setProfilePaymentExpanded] = React.useState(false)
  const [profilePaymentSaving, setProfilePaymentSaving] = React.useState(false)
  const [profilePaymentError, setProfilePaymentError] = React.useState<string | null>(null)
  const [profilePaymentSuccess, setProfilePaymentSuccess] = React.useState<string | null>(null)
  const [profilePaymentForm, setProfilePaymentForm] = React.useState<StaffPaymentForm>(() => createEmptyStaffPaymentForm())
  const [profileRequestSubmitting, setProfileRequestSubmitting] = React.useState(false)
  const [profileRequestSuccess, setProfileRequestSuccess] = React.useState<string | null>(null)
  const [profileRequestError, setProfileRequestError] = React.useState<string | null>(null)
  const [profileRequestForm, setProfileRequestForm] = React.useState<ProfileRequestFormState>({
    type: "STAFF_SCHEDULE_CHANGE",
    message: "",
    startDate: "",
    endDate: "",
    preferredShift: "",
    consultTopic: "",
  })

  const [profileModalOpen, setProfileModalOpen] = React.useState(false)
  const [profileTarget, setProfileTarget] = React.useState<StaffUserRow | null>(null)
  const [profileLoading, setProfileLoading] = React.useState(false)
  const [profileSaving, setProfileSaving] = React.useState(false)
  const [profileError, setProfileError] = React.useState<string | null>(null)
  const [profileSuccess, setProfileSuccess] = React.useState<string | null>(null)
  const [profileHasPin, setProfileHasPin] = React.useState(false)
  const [profileCanEditRole, setProfileCanEditRole] = React.useState(false)
  const [profileAvatarUploading, setProfileAvatarUploading] = React.useState(false)
  const [profileAvatarError, setProfileAvatarError] = React.useState<string | null>(null)
  const [profileGalleryUploading, setProfileGalleryUploading] = React.useState(false)
  const [presenceMenuUserId, setPresenceMenuUserId] = React.useState<string | null>(null)
  const [delayModal, setDelayModal] = React.useState<PayrollDelayModalState | null>(null)
  const [studentPinModal, setStudentPinModal] = React.useState<StudentPinModalState | null>(null)
  const [studentPinReason, setStudentPinReason] = React.useState("")
  const [studentPinDraft, setStudentPinDraft] = React.useState("")
  const [studentPinSubmitting, setStudentPinSubmitting] = React.useState(false)
  const [studentPinError, setStudentPinError] = React.useState<string | null>(null)
  const [studentPinIssued, setStudentPinIssued] = React.useState<{
    value: string
    masked: string
    expiresAt: string | null
  } | null>(null)
  const [studentPinRevealIssued, setStudentPinRevealIssued] = React.useState(false)
  const [overrideModalStudent, setOverrideModalStudent] = React.useState<{ id: string; name: string } | null>(null)
  const overrideModalOpen = overrideModalStudent !== null
  const [usersWithAuditEntries, setUsersWithAuditEntries] = React.useState<Set<string>>(new Set())
  const [clerkSyncHealth, setClerkSyncHealth] = React.useState<ClerkSyncHealth | null>(null)
  const [clerkSyncLoading, setClerkSyncLoading] = React.useState(false)
  const [clerkSyncRepairing, setClerkSyncRepairing] = React.useState(false)
  const [clerkSyncError, setClerkSyncError] = React.useState<string | null>(null)
  const [clerkSyncMessage, setClerkSyncMessage] = React.useState<string | null>(null)
  const [clerkSyncUserBusyId, setClerkSyncUserBusyId] = React.useState<string | null>(null)
  const [teacherUserId, setTeacherUserId] = React.useState("")
  const [teacherReviewCycleDays, setTeacherReviewCycleDays] = React.useState(30)
  const [teacherAssignedUserId, setTeacherAssignedUserId] = React.useState("")
  const [teacherRecurrenceUnit, setTeacherRecurrenceUnit] = React.useState<"month" | "year">("month")
  const [teacherRecurrenceInterval, setTeacherRecurrenceInterval] = React.useState(1)
  const [teacherCourseSlugs, setTeacherCourseSlugs] = React.useState<string[]>([])
  const [teacherSaving, setTeacherSaving] = React.useState(false)
  const [teacherSuccess, setTeacherSuccess] = React.useState<string | null>(null)
  const [teacherError, setTeacherError] = React.useState<string | null>(null)
  const lastHydratedTeacherIdRef = React.useRef<string | null>(null)
  const [metricsView, setMetricsView] = React.useState<"current" | "previous_cycle">("current")
  const [metricsSaving, setMetricsSaving] = React.useState(false)
  const [metricsSuccess, setMetricsSuccess] = React.useState<string | null>(null)
  const [metricsError, setMetricsError] = React.useState<string | null>(null)
  const [schoolLoading, setSchoolLoading] = React.useState(false)
  const [schoolBusy, setSchoolBusy] = React.useState<null | "course" | "package" | "rule" | "assign">(null)
  const [schoolError, setSchoolError] = React.useState<string | null>(null)
  const [schoolSuccess, setSchoolSuccess] = React.useState<string | null>(null)
  const schoolWizard = useSchoolWizard()
  const [schoolCourses, setSchoolCourses] = React.useState<SchoolCourseRow[]>([])
  const [schoolRooms, setSchoolRooms] = React.useState<RoomRow[]>([])
  const [schoolPackages, setSchoolPackages] = React.useState<SchoolPackageRow[]>([])
  const [packageStatusFilter, setPackageStatusFilter] = React.useState<PackageStatusFilter>("all")
  const [packageSearchQuery, setPackageSearchQuery] = React.useState("")
  const [editingPackageId, setEditingPackageId] = React.useState<string | null>(null)
  const [schoolPointsRules, setSchoolPointsRules] = React.useState<PointsRuleRow[]>([])
  const [roomForm, setRoomForm] = React.useState<RoomFormState>(() => createInitialRoomForm())
  const [roomSearchQuery, setRoomSearchQuery] = React.useState("")
  const [roomStatusFilter, setRoomStatusFilter] = React.useState<"all" | "active" | "inactive">("all")
  const [roomSaving, setRoomSaving] = React.useState(false)
  const [roomBusyId, setRoomBusyId] = React.useState<string | null>(null)
  const [roomFormError, setRoomFormError] = React.useState<string | null>(null)
  const [roomFormSuccess, setRoomFormSuccess] = React.useState<string | null>(null)
  const [roomActionErrors, setRoomActionErrors] = React.useState<Record<string, string>>({})
  const [roomSafeDeleteModal, setRoomSafeDeleteModal] = React.useState<RoomSafeDeleteModalState | null>(null)
  const [roomReassignModal, setRoomReassignModal] = React.useState<RoomReassignModalState | null>(null)
  const [roomReservations, setRoomReservations] = React.useState<RoomReservationRow[]>([])
  const [roomReservationForm, setRoomReservationForm] = React.useState<RoomReservationFormState>(() => createEmptyRoomReservationForm())
  const [roomReservationSaving, setRoomReservationSaving] = React.useState(false)
  const [roomReservationCancelModal, setRoomReservationCancelModal] = React.useState<RoomReservationCancelModalState | null>(null)
  const [roomReservationBusyId, setRoomReservationBusyId] = React.useState<string | null>(null)
  const [roomReservationFormError, setRoomReservationFormError] = React.useState<string | null>(null)
  const [roomReservationFormSuccess, setRoomReservationFormSuccess] = React.useState<string | null>(null)
  const updateRoomReservationFormField = React.useCallback(
    <Field extends keyof RoomReservationFormState>(field: Field, value: RoomReservationFormState[Field]) => {
      setRoomReservationForm((prev) => ({
        ...prev,
        [field]: value,
      }))
    },
    [],
  )
  const [courseForm, setCourseForm] = React.useState<CourseFormState>({
    slug: "",
    title: "",
    kind: "course",
    category: "",
    description: "",
    previewImageUrl: "",
    previewVideoUrl: "",
    dropInPriceCents: "",
    firstClassPriceCents: "",
    level: "Beginner",
    durationMinutes: "55",
    location: "54 Coles St, Jersey City, NJ",
    defaultRoomId: "",
    publicationMode: "publish_now",
    launchDate: "",
    specialDiscountType: "none",
    specialDiscountCustomLabel: "",
    specialDiscountPrice: "",
    availableTimesCsv: "",
    active: true,
  })
  const [courseWeekdays, setCourseWeekdays] = React.useState<number[]>([])
  const [courseScheduleDate, setCourseScheduleDate] = React.useState("")
  const [courseScheduleDates, setCourseScheduleDates] = React.useState<string[]>([])
  const [courseRecurringWeekdays, setCourseRecurringWeekdays] = React.useState<number[]>([])
  const [courseMirrorEnabled, setCourseMirrorEnabled] = React.useState(false)
  const [courseMirrorWeekdays, setCourseMirrorWeekdays] = React.useState<number[]>([])
  const [courseRepeatAllMonth, setCourseRepeatAllMonth] = React.useState(true)
  const [courseRecurrenceMode, setCourseRecurrenceMode] = React.useState<"indefinite" | "until_date">("indefinite")
  const [courseRecurrenceEndsAt, setCourseRecurrenceEndsAt] = React.useState("")
  const [courseScheduleTime, setCourseScheduleTime] = React.useState("10:00")
  const [courseScheduleSlots, setCourseScheduleSlots] = React.useState<CourseScheduleSlot[]>([])
  const [quickScheduleTimes, setQuickScheduleTimes] = React.useState<string[]>(() => normalizeQuickScheduleTimes(DEFAULT_QUICK_SCHEDULE_TIMES))
  const [editingQuickTimeIndex, setEditingQuickTimeIndex] = React.useState<number | null>(null)
  const [quickTimeDraft, setQuickTimeDraft] = React.useState("")
  const [scheduleTimePickerOpen, setScheduleTimePickerOpen] = React.useState(false)
  const [reviewPreviewHover, setReviewPreviewHover] = React.useState<"home" | "single" | null>(null)
  const [courseLocalImagePreview, setCourseLocalImagePreview] = React.useState("")
  const [courseLocalVideoPreview, setCourseLocalVideoPreview] = React.useState("")
  const [courseLocalImageName, setCourseLocalImageName] = React.useState("")
  const [courseLocalVideoName, setCourseLocalVideoName] = React.useState("")
  const [courseMediaUploading, setCourseMediaUploading] = React.useState<null | "image" | "video">(null)
  const [courseHydratedFromQuery, setCourseHydratedFromQuery] = React.useState(false)
  const [courseEditingSlug, setCourseEditingSlug] = React.useState<string | null>(null) // The original slug when editing
  const wizardEnabledCtx: StepEnabledContext = { courseEditingSlug }
  const [courseCatalogSearch, setCourseCatalogSearch] = React.useState("")
  const [courseCatalogFilter, setCourseCatalogFilter] = React.useState<"all" | "active" | "inactive">("all")
  const [courseSlugConflict, setCourseSlugConflict] = React.useState<{ exists: boolean; suggestion: string | null; existingTitle: string | null }>({
    exists: false,
    suggestion: null,
    existingTitle: null,
  })
  // CourseLink (consecutive classes) state
  const [courseLinksAsA, setCourseLinksAsA] = React.useState<CourseLinkRow[]>([])
  const [courseLinksAsB, setCourseLinksAsB] = React.useState<CourseLinkRow[]>([])
  const [courseLinkForm, setCourseLinkForm] = React.useState<CourseLinkFormState>({
    courseSlugB: "",
    dropInConsecutiveCents: "",
    packageHolderConsecutiveCents: "",
    active: true,
  })
  const [courseLinkEditingId, setCourseLinkEditingId] = React.useState<string | null>(null)
  const [courseLinkSaving, setCourseLinkSaving] = React.useState(false)
  const [courseLinkError, setCourseLinkError] = React.useState<string | null>(null)
  const [courseLinkSuccess, setCourseLinkSuccess] = React.useState<string | null>(null)
  const [allCourseLinksMap, setAllCourseLinksMap] = React.useState<Record<string, { asA: CourseLinkRow[]; asB: CourseLinkRow[] }>>({})
  const courseImageInputRef = React.useRef<HTMLInputElement>(null)
  const courseVideoInputRef = React.useRef<HTMLInputElement>(null)
  const scheduleTimePickerRef = React.useRef<HTMLDivElement>(null)
  const courseFormFieldsRef = React.useRef<HTMLDivElement>(null)
  const resetCourseLinkForm = React.useCallback(() => {
    setCourseLinkForm({
      courseSlugB: "",
      dropInConsecutiveCents: "",
      packageHolderConsecutiveCents: "",
      active: true,
    })
    setCourseLinkEditingId(null)
    setCourseLinkError(null)
    setCourseLinkSuccess(null)
  }, [])
  const [packageForm, setPackageForm] = React.useState<PackageFormState>(() => createEmptyPackageForm())
  const [pointsRuleForm, setPointsRuleForm] = React.useState<PointsRuleFormState>({
    templateKey: POINTS_RULE_DEFINITIONS[0]?.key || "profile-completed",
    points: "10",
    active: true,
  })
  const [pointsAssignForm, setPointsAssignForm] = React.useState<PointsAssignFormState>({
    userEmail: "",
    type: "MANUAL_STAFF_ASSIGNMENT",
    points: "10",
    note: "",
    eventKey: "",
  })
  const [profileForm, setProfileForm] = React.useState<StaffProfileForm>({
    firstName: "",
    lastName: "",
    role: "staff",
    category: "guest",
    birthDate: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    personalNote: "",
    location: "",
    gallery: [],
    pin: "",
    clearPin: false,
  })

  React.useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(SCHOOL_SCHEDULE_SHORTCUTS_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { quick?: unknown }
      if (Array.isArray(parsed.quick)) {
        const nextQuick = parsed.quick
          .map((item) => normalizeClockTime(String(item)))
          .filter((item): item is string => Boolean(item))
        if (nextQuick.length > 0) setQuickScheduleTimes(normalizeQuickScheduleTimes(nextQuick))
      }
    } catch {
      // ignore corrupted local storage
    }
  }, [])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    try {
      window.localStorage.setItem(
        SCHOOL_SCHEDULE_SHORTCUTS_STORAGE_KEY,
        JSON.stringify({
          quick: quickScheduleTimes,
        })
      )
    } catch {
      // ignore storage write failures
    }
  }, [quickScheduleTimes])

  // Load user payment history for history-range popovers only.
  // Daily PMT history must remain board-scoped to NY-today rows.
  React.useEffect(() => {
    const userId = isHistoryMode
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
    if (historyFrom && historyTo) {
      params.set("from", historyFrom)
      params.set("to", historyTo)
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
          if (paymentHistoryStudentId && isHistoryMode) {
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
  }, [attendanceHistoryStudentId, historyFrom, historyTo, isHistoryMode, paymentHistoryStudentId, payments])

  const allowedNavSections = React.useMemo(
    () => resolveStaffPortalSections(currentRole, resolvedCurrentCategory),
    [currentRole, resolvedCurrentCategory]
  )
  const visibleNavItems = React.useMemo(
    () => NAV_ITEMS.filter((item) => allowedNavSections.includes(item.key)),
    [allowedNavSections]
  )

  const filteredSchoolPackages = React.useMemo(() => {
    const normalizedQuery = packageSearchQuery.trim().toLowerCase()
    const statusFiltered =
      packageStatusFilter === "all"
        ? schoolPackages.filter((item) => getPackageLifecycleStatus(item) !== "DELETED")
        : schoolPackages.filter((item) => getPackageLifecycleStatus(item) === packageStatusFilter)

    if (!normalizedQuery) return statusFiltered

    return statusFiltered.filter((item) => {
      const haystack = [item.label, item.key, item.courseSlug || "", item.cadence || ""].join(" ").toLowerCase()
      return haystack.includes(normalizedQuery)
    })
  }, [packageSearchQuery, packageStatusFilter, schoolPackages])

  const packageCounts = React.useMemo(
    () => ({
      all: schoolPackages.length,
      live: schoolPackages.filter((item) => getPackageLifecycleStatus(item) !== "DELETED").length,
      ACTIVE: schoolPackages.filter((item) => getPackageLifecycleStatus(item) === "ACTIVE").length,
      SUSPENDED: schoolPackages.filter((item) => getPackageLifecycleStatus(item) === "SUSPENDED").length,
      SCHEDULED: schoolPackages.filter((item) => getPackageLifecycleStatus(item) === "SCHEDULED").length,
      DELETED: schoolPackages.filter((item) => getPackageLifecycleStatus(item) === "DELETED").length,
    }),
    [schoolPackages]
  )
  const courseLinkStats = React.useMemo(() => {
    const all: CourseLinkRow[] = []
    const seen = new Set<string>()
    for (const entry of Object.values(allCourseLinksMap)) {
      for (const link of [...entry.asA, ...entry.asB]) {
        if (!seen.has(link.id)) { seen.add(link.id); all.push(link) }
      }
    }
    return { total: all.length, active: all.filter((l) => l.active).length, inactive: all.filter((l) => !l.active).length }
  }, [allCourseLinksMap])
  const canAccessUsersNav = allowedNavSections.includes("users")
  const canAccessStudentsNav = allowedNavSections.includes("students")
  const canAccessSchoolNav = allowedNavSections.includes("schedule")
  const canAccessTerminalsNav = allowedNavSections.includes("terminals")
  const canManageTerminalSetup = currentRole === "owner" || currentRole === "admin"
  const canAccessReportsNav = allowedNavSections.includes("reports")
  const canAccessAssistantNav = allowedNavSections.includes("assistant")
  const canAccessSettingsNav = allowedNavSections.includes("settings")
  const canAccessProfileNav = allowedNavSections.includes("profile")
  const canOperateStudentPins = hasExplicitStaffPermission(currentRole, resolvedCurrentCategory, "studentPinOps")
  const canManageClerkSync = currentRole === "owner" || currentRole === "admin"
  const isStudentsView = activeNav === "students" && canAccessStudentsNav
  const isReportsView = activeNav === "reports" && canAccessReportsNav
  const isSchoolView = activeNav === "schedule" && canAccessSchoolNav
  const isTerminalView = activeNav === "terminals" && canAccessTerminalsNav
  const isAssistantView = activeNav === "assistant" && canAccessAssistantNav
  const isSettingsView = activeNav === "settings" && canAccessSettingsNav
  const isProfileView = activeNav === "profile" && canAccessProfileNav
  const isSpecialEventCourse = SPECIAL_EVENT_COURSE_KINDS.has(courseForm.kind)
  const showStaffOps = activeNav === "users" && canAccessUsersNav
  const showRightRail = true
  const showInlineRightRail = showRightRail && !isRailCollapsed
  const activeNavLabel = React.useMemo(
    () => visibleNavItems.find((item) => item.key === activeNav)?.label ?? "Current section",
    [activeNav, visibleNavItems]
  )
  React.useEffect(() => {
    if (allowedNavSections.length === 0) return
    if (!allowedNavSections.includes(activeNav)) {
      const next = getDefaultStaffPortalSection(currentRole, resolvedCurrentCategory) || allowedNavSections[0]
      setActiveNav(next)
    }
  }, [activeNav, allowedNavSections, currentRole, resolvedCurrentCategory])
  const handleNavSelection = React.useCallback((nextNav: StaffPortalSection) => {
    setActiveNav(nextNav)
    if (nextNav === "assistant") {
      setIsRailCollapsed(false)
    }
  }, [])
  const assignableRoles = React.useMemo<StaffRole[]>(() => {
    return currentRole === "owner" ? ["owner", "admin", "staff"] : ["admin", "staff"]
  }, [currentRole])
  const canManageTarget = React.useCallback(
    (target: StaffUserRow) => {
      if (currentRole === "owner") return true
      if (target.role === "owner") return false
      return true
    },
    [currentRole]
  )
  const selfProfileRow = React.useMemo<StaffUserRow>(
    () => ({
      id: currentUserId,
      paymentModelId: null,
      email: "",
      phone: "",
      avatarUrl: "",
      location: "",
      hasPin: false,
      firstName: profileForm.firstName || "Staff",
      lastName: profileForm.lastName || "Member",
      role: currentRole,
      category: resolvedCurrentCategory,
      payrollHoursWorked: null,
      payrollHourlyRate: null,
      payrollStatus: null,
      payrollPaydayWeekday: null,
      payrollDelayEntries: [],
      performanceRating: null,
      performanceReviewsCount: null,
      performanceReviewCycleDays: null,
      teacherType: "full_time",
      teacherAssignedUserId: "",
      teacherRecurrenceUnit: "month",
      teacherRecurrenceInterval: null,
      teacherCourseSlugs: [],
      teacherWeekdays: [],
      teacherShiftStart: "",
      teacherShiftEnd: "",
      teacherWeeklyHours: null,
      teacherBonusTargetHours: null,
      banned: false,
      locked: false,
      online: false,
      authOnline: false,
      lastActiveAt: null,
      staffLastCheckInAt: null,
      createdAt: Date.now(),
      lastSignInAt: null,
    }),
    [currentRole, currentUserId, profileForm.firstName, profileForm.lastName, resolvedCurrentCategory]
  )
  const resolvedSelfProfile = React.useMemo<SelfProfileSnapshot>(() => {
    if (selfProfileSnapshot) return selfProfileSnapshot
    return {
      firstName: profileForm.firstName || "Staff",
      lastName: profileForm.lastName || "Member",
      imageUrl: "",
      location: profileForm.location || "",
      role: currentRole,
      category: resolvedCurrentCategory,
      paymentPreference: null,
      assignedPaymentPreference: null,
      paymentInfo: null,
      metrics: {
        performanceRating: null,
        performanceReviewsCount: null,
        performanceReviewCycleDays: null,
        payrollHoursWorked: null,
        payrollHourlyRate: null,
        payrollStatus: null,
        payrollPaydayWeekday: null,
      },
      presence: {
        online: false,
        authOnline: false,
        lastSignInAt: null,
        staffLastCheckInAt: null,
        status: null,
      },
      teaching: {
        teacherCourseSlugs: [],
        teacherWeekdays: [],
        teacherShiftStart: "",
        teacherShiftEnd: "",
      },
    }
  }, [currentRole, profileForm.firstName, profileForm.lastName, profileForm.location, resolvedCurrentCategory, selfProfileSnapshot])
  const selfPerformanceScore = React.useMemo(
    () => computeSelfPerformanceScore(resolvedSelfProfile.metrics),
    [resolvedSelfProfile.metrics]
  )
  const selfRecommendations = React.useMemo(
    () => buildSelfRecommendations(resolvedSelfProfile.metrics),
    [resolvedSelfProfile.metrics]
  )
  const profilePaymentSummaryCards = React.useMemo(
    () => resolveStaffProfilePaymentSummaryCards(resolvedSelfProfile.paymentInfo),
    [resolvedSelfProfile.paymentInfo]
  )
  const selectedProfileRequestType = React.useMemo(
    () => PROFILE_REQUEST_TYPE_OPTIONS.find((item) => item.value === profileRequestForm.type) || PROFILE_REQUEST_TYPE_OPTIONS[0],
    [profileRequestForm.type]
  )
  const roomById = React.useMemo(() => buildRoomLookup(schoolRooms), [schoolRooms])
  const activeRoomOptions = React.useMemo(() => schoolRooms.filter((room) => room.active), [schoolRooms])
  const courseRoomOptions = React.useMemo(
    () => buildCourseRoomOptions(schoolRooms, courseForm.defaultRoomId),
    [courseForm.defaultRoomId, schoolRooms]
  )
  const visibleRooms = React.useMemo(
    () => filterVisibleRooms(schoolRooms, roomSearchQuery, roomStatusFilter),
    [roomSearchQuery, roomStatusFilter, schoolRooms]
  )
  const currentUpcomingReservations = React.useMemo(() => {
    const now = Date.now()
    return roomReservations
      .filter((item) => {
        const endsAtTime = new Date(item.endsAt).getTime()
        return Number.isFinite(endsAtTime) && endsAtTime >= now
      })
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
  }, [roomReservations])
  const reservationAssignableStaff = React.useMemo(
    () =>
      rows
        .map((item) => ({ id: item.id, label: `${item.firstName} ${item.lastName}`.trim() || item.email }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [rows]
  )
  const reservationStaffLabelById = React.useMemo(
    () =>
      reservationAssignableStaff.reduce<Record<string, string>>((acc, item) => {
        acc[item.id] = item.label
        return acc
      }, {}),
    [reservationAssignableStaff]
  )
  const reservationRangePreview = React.useMemo(() => {
    const effectiveEndDate = roomReservationForm.endDate || roomReservationForm.startDate
    const startsAt = buildReservationDateTime(roomReservationForm.startDate, roomReservationForm.startTime)
    const endsAt = buildReservationDateTime(effectiveEndDate, roomReservationForm.endTime)
    if (!startsAt || !endsAt) return ""
    if (endsAt.getTime() <= startsAt.getTime()) return ""
    return `${startsAt.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })} → ${endsAt.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })}`
  }, [roomReservationForm.endDate, roomReservationForm.endTime, roomReservationForm.startDate, roomReservationForm.startTime])
  const ensureMinimumLoadingTime = React.useCallback(async (startedAt: number) => {
    const elapsed = Date.now() - startedAt
    if (elapsed < MIN_LOADING_DELAY_MS) {
      await wait(MIN_LOADING_DELAY_MS - elapsed)
    }
  }, [])

  const handleStaffAuthFailure = React.useCallback((status: number) => {
    if (typeof window === "undefined") return false
    const navParam = typeof window !== "undefined" ? new URL(window.location.href).searchParams.get("nav") : null
    const navSuffix = navParam ? `?nav=${encodeURIComponent(navParam)}` : ""
    if (status === 401) {
      setError("Staff session expired. Please validate your PIN again.")
      window.location.href = `/staff/checkin${navSuffix}`
      return true
    }
    if (status === 403) {
      setError("Insufficient staff permissions. Resolving access...")
      window.location.href = `/staff/resolve${navSuffix}`
      return true
    }
    return false
  }, [])

  const fetchRows = React.useCallback(async (
    search?: string,
    category?: StaffCategory | "all",
    options?: { showLoader?: boolean; enforceMinDelay?: boolean }
  ) => {
    // Prevent overlapping requests
    if (fetchInFlightRef.current) return
    // Respect backoff period after 429/503
    if (Date.now() < backoffUntilRef.current) return

    fetchInFlightRef.current = true
    const showLoader = options?.showLoader ?? true
    const enforceMinDelay = options?.enforceMinDelay ?? showLoader
    const startedAt = Date.now()
    if (showLoader) setLoading(true)
    setError(null)
    try {
      const url = new URL("/api/staff/users", window.location.origin)
      if (search?.trim()) url.searchParams.set("q", search.trim())
      if (category && category !== "all") url.searchParams.set("category", category)
      const res = await fetch(url.toString(), {
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        // Handle 429/503 with backoff and Retry-After
        if (res.status === 429 || res.status === 503) {
          const retryAfterSec = Number(res.headers.get("Retry-After")) || 5
          const backoffMs = Math.min(retryAfterSec * 1000, STAFF_PRESENCE_BACKOFF_MAX_MS)
          // Add jitter to prevent thundering herd
          const jitter = Math.floor(Math.random() * 1000)
          backoffUntilRef.current = Date.now() + backoffMs + jitter
          consecutiveFailuresRef.current += 1
        }
        setError(typeof data?.error === "string" ? data.error : "Failed to load staff users")
        if (showLoader) setRows([])
        return
      }
      // Success: reset backoff state
      consecutiveFailuresRef.current = 0
      backoffUntilRef.current = 0
      setRows(Array.isArray(data?.items) ? data.items : [])
    } catch {
      consecutiveFailuresRef.current += 1
      // Backoff on network errors too, with exponential growth
      const backoffMs = Math.min(
        STAFF_USERS_NORMAL_REFRESH_MS * Math.pow(2, consecutiveFailuresRef.current),
        STAFF_PRESENCE_BACKOFF_MAX_MS
      )
      backoffUntilRef.current = Date.now() + backoffMs
      setError("Network error while loading staff users")
      if (showLoader) setRows([])
    } finally {
      fetchInFlightRef.current = false
      if (enforceMinDelay) await ensureMinimumLoadingTime(startedAt)
      if (showLoader) setLoading(false)
    }
  }, [ensureMinimumLoadingTime, handleStaffAuthFailure])

  const fetchClerkSyncHealth = React.useCallback(async () => {
    if (!canManageClerkSync) return
    setClerkSyncLoading(true)
    setClerkSyncError(null)
    try {
      const res = await fetch("/api/staff/users/sync-clerk/health", {
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        setClerkSyncHealth(null)
        setClerkSyncError(typeof data?.error === "string" ? data.error : "Unable to check user sync status.")
        return
      }
      setClerkSyncHealth({
        clerkUsers: typeof data?.clerkUsers === "number" ? data.clerkUsers : 0,
        dbUsersWithClerkId: typeof data?.dbUsersWithClerkId === "number" ? data.dbUsersWithClerkId : 0,
        missingCount: typeof data?.missingCount === "number" ? data.missingCount : 0,
        missingUsers: Array.isArray(data?.missingUsers) ? data.missingUsers : [],
        mismatchedCount: typeof data?.mismatchedCount === "number" ? data.mismatchedCount : 0,
        mismatchedUsers: Array.isArray(data?.mismatchedUsers) ? data.mismatchedUsers : [],
      })
    } catch {
      setClerkSyncHealth(null)
      setClerkSyncError("Network error while checking user sync status.")
    } finally {
      setClerkSyncLoading(false)
    }
  }, [canManageClerkSync, handleStaffAuthFailure])

  const repairClerkSync = React.useCallback(async () => {
    if (!canManageClerkSync) return
    setClerkSyncRepairing(true)
    setClerkSyncError(null)
    setClerkSyncMessage(null)
    try {
      const res = await fetch("/api/staff/users/sync-clerk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        setClerkSyncError(typeof data?.error === "string" ? data.error : "Unable to sync users.")
        return
      }
      const missingAfterSync = typeof data?.missingAfterSync === "number" ? data.missingAfterSync : 0
      const synced = typeof data?.synced === "number" ? data.synced : 0
      setClerkSyncMessage(
        missingAfterSync === 0
          ? `${synced} users are now up to date.`
          : `Repair finished, but ${missingAfterSync} users still need attention.`
      )
      await fetchClerkSyncHealth()
      await fetchRows(query, categoryFilter, { showLoader: false, enforceMinDelay: false })
    } catch {
      setClerkSyncError("Network error while syncing users.")
    } finally {
      setClerkSyncRepairing(false)
    }
  }, [canManageClerkSync, categoryFilter, fetchClerkSyncHealth, fetchRows, handleStaffAuthFailure, query])

  const syncClerkUser = React.useCallback(async (userId: string) => {
    if (!canManageClerkSync || !userId) return
    setClerkSyncUserBusyId(userId)
    setClerkSyncError(null)
    setClerkSyncMessage(null)
    try {
      const res = await fetch(`/api/staff/users/sync-clerk/${encodeURIComponent(userId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        setClerkSyncError(typeof data?.error === "string" ? data.error : "Unable to sync user.")
        return
      }
      setClerkSyncMessage("Student synced from Clerk (phone preserved).")
      await fetchClerkSyncHealth()
      await fetchRows(query, categoryFilter, { showLoader: false, enforceMinDelay: false })
    } catch {
      setClerkSyncError("Network error while syncing user.")
    } finally {
      setClerkSyncUserBusyId(null)
    }
  }, [canManageClerkSync, categoryFilter, fetchClerkSyncHealth, fetchRows, handleStaffAuthFailure, query])

  const clerkMismatchByUserId = React.useMemo(() => {
    const map = new Map<string, ClerkSyncMismatch>()
    for (const m of clerkSyncHealth?.mismatchedUsers ?? []) {
      map.set(m.userId, m)
    }
    return map
  }, [clerkSyncHealth])

  React.useEffect(() => {
    if (!isStudentsView || !canManageClerkSync) return
    void fetchClerkSyncHealth()
  }, [canManageClerkSync, fetchClerkSyncHealth, isStudentsView])

  const fetchPayrollModelOptions = React.useCallback(async () => {
    setPayrollModelLoading(true)
    setPayrollModelError(null)
    try {
      const res = await fetch("/api/staff/payroll/payment-models", {
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        setPayrollModelOptions([])
        setPayrollModelError(typeof data?.error === "string" ? data.error : "Failed to load payroll models")
        return
      }

      setPayrollModelOptions(
        Array.isArray(data?.items)
          ? data.items
              .map((item: unknown) => {
                const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {}
                return {
                  id: typeof record.id === "string" ? record.id : "",
                  name: typeof record.name === "string" ? record.name.trim() : "",
                  active: record.active !== false,
                  isDefault: record.isDefault === true,
                }
              })
              .filter((item: { id: string; name: string }) => item.id && item.name)
          : []
      )
    } catch {
      setPayrollModelOptions([])
      setPayrollModelError("Network error while loading payroll models")
    } finally {
      setPayrollModelLoading(false)
    }
  }, [handleStaffAuthFailure])

  const updateStaffPayrollModel = React.useCallback(async (userId: string, paymentModelId: string | null) => {
    setPayrollModelActionByUserId((prev) => ({
      ...prev,
      [userId]: { status: "saving", message: "Saving payroll model..." },
    }))

    try {
      const res = await fetch(`/api/staff/users/${userId}/payroll-model`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentModelId }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        setPayrollModelActionByUserId((prev) => ({
          ...prev,
          [userId]: {
            status: "error",
            message: typeof data?.error === "string" ? data.error : "Unable to update payroll model.",
          },
        }))
        return
      }

      setRows((prev) =>
        prev.map((row) =>
          row.id === userId
            ? {
                ...row,
                paymentModelId: typeof data?.paymentModelId === "string" ? data.paymentModelId : null,
              }
            : row
        )
      )
      setPayrollModelActionByUserId((prev) => ({
        ...prev,
        [userId]: {
          status: "success",
          message: paymentModelId ? "Payroll model updated." : "Using school default payroll model.",
        },
      }))
    } catch {
      setPayrollModelActionByUserId((prev) => ({
        ...prev,
        [userId]: {
          status: "error",
          message: "Network error while updating payroll model.",
        },
      }))
    }
  }, [handleStaffAuthFailure])

  const fetchSchedule = React.useCallback(async (month: Date) => {
    const startedAt = Date.now()
    setScheduleLoading(true)
    try {
      const url = new URL("/api/staff/schedule", window.location.origin)
      url.searchParams.set("month", monthKey(month))
      const res = await fetch(url.toString(), { headers: { "Content-Type": "application/json" } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        return
      }
      setScheduleEventsByDay((data?.eventsByDay as Record<string, ScheduleEvent[]>) || {})
    } catch {
      setScheduleEventsByDay({})
    } finally {
      await ensureMinimumLoadingTime(startedAt)
      setScheduleLoading(false)
    }
  }, [ensureMinimumLoadingTime, handleStaffAuthFailure])

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
      setHistoryClassOptions(
        isHistoryMode && Array.isArray(data?.classOptions)
          ? data.classOptions
              .map((item: unknown) => {
                const option = item as Partial<HistoryClassOption>
                return typeof option?.slug === "string" && typeof option?.title === "string"
                  ? { slug: option.slug, title: option.title }
                  : null
              })
              .filter((item: HistoryClassOption | null): item is HistoryClassOption => Boolean(item))
          : []
      )
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
  }, [ensureMinimumLoadingTime, handleStaffAuthFailure, historyFrom, historyTo, isHistoryMode])

  // Debounced server-side search for history mode
  React.useEffect(() => {
    if (historySearchDebounceRef.current) {
      clearTimeout(historySearchDebounceRef.current)
      historySearchDebounceRef.current = null
    }

    const trimmedQuery = studentSearchQuery.trim()

    // In history mode, trigger server-side search with debounce
    if (isHistoryMode) {
      if (trimmedQuery.length < 2) {
        // If query is too short, refetch without search param
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
      setPaymentsMonthlyCheckedInStudents(monthlyStudentCards.filter((item) => Boolean(item.latestAttendedPayment)).length)
    } catch {
      setPaymentsMonthlySummaryApi(createEmptyPaymentsSummary())
      setPaymentsMonthlyStudentCount(0)
      setPaymentsMonthlyCheckedInStudents(0)
    }
  }, [handleStaffAuthFailure])

  const fetchTerminalPinAlerts = React.useCallback(async () => {
    try {
      const res = await fetch("/api/staff/terminals", { headers: { "Content-Type": "application/json" } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        setTerminalPinAlerts([])
        return
      }

      const nextAlerts = Array.isArray(data?.items)
        ? data.items
            .flatMap((item: {
              id: string
              name: string
              location: string | null
              pinAlert?: {
                severity: "warning" | "cooldown" | "emergency"
                label: string
                message: string
                blockedUntil: string | null
                missCount: number
              } | null
            }) =>
              item.pinAlert
                ? [{
                    terminalId: item.id,
                    terminalName: item.name,
                    terminalLocation: item.location,
                    severity: item.pinAlert.severity,
                    label: item.pinAlert.label,
                    message: item.pinAlert.message,
                    blockedUntil: item.pinAlert.blockedUntil,
                    missCount: item.pinAlert.missCount,
                  }]
                : []
            )
        : []

      setTerminalPinAlerts(nextAlerts)
    } catch {
      setTerminalPinAlerts([])
    }
  }, [handleStaffAuthFailure])

  const refreshPaymentsBoard = React.useCallback(async () => {
    await Promise.all([fetchPayments(), fetchPaymentsMonthlySummary(), fetchTerminalPinAlerts()])
  }, [fetchPayments, fetchPaymentsMonthlySummary, fetchTerminalPinAlerts])

  React.useEffect(() => {
    if (!historyClassKey) return
    if (historyClassOptions.some((option) => option.slug === historyClassKey)) return
    setHistoryClassKey("")
  }, [historyClassKey, historyClassOptions])

  const closeStudentPinModal = React.useCallback(() => {
    setStudentPinModal(null)
    setStudentPinReason("")
    setStudentPinDraft("")
    setStudentPinError(null)
    setStudentPinIssued(null)
    setStudentPinRevealIssued(false)
    setStudentPinSubmitting(false)
  }, [])

  const openStudentPinModal = React.useCallback((payment: PaymentRow) => {
    const identity = splitCustomerName(payment.customerName, payment.customerEmail)
    setStudentPinModal({
      userId: payment.userId,
      name: identity.fullName,
      email: payment.customerEmail,
      needsEnrollment: payment.studentPin.needsEnrollment,
      provisionalActive: payment.studentPin.provisionalActive,
      provisionalExpiresAt: payment.studentPin.provisionalExpiresAt,
    })
    setStudentPinReason("")
    setStudentPinDraft("")
    setStudentPinError(null)
    setStudentPinIssued(null)
    setStudentPinRevealIssued(false)
  }, [])

  const openStudentPinModalForProfile = React.useCallback((student: {
    userId: string
    displayName: string
    email: string
    provisionalPinExpiresAt?: string
  }) => {
    setStudentPinModal({
      userId: student.userId,
      name: student.displayName,
      email: student.email,
      needsEnrollment: false,
      provisionalActive: Boolean(student.provisionalPinExpiresAt),
      provisionalExpiresAt: student.provisionalPinExpiresAt ?? null,
    })
    setStudentPinReason("")
    setStudentPinDraft("")
    setStudentPinError(null)
    setStudentPinIssued(null)
    setStudentPinRevealIssued(false)
  }, [])

  const openOverrideModal = React.useCallback((studentId: string, studentName: string) => {
    setOverrideModalStudent({ id: studentId, name: studentName })
  }, [])

  const closeOverrideModal = React.useCallback(() => {
    setOverrideModalStudent(null)
  }, [])

  // Check if a user has audit entries in the current month (for showing the change-history button)
  const checkUserHasAuditEntries = React.useCallback(async (userId: string) => {
    if (usersWithAuditEntries.has(userId)) return
    try {
      const res = await fetch(`/api/staff/students/${encodeURIComponent(userId)}/audit-log?pageSize=50`)
      if (res.ok) {
        const json = await res.json()
        const payload = json.data ?? json
        const entries = Array.isArray(payload?.entries) ? payload.entries : []
        const now = new Date()
        const hasCurrentMonthEntries = entries.some((entry: { createdAt?: string }) => {
          if (!entry.createdAt) return false
          const createdAt = new Date(entry.createdAt)
          return createdAt.getFullYear() === now.getFullYear() && createdAt.getMonth() === now.getMonth()
        })

        if (hasCurrentMonthEntries) {
          setUsersWithAuditEntries((prev) => new Set(prev).add(userId))
        }
      }
    } catch {
      // Silently fail — user just won't see the button
    }
  }, [usersWithAuditEntries])

  const submitStudentPinIssue = React.useCallback(async () => {
    if (!studentPinModal?.userId) return

    const reason = studentPinReason.trim()
    const provisionalPin = studentPinDraft.trim()
    if (reason.length < 8) {
      setStudentPinError("Add a short reason so the audit log explains the recovery.")
      return
    }
    if (provisionalPin && !/^\d{4}$/.test(provisionalPin)) {
      setStudentPinError("Custom provisional PIN must be exactly 4 digits.")
      return
    }

    setStudentPinSubmitting(true)
    setStudentPinError(null)
    try {
      const res = await fetch(`/api/staff/users/${encodeURIComponent(studentPinModal.userId)}/pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "issue_provisional",
          reason,
          provisionalPin: provisionalPin || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        setStudentPinError(typeof data?.error === "string" ? data.error : "Unable to issue provisional PIN.")
        return
      }

      setStudentPinIssued({
        value: typeof data?.provisionalPin === "string" ? data.provisionalPin : "",
        masked: typeof data?.provisionalPinMasked === "string" ? data.provisionalPinMasked : "",
        expiresAt: typeof data?.expiresAt === "string" ? data.expiresAt : null,
      })
      setStudentPinRevealIssued(false)
      await refreshPaymentsBoard()
    } catch {
      setStudentPinError("Network error while issuing provisional PIN.")
    } finally {
      setStudentPinSubmitting(false)
    }
  }, [handleStaffAuthFailure, refreshPaymentsBoard, studentPinDraft, studentPinModal, studentPinReason])

  const fetchStaffRequests = React.useCallback(
    async (
      status: StaffRequestStatus | "all" = "PENDING",
      options?: {
        scope?: "all" | "mine"
      }
    ) => {
    const startedAt = Date.now()
    setRequestsLoading(true)
    try {
      const url = new URL("/api/staff/requests", window.location.origin)
      const scope = options?.scope || "all"
      if (status !== "all") {
        url.searchParams.set("status", status)
      }
      if (scope === "mine") {
        url.searchParams.set("scope", "mine")
      }
      const res = await fetch(url.toString(), { headers: { "Content-Type": "application/json" } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        setError(typeof data?.error === "string" ? data.error : "Failed to load staff requests")
        setStaffRequests([])
        return
      }
      setStaffRequests(Array.isArray(data?.items) ? data.items : [])
      setRequestsSummary(
        data?.summary || {
          total: 0,
          pending: 0,
          inReview: 0,
          approved: 0,
          rejected: 0,
        }
      )
    } catch {
      setError("Network error while loading staff requests")
      setStaffRequests([])
    } finally {
      await ensureMinimumLoadingTime(startedAt)
      setRequestsLoading(false)
    }
  }, [ensureMinimumLoadingTime, handleStaffAuthFailure])

  const fetchPaymentChangeRequests = React.useCallback(async () => {
    const startedAt = Date.now()
    setPaymentChangeRequestsLoading(true)
    try {
      const res = await fetch("/api/staff/payroll/change-requests", {
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        setError(typeof data?.error === "string" ? data.error : "Failed to load payment change requests")
        setPaymentChangeRequests([])
        return
      }

      setPaymentChangeRequests(Array.isArray(data?.items) ? data.items : [])
    } catch {
      setError("Network error while loading payment change requests")
      setPaymentChangeRequests([])
    } finally {
      await ensureMinimumLoadingTime(startedAt)
      setPaymentChangeRequestsLoading(false)
    }
  }, [ensureMinimumLoadingTime, handleStaffAuthFailure])

  const fetchSelfProfile = React.useCallback(async () => {
    const startedAt = Date.now()
    setSelfProfileLoading(true)
    try {
      const res = await fetch(`/api/staff/users/${currentUserId}/profile`, {
        headers: { "Content-Type": "application/json" },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        setProfileRequestError(typeof data?.error === "string" ? data.error : "Failed to load your profile.")
        return
      }
      const user = (data?.user || {}) as Record<string, unknown>
      const profile = (user.profile || {}) as Record<string, unknown>
      const metrics = (user.metrics || {}) as Record<string, unknown>
      const presence = (user.presence || {}) as Record<string, unknown>
      const teaching = (user.teaching || {}) as Record<string, unknown>
      const firstName = typeof user.firstName === "string" ? user.firstName : ""
      const lastName = typeof user.lastName === "string" ? user.lastName : ""
      const imageUrl = typeof user.imageUrl === "string" ? user.imageUrl : ""
      const location = typeof profile.location === "string" ? profile.location : ""
      const lastCheckInIso = typeof presence.staffLastCheckInAt === "string" ? presence.staffLastCheckInAt : ""
      const parsedLastCheckIn = lastCheckInIso ? Date.parse(lastCheckInIso) : Number.NaN
      const statusValue = presence.status === "online" || presence.status === "offline" ? presence.status : null
      const paymentPreference = parsePaymentPreferenceValue(data?.paymentPreference)
      const assignedPaymentPreference = parsePaymentPreferenceValue(data?.assignedPaymentPreference)
      const paymentInfo = normalizeStaffProfilePaymentInfo(data?.paymentInfo)
      const nextRole: StaffRole =
        user?.role === "owner" || user?.role === "admin" || user?.role === "staff" ? user.role : currentRole
      const nextCategory: StaffCategory =
        user?.category === "front_desk" ||
        user?.category === "manager" ||
        user?.category === "teacher" ||
        user?.category === "guest" ||
        user?.category === "partner"
          ? user.category
          : resolvedCurrentCategory

      setSelfProfileSnapshot({
        firstName,
        lastName,
        imageUrl,
        location,
        role: nextRole,
        category: nextCategory,
        paymentPreference,
        assignedPaymentPreference,
        paymentInfo,
        metrics: {
          performanceRating:
            typeof metrics.performanceRating === "number" && Number.isFinite(metrics.performanceRating)
              ? metrics.performanceRating
              : null,
          performanceReviewsCount:
            typeof metrics.performanceReviewsCount === "number" && Number.isFinite(metrics.performanceReviewsCount)
              ? metrics.performanceReviewsCount
              : null,
          performanceReviewCycleDays:
            typeof metrics.performanceReviewCycleDays === "number" && Number.isFinite(metrics.performanceReviewCycleDays)
              ? metrics.performanceReviewCycleDays
              : null,
          payrollHoursWorked:
            typeof metrics.payrollHoursWorked === "number" && Number.isFinite(metrics.payrollHoursWorked)
              ? metrics.payrollHoursWorked
              : null,
          payrollHourlyRate:
            typeof metrics.payrollHourlyRate === "number" && Number.isFinite(metrics.payrollHourlyRate)
              ? metrics.payrollHourlyRate
              : null,
          payrollStatus: metrics.payrollStatus === "paid" || metrics.payrollStatus === "pending" ? metrics.payrollStatus : null,
          payrollPaydayWeekday:
            typeof metrics.payrollPaydayWeekday === "number" &&
            Number.isInteger(metrics.payrollPaydayWeekday) &&
            metrics.payrollPaydayWeekday >= 0 &&
            metrics.payrollPaydayWeekday <= 6
              ? metrics.payrollPaydayWeekday
              : null,
        },
        presence: {
          online: Boolean(presence.online),
          authOnline: Boolean(presence.authOnline),
          lastSignInAt:
            typeof presence.lastSignInAt === "number" && Number.isFinite(presence.lastSignInAt)
              ? presence.lastSignInAt
              : null,
          staffLastCheckInAt: Number.isFinite(parsedLastCheckIn) ? parsedLastCheckIn : null,
          status: statusValue,
        },
        teaching: {
          teacherCourseSlugs: sanitizeCourseSlugs(teaching.teacherCourseSlugs),
          teacherWeekdays: sanitizeWeekdays(teaching.teacherWeekdays),
          teacherShiftStart: sanitizeTimeValue(teaching.teacherShiftStart),
          teacherShiftEnd: sanitizeTimeValue(teaching.teacherShiftEnd),
        },
      })
      setProfilePaymentForm(createStaffPaymentForm(paymentPreference, paymentInfo))
      setProfilePaymentError(null)

      setProfileForm((prev) => ({
        ...prev,
        firstName: firstName || prev.firstName,
        lastName: lastName || prev.lastName,
        location: location || prev.location,
        role: nextRole,
        category: normalizeCategoryForRole(nextRole, nextCategory),
      }))
    } catch {
      setProfileRequestError("Network error while loading your profile.")
    } finally {
      await ensureMinimumLoadingTime(startedAt)
      setSelfProfileLoading(false)
    }
  }, [currentRole, currentUserId, ensureMinimumLoadingTime, handleStaffAuthFailure, resolvedCurrentCategory])

  const saveProfilePaymentInfo = React.useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setProfilePaymentSaving(true)
    setProfilePaymentError(null)
    setProfilePaymentSuccess(null)

    const isRequestFlow = 
      profilePaymentForm.paymentPreference !== "" && 
      profilePaymentForm.paymentPreference !== resolvedSelfProfile.assignedPaymentPreference

    try {
      const res = await fetch(isRequestFlow ? "/api/staff/payroll/change-requests" : `/api/staff/users/${currentUserId}/profile`, {
        method: isRequestFlow ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isRequestFlow ? {
          requestedMethod: profilePaymentForm.paymentPreference,
          requestedInfo: toPaymentInfoPayload(profilePaymentForm),
          reason: "Staff requested change via profile portal"
        } : {
          paymentPreference: profilePaymentForm.paymentPreference || null,
          paymentInfo: toPaymentInfoPayload(profilePaymentForm),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        setProfilePaymentError(typeof data?.error === "string" ? data.error : `Unable to ${isRequestFlow ? "submit change request" : "save payment information"}.`)
        return
      }

      if (isRequestFlow) {
        setProfilePaymentSuccess("Payment change request submitted for review.")
      } else {
        const nextPaymentPreference = parsePaymentPreferenceValue(data?.paymentPreference)
        const nextPaymentInfo = normalizeStaffProfilePaymentInfo(data?.paymentInfo)
        setProfilePaymentForm(createStaffPaymentForm(nextPaymentPreference, nextPaymentInfo))
        setSelfProfileSnapshot((prev) =>
          prev
            ? {
                ...prev,
                paymentPreference: nextPaymentPreference,
                paymentInfo: nextPaymentInfo,
              }
            : prev
        )
        setProfilePaymentSuccess("Payment information updated.")
      }
    } catch {
      setProfilePaymentError("Network error while saving payment information.")
    } finally {
      setProfilePaymentSaving(false)
    }
  }, [currentUserId, handleStaffAuthFailure, profilePaymentForm, resolvedSelfProfile.assignedPaymentPreference])

  const submitProfileRequest = React.useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setProfileRequestSubmitting(true)
    setProfileRequestError(null)
    setProfileRequestSuccess(null)

    const message = profileRequestForm.message.trim()
    if (message.length < 6) {
      setProfileRequestError("Add more detail in the request message.")
      setProfileRequestSubmitting(false)
      return
    }

    const meta: Record<string, unknown> = {}
    if (profileRequestForm.startDate) meta.startDate = profileRequestForm.startDate
    if (profileRequestForm.endDate) meta.endDate = profileRequestForm.endDate
    if (profileRequestForm.preferredShift.trim()) meta.preferredShift = profileRequestForm.preferredShift.trim()
    if (profileRequestForm.consultTopic.trim()) meta.consultTopic = profileRequestForm.consultTopic.trim()

    try {
      const res = await fetch("/api/staff/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: profileRequestForm.type,
          message,
          meta,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        setProfileRequestError(typeof data?.error === "string" ? data.error : "Unable to submit request.")
        return
      }
      setProfileRequestSuccess("Request submitted. Staff management will review it shortly.")
      setProfileRequestForm((prev) => ({
        ...prev,
        message: "",
        startDate: "",
        endDate: "",
        preferredShift: "",
        consultTopic: "",
      }))
      await fetchStaffRequests(profileRequestStatusFilter, { scope: "mine" })
    } catch {
      setProfileRequestError("Network error while submitting request.")
    } finally {
      setProfileRequestSubmitting(false)
    }
  }, [fetchStaffRequests, handleStaffAuthFailure, profileRequestForm, profileRequestStatusFilter])

  const fetchSchoolData = React.useCallback(async (options?: { showLoader?: boolean }) => {
    const showLoader = options?.showLoader ?? true
    const startedAt = Date.now()
    if (showLoader) setSchoolLoading(true)
    setSchoolError(null)
    try {
      const [coursesRes, roomsRes, packagesRes, rulesRes, reservationsRes] = await Promise.all([
        fetch("/api/staff/school/courses", { headers: { "Content-Type": "application/json" } }),
        fetch("/api/staff/rooms?pageSize=100", { headers: { "Content-Type": "application/json" } }),
        fetch("/api/staff/school/packages", { headers: { "Content-Type": "application/json" } }),
        fetch("/api/staff/school/points-rules", { headers: { "Content-Type": "application/json" } }),
        fetch("/api/staff/room-reservations", { headers: { "Content-Type": "application/json" } }),
      ])
      const [coursesData, roomsData, packagesData, rulesData, reservationsData] = await Promise.all([
        coursesRes.json().catch(() => ({})),
        roomsRes.json().catch(() => ({})),
        packagesRes.json().catch(() => ({})),
        rulesRes.json().catch(() => ({})),
        reservationsRes.json().catch(() => ({})),
      ])
      if (!coursesRes.ok || !roomsRes.ok || !packagesRes.ok || !rulesRes.ok || !reservationsRes.ok) {
        const authStatuses = [coursesRes.status, roomsRes.status, packagesRes.status, rulesRes.status, reservationsRes.status]
        if (authStatuses.some((status) => status === 401) && authStatuses.some((status) => handleStaffAuthFailure(status))) {
          return
        }
        const nextError = resolveRoomCatalogErrorMessage([coursesData, roomsData, packagesData, rulesData, reservationsData])
        setSchoolError(nextError)
        return
      }
      setSchoolCourses(Array.isArray(coursesData?.items) ? coursesData.items : [])
      setSchoolRooms(Array.isArray(roomsData?.items) ? roomsData.items : [])
      setSchoolPackages(Array.isArray(packagesData?.items) ? packagesData.items : [])
      setSchoolPointsRules(Array.isArray(rulesData?.items) ? rulesData.items : [])
      setRoomReservations(Array.isArray(reservationsData?.items) ? reservationsData.items : [])
      // Non-critical: fetch all course links per course for catalog display
      const courses: SchoolCourseRow[] = Array.isArray(coursesData?.items) ? coursesData.items : []
      if (courses.length > 0) {
        Promise.all(
          courses.map((c) =>
            fetch(`/api/staff/school/course-links?courseSlug=${encodeURIComponent(c.slug)}`)
              .then((r) => (r.ok ? r.json() : { asA: [], asB: [] }))
              .then((d) => ({ slug: c.slug, asA: d.asA || [], asB: d.asB || [] }))
              .catch(() => ({ slug: c.slug, asA: [], asB: [] }))
          )
        ).then((results) => {
          const map: Record<string, { asA: CourseLinkRow[]; asB: CourseLinkRow[] }> = {}
          for (const r of results) map[r.slug] = { asA: r.asA, asB: r.asB }
          setAllCourseLinksMap(map)
        })
      }
    } catch {
      setSchoolError("Network error while loading school catalog.")
    } finally {
      if (showLoader) {
        await ensureMinimumLoadingTime(startedAt)
        setSchoolLoading(false)
      }
    }
  }, [ensureMinimumLoadingTime, handleStaffAuthFailure])

  const resetRoomForm = React.useCallback(() => {
    setRoomForm(createInitialRoomForm())
    setRoomFormError(null)
    setRoomFormSuccess(null)
  }, [])

  const loadRoomIntoForm = React.useCallback((room: RoomRow) => {
    setRoomForm(createRoomFormFromRoom(room))
    setRoomFormError(null)
    setRoomFormSuccess(null)
  }, [])

  const saveRoom = React.useCallback(async (event: React.FormEvent) => {
    event.preventDefault()
    setRoomSaving(true)
    setRoomFormError(null)
    setRoomFormSuccess(null)
    try {
      const isEditing = Boolean(roomForm.id)
      const endpoint = isEditing ? `/api/staff/rooms/${roomForm.id}` : "/api/staff/rooms"
      const method = isEditing ? "PUT" : "POST"
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roomForm.name,
          capacity: roomForm.capacity,
          location: roomForm.location,
          active: roomForm.active,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        setRoomFormError(typeof data?.error === "string" ? data.error : "Unable to save room.")
        return
      }
      const nextSuccess = typeof data?.message === "string" ? data.message : isEditing ? "Room updated." : "Room created."
      await fetchSchoolData({ showLoader: false })
      resetRoomForm()
      setRoomFormSuccess(nextSuccess)
    } catch {
      setRoomFormError("Network error while saving room.")
    } finally {
      setRoomSaving(false)
    }
  }, [fetchSchoolData, handleStaffAuthFailure, resetRoomForm, roomForm])

  const disableRoom = React.useCallback(async (roomId: string) => {
    setRoomBusyId(roomId)
    setRoomActionErrors((prev) => {
      if (!prev[roomId]) return prev
      const next = { ...prev }
      delete next[roomId]
      return next
    })
    setRoomFormSuccess(null)
    try {
      const res = await fetch(`/api/staff/rooms/${roomId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        setRoomActionErrors((prev) => ({
          ...prev,
          [roomId]: resolveRoomActionErrorMessage(data, "Unable to disable room."),
        }))
        return
      }
      const nextSuccess = typeof data?.message === "string" ? data.message : "Room disabled."
      await fetchSchoolData({ showLoader: false })
      if (roomForm.id === roomId) {
        resetRoomForm()
      }
      setRoomFormSuccess(nextSuccess)
    } catch {
      setRoomActionErrors((prev) => ({
        ...prev,
        [roomId]: "Network error while disabling room.",
      }))
    } finally {
      setRoomBusyId(null)
    }
  }, [fetchSchoolData, handleStaffAuthFailure, resetRoomForm, roomForm.id])

  const activateRoom = React.useCallback(async (roomId: string) => {
    setRoomBusyId(roomId)
    setRoomActionErrors((prev) => {
      if (!prev[roomId]) return prev
      const next = { ...prev }
      delete next[roomId]
      return next
    })
    setRoomFormSuccess(null)
    try {
      const res = await fetch(`/api/staff/rooms/${roomId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        setRoomActionErrors((prev) => ({
          ...prev,
          [roomId]: resolveRoomActionErrorMessage(data, "Unable to activate room."),
        }))
        return
      }
      await fetchSchoolData({ showLoader: false })
      setRoomFormSuccess(typeof data?.message === "string" ? data.message : "Room activated.")
    } catch {
      setRoomActionErrors((prev) => ({
        ...prev,
        [roomId]: "Network error while activating room.",
      }))
    } finally {
      setRoomBusyId(null)
    }
  }, [fetchSchoolData, handleStaffAuthFailure])

  const openRoomSafeDeleteModal = React.useCallback((room: RoomRow) => {
    setRoomFormSuccess(null)
    setRoomSafeDeleteModal({
      room,
      reason: "",
      error: null,
    })
  }, [])

  const closeRoomSafeDeleteModal = React.useCallback(() => {
    setRoomSafeDeleteModal(null)
  }, [])

  const openRoomReassignModal = React.useCallback((room: RoomRow) => {
    const affectedCourses = schoolCourses
      .filter((course) => course.defaultRoomId === room.id)
      .map((course) => ({
        id: course.id,
        title: course.title,
        slug: course.slug,
        scheduleLabel: buildAssignmentCourseScheduleLabel(course),
      }))

    setRoomFormSuccess(null)
    setRoomReassignModal({
      room,
      targetRoomId: "",
      moveFutureSessions: false,
      availableCourses: affectedCourses,
      selectedCourseIds: affectedCourses.map((course) => course.id),
      error: null,
    })
  }, [schoolCourses])

  const closeRoomReassignModal = React.useCallback(() => {
    setRoomReassignModal(null)
  }, [])

  const confirmRoomSafeDelete = React.useCallback(async () => {
    if (!roomSafeDeleteModal) return

    const room = roomSafeDeleteModal.room
    const reason = roomSafeDeleteModal.reason.trim()
    if (!reason) {
      setRoomSafeDeleteModal((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          error: "Deletion reason is required.",
        }
      })
      return
    }

    setRoomBusyId(room.id)
    setRoomSafeDeleteModal((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        error: null,
      }
    })
    setRoomActionErrors((prev) => {
      if (!prev[room.id]) return prev
      const next = { ...prev }
      delete next[room.id]
      return next
    })
    setRoomFormSuccess(null)

    try {
      const res = await fetch(`/api/staff/rooms/${room.id}/safe-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        const nextError = resolveRoomActionErrorMessage(data, "Unable to safe-delete room.")
        setRoomSafeDeleteModal((prev) => {
          if (!prev || prev.room.id !== room.id) return prev
          return {
            ...prev,
            error: nextError,
          }
        })
        setRoomActionErrors((prev) => ({
          ...prev,
          [room.id]: nextError,
        }))
        return
      }

      await fetchSchoolData({ showLoader: false })
      if (roomForm.id === room.id) {
        resetRoomForm()
      }
      closeRoomSafeDeleteModal()
      setRoomFormSuccess("Room deleted.")
    } catch {
      const nextError = "Network error while deleting room."
      setRoomSafeDeleteModal((prev) => {
        if (!prev || prev.room.id !== room.id) return prev
        return {
          ...prev,
          error: nextError,
        }
      })
      setRoomActionErrors((prev) => ({
        ...prev,
        [room.id]: nextError,
      }))
    } finally {
      setRoomBusyId(null)
    }
  }, [closeRoomSafeDeleteModal, fetchSchoolData, handleStaffAuthFailure, resetRoomForm, roomForm.id, roomSafeDeleteModal])

  const confirmRoomReassign = React.useCallback(async () => {
    if (!roomReassignModal) return

    const room = roomReassignModal.room
    const targetRoomId = roomReassignModal.targetRoomId
    const selectedCourseIds = roomReassignModal.selectedCourseIds
    if (!targetRoomId) {
      setRoomReassignModal((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          error: "Select a target room to continue.",
        }
      })
      return
    }
    if (roomReassignModal.availableCourses.length > 0 && selectedCourseIds.length === 0) {
      setRoomReassignModal((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          error: "Select at least one course to reassign.",
        }
      })
      return
    }

    setRoomBusyId(room.id)
    setRoomReassignModal((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        error: null,
      }
    })
    setRoomActionErrors((prev) => {
      if (!prev[room.id]) return prev
      const next = { ...prev }
      delete next[room.id]
      return next
    })
    setRoomFormSuccess(null)

    try {
      const res = await fetch(`/api/staff/rooms/${room.id}/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetRoomId,
          moveFutureSessions: roomReassignModal.moveFutureSessions,
          courseIds: selectedCourseIds,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        const nextError = resolveRoomActionErrorMessage(data, "Unable to reassign room.")
        setRoomReassignModal((prev) => {
          if (!prev || prev.room.id !== room.id) return prev
          return {
            ...prev,
            error: nextError,
          }
        })
        setRoomActionErrors((prev) => ({
          ...prev,
          [room.id]: nextError,
        }))
        return
      }

      const movedSessions = typeof data?.movedSessions === "number" ? data.movedSessions : 0
      const movedDefaults = typeof data?.reassignedDefaults === "number" ? data.reassignedDefaults : 0
      await fetchSchoolData({ showLoader: false })
      closeRoomReassignModal()
      setRoomFormSuccess(`Room reassigned. Defaults moved: ${movedDefaults}. Future sessions moved: ${movedSessions}.`)
    } catch {
      const nextError = "Network error while reassigning room."
      setRoomReassignModal((prev) => {
        if (!prev || prev.room.id !== room.id) return prev
        return {
          ...prev,
          error: nextError,
        }
      })
      setRoomActionErrors((prev) => ({
        ...prev,
        [room.id]: nextError,
      }))
    } finally {
      setRoomBusyId(null)
    }
  }, [closeRoomReassignModal, fetchSchoolData, handleStaffAuthFailure, roomReassignModal])

  const saveRoomReservation = React.useCallback(async (event: React.FormEvent) => {
    event.preventDefault()
    setRoomReservationSaving(true)
    setRoomReservationFormError(null)
    setRoomReservationFormSuccess(null)
    try {
      const effectiveEndDate = roomReservationForm.endDate || roomReservationForm.startDate
      const startsAtDate = buildReservationDateTime(roomReservationForm.startDate, roomReservationForm.startTime)
      const endsAtDate = buildReservationDateTime(effectiveEndDate, roomReservationForm.endTime)
      if (!startsAtDate || !endsAtDate) {
        setRoomReservationFormError("Select a valid start/end date and time.")
        return
      }
      if (endsAtDate.getTime() <= startsAtDate.getTime()) {
        setRoomReservationFormError("End date/time must be after start date/time. For overnight events, choose the next day as end date.")
        return
      }
      const payload = {
        roomId: roomReservationForm.roomId,
        title: roomReservationForm.title.trim(),
        reason: roomReservationForm.reason.trim(),
        startsAt: startsAtDate.toISOString(),
        endsAt: endsAtDate.toISOString(),
        ...(roomReservationForm.assignedStaffClerkUserId
          ? { assignedStaffClerkUserId: roomReservationForm.assignedStaffClerkUserId }
          : {}),
      }
      const res = await fetch("/api/staff/room-reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        setRoomReservationFormError(resolveRoomActionErrorMessage(data, "Unable to create reservation."))
        return
      }
      await fetchSchoolData({ showLoader: false })
      setRoomReservationForm(createEmptyRoomReservationForm())
      setRoomReservationFormSuccess("Reservation created.")
    } catch {
      setRoomReservationFormError("Network error while creating reservation.")
    } finally {
      setRoomReservationSaving(false)
    }
  }, [fetchSchoolData, handleStaffAuthFailure, roomReservationForm])

  const closeRoomReservationCancelModal = React.useCallback(() => {
    setRoomReservationCancelModal(null)
  }, [])

  const openRoomReservationCancelModal = React.useCallback((reservation: RoomReservationRow) => {
    setRoomReservationFormSuccess(null)
    setRoomReservationCancelModal({ reservation, reason: "", error: null })
  }, [])

  const confirmRoomReservationCancel = React.useCallback(async () => {
    if (!roomReservationCancelModal) return
    const reservation = roomReservationCancelModal.reservation
    setRoomReservationBusyId(reservation.id)
    setRoomReservationFormError(null)
    try {
      const res = await fetch(`/api/staff/room-reservations/${reservation.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: roomReservationCancelModal.reason.trim() || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        const nextError = resolveRoomActionErrorMessage(data, "Unable to cancel reservation.")
        setRoomReservationCancelModal((prev) => (prev ? { ...prev, error: nextError } : prev))
        return
      }
      await fetchSchoolData({ showLoader: false })
      closeRoomReservationCancelModal()
      setRoomReservationFormSuccess("Reservation cancelled.")
    } catch {
      setRoomReservationCancelModal((prev) => (prev ? { ...prev, error: "Network error while cancelling reservation." } : prev))
    } finally {
      setRoomReservationBusyId(null)
    }
  }, [closeRoomReservationCancelModal, fetchSchoolData, handleStaffAuthFailure, roomReservationCancelModal])

  const resetCourseBuilder = React.useCallback(() => {
    setCourseForm({
      slug: "",
      title: "",
      kind: "course",
      category: "",
      description: "",
      previewImageUrl: "",
      previewVideoUrl: "",
      dropInPriceCents: "",
      firstClassPriceCents: "",
      level: "Beginner",
      durationMinutes: "55",
      location: "54 Coles St, Jersey City, NJ",
      defaultRoomId: "",
      publicationMode: "publish_now",
      launchDate: "",
      specialDiscountType: "none",
      specialDiscountCustomLabel: "",
      specialDiscountPrice: "",
      availableTimesCsv: "",
      active: true,
    })
    setCourseWeekdays([])
    setCourseScheduleDate("")
    setCourseScheduleDates([])
    setCourseRecurringWeekdays([])
    setCourseMirrorEnabled(false)
    setCourseMirrorWeekdays([])
    setCourseRepeatAllMonth(true)
    setCourseRecurrenceMode("indefinite")
    setCourseRecurrenceEndsAt("")
    setCourseScheduleTime(normalizeClockTime(quickScheduleTimes[0] || "") || "10:00")
    setCourseScheduleSlots([])
    setEditingQuickTimeIndex(null)
    setQuickTimeDraft("")
    setScheduleTimePickerOpen(false)
    setCourseHydratedFromQuery(false)
    setCourseEditingSlug(null) // Clear editing state
    setCourseLinksAsA([])
    setCourseLinksAsB([])
    resetCourseLinkForm()
    setCourseLocalImagePreview((prev) => {
      if (prev.startsWith("blob:")) URL.revokeObjectURL(prev)
      return ""
    })
    setCourseLocalVideoPreview((prev) => {
      if (prev.startsWith("blob:")) URL.revokeObjectURL(prev)
      return ""
    })
    setCourseLocalImageName("")
    setCourseLocalVideoName("")
  }, [quickScheduleTimes, resetCourseLinkForm])

  const saveCourseCatalog = React.useCallback(async (event: React.FormEvent) => {
    event.preventDefault()
    setSchoolError(null)
    setSchoolSuccess(null)
    // Block save if there's a slug conflict (user must choose an action)
    if (courseSlugConflict.exists) {
      setSchoolError("This slug already exists. Use the suggested slug or choose to edit the existing course.")
      return
    }
    setSchoolBusy("course")
    try {
      const derivedSchedule = deriveCourseScheduleData(courseScheduleSlots)
      const derivedRules = deriveRulesFromScheduleSlots(courseScheduleSlots)
      const derivedSpecialEvents = deriveSpecialEventsFromScheduleSlots(courseScheduleSlots)
      const fallbackTimes = courseForm.availableTimesCsv
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
      const times = derivedSchedule.times.length > 0 ? derivedSchedule.times : fallbackTimes
      const weekdays = derivedSchedule.weekdays.length > 0 ? derivedSchedule.weekdays : courseWeekdays
      if (courseForm.publicationMode === "launch_date" && !ISO_DATE_REGEX.test(courseForm.launchDate.trim())) {
        setSchoolError("Select a valid launch date for Launch date mode.")
        return
      }
      if (courseForm.specialDiscountType === "custom" && !courseForm.specialDiscountCustomLabel.trim()) {
        setSchoolError("Write a custom discount label.")
        return
      }
      const scheduleRulesPayload: CourseScheduleRulesPayload | null = (() => {
        const rules =
          isSpecialEventCourse
            ? []
            : derivedRules.length > 0
            ? derivedRules
            : weekdays.length > 0 && times.length > 0
              ? weekdays.map((weekday) => ({ weekday, times }))
              : []
        const specialEvents = derivedSpecialEvents
        const publicationMode: CoursePublicationMode =
          courseForm.publicationMode === "coming_soon" || courseForm.publicationMode === "launch_date"
            ? courseForm.publicationMode
            : "publish_now"
        const launchDateRaw = courseForm.launchDate.trim()
        const launchDate =
          publicationMode === "launch_date" && ISO_DATE_REGEX.test(launchDateRaw)
            ? launchDateRaw
            : null
        const publication: CoursePublicationSettings = {
          mode: publicationMode,
          launchDate,
        }

        const specialDiscountType: CourseSpecialDiscountType =
          courseForm.specialDiscountType === "valentines_desc" ||
          courseForm.specialDiscountType === "christmas_desc" ||
          courseForm.specialDiscountType === "custom"
            ? courseForm.specialDiscountType
            : "none"
        const specialDiscountLabelRaw = courseForm.specialDiscountCustomLabel.trim()
        const specialDiscountLabel = specialDiscountType === "custom" && specialDiscountLabelRaw ? specialDiscountLabelRaw : null
        const specialDiscountPriceCents = usdInputToCents(courseForm.specialDiscountPrice)
        const specialDiscount: CourseSpecialDiscountSettings = {
          type: specialDiscountType,
          label: specialDiscountLabel,
          priceCents: specialDiscountType === "none" ? null : specialDiscountPriceCents,
        }

        const hasPublicationOverride = publication.mode !== "publish_now" || Boolean(publication.launchDate)
        const hasSpecialDiscount =
          specialDiscount.type !== "none" || specialDiscount.priceCents !== null || Boolean(specialDiscount.label)
        if (rules.length === 0 && specialEvents.length === 0 && !hasPublicationOverride && !hasSpecialDiscount) return null
        const derivedWeeklyTarget = [...new Set(rules.map((rule) => rule.weekday))].length
        return {
          mode: isSpecialEventCourse ? "special_event" : "regular",
          weeklyDaysTarget: Math.max(1, Math.min(7, derivedWeeklyTarget || courseRecurringWeekdays.length || 1)),
          repeatAllMonth: courseRepeatAllMonth,
          recurrenceMode: courseRecurrenceMode,
          recurrenceEndsAt:
            courseRecurrenceMode === "until_date" && courseRecurrenceEndsAt.trim() ? courseRecurrenceEndsAt.trim() : null,
          rules,
          specialEvents,
          publication,
          specialDiscount,
        }
      })()
      const res = await fetch("/api/staff/school/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: courseForm.slug,
          title: courseForm.title,
          kind: courseForm.kind,
          category: courseForm.category,
          description: courseForm.description,
          coverImageUrl: courseForm.previewImageUrl,
          previewVideoUrl: courseForm.previewVideoUrl,
          dropInPriceCents: usdInputToCents(courseForm.dropInPriceCents),
          firstClassPriceCents: usdInputToCents(courseForm.firstClassPriceCents),
          level: courseForm.level,
          durationMinutes: courseForm.durationMinutes,
          location: courseForm.location,
          defaultRoomId: courseForm.defaultRoomId || null,
          availableWeekdays: weekdays,
          availableTimes: times,
          scheduleRules: scheduleRulesPayload,
          active: courseForm.active,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSchoolError(typeof data?.error === "string" ? data.error : "Unable to save course.")
        return
      }
      setSchoolSuccess(typeof data?.message === "string" ? data.message : "Course saved.")
      await fetchSchoolData({ showLoader: false })
      resetCourseBuilder()
    } catch {
      setSchoolError("Network error while saving course.")
    } finally {
      setSchoolBusy(null)
    }
  }, [
    courseForm,
    courseRecurrenceEndsAt,
    courseRecurrenceMode,
    courseRecurringWeekdays,
    courseRepeatAllMonth,
    courseScheduleSlots,
    courseSlugConflict.exists,
    courseWeekdays,
    fetchSchoolData,
    isSpecialEventCourse,
    resetCourseBuilder,
  ])

  const togglePackageCourse = React.useCallback((courseSlug: string) => {
    setPackageForm((prev) => {
      if (prev.courseSlugs.includes(courseSlug)) {
        return { ...prev, courseSlugs: prev.courseSlugs.filter((slug) => slug !== courseSlug) }
      }
      return { ...prev, courseSlugs: [...prev.courseSlugs, courseSlug] }
    })
  }, [])

  const savePackagePlan = React.useCallback(async (event: React.FormEvent) => {
    event.preventDefault()
    setSchoolError(null)
    setSchoolSuccess(null)
    if (packageForm.courseSlugs.length === 0) {
      setSchoolError("Select at least one course for this package.")
      return
    }
    setSchoolBusy("package")
    try {
      const res = await fetch("/api/staff/school/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: packageForm.id || null,
          key: packageForm.key,
          courseSlugs: packageForm.courseSlugs,
          label: packageForm.label,
          description: packageForm.description,
          priceCents: packageForm.priceCents,
          cadence: packageForm.cadence,
          status: packageForm.status,
          launchAt: packageForm.launchAt || null,
          totalCredits: packageForm.totalCredits,
          makeUps: packageForm.makeUps,
          validDays: packageForm.validDays,
          isUnlimited: packageForm.isUnlimited,
          active: packageForm.active,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSchoolError(typeof data?.error === "string" ? data.error : "Unable to save package.")
        return
      }
      setSchoolSuccess(typeof data?.message === "string" ? data.message : "Package saved.")
      await fetchSchoolData({ showLoader: false })
      setEditingPackageId(null)
      setPackageForm(createEmptyPackageForm())
    } catch {
      setSchoolError("Network error while saving package.")
    } finally {
      setSchoolBusy(null)
    }
  }, [fetchSchoolData, packageForm])

  const setPackageLifecycleState = React.useCallback(
    async (item: SchoolPackageRow, nextStatus: PackagePlanStatus) => {
      setSchoolError(null)
      setSchoolSuccess(null)
      setSchoolBusy("package")
      try {
        const res = await fetch("/api/staff/school/packages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: item.key,
            courseSlugs: item.courseSlugs ?? (item.courseSlug ? [item.courseSlug] : []),
            label: item.label,
            description: item.description || "",
            priceCents: item.priceCents,
            cadence: item.cadence || "",
            status: nextStatus,
            launchAt: nextStatus === "SCHEDULED" ? item.launchAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
            totalCredits: item.totalCredits,
            makeUps: item.makeUps,
            validDays: item.validDays,
            isUnlimited: item.isUnlimited,
            active: nextStatus === "ACTIVE",
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setSchoolError(typeof data?.error === "string" ? data.error : "Unable to update package state.")
          return
        }
        setSchoolSuccess(typeof data?.message === "string" ? data.message : `Package moved to ${nextStatus.toLowerCase()}.`)
        await fetchSchoolData({ showLoader: false })
      } catch {
        setSchoolError("Network error while updating package state.")
      } finally {
        setSchoolBusy(null)
      }
    },
    [fetchSchoolData]
  )

  const deletePackagePlan = React.useCallback(
    async (item: SchoolPackageRow) => {
      if (typeof window !== "undefined") {
        const confirmed = window.confirm(`Delete package "${item.label}"? You can restore it later from the Deleted filter.`)
        if (!confirmed) return
      }
      await setPackageLifecycleState(item, "DELETED")
    },
    [setPackageLifecycleState]
  )

  const savePointsRule = React.useCallback(async (event: React.FormEvent) => {
    event.preventDefault()
    setSchoolError(null)
    setSchoolSuccess(null)
    setSchoolBusy("rule")
    try {
      const template = POINTS_RULE_DEFINITIONS.find((item) => item.key === pointsRuleForm.templateKey)
      if (!template) {
        setSchoolError("Invalid points rule template.")
        return
      }
      const res = await fetch("/api/staff/school/points-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: template.key,
          label: template.label,
          eventType: template.eventType,
          points: pointsRuleForm.points,
          description: template.description,
          active: pointsRuleForm.active,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSchoolError(typeof data?.error === "string" ? data.error : "Unable to save points rule.")
        return
      }
      setSchoolSuccess(typeof data?.message === "string" ? data.message : "Points rule saved.")
      await fetchSchoolData({ showLoader: false })
    } catch {
      setSchoolError("Network error while saving points rule.")
    } finally {
      setSchoolBusy(null)
    }
  }, [fetchSchoolData, pointsRuleForm])

  const assignPointsManually = React.useCallback(async (event: React.FormEvent) => {
    event.preventDefault()
    setSchoolError(null)
    setSchoolSuccess(null)
    setSchoolBusy("assign")
    try {
      const res = await fetch("/api/staff/school/points-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail: pointsAssignForm.userEmail,
          points: pointsAssignForm.points,
          type: pointsAssignForm.type,
          note: pointsAssignForm.note,
          eventKey: pointsAssignForm.eventKey,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSchoolError(typeof data?.error === "string" ? data.error : "Unable to assign points.")
        return
      }
      setSchoolSuccess(typeof data?.message === "string" ? data.message : "Points assigned.")
      setPointsAssignForm((prev) => ({ ...prev, points: "10", note: "", eventKey: "" }))
    } catch {
      setSchoolError("Network error while assigning points.")
    } finally {
      setSchoolBusy(null)
    }
  }, [pointsAssignForm])

  const openProfileModal = React.useCallback(async (row: StaffUserRow) => {
    const startedAt = Date.now()
    setProfileModalOpen(true)
    setProfileTarget(row)
    setProfileLoading(true)
    setProfileError(null)
    setProfileSuccess(null)
    setProfileCanEditRole(false)
    try {
      const res = await fetch(`/api/staff/users/${row.id}/profile`, {
        headers: { "Content-Type": "application/json" },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setProfileError(typeof data?.error === "string" ? data.error : "Failed to load staff profile")
        return
      }
      const user = data?.user || {}
      const profile = user.profile || {}
      const profileImageUrl = typeof user.imageUrl === "string" ? user.imageUrl : row.avatarUrl || ""
      const profileGallery = Array.isArray(profile.gallery)
        ? profile.gallery.filter((item: unknown): item is string => typeof item === "string")
        : []
      setProfileCanEditRole(Boolean(data?.canEditRole))
      setProfileHasPin(Boolean(user.hasPin))
      setProfileAvatarError(null)
      setProfileTarget((prev) => (prev ? { ...prev, avatarUrl: profileImageUrl } : prev))
      const resolvedRole: StaffRole =
        user?.role === "owner" || user?.role === "admin" || user?.role === "staff" ? user.role : row.role
      const resolvedCategory: StaffCategory =
        user?.category === "front_desk" ||
        user?.category === "manager" ||
        user?.category === "teacher" ||
        user?.category === "guest" ||
        user?.category === "partner"
          ? user.category
          : row.category

      setProfileForm({
        firstName: typeof user.firstName === "string" ? user.firstName : row.firstName || "",
        lastName: typeof user.lastName === "string" ? user.lastName : row.lastName || "",
        role: resolvedRole,
        category: normalizeCategoryForRole(resolvedRole, resolvedCategory),
        birthDate: typeof profile.birthDate === "string" ? profile.birthDate : "",
        addressLine1: typeof profile.addressLine1 === "string" ? profile.addressLine1 : "",
        addressLine2: typeof profile.addressLine2 === "string" ? profile.addressLine2 : "",
        city: typeof profile.city === "string" ? profile.city : "",
        state: typeof profile.state === "string" ? profile.state : "",
        postalCode: typeof profile.postalCode === "string" ? profile.postalCode : "",
        country: typeof profile.country === "string" ? profile.country : "",
        personalNote: typeof profile.personalNote === "string" ? profile.personalNote : "",
        location: typeof profile.location === "string" ? profile.location : row.location || "",
        gallery: profileGallery.slice(0, 6),
        pin: "",
        clearPin: false,
      })
    } catch {
      setProfileError("Network error while loading staff profile")
    } finally {
      await ensureMinimumLoadingTime(startedAt)
      setProfileLoading(false)
    }
  }, [ensureMinimumLoadingTime])

  React.useEffect(() => {
    if (!canAccessUsersNav) {
      setLoading(false)
      setRows([])
      setPayrollModelOptions([])
      setPayrollModelError(null)
      return
    }
    fetchRows(undefined, categoryFilter)
    void fetchPayrollModelOptions()
  }, [canAccessUsersNav, fetchPayrollModelOptions, fetchRows, categoryFilter])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    if (!canAccessUsersNav) return
    let active = true
    let timeoutId: number | undefined
    const tick = () => {
      if (!active) return
      if (document.visibilityState !== "visible") return
      void fetchRows(query, categoryFilter, { showLoader: false, enforceMinDelay: false })
    }
    const scheduleNext = () => {
      if (!active) return
      const now = Date.now()
      const backoffRemaining = Math.max(0, backoffUntilRef.current - now)
      const baseInterval = isInsideCriticalClassWindow(scheduleEventsByDay, now)
        ? STAFF_USERS_CRITICAL_REFRESH_MS
        : STAFF_USERS_NORMAL_REFRESH_MS
      const delay = Math.max(baseInterval, backoffRemaining)
      timeoutId = window.setTimeout(() => {
        tick()
        scheduleNext()
      }, delay)
    }
    const handleVisibilityChange = () => {
      if (!active) return
      if (document.visibilityState !== "visible") return
      window.clearTimeout(timeoutId)
      void fetchRows(query, categoryFilter, { showLoader: false, enforceMinDelay: false })
      scheduleNext()
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    scheduleNext()
    return () => {
      active = false
      window.clearTimeout(timeoutId)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [canAccessUsersNav, fetchRows, query, categoryFilter, scheduleEventsByDay])

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      setNowTs(Date.now())
    }, STAFF_USERS_NORMAL_REFRESH_MS)
    return () => window.clearInterval(interval)
  }, [])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    const desktopQuery = window.matchMedia("(min-width: 1180px)")

    const syncAssistantLayout = () => {
      setIsRailCollapsed(!desktopQuery.matches)
    }

    syncAssistantLayout()
    desktopQuery.addEventListener("change", syncAssistantLayout)

    return () => {
      desktopQuery.removeEventListener("change", syncAssistantLayout)
    }
  }, [])

  React.useEffect(() => {
    if (!presenceMenuUserId) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      if (target.closest("[data-presence-menu]")) return
      setPresenceMenuUserId(null)
    }
    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [presenceMenuUserId])

  React.useEffect(() => {
    if (!checkoutMenuPaymentId) return
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      if (target.closest("[data-checkout-menu]")) return
      setCheckoutMenuPaymentId(null)
    }
    document.addEventListener("mousedown", handlePointerDown)
    return () => document.removeEventListener("mousedown", handlePointerDown)
  }, [checkoutMenuPaymentId])

  React.useEffect(() => {
    if (!canAccessSchoolNav) return
    fetchSchedule(scheduleMonth)
  }, [canAccessSchoolNav, fetchSchedule, scheduleMonth])

  React.useEffect(() => {
    if (!canAccessStudentsNav) return
    void refreshPaymentsBoard()
  }, [canAccessStudentsNav, refreshPaymentsBoard])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    if (!isStudentsView) return

    const refreshAlerts = () => {
      if (document.visibilityState !== "visible") return
      void fetchTerminalPinAlerts()
    }

    const inCriticalWindow = isInsideCriticalClassWindow(scheduleEventsByDay)
    const refreshMs =
      terminalPinAlerts.length > 0 || inCriticalWindow
        ? TERMINAL_ALERTS_CRITICAL_REFRESH_MS
        : TERMINAL_ALERTS_NORMAL_REFRESH_MS
    const interval = window.setInterval(refreshAlerts, refreshMs)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchTerminalPinAlerts()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [fetchTerminalPinAlerts, isStudentsView, terminalPinAlerts.length, scheduleEventsByDay])

  React.useEffect(() => {
    if (!canAccessUsersNav) return
    fetchStaffRequests(requestStatusFilter, { scope: "all" })
  }, [canAccessUsersNav, fetchStaffRequests, requestStatusFilter])

  React.useEffect(() => {
    if (!showStaffOps) return
    void fetchPaymentChangeRequests()
  }, [fetchPaymentChangeRequests, showStaffOps])

  React.useEffect(() => {
    if (!isProfileView || !canAccessProfileNav) return
    void fetchSelfProfile()
  }, [canAccessProfileNav, fetchSelfProfile, isProfileView])

  React.useEffect(() => {
    if (!isProfileView || !canAccessProfileNav) return
    void fetchStaffRequests(profileRequestStatusFilter, { scope: "mine" })
  }, [canAccessProfileNav, fetchStaffRequests, isProfileView, profileRequestStatusFilter])

  React.useEffect(() => {
    if (!showStaffOps || schoolCourses.length > 0) return
    let cancelled = false

    const loadAssignmentCourses = async () => {
      try {
        const res = await fetch("/api/staff/school/courses", { headers: { "Content-Type": "application/json" } })
        if (handleStaffAuthFailure(res.status)) return
        const data = await res.json().catch(() => ({}))
        if (!res.ok || cancelled) return
        setSchoolCourses(Array.isArray(data?.items) ? data.items : [])
      } catch {
        // Keep the UI functional with the local fallback course catalog.
      }
    }

    void loadAssignmentCourses()

    return () => {
      cancelled = true
    }
  }, [handleStaffAuthFailure, schoolCourses.length, showStaffOps])

  React.useEffect(() => {
    if (!canAccessSchoolNav || !isSchoolView) return
    void fetchSchoolData({ showLoader: true })
  }, [canAccessSchoolNav, fetchSchoolData, isSchoolView])

  React.useEffect(() => {
    const nav = searchParams.get("nav")
    if (!nav) return
    if (!allowedNavSections.includes(nav as StaffPortalSection)) return
    setActiveNav(nav as StaffPortalSection)
  }, [allowedNavSections, searchParams])

  React.useEffect(() => {
    const selectedSlug = searchParams.get("course")
    if (!selectedSlug) {
      setCourseHydratedFromQuery(false)
      return
    }
    if (!isSchoolView || courseHydratedFromQuery || schoolCourses.length === 0) return
    const selected = schoolCourses.find((item) => item.slug === selectedSlug)
    if (!selected) return
    const parsedRules = normalizeCourseScheduleRules(selected.scheduleRules)
    const scheduleSlotsFromRules = parsedRules ? buildSlotsFromScheduleRules(parsedRules) : []
    const defaultWeekdays = parsedRules
      ? [...new Set(parsedRules.rules.map((rule) => rule.weekday))].sort((a, b) => a - b)
      : selected.availableWeekdays
    const defaultTimes = parsedRules
      ? [...new Set(parsedRules.rules.flatMap((rule) => rule.times).map((time) => normalizeClockTime(time)).filter(Boolean))].sort()
      : selected.availableTimes.map((time) => normalizeClockTime(time)).filter(Boolean)
    const publicationMode = parsedRules?.publication?.mode || "publish_now"
    const launchDate = publicationMode === "launch_date" ? parsedRules?.publication?.launchDate || "" : ""
    const specialDiscountType = parsedRules?.specialDiscount?.type || "none"
    const specialDiscountCustomLabel = specialDiscountType === "custom" ? parsedRules?.specialDiscount?.label || "" : ""
    const specialDiscountPrice =
      parsedRules?.specialDiscount?.priceCents !== null && parsedRules?.specialDiscount?.priceCents !== undefined
        ? centsToUsdInput(parsedRules.specialDiscount.priceCents)
        : ""
    setCourseForm((prev) => ({
      ...prev,
      slug: selected.slug,
      title: selected.title,
      kind: selected.kind,
      category: selected.category || "",
      description: selected.description || "",
      previewImageUrl: selected.coverImageUrl || "",
      previewVideoUrl: selected.previewVideoUrl || "",
      dropInPriceCents: centsToUsdInput(selected.dropInPriceCents),
      firstClassPriceCents: centsToUsdInput(selected.firstClassPriceCents),
       level: selected.level || "",
       durationMinutes: selected.durationMinutes?.toString() || "",
       location: selected.location || "",
       defaultRoomId: selected.defaultRoomId || "",
       publicationMode,
       launchDate,
      specialDiscountType,
      specialDiscountCustomLabel,
      specialDiscountPrice,
      availableTimesCsv: selected.availableTimes.join(","),
      active: selected.active,
    }))
    setCourseWeekdays(defaultWeekdays)
    setCourseRecurringWeekdays(defaultWeekdays)
    setCourseScheduleSlots(scheduleSlotsFromRules)
    setCourseRepeatAllMonth(parsedRules?.repeatAllMonth ?? true)
    setCourseRecurrenceMode(parsedRules?.recurrenceMode || "indefinite")
    setCourseRecurrenceEndsAt(parsedRules?.recurrenceEndsAt || "")
    setCourseMirrorEnabled(false)
    setCourseMirrorWeekdays([])
    setQuickScheduleTimes((prev) => normalizeQuickScheduleTimes([...defaultTimes, ...prev]))
    setEditingQuickTimeIndex(null)
    setQuickTimeDraft("")
    setScheduleTimePickerOpen(false)
    setCourseHydratedFromQuery(true)
    schoolWizard.goToEntity("courses")
  }, [courseHydratedFromQuery, isSchoolView, schoolCourses, schoolWizard, searchParams])

  React.useEffect(() => {
    if (editingPackageId !== null) return // Don't auto-assign when editing an existing package
    if (packageForm.courseSlugs.length > 0) return
    const firstCourseSlug = schoolCourses[0]?.slug || demoCourses[0]?.slug || ""
    if (!firstCourseSlug) return
    setPackageForm((prev) => ({ ...prev, courseSlugs: [firstCourseSlug] }))
  }, [editingPackageId, packageForm.courseSlugs, schoolCourses])

  React.useEffect(() => {
    return () => {
      if (courseLocalImagePreview.startsWith("blob:")) URL.revokeObjectURL(courseLocalImagePreview)
      if (courseLocalVideoPreview.startsWith("blob:")) URL.revokeObjectURL(courseLocalVideoPreview)
    }
  }, [courseLocalImagePreview, courseLocalVideoPreview])

  const scheduleDerivedData = React.useMemo(() => deriveCourseScheduleData(courseScheduleSlots), [courseScheduleSlots])
  const scheduleCalendarMap = React.useMemo(() => {
    const map = new Map<string, string[]>()
    const appendTime = (isoDate: string, rawTime: string) => {
      const normalized = normalizeClockTime(rawTime)
      if (!normalized) return
      const existing = map.get(isoDate) || []
      if (!existing.includes(normalized)) {
        const next = [...existing, normalized].sort()
        map.set(isoDate, next)
      }
    }

    const recurring = courseScheduleSlots.filter(
      (slot): slot is CourseScheduleSlot & { weekday: number } =>
        typeof slot.weekday === "number" && slot.weekday >= 0 && slot.weekday <= 6 && !!normalizeClockTime(slot.time)
    )
    const explicitDates = courseScheduleSlots.filter((slot) => typeof slot.date === "string" && !!slot.date)

    for (const slot of explicitDates) {
      appendTime(slot.date!, slot.time)
    }

    if (recurring.length > 0) {
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      start.setMonth(start.getMonth() - 1)
      const end = new Date(start)
      end.setFullYear(end.getFullYear() + 2)

      for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
        const weekday = cursor.getDay()
        const isoDate = toLocalIsoDate(cursor)
        for (const slot of recurring) {
          if (slot.weekday !== weekday) continue
          appendTime(isoDate, slot.time)
        }
      }
    }

    return map
  }, [courseScheduleSlots])
  const getCourseScheduleDateTooltip = React.useCallback(
    (isoDate: string) => {
      const times = scheduleCalendarMap.get(isoDate)
      if (!times || times.length === 0) return undefined
      return `${courseForm.title || "Course"} · ${times.map((time) => formatClockLabel(time)).join(", ")}`
    },
    [courseForm.title, scheduleCalendarMap]
  )
  const getCourseScheduleDateTone = React.useCallback(
    (isoDate: string) => {
      const times = scheduleCalendarMap.get(isoDate)
      if (!times || times.length === 0) return undefined
      return COURSE_KIND_DATE_TONE[courseForm.kind] || "course"
    },
    [courseForm.kind, scheduleCalendarMap]
  )

  const previewMediaUrl = courseLocalImagePreview || courseForm.previewImageUrl.trim()
  const previewVideoUrl = courseLocalVideoPreview || courseForm.previewVideoUrl.trim()
  const embedPreviewVideoUrl = toEmbedVideoUrl(previewVideoUrl)
  const isEmbedPreviewVideo = isEmbedVideoUrl(embedPreviewVideoUrl)
  const previewVideoSource = isEmbedPreviewVideo ? toAutoplayEmbedUrl(embedPreviewVideoUrl) : previewVideoUrl
  const selectedCourseKindLabel = COURSE_KIND_LABELS[courseForm.kind] || "Course"
  const selectedCourseKindReviewLabel = `${selectedCourseKindLabel} review`
  const courseReviewVariants = React.useMemo(
    () =>
      SCHOOL_COURSE_KINDS.map((kind) => ({
        kind,
        label: COURSE_KIND_LABELS[kind] || kind,
        hint: COURSE_KIND_REVIEW_HINTS[kind] || "",
        active: courseForm.kind === kind,
      })),
    [courseForm.kind]
  )
  const previewEditorHref = courseForm.slug.trim()
    ? `/staff/school/course/${courseForm.slug.trim()}`
    : "/staff/portal?nav=schedule"
  const previewPublicHref = courseForm.slug.trim() ? `/courses/${courseForm.slug.trim()}` : ""

  const getCourseShareUrl = React.useCallback(() => {
    if (!previewPublicHref) return ""
    if (typeof window === "undefined") return previewPublicHref
    return `${window.location.origin}${previewPublicHref}`
  }, [previewPublicHref])

  const copyCourseLink = React.useCallback(async () => {
    const link = getCourseShareUrl()
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setSchoolSuccess("Course link copied.")
      setSchoolError(null)
    } catch {
      setSchoolError("Could not copy the course link.")
    }
  }, [getCourseShareUrl])

  const shareCourse = React.useCallback(
    (platform: "facebook" | "x" | "whatsapp" | "instagram" | "tiktok") => {
      const link = getCourseShareUrl()
      if (!link || typeof window === "undefined") return
      const encodedUrl = encodeURIComponent(link)
      const text = encodeURIComponent(`Check out this course: ${courseForm.title || "New PLI course"}`)
      if (platform === "instagram" || platform === "tiktok") {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          void navigator.clipboard
            .writeText(link)
            .then(() => {
              setSchoolSuccess("Link copied. Paste it into your social media post.")
              setSchoolError(null)
            })
            .catch(() => {
              setSchoolError("Could not copy the course link.")
            })
        }
        const socialHref = platform === "instagram" ? "https://www.instagram.com/" : "https://www.tiktok.com/"
        window.open(socialHref, "_blank", "noopener,noreferrer")
        return
      }
      const href =
        platform === "facebook"
          ? `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
          : platform === "x"
            ? `https://twitter.com/intent/tweet?text=${text}&url=${encodedUrl}`
            : `https://wa.me/?text=${text}%20${encodedUrl}`
      window.open(href, "_blank", "noopener,noreferrer")
    },
    [courseForm.title, getCourseShareUrl]
  )

  const externalRecurringSlotsMap = React.useMemo(() => {
    const map = new Map<string, { title: string; slug: string }[]>()
    const currentSlug = courseForm.slug.trim()
    for (const course of schoolCourses) {
      if (currentSlug && course.slug === currentSlug) continue
      const parsedRules = normalizeCourseScheduleRules(course.scheduleRules)
      const fallbackRules =
        !parsedRules && course.availableWeekdays.length > 0 && course.availableTimes.length > 0
          ? course.availableWeekdays.map((weekday) => ({
              weekday,
              times: course.availableTimes,
            }))
          : []
      const rules = parsedRules?.rules || fallbackRules
      for (const rule of rules) {
        for (const rawTime of rule.times) {
          const time = normalizeClockTime(rawTime)
          if (!time) continue
          const key = `${rule.weekday}|${time}`
          const current = map.get(key) || []
          current.push({ title: course.title, slug: course.slug })
          map.set(key, current)
        }
      }
    }
    return map
  }, [courseForm.slug, schoolCourses])

  const externalSpecialEventSlots = React.useMemo(() => {
    const items: Array<{ date: string; time: string; title: string; slug: string }> = []
    const currentSlug = courseForm.slug.trim()
    for (const course of schoolCourses) {
      if (currentSlug && course.slug === currentSlug) continue
      const parsedRules = normalizeCourseScheduleRules(course.scheduleRules)
      if (!parsedRules || parsedRules.specialEvents.length === 0) continue
      for (const event of parsedRules.specialEvents) {
        for (const rawTime of event.times) {
          const time = normalizeClockTime(rawTime)
          if (!time) continue
          if (!ISO_DATE_REGEX.test(event.date)) continue
          items.push({ date: event.date, time, title: course.title, slug: course.slug })
        }
      }
    }
    return items
  }, [courseForm.slug, schoolCourses])

  const externalSpecialEventSlotMap = React.useMemo(() => {
    const map = new Map<string, { title: string; slug: string }[]>()
    for (const item of externalSpecialEventSlots) {
      const key = `${item.date}|${item.time}`
      const current = map.get(key) || []
      current.push({ title: item.title, slug: item.slug })
      map.set(key, current)
    }
    return map
  }, [externalSpecialEventSlots])

  const regularSlotsBlockedByEvents = React.useMemo(() => {
    if (isSpecialEventCourse) return [] as Array<{ date: string; time: string; title: string }>
    const recurringSlots = courseScheduleSlots.filter(
      (slot): slot is CourseScheduleSlot & { weekday: number } =>
        typeof slot.weekday === "number" && slot.weekday >= 0 && slot.weekday <= 6
    )
    if (recurringSlots.length === 0) return [] as Array<{ date: string; time: string; title: string }>
    const entries: Array<{ date: string; time: string; title: string }> = []
    const seen = new Set<string>()
    for (const recurringSlot of recurringSlots) {
      const time = normalizeClockTime(recurringSlot.time)
      if (!time) continue
      for (const specialSlot of externalSpecialEventSlots) {
        if (specialSlot.time !== time) continue
        const eventWeekday = toCourseScheduleWeekday(specialSlot.date)
        if (eventWeekday !== recurringSlot.weekday) continue
        const key = `${specialSlot.date}|${time}|${specialSlot.slug}`
        if (seen.has(key)) continue
        seen.add(key)
        entries.push({ date: specialSlot.date, time, title: specialSlot.title })
      }
    }
    return entries.sort((a, b) => `${a.date}|${a.time}`.localeCompare(`${b.date}|${b.time}`))
  }, [courseScheduleSlots, externalSpecialEventSlots, isSpecialEventCourse])

  const regularScheduleWarningMessage = React.useMemo(() => {
    if (regularSlotsBlockedByEvents.length === 0) return null
    const first = regularSlotsBlockedByEvents[0]
    const next = regularSlotsBlockedByEvents.length > 1 ? ` +${regularSlotsBlockedByEvents.length - 1} more` : ""
    return `Warning: there are special events that conflict with this time slot (${first.date} · ${formatClockLabel(first.time)} · ${first.title}${next}). That day skips the regular class and continues on the next available day.`
  }, [regularSlotsBlockedByEvents])

  // Detect slug conflicts when creating a new course
  React.useEffect(() => {
    const currentSlug = courseForm.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
    if (!currentSlug || currentSlug.length < 3) {
      setCourseSlugConflict({ exists: false, suggestion: null, existingTitle: null })
      return
    }
    // If we're editing a course and the slug matches the original, no conflict
    if (courseEditingSlug && courseEditingSlug.toLowerCase() === currentSlug) {
      setCourseSlugConflict({ exists: false, suggestion: null, existingTitle: null })
      return
    }
    const existingCourse = schoolCourses.find((course) => course.slug.toLowerCase() === currentSlug)
    if (!existingCourse) {
      setCourseSlugConflict({ exists: false, suggestion: null, existingTitle: null })
      return
    }
    // Generate a unique suggestion by appending a number
    let suffix = 2
    let suggestion = `${currentSlug}-${suffix}`
    while (schoolCourses.some((course) => course.slug.toLowerCase() === suggestion)) {
      suffix++
      suggestion = `${currentSlug}-${suffix}`
    }
    setCourseSlugConflict({ exists: true, suggestion, existingTitle: existingCourse.title })
  }, [courseForm.slug, courseEditingSlug, schoolCourses])

  const handleUseSlugSuggestion = React.useCallback(() => {
    if (courseSlugConflict.suggestion) {
      setCourseForm((prev) => ({ ...prev, slug: courseSlugConflict.suggestion! }))
      setCourseSlugConflict({ exists: false, suggestion: null, existingTitle: null })
    }
  }, [courseSlugConflict.suggestion])

  const handleEditExistingCourse = React.useCallback(() => {
    // Normalize the slug the same way as the conflict detection effect
    const normalizedSlug = courseForm.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
    const existingCourse = schoolCourses.find((course) => course.slug.toLowerCase() === normalizedSlug)
    if (existingCourse) {
      // Hydrate the form with the existing course data
      setCourseForm({
        slug: existingCourse.slug,
        title: existingCourse.title,
        kind: existingCourse.kind || "course",
        category: existingCourse.category || "",
        description: existingCourse.description || "",
        previewImageUrl: existingCourse.coverImageUrl || "",
        previewVideoUrl: existingCourse.previewVideoUrl || "",
        dropInPriceCents: existingCourse.dropInPriceCents ? String(existingCourse.dropInPriceCents / 100) : "",
        firstClassPriceCents: existingCourse.firstClassPriceCents ? String(existingCourse.firstClassPriceCents / 100) : "",
        level: existingCourse.level || "Beginner",
        durationMinutes: existingCourse.durationMinutes ? String(existingCourse.durationMinutes) : "55",
        location: existingCourse.location || "54 Coles St, Jersey City, NJ",
        defaultRoomId: existingCourse.defaultRoomId || "",
        publicationMode: "publish_now",
        launchDate: "",
        specialDiscountType: "none",
        specialDiscountCustomLabel: "",
        specialDiscountPrice: "",
        availableTimesCsv: (existingCourse.availableTimes || []).join(", "),
        active: existingCourse.active ?? true,
      })
      setCourseWeekdays(existingCourse.availableWeekdays || [])
      setCourseHydratedFromQuery(true)
      setCourseEditingSlug(existingCourse.slug) // Track which course we're editing
      loadCourseLinks(existingCourse.slug) // Load consecutive class links for admin table
      setCourseSlugConflict({ exists: false, suggestion: null, existingTitle: null })
      setSchoolSuccess(`Loaded "${existingCourse.title}" for editing.`)
    }
  }, [courseForm.slug, loadCourseLinks, schoolCourses])

  const getSpecialEventConflictReason = React.useCallback(
    (isoDate: string, rawTime: string) => {
      const time = normalizeClockTime(rawTime)
      if (!time || !ISO_DATE_REGEX.test(isoDate)) return undefined
      const existingDateSlot = externalSpecialEventSlotMap.get(`${isoDate}|${time}`)
      if (existingDateSlot && existingDateSlot.length > 0) {
        return `Blocked: ${existingDateSlot[0].title} already uses ${formatClockLabel(time)} that day.`
      }
      const weekday = toCourseScheduleWeekday(isoDate)
      if (weekday !== null) {
        const recurring = externalRecurringSlotsMap.get(`${weekday}|${time}`)
        if (recurring && recurring.length > 0) {
          return `Blocked: ${recurring[0].title} has a regular class at ${formatClockLabel(time)}.`
        }
      }
      return undefined
    },
    [externalRecurringSlotsMap, externalSpecialEventSlotMap]
  )

  const addCourseScheduleSlot = React.useCallback(() => {
    const time = normalizeClockTime(courseScheduleTime)
    if (!time) return

    if (isSpecialEventCourse) {
      const dates = courseScheduleDates.length > 0 ? courseScheduleDates : []
      if (dates.length === 0) {
        setSchoolError("Select at least one date in the calendar to connect the event time slot.")
        return
      }
      const blockedDate = dates.find((date) => getSpecialEventConflictReason(date, time))
      if (blockedDate) {
        setSchoolError(getSpecialEventConflictReason(blockedDate, time) || "That time slot is already occupied.")
        return
      }
      setCourseScheduleSlots((prev) => {
        const next = [...prev]
        for (const date of dates) {
          const slot: CourseScheduleSlot = { date, time }
          const key = getCourseSlotKey(slot)
          if (next.some((item) => getCourseSlotKey(item) === key)) continue
          next.push(slot)
        }
        return next.sort(compareCourseSlots)
      })
      setCourseScheduleDate("")
      setCourseScheduleDates([])
      setCourseScheduleTime(normalizeClockTime(quickScheduleTimes[0] || "") || "10:00")
      setScheduleTimePickerOpen(false)
      setSchoolError(null)
      return
    }

    const recurringBase = [...new Set(courseRecurringWeekdays)].sort((a, b) => a - b)
    const mirrorWeekdays = courseMirrorEnabled
      ? courseMirrorWeekdays.filter((weekday) => !recurringBase.includes(weekday))
      : []
    const recurringWeekdays = [...new Set([...recurringBase, ...mirrorWeekdays])].sort((a, b) => a - b)
    if (recurringWeekdays.length === 0) return
    if (!quickScheduleTimes.includes(time) && typeof window !== "undefined") {
      const shouldAddShortcut = window.confirm("Do you want to add this time slot to your shortcuts?")
      if (shouldAddShortcut) {
        setQuickScheduleTimes((prev) => normalizeQuickScheduleTimes([...prev, time]))
      }
    }
    setCourseScheduleSlots((prev) => {
      const next = [...prev]
      for (const weekday of recurringWeekdays) {
        const candidate: CourseScheduleSlot = { weekday, recurring: true, time }
        const key = getCourseSlotKey(candidate)
        if (next.some((slot) => getCourseSlotKey(slot) === key)) continue
        next.push(candidate)
      }
      return next.sort(compareCourseSlots)
    })
    setCourseScheduleDate("")
    setCourseScheduleDates([])
    setCourseRecurringWeekdays([])
    setCourseMirrorEnabled(false)
    setCourseMirrorWeekdays([])
    setCourseScheduleTime(normalizeClockTime(quickScheduleTimes[0] || "") || "10:00")
    setScheduleTimePickerOpen(false)
  }, [
    courseMirrorEnabled,
    courseMirrorWeekdays,
    courseRecurringWeekdays,
    courseScheduleDates,
    courseScheduleTime,
    getSpecialEventConflictReason,
    isSpecialEventCourse,
    quickScheduleTimes,
    setSchoolError,
    setScheduleTimePickerOpen,
  ])

  const removeCourseScheduleSlot = React.useCallback((slotKey: string) => {
    setCourseScheduleSlots((prev) => prev.filter((slot) => getCourseSlotKey(slot) !== slotKey))
  }, [])

  const toggleCourseRecurringWeekday = React.useCallback((weekday: number) => {
    setCourseRecurringWeekdays((prev) => {
      if (prev.includes(weekday)) return prev.filter((item) => item !== weekday)
      return [...prev, weekday].sort((a, b) => a - b)
    })
  }, [])

  const toggleCourseMirrorWeekday = React.useCallback((weekday: number) => {
    setCourseMirrorWeekdays((prev) => {
      if (prev.includes(weekday)) return prev.filter((item) => item !== weekday)
      return [...prev, weekday].sort((a, b) => a - b)
    })
  }, [])

  const uploadCourseMedia = React.useCallback(
    async (file: File, kind: "image" | "video"): Promise<string | null> => {
      const payload = new FormData()
      payload.set("file", file)
      payload.set("kind", kind)

      try {
        const res = await fetch("/api/staff/school/courses/upload", {
          method: "POST",
          body: payload,
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          if (handleStaffAuthFailure(res.status)) return null
          setSchoolError(typeof data?.error === "string" ? data.error : `Unable to upload ${kind}.`)
          return null
        }
        const uploadedUrl = typeof data?.url === "string" ? data.url.trim() : ""
        if (!uploadedUrl) {
          setSchoolError(`Upload completed but ${kind} URL was empty.`)
          return null
        }
        return uploadedUrl
      } catch {
        setSchoolError(`Network error while uploading ${kind}.`)
        return null
      }
    },
    [handleStaffAuthFailure]
  )

  const handleCourseLocalImage = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      if (!COURSE_IMAGE_MIME_TYPES.has(file.type)) {
        setSchoolError("Formato inválido. Solo jpeg/png/webp.")
        event.target.value = ""
        return
      }
      if (file.size > COURSE_IMAGE_MAX_BYTES) {
        setSchoolError("Imagen demasiado grande. Máximo 2MB.")
        event.target.value = ""
        return
      }

      setSchoolError(null)
      setSchoolSuccess(null)
      const localPreviewUrl = URL.createObjectURL(file)
      setCourseLocalImagePreview((prev) => {
        if (prev.startsWith("blob:")) URL.revokeObjectURL(prev)
        return localPreviewUrl
      })
      setCourseMediaUploading("image")
      try {
        const uploadedUrl = await uploadCourseMedia(file, "image")
        if (!uploadedUrl) return
        setCourseForm((prev) => ({ ...prev, previewImageUrl: uploadedUrl }))
        setCourseLocalImagePreview((prev) => {
          if (prev.startsWith("blob:")) URL.revokeObjectURL(prev)
          return uploadedUrl
        })
        setCourseLocalImageName(file.name)
        setSchoolSuccess("Course image uploaded and linked. Save course to publish.")
      } finally {
        setCourseMediaUploading((prev) => (prev === "image" ? null : prev))
        event.target.value = ""
      }
    },
    [uploadCourseMedia]
  )

  const handleCourseLocalVideo = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      if (!COURSE_VIDEO_MIME_TYPES.has(file.type)) {
        setSchoolError("Formato inválido. Solo mp4/webm.")
        event.target.value = ""
        return
      }
      if (file.size > COURSE_VIDEO_MAX_BYTES) {
        setSchoolError("Video demasiado grande. Máximo 15MB.")
        event.target.value = ""
        return
      }

      setSchoolError(null)
      setSchoolSuccess(null)
      const localPreviewUrl = URL.createObjectURL(file)
      setCourseLocalVideoPreview((prev) => {
        if (prev.startsWith("blob:")) URL.revokeObjectURL(prev)
        return localPreviewUrl
      })
      setCourseMediaUploading("video")
      try {
        const uploadedUrl = await uploadCourseMedia(file, "video")
        if (!uploadedUrl) return
        setCourseForm((prev) => ({ ...prev, previewVideoUrl: uploadedUrl }))
        setCourseLocalVideoPreview((prev) => {
          if (prev.startsWith("blob:")) URL.revokeObjectURL(prev)
          return uploadedUrl
        })
        setCourseLocalVideoName(file.name)
        setSchoolSuccess("Course video uploaded and linked. Save course to publish.")
      } finally {
        setCourseMediaUploading((prev) => (prev === "video" ? null : prev))
        event.target.value = ""
      }
    },
    [uploadCourseMedia]
  )

  const runAction = async (userId: string, action: string, payload?: Record<string, unknown>) => {
    setBusyUserId(userId)
    setError(null)
    try {
      const res = await fetch(`/api/staff/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Action failed")
        return
      }
      await fetchRows(query, categoryFilter)
    } catch {
      setError("Network error while updating staff user")
    } finally {
      setBusyUserId(null)
    }
  }

  const revokeStaff = async (userId: string) => {
    setBusyUserId(userId)
    setError(null)
    try {
      const res = await fetch(`/api/staff/users/${userId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Failed to remove staff access")
        return
      }
      await fetchRows(query, categoryFilter)
    } catch {
      setError("Network error while removing staff access")
    } finally {
      setBusyUserId(null)
    }
  }

  const updateSettlementBulk = async (action: "mark_paid" | "mark_pending", ids: string[]) => {
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
      await refreshPaymentsBoard()
      if (searchResultCards !== null && studentSearchQuery.trim().length >= 2) {
        await triggerGlobalSearch(studentSearchQuery.trim())
      }
      setSelectedPaymentIds((prev) => prev.filter((id) => !ids.includes(id)))
    } catch {
      setError("Network error while updating settlement in bulk")
    } finally {
      setPaymentsBulkBusyAction(null)
    }
  }

  const updateRequestStatus = async (requestId: string, status: StaffRequestStatus) => {
    setRequestBusyId(requestId)
    setError(null)
    try {
      const res = await fetch(`/api/staff/requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Failed to update request")
        return
      }
      await fetchStaffRequests(requestStatusFilter, { scope: "all" })
    } catch {
      setError("Network error while updating request")
    } finally {
      setRequestBusyId(null)
    }
  }

  const updatePaymentChangeRequestStatus = async (
    requestId: string,
    status: Extract<PaymentChangeRequestStatus, "approved" | "rejected">
  ) => {
    setPaymentChangeRequestBusyId(requestId)
    setError(null)
    try {
      const res = await fetch(`/api/staff/payroll/change-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        setError(typeof data?.error === "string" ? data.error : "Failed to update payment change request")
        return
      }
      await fetchPaymentChangeRequests()
    } catch {
      setError("Network error while updating payment change request")
    } finally {
      setPaymentChangeRequestBusyId(null)
    }
  }

  const approvalsSummary = React.useMemo(
    () => buildStaffApprovalsSummary(requestsSummary, paymentChangeRequests),
    [paymentChangeRequests, requestsSummary]
  )
  const approvalFeed = React.useMemo(
    () =>
      buildStaffApprovalsFeed(
        staffRequests,
        paymentChangeRequests.filter((request) => isVisiblePaymentChangeRequest(request, requestStatusFilter))
      ),
    [paymentChangeRequests, requestStatusFilter, staffRequests]
  )
  const approvalsLoading = requestsLoading || paymentChangeRequestsLoading

  const saveProfileModal = async () => {
    if (!profileTarget) return
    setProfileSaving(true)
    setProfileError(null)
    setProfileSuccess(null)
    try {
      const res = await fetch(`/api/staff/users/${profileTarget.id}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileForm),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setProfileError(typeof data?.error === "string" ? data.error : "Unable to save profile")
        return
      }
      setProfileSuccess("Staff profile updated.")
      if (data?.user?.role === "owner" || data?.user?.role === "admin" || data?.user?.role === "staff") {
        setProfileForm((prev) => ({ ...prev, role: data.user.role }))
      }
      if (
        data?.user?.category === "front_desk" ||
        data?.user?.category === "manager" ||
        data?.user?.category === "teacher" ||
        data?.user?.category === "guest" ||
        data?.user?.category === "partner"
      ) {
        setProfileForm((prev) => ({ ...prev, category: data.user.category }))
      }
      setProfileHasPin(Boolean(data?.user?.hasPin))
      setProfileForm((prev) => ({ ...prev, pin: "", clearPin: false }))
      if (canAccessUsersNav) {
        await fetchRows(query, categoryFilter)
      }
      if (profileTarget.id === currentUserId) {
        await fetchSelfProfile()
      }
      closeProfileModal()
    } catch {
      setProfileError("Network error while saving profile")
    } finally {
      setProfileSaving(false)
    }
  }

  const uploadProfileAvatar = async (file: File) => {
    if (!profileTarget) return
    setProfileAvatarUploading(true)
    setProfileAvatarError(null)
    setProfileError(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch(`/api/staff/users/${profileTarget.id}/avatar`, {
        method: "PATCH",
        body: formData,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setProfileAvatarError(typeof data?.error === "string" ? data.error : "Unable to upload avatar.")
        return
      }
      const nextImage = typeof data?.imageUrl === "string" ? data.imageUrl : ""
      if (nextImage) {
        setRows((prev) => prev.map((row) => (row.id === profileTarget.id ? { ...row, avatarUrl: nextImage } : row)))
        setProfileTarget((prev) => (prev ? { ...prev, avatarUrl: nextImage } : prev))
        setProfileSuccess("Avatar updated.")
      }
    } catch {
      setProfileAvatarError("Network error while uploading avatar.")
    } finally {
      setProfileAvatarUploading(false)
    }
  }

  const uploadProfileGalleryImages = async (files: FileList | File[]) => {
    if (!profileTarget) return
    const picked = Array.from(files)
    if (picked.length === 0) return
    setProfileGalleryUploading(true)
    setProfileError(null)
    try {
      for (const file of picked) {
        const formData = new FormData()
        formData.append("file", file)
        const res = await fetch(`/api/staff/users/${profileTarget.id}/gallery-upload`, {
          method: "POST",
          body: formData,
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setProfileError(typeof data?.error === "string" ? data.error : "Unable to upload gallery image.")
          return
        }
        const nextUrl = typeof data?.url === "string" ? data.url : ""
        if (!nextUrl) continue
        setProfileForm((prev) => {
          if (prev.gallery.includes(nextUrl) || prev.gallery.length >= 6) return prev
          return { ...prev, gallery: [...prev.gallery, nextUrl] }
        })
      }
    } catch {
      setProfileError("Network error while uploading gallery images.")
    } finally {
      setProfileGalleryUploading(false)
    }
  }

  const closeProfileModal = () => {
    setProfileModalOpen(false)
    setProfileTarget(null)
    setProfileError(null)
    setProfileSuccess(null)
    setProfileCanEditRole(false)
    setProfileAvatarError(null)
    setProfileGalleryUploading(false)
  }

  const createStaff = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCreateMessage(null)
    setError(null)
    setCreateBusy(true)
    try {
      const body: Record<string, string> = {
        email,
        firstName,
        lastName,
        role: newRole,
        category: normalizeCategoryForRole(newRole, newCategory),
      }
      if (newPin && /^\d{4}$/.test(newPin)) {
        body.pin = newPin
      }
      const res = await fetch("/api/staff/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Failed to create staff user")
        return
      }

      if (data?.mode === "invited") {
        setCreateMessage(`Invitation sent to ${data?.invitation?.emailAddress || email}`)
      } else {
        setCreateMessage(newPin ? "Existing user promoted to staff with PIN assigned" : "Existing user promoted to staff")
      }

      setEmail("")
      setFirstName("")
      setLastName("")
      setNewRole("staff")
      setNewCategory("guest")
      setNewPin("")
      await fetchRows(query, categoryFilter)
    } catch {
      setError("Network error while creating staff user")
    } finally {
      setCreateBusy(false)
    }
  }

  const openPendingPayments = () => {
    setActiveNav("students")
    setPaymentsFilter("pending")
    requestAnimationFrame(() => {
      const el = document.getElementById("students-payments")
      el?.scrollIntoView({ block: "start", behavior: "smooth" })
    })
  }

  const calendarCells = React.useMemo(
    () => buildCalendar(scheduleMonth.getFullYear(), scheduleMonth.getMonth()),
    [scheduleMonth]
  )

  const scheduleMonthLabel = React.useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "long",
        year: "numeric",
      }).format(scheduleMonth),
    [scheduleMonth]
  )

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

  const selectedPointsRuleTemplate = React.useMemo(
    () => POINTS_RULE_DEFINITIONS.find((item) => item.key === pointsRuleForm.templateKey) || null,
    [pointsRuleForm.templateKey]
  )
  const selectedPointsRuleRecord = React.useMemo(
    () => schoolPointsRules.find((item) => item.key === pointsRuleForm.templateKey) || null,
    [schoolPointsRules, pointsRuleForm.templateKey]
  )

  const resetPointsRuleForm = React.useCallback(() => {
    const templateKey = pointsRuleForm.templateKey || POINTS_RULE_DEFINITIONS[0]?.key || "profile-completed"
    const template = POINTS_RULE_DEFINITIONS.find((item) => item.key === templateKey) || POINTS_RULE_DEFINITIONS[0] || null
    const existing = schoolPointsRules.find((item) => item.key === templateKey) || null
    setPointsRuleForm({
      templateKey,
      points: String(existing?.points ?? template?.defaultPoints ?? 10),
      active: existing?.active ?? true,
    })
  }, [pointsRuleForm.templateKey, schoolPointsRules])

  const resetPointsAssignForm = React.useCallback(() => {
    setPointsAssignForm({
      userEmail: "",
      type: "MANUAL_STAFF_ASSIGNMENT",
      points: "10",
      note: "",
      eventKey: "",
    })
  }, [])

  React.useEffect(() => {
    if (!selectedPointsRuleTemplate) return
    const nextPoints = selectedPointsRuleRecord ? String(selectedPointsRuleRecord.points) : String(selectedPointsRuleTemplate.defaultPoints)
    const nextActive = selectedPointsRuleRecord ? selectedPointsRuleRecord.active : true
    setPointsRuleForm((prev) => {
      if (prev.points === nextPoints && prev.active === nextActive) return prev
      return {
        ...prev,
        points: nextPoints,
        active: nextActive,
      }
    })
  }, [selectedPointsRuleRecord, selectedPointsRuleTemplate])

  React.useEffect(() => {
    setCourseMirrorWeekdays((prev) => prev.filter((weekday) => !courseRecurringWeekdays.includes(weekday)))
    if (courseRecurringWeekdays.length !== 1) {
      setCourseMirrorEnabled(false)
    }
  }, [courseRecurringWeekdays])

  React.useEffect(() => {
    if (courseRecurrenceMode === "indefinite" && courseRecurrenceEndsAt) {
      setCourseRecurrenceEndsAt("")
    }
  }, [courseRecurrenceEndsAt, courseRecurrenceMode])

  React.useEffect(() => {
    if (!scheduleTimePickerOpen) return
    const handlePointerDown = (event: MouseEvent) => {
      if (!scheduleTimePickerRef.current) return
      if (scheduleTimePickerRef.current.contains(event.target as Node)) return
      setScheduleTimePickerOpen(false)
    }
    document.addEventListener("mousedown", handlePointerDown)
    return () => document.removeEventListener("mousedown", handlePointerDown)
  }, [scheduleTimePickerOpen])

  const scheduleSlotTimeUsage = React.useMemo(() => {
    const counter = new Map<string, number>()
    for (const slot of courseScheduleSlots) {
      const normalized = normalizeClockTime(slot.time)
      if (!normalized) continue
      counter.set(normalized, (counter.get(normalized) || 0) + 1)
    }
    return counter
  }, [courseScheduleSlots])

  const scheduleTimeCourseUsage = React.useMemo(() => {
    const counter = new Map<string, number>()
    for (const course of schoolCourses) {
      const courseTimes = new Set<string>()
      const parsedRules = normalizeCourseScheduleRules(course.scheduleRules)
      if (parsedRules) {
        for (const rule of parsedRules.rules) {
          for (const rawTime of rule.times) {
            const normalized = normalizeClockTime(rawTime)
            if (normalized) courseTimes.add(normalized)
          }
        }
      } else {
        for (const rawTime of course.availableTimes) {
          const normalized = normalizeClockTime(rawTime)
          if (normalized) courseTimes.add(normalized)
        }
      }
      courseTimes.forEach((time) => counter.set(time, (counter.get(time) || 0) + 1))
    }
    return counter
  }, [schoolCourses])

  const scheduleTimeOptions = React.useMemo(() => {
    const options: string[] = []
    for (let hour = 0; hour < 24; hour++) {
      options.push(`${String(hour).padStart(2, "0")}:00`)
      options.push(`${String(hour).padStart(2, "0")}:30`)
    }
    return options
  }, [])

  const startEditingQuickTime = React.useCallback(
    (index: number) => {
      const current = quickScheduleTimes[index] || ""
      setEditingQuickTimeIndex(index)
      setQuickTimeDraft(current)
    },
    [quickScheduleTimes]
  )

  const commitQuickTimeEdit = React.useCallback(() => {
    if (editingQuickTimeIndex === null) return
    const normalized = normalizeClockTime(quickTimeDraft)
    if (!normalized) {
      setEditingQuickTimeIndex(null)
      setQuickTimeDraft("")
      return
    }
    setQuickScheduleTimes((prev) => {
      if (!prev[editingQuickTimeIndex]) return prev
      const next = [...prev]
      next[editingQuickTimeIndex] = normalized
      return normalizeQuickScheduleTimes(next)
    })
    setEditingQuickTimeIndex(null)
    setQuickTimeDraft("")
  }, [editingQuickTimeIndex, quickTimeDraft])

  const loadCourseIntoForm = React.useCallback((item: SchoolCourseRow) => {
    const parsedRules = normalizeCourseScheduleRules(item.scheduleRules)
    const scheduleSlotsFromRules = parsedRules ? buildSlotsFromScheduleRules(parsedRules) : []
    const defaultWeekdays = parsedRules
      ? [...new Set(parsedRules.rules.map((rule) => rule.weekday))].sort((a, b) => a - b)
      : item.availableWeekdays
    const defaultTimes = parsedRules
      ? [...new Set(parsedRules.rules.flatMap((rule) => rule.times).map((time) => normalizeClockTime(time)).filter(Boolean))].sort()
      : item.availableTimes.map((time) => normalizeClockTime(time)).filter(Boolean)
    const publicationMode = parsedRules?.publication?.mode || "publish_now"
    const launchDate = publicationMode === "launch_date" ? parsedRules?.publication?.launchDate || "" : ""
    const specialDiscountType = parsedRules?.specialDiscount?.type || "none"
    const specialDiscountCustomLabel = specialDiscountType === "custom" ? parsedRules?.specialDiscount?.label || "" : ""
    const specialDiscountPrice =
      parsedRules?.specialDiscount?.priceCents !== null && parsedRules?.specialDiscount?.priceCents !== undefined
        ? centsToUsdInput(parsedRules.specialDiscount.priceCents)
        : ""
    setCourseForm({
      slug: item.slug,
      title: item.title,
      kind: item.kind,
      category: item.category || "",
      description: item.description || "",
      previewImageUrl: item.coverImageUrl || "",
      previewVideoUrl: item.previewVideoUrl || "",
      dropInPriceCents: centsToUsdInput(item.dropInPriceCents),
      firstClassPriceCents: centsToUsdInput(item.firstClassPriceCents),
      level: item.level || "",
      durationMinutes: item.durationMinutes?.toString() || "",
      location: item.location || "",
      defaultRoomId: item.defaultRoomId || "",
      publicationMode,
      launchDate,
      specialDiscountType,
      specialDiscountCustomLabel,
      specialDiscountPrice,
      availableTimesCsv: item.availableTimes.join(","),
      active: item.active,
    })
    setCourseWeekdays(defaultWeekdays)
    setCourseScheduleDate("")
    setCourseScheduleDates([])
    setCourseRecurringWeekdays(defaultWeekdays)
    setCourseScheduleSlots(scheduleSlotsFromRules)
    setCourseRepeatAllMonth(parsedRules?.repeatAllMonth ?? true)
    setCourseRecurrenceMode(parsedRules?.recurrenceMode || "indefinite")
    setCourseRecurrenceEndsAt(parsedRules?.recurrenceEndsAt || "")
    setCourseMirrorEnabled(false)
    setCourseMirrorWeekdays([])
    setQuickScheduleTimes((prev) => normalizeQuickScheduleTimes([...defaultTimes, ...prev]))
    setEditingQuickTimeIndex(null)
    setQuickTimeDraft("")
    setScheduleTimePickerOpen(false)
    setCourseHydratedFromQuery(true)
    setCourseEditingSlug(item.slug) // Track which course we're editing
    loadCourseLinks(item.slug) // Load consecutive class links
    schoolWizard.goToEntity("courses")
    schoolWizard.setStep(0)
    requestAnimationFrame(() => {
      courseFormFieldsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }, [loadCourseLinks, schoolWizard])

  const deleteCourse = React.useCallback(async (slug: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
      return
    }
    setSchoolError(null)
    setSchoolSuccess(null)
    setSchoolBusy("course")
    try {
      const res = await fetch("/api/staff/school/courses", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSchoolError(typeof data?.error === "string" ? data.error : "Unable to delete course.")
        return
      }
      setSchoolSuccess(typeof data?.message === "string" ? data.message : "Course deleted.")
      await fetchSchoolData({ showLoader: false })
      // If we were editing this course, reset the form
      if (courseForm.slug === slug) {
        resetCourseBuilder()
      }
    } catch {
      setSchoolError("Network error while deleting course.")
    } finally {
      setSchoolBusy(null)
    }
  }, [courseForm.slug, fetchSchoolData, resetCourseBuilder])

  const toggleCourseActive = React.useCallback(async (item: SchoolCourseRow) => {
    const next = !item.active
    const label = next ? "activate" : "deactivate"
    if (!window.confirm(`Are you sure you want to ${label} "${item.title}"?`)) return
    setSchoolError(null)
    setSchoolSuccess(null)
    setSchoolBusy("course")
    try {
      const res = await fetch("/api/staff/school/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: item.slug, title: item.title, kind: item.kind, active: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSchoolError(typeof data?.error === "string" ? data.error : `Unable to ${label} course.`)
        return
      }
      setSchoolSuccess(`Course ${next ? "activated" : "deactivated"}.`)
      await fetchSchoolData({ showLoader: false })
    } catch {
      setSchoolError(`Network error while trying to ${label} course.`)
    } finally {
      setSchoolBusy(null)
    }
  }, [fetchSchoolData])

  // ─── CourseLink (consecutive classes) functions ────────────────

  const saveCourseLink = React.useCallback(async (event: React.FormEvent) => {
    event.preventDefault()
    setCourseLinkError(null)
    setCourseLinkSuccess(null)

    if (!courseEditingSlug) {
      setCourseLinkError("Save the course first before adding consecutive class links.")
      return
    }

    // Client-side validation: prevent self-linking
    if (courseLinkForm.courseSlugB === courseEditingSlug) {
      setCourseLinkError("A course cannot be linked to itself.")
      return
    }

    if (!courseLinkForm.courseSlugB) {
      setCourseLinkError("Select a consecutive course.")
      return
    }

    // Validate prices are non-negative numbers (or empty)
    const dropInCents = courseLinkForm.dropInConsecutiveCents.trim()
    const packageCents = courseLinkForm.packageHolderConsecutiveCents.trim()

    if (dropInCents) {
      const parsed = Number(dropInCents.replace(",", "."))
      if (!Number.isFinite(parsed) || parsed < 0) {
        setCourseLinkError("Drop-in consecutive price must be a valid non-negative number.")
        return
      }
    }

    if (packageCents) {
      const parsed = Number(packageCents.replace(",", "."))
      if (!Number.isFinite(parsed) || parsed < 0) {
        setCourseLinkError("Package-holder consecutive price must be a valid non-negative number.")
        return
      }
    }

    setCourseLinkSaving(true)
    try {
      const dropInValue = dropInCents ? Math.round(Number(dropInCents.replace(",", ".")) * 100) : null
      const packageValue = packageCents ? Math.round(Number(packageCents.replace(",", ".")) * 100) : null

      const isUpdate = courseLinkEditingId !== null

      const res = await fetch("/api/staff/school/course-links", {
        method: isUpdate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isUpdate ? { id: courseLinkEditingId } : {}),
          courseSlugA: courseEditingSlug,
          courseSlugB: courseLinkForm.courseSlugB,
          dropInConsecutiveCents: dropInValue ?? (isUpdate ? undefined : 0),
          packageHolderConsecutiveCents: packageValue ?? (isUpdate ? undefined : 0),
          active: courseLinkForm.active,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setCourseLinkError(typeof data?.error === "string" ? data.error : "Unable to save course link.")
        return
      }
      setCourseLinkSuccess(typeof data?.message === "string" ? data.message : "Course link saved.")
      resetCourseLinkForm()
      await loadCourseLinks(courseEditingSlug)
    } catch {
      setCourseLinkError("Network error while saving course link.")
    } finally {
      setCourseLinkSaving(false)
    }
  }, [courseEditingSlug, courseLinkForm, courseLinkEditingId, loadCourseLinks, resetCourseLinkForm])

  const editCourseLink = React.useCallback((link: CourseLinkRow) => {
    setCourseLinkForm({
      courseSlugB: link.courseSlugB,
      dropInConsecutiveCents: centsToUsdInput(link.dropInConsecutiveCents),
      packageHolderConsecutiveCents: centsToUsdInput(link.packageHolderConsecutiveCents),
      active: link.active,
    })
    setCourseLinkEditingId(link.id)
    setCourseLinkError(null)
    setCourseLinkSuccess(null)
  }, [])

  const deleteCourseLink = React.useCallback(async (linkId: string) => {
    setCourseLinkError(null)
    setCourseLinkSuccess(null)
    setCourseLinkSaving(true)
    try {
      const res = await fetch("/api/staff/school/course-links", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: linkId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setCourseLinkError(typeof data?.error === "string" ? data.error : "Unable to delete course link.")
        return
      }
      setCourseLinkSuccess(typeof data?.message === "string" ? data.message : "Course link removed.")
      if (courseEditingSlug) {
        await loadCourseLinks(courseEditingSlug)
      }
      if (courseLinkEditingId === linkId) {
        resetCourseLinkForm()
      }
    } catch {
      setCourseLinkError("Network error while deleting course link.")
    } finally {
      setCourseLinkSaving(false)
    }
  }, [courseEditingSlug, courseLinkEditingId, loadCourseLinks, resetCourseLinkForm])

  const toggleCourseLinkActive = React.useCallback(async (link: CourseLinkRow) => {
    setCourseLinkError(null)
    setCourseLinkSaving(true)
    try {
      const res = await fetch("/api/staff/school/course-links", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: link.id,
          active: !link.active,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setCourseLinkError(typeof data?.error === "string" ? data.error : "Unable to toggle course link.")
        return
      }
      if (courseEditingSlug) {
        await loadCourseLinks(courseEditingSlug)
      }
    } catch {
      setCourseLinkError("Network error while toggling course link.")
    } finally {
      setCourseLinkSaving(false)
    }
  }, [courseEditingSlug, loadCourseLinks])

  const rowById = React.useMemo(() => {
    return rows.reduce<Record<string, StaffUserRow>>((acc, row) => {
      acc[row.id] = row
      return acc
    }, {})
  }, [rows])

  const getLiveSessionMinutes = React.useCallback(
    (row: StaffUserRow) => {
      if (!row.online) return null
      if (!row.staffLastCheckInAt) return null
      const diff = nowTs - row.staffLastCheckInAt
      if (!Number.isFinite(diff) || diff < 0) return null
      return Math.floor(diff / 60_000)
    },
    [nowTs]
  )

  const selfRowFromDirectory = rowById[currentUserId] || null
  const selfIsOnline = selfRowFromDirectory ? selfRowFromDirectory.online : resolvedSelfProfile.presence.online
  const selfLastCheckInAt = selfRowFromDirectory?.staffLastCheckInAt ?? resolvedSelfProfile.presence.staffLastCheckInAt
  const selfLiveSessionMinutes = React.useMemo(() => {
    if (!selfIsOnline || !selfLastCheckInAt) return null
    const diff = nowTs - selfLastCheckInAt
    if (!Number.isFinite(diff) || diff < 0) return null
    return Math.floor(diff / 60_000)
  }, [nowTs, selfIsOnline, selfLastCheckInAt])

  const profileCalendarCells = React.useMemo(
    () => buildCalendar(profileScheduleMonth.getFullYear(), profileScheduleMonth.getMonth()),
    [profileScheduleMonth]
  )
  const profileScheduleMonthLabel = React.useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "long",
        year: "numeric",
      }).format(profileScheduleMonth),
    [profileScheduleMonth]
  )

  const profileCourseTitleBySlug = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const item of courseOptions) {
      map.set(item.slug, item.title)
    }
    return map
  }, [courseOptions])

  const selfScheduleEntries = React.useMemo(() => {
    const weekdays = resolvedSelfProfile.teaching.teacherWeekdays
    const startTime = resolvedSelfProfile.teaching.teacherShiftStart
    if (!Array.isArray(weekdays) || weekdays.length === 0 || !startTime) return [] as Array<{
      id: string
      dateKey: string
      title: string
      startAt: Date
      endAt: Date
      timeLabel: string
    }>

    const [startHour, startMinute] = startTime.split(":").map((value) => Number.parseInt(value, 10))
    if (!Number.isFinite(startHour) || !Number.isFinite(startMinute)) return []
    const endTime = resolvedSelfProfile.teaching.teacherShiftEnd
    const [endHourRaw, endMinuteRaw] = endTime ? endTime.split(":").map((value) => Number.parseInt(value, 10)) : [NaN, NaN]
    const fallbackTitle =
      resolvedSelfProfile.teaching.teacherCourseSlugs
        .map((slug) => profileCourseTitleBySlug.get(slug) || slug)
        .filter(Boolean)
        .slice(0, 2)
        .join(" / ") || "Staff shift"
    const timeFormatter = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" })

    return profileCalendarCells
      .filter((cell) => cell.inMonth)
      .flatMap((cell, index) => {
        const baseDate = new Date(`${cell.dateKey}T00:00:00`)
        if (!Number.isFinite(baseDate.getTime())) return []
        if (!weekdays.includes(baseDate.getDay())) return []

        const startAt = new Date(baseDate)
        startAt.setHours(startHour, startMinute, 0, 0)

        const endAt = new Date(baseDate)
        if (Number.isFinite(endHourRaw) && Number.isFinite(endMinuteRaw)) {
          endAt.setHours(endHourRaw, endMinuteRaw, 0, 0)
        } else {
          endAt.setTime(startAt.getTime() + 60 * 60 * 1000)
        }
        if (endAt.getTime() <= startAt.getTime()) {
          endAt.setTime(startAt.getTime() + 60 * 60 * 1000)
        }

        return [
          {
            id: `profile-schedule-${cell.dateKey}-${index}`,
            dateKey: cell.dateKey,
            title: fallbackTitle,
            startAt,
            endAt,
            timeLabel: `${timeFormatter.format(startAt)} - ${timeFormatter.format(endAt)}`,
          },
        ]
      })
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
  }, [profileCalendarCells, profileCourseTitleBySlug, resolvedSelfProfile.teaching.teacherCourseSlugs, resolvedSelfProfile.teaching.teacherShiftEnd, resolvedSelfProfile.teaching.teacherShiftStart, resolvedSelfProfile.teaching.teacherWeekdays])

  const selfScheduleByDay = React.useMemo(() => {
    return selfScheduleEntries.reduce<Record<string, Array<(typeof selfScheduleEntries)[number]>>>((acc, item) => {
      if (!acc[item.dateKey]) acc[item.dateKey] = []
      acc[item.dateKey].push(item)
      return acc
    }, {})
  }, [selfScheduleEntries])

  const selfCalendarGoogleHref = React.useMemo(() => {
    if (selfScheduleEntries.length === 0) return "#"
    const first = selfScheduleEntries[0]
    if (!first) return "#"
    const text = `${first.title} — Staff schedule`
    const details = `Staff schedule for ${resolvedSelfProfile.firstName || "team member"} (${profileScheduleMonthLabel}).`
    const location = resolvedSelfProfile.location || "Palladium Latin Institute"
    const dates = `${toUtcCalendarStamp(first.startAt)}/${toUtcCalendarStamp(first.endAt)}`
    const url = new URL("https://calendar.google.com/calendar/r/eventedit")
    url.searchParams.set("text", text)
    url.searchParams.set("details", details)
    url.searchParams.set("location", location)
    url.searchParams.set("dates", dates)
    return url.toString()
  }, [profileScheduleMonthLabel, resolvedSelfProfile.firstName, resolvedSelfProfile.location, selfScheduleEntries])

  const selfCalendarIcsDataUri = React.useMemo(() => {
    if (selfScheduleEntries.length === 0) return "#"
    const location = resolvedSelfProfile.location || "Palladium Latin Institute"
    const ownerName = `${resolvedSelfProfile.firstName} ${resolvedSelfProfile.lastName}`.trim() || "Staff member"
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//PLI//Staff Calendar//EN"]
    selfScheduleEntries.slice(0, 80).forEach((entry, index) => {
      lines.push("BEGIN:VEVENT")
      lines.push(`UID:staff-${entry.dateKey}-${index}@pli.local`)
      lines.push(`DTSTAMP:${toUtcCalendarStamp(new Date())}`)
      lines.push(`DTSTART:${toUtcCalendarStamp(entry.startAt)}`)
      lines.push(`DTEND:${toUtcCalendarStamp(entry.endAt)}`)
      lines.push(`SUMMARY:${entry.title}`)
      lines.push(`DESCRIPTION:Staff schedule for ${ownerName}`)
      lines.push(`LOCATION:${location}`)
      lines.push("END:VEVENT")
    })
    lines.push("END:VCALENDAR")
    return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\n"))}`
  }, [resolvedSelfProfile.firstName, resolvedSelfProfile.lastName, resolvedSelfProfile.location, selfScheduleEntries])

  const teacherRows = React.useMemo(
    () => rows.filter((row) => row.category === "teacher" || row.role === "owner" || row.role === "admin"),
    [rows]
  )

  React.useEffect(() => {
    if (teacherRows.length === 0) {
      setTeacherUserId("")
      return
    }
    if (!teacherRows.some((row) => row.id === teacherUserId)) {
      setTeacherUserId(teacherRows[0].id)
    }
  }, [teacherRows, teacherUserId])

  const selectedTeacher = React.useMemo(
    () => teacherRows.find((row) => row.id === teacherUserId) || null,
    [teacherRows, teacherUserId]
  )
  const assignedTeacher = React.useMemo(
    () => teacherRows.find((row) => row.id === teacherAssignedUserId) || null,
    [teacherRows, teacherAssignedUserId]
  )
  const selectedTeacherAssignmentState = React.useMemo(
    () => (selectedTeacher ? buildTeacherAssignmentFormState(selectedTeacher) : null),
    [selectedTeacher]
  )
  const teacherAssignmentDraftState = React.useMemo<TeacherAssignmentFormState | null>(() => {
    if (!selectedTeacher) return null
    return {
      assignedUserId: teacherAssignedUserId || selectedTeacher.id,
      recurrenceUnit: teacherRecurrenceUnit,
      recurrenceInterval: Math.max(1, Math.min(12, Math.round(teacherRecurrenceInterval))),
      courseSlugs: normalizeTeacherAssignmentCourseSlugs(teacherCourseSlugs),
    }
  }, [selectedTeacher, teacherAssignedUserId, teacherRecurrenceUnit, teacherRecurrenceInterval, teacherCourseSlugs])
  const teacherAssignmentDirty = React.useMemo(() => {
    if (!selectedTeacherAssignmentState || !teacherAssignmentDraftState) return false
    return !areTeacherAssignmentStatesEqual(teacherAssignmentDraftState, selectedTeacherAssignmentState)
  }, [selectedTeacherAssignmentState, teacherAssignmentDraftState])
  const teacherRecurrenceIntervalHelperText =
    teacherRecurrenceUnit === "year"
      ? "Example: Yearly + 2 means this program repeats every 2 years."
      : "Example: Monthly + 2 means this program repeats every 2 months."

  React.useEffect(() => {
    if (teacherRows.length === 0) {
      setTeacherAssignedUserId("")
      return
    }
    if (!teacherAssignedUserId || !teacherRows.some((row) => row.id === teacherAssignedUserId)) {
      setTeacherAssignedUserId(teacherRows[0].id)
    }
  }, [teacherRows, teacherAssignedUserId])

  const teacherRating = React.useMemo(() => {
    if (!selectedTeacher) return 0
    if (typeof selectedTeacher.performanceRating !== "number" || !Number.isFinite(selectedTeacher.performanceRating)) {
      return 0
    }
    return Math.max(0, Math.min(5, Math.round(selectedTeacher.performanceRating * 10) / 10))
  }, [selectedTeacher])

  React.useEffect(() => {
    if (!selectedTeacher || !selectedTeacherAssignmentState) return
    const teacherChanged = lastHydratedTeacherIdRef.current !== selectedTeacher.id
    if (!teacherChanged && teacherAssignmentDirty) return
    setTeacherReviewCycleDays(
      typeof selectedTeacher.performanceReviewCycleDays === "number" && Number.isFinite(selectedTeacher.performanceReviewCycleDays)
        ? Math.max(7, Math.min(90, Math.round(selectedTeacher.performanceReviewCycleDays)))
        : 30
    )
    setTeacherAssignedUserId(selectedTeacherAssignmentState.assignedUserId)
    setTeacherRecurrenceUnit(selectedTeacherAssignmentState.recurrenceUnit)
    setTeacherRecurrenceInterval(selectedTeacherAssignmentState.recurrenceInterval)
    setTeacherCourseSlugs(selectedTeacherAssignmentState.courseSlugs)
    lastHydratedTeacherIdRef.current = selectedTeacher.id
    if (teacherChanged) {
      setTeacherSuccess(null)
      setTeacherError(null)
      setMetricsSuccess(null)
      setMetricsError(null)
    }
  }, [selectedTeacher, selectedTeacherAssignmentState, teacherAssignmentDirty])

  const teacherPunctualityScore = React.useMemo(() => {
    if (!selectedTeacher) return 100
    const entries = Array.isArray(selectedTeacher.payrollDelayEntries) ? selectedTeacher.payrollDelayEntries : []
    if (entries.length === 0) return 100
    const totalDelay = entries.reduce((sum, item) => sum + item.delayMinutes, 0)
    const avgDelay = totalDelay / Math.max(entries.length, 1)
    return Math.max(50, Math.round(100 - avgDelay * 1.6))
  }, [selectedTeacher])

  const teacherHoursWorked = React.useMemo(() => {
    if (!selectedTeacher || typeof selectedTeacher.payrollHoursWorked !== "number") return 0
    return Math.max(0, selectedTeacher.payrollHoursWorked)
  }, [selectedTeacher])

  const teacherBonusTargetHours = React.useMemo(() => {
    if (!selectedTeacher || typeof selectedTeacher.teacherBonusTargetHours !== "number") return 30
    return Math.max(1, Math.round(selectedTeacher.teacherBonusTargetHours))
  }, [selectedTeacher])

  const teacherWeekdaysCount = React.useMemo(() => {
    if (!selectedTeacher || !Array.isArray(selectedTeacher.teacherWeekdays)) return 0
    return selectedTeacher.teacherWeekdays.length
  }, [selectedTeacher])

  const teacherBonusProgress = React.useMemo(() => {
    const goal = Math.max(1, teacherBonusTargetHours)
    return Math.min(100, Math.round((teacherHoursWorked / goal) * 100))
  }, [teacherBonusTargetHours, teacherHoursWorked])

  const teacherRatingPercent = React.useMemo(() => {
    if (teacherRating <= 0) return 0
    return Math.round((teacherRating / 5) * 100)
  }, [teacherRating])

  const teacherMetrics = React.useMemo(
    () => [
      { key: "rating", label: "Star rating", value: teacherRatingPercent, color: "#ff6b6b", valueLabel: teacherRating > 0 ? `${teacherRating.toFixed(1)} / 5` : "No data" },
      { key: "hours", label: "Hours vs bonus target", value: teacherBonusProgress, color: "#b61616", valueLabel: `${teacherHoursWorked.toFixed(1)}h / ${Math.max(1, teacherBonusTargetHours)}h` },
      { key: "punctuality", label: "Punctuality", value: teacherPunctualityScore, color: "#f59e0b", valueLabel: `${teacherPunctualityScore}%` },
    ],
    [teacherBonusProgress, teacherBonusTargetHours, teacherHoursWorked, teacherPunctualityScore, teacherRating, teacherRatingPercent]
  )

  const visibleTeacherMetrics = React.useMemo(() => {
    if (metricsView === "current") return teacherMetrics
    return teacherMetrics.map((metric) => {
      const value =
        metric.key === "hours"
          ? Math.max(0, Math.round(metric.value * 0.88))
          : metric.key === "punctuality"
            ? Math.max(0, Math.round(metric.value * 0.93))
            : Math.max(0, Math.round(metric.value * 0.9))
      return { ...metric, value }
    })
  }, [metricsView, teacherMetrics])

  const teacherDonutStyle = React.useMemo(() => {
    const total = visibleTeacherMetrics.reduce((sum, metric) => sum + metric.value, 0)
    if (total <= 0) {
      return {
        background: "conic-gradient(rgba(255,255,255,0.18) 0 100%)",
      } as React.CSSProperties
    }
    const ratingShare = Math.round((visibleTeacherMetrics[0].value / total) * 100)
    const hoursShare = Math.round((visibleTeacherMetrics[1].value / total) * 100)
    const firstStop = ratingShare
    const secondStop = Math.min(100, firstStop + hoursShare)
    return {
      background: `conic-gradient(${visibleTeacherMetrics[0].color} 0 ${firstStop}%, ${visibleTeacherMetrics[1].color} ${firstStop}% ${secondStop}%, ${visibleTeacherMetrics[2].color} ${secondStop}% 100%)`,
    } as React.CSSProperties
  }, [visibleTeacherMetrics])

  const teacherMetricsAverage = React.useMemo(() => {
    if (visibleTeacherMetrics.length === 0) return 0
    return Math.round(visibleTeacherMetrics.reduce((sum, metric) => sum + metric.value, 0) / visibleTeacherMetrics.length)
  }, [visibleTeacherMetrics])

  const teacherAiTips = React.useMemo(() => {
    if (!selectedTeacher) return []
    const tips: string[] = []
    if (teacherPunctualityScore < 85) {
      tips.push("Low punctuality: reinforce check-in 10 minutes before start time.")
    }
    if (teacherRating < 4) {
      tips.push("Rating below 4.0: suggest an observed class + AI-guided feedback.")
    }
    if (teacherBonusProgress < 70) {
      tips.push("Hours below bonus target: offer shift coverage on available days.")
    }
    if (teacherWeekdaysCount <= 2) {
      tips.push("Short availability: open at least 1 extra day to improve schedule continuity.")
    }
    if (tips.length === 0) {
      tips.push("Stable performance: maintain evaluation cycle and gradually raise bonus target.")
    }
    return tips.slice(0, 3)
  }, [selectedTeacher, teacherPunctualityScore, teacherRating, teacherBonusProgress, teacherWeekdaysCount])

  const toggleTeacherCourse = React.useCallback((courseSlug: string) => {
    setTeacherCourseSlugs((prev) => {
      if (prev.includes(courseSlug)) {
        return prev.filter((slug) => slug !== courseSlug)
      }
      return [...prev, courseSlug]
    })
  }, [])

  const saveTeacherPerformance = async () => {
    if (!selectedTeacher) return
    if (teacherCourseSlugs.length === 0) {
      setTeacherError("Select at least one course for this program template.")
      setTeacherSuccess(null)
      return
    }
    if (!teacherAssignedUserId) {
      setTeacherError("Select the assigned teacher for this program.")
      setTeacherSuccess(null)
      return
    }
    setTeacherSaving(true)
    setTeacherError(null)
    setTeacherSuccess(null)
    try {
      const res = await fetch(`/api/staff/users/${selectedTeacher.id}/performance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedTeacherUserId: teacherAssignedUserId,
          recurrenceUnit: teacherRecurrenceUnit,
          recurrenceInterval: teacherRecurrenceInterval,
          courseSlugs: teacherCourseSlugs,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setTeacherError(typeof data?.error === "string" ? data.error : "Unable to save performance settings.")
        return
      }
      setTeacherSuccess("Teaching assignment saved.")
      await fetchRows(query, categoryFilter, { showLoader: false, enforceMinDelay: false })
    } catch {
      setTeacherError("Network error while saving settings.")
    } finally {
      setTeacherSaving(false)
    }
  }

  const saveTeacherReviewCycle = async () => {
    if (!selectedTeacher) return
    setMetricsSaving(true)
    setMetricsError(null)
    setMetricsSuccess(null)
    try {
      const res = await fetch(`/api/staff/users/${selectedTeacher.id}/performance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewCycleDays: teacherReviewCycleDays,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMetricsError(typeof data?.error === "string" ? data.error : "Unable to save review cycle.")
        return
      }
      setMetricsSuccess("Review cycle saved.")
      await fetchRows(query, categoryFilter, { showLoader: false, enforceMinDelay: false })
    } catch {
      setMetricsError("Network error while saving review cycle.")
    } finally {
      setMetricsSaving(false)
    }
  }

  const payrollRows = React.useMemo<PayrollStaffRow[]>(() => {
    const today = new Date()
    return rows.map((row) => {
      const hoursWorked = typeof row.payrollHoursWorked === "number" ? row.payrollHoursWorked : null
      const hourlyRate = typeof row.payrollHourlyRate === "number" ? row.payrollHourlyRate : null
      const amountCents = hoursWorked !== null && hourlyRate !== null ? Math.round(hoursWorked * hourlyRate * 100) : null
      const paydayWeekday = row.payrollPaydayWeekday
      const paydayLabel = paydayWeekday !== null ? WEEKDAY_LABELS_LONG[paydayWeekday] : "Not configured"
      const dueDate = paydayWeekday !== null ? previousWeekday(today, paydayWeekday) : null
      const status: PayrollStaffRow["status"] = row.payrollStatus || "unknown"
      const delayDays =
        status === "pending" && dueDate
          ? Math.max(0, Math.floor((startOfDay(today).getTime() - dueDate.getTime()) / 86_400_000))
          : status === "paid"
            ? 0
            : null

      return {
        userId: row.id,
        name: `${row.firstName} ${row.lastName}`.trim() || row.email,
        role: row.role,
        category: row.category,
        hoursWorked,
        hourlyRate,
        amountCents,
        status,
        delayDays,
        paydayWeekday,
        paydayLabel,
        dueDateLabel: dueDate ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(dueDate) : null,
        delayEntries: Array.isArray(row.payrollDelayEntries) ? row.payrollDelayEntries : [],
      }
    })
  }, [rows])

  const payrollSummary = React.useMemo(() => {
    const totals = payrollRows.reduce(
      (acc, row) => {
        if (typeof row.amountCents === "number") {
          acc.total += row.amountCents
        }
        if (row.status === "paid" && typeof row.amountCents === "number") {
          acc.paid += row.amountCents
          acc.paidCount += 1
        } else if (row.status === "pending" && typeof row.amountCents === "number") {
          acc.pending += row.amountCents
          acc.pendingCount += 1
          if (typeof row.delayDays === "number") {
            acc.maxDelay = Math.max(acc.maxDelay, row.delayDays)
          }
        }
        return acc
      },
      { total: 0, paid: 0, pending: 0, paidCount: 0, pendingCount: 0, maxDelay: 0 }
    )

    const fridayCount = payrollRows.filter((row) => row.paydayWeekday === 5).length
    const exceptions = payrollRows
      .filter((row) => typeof row.paydayWeekday === "number" && row.paydayWeekday !== 5)
      .map((row) => ({
        id: row.userId,
        name: row.name,
        dayLabel: WEEKDAY_LABELS_LONG[row.paydayWeekday!],
      }))

    return { ...totals, fridayCount, exceptions }
  }, [payrollRows])

  const studentCards = React.useMemo(
    () => buildHistoryStudentCards(payments, { mode: isHistoryMode ? "history" : "daily" }),
    [isHistoryMode, payments]
  )
  const currentDateNY = React.useMemo(
    () => resolveHistoryMaxSelectableDateIso(new Date(nowTs), "America/New_York"),
    [nowTs]
  )

  const PAGE_SIZE = 9

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
    setSelectedPaymentIds((prev) => prev.filter((id) => filteredPaymentIds.includes(id)))
  }, [filteredPaymentIds])

  React.useEffect(() => {
    setCurrentPage(1)
  }, [historyAttendanceFilter, historyClassKey, historyPaymentMethodFilter, isHistoryMode, paymentCategoryFilter, paymentsFilter, searchResultCards, studentSearchQuery])

  // Check which displayed students have audit entries in the current month
  React.useEffect(() => {
    if (currentRole !== "owner" && currentRole !== "admin") return

    const userIds = displayedStudentCards
      .map((card) => ("source" in card && card.source === "profile" ? card.userId : card.latestPayment?.userId))
      .filter((id): id is string => Boolean(id) && !usersWithAuditEntries.has(id))

    // Check in batches to avoid too many requests
    const uniqueIds = [...new Set(userIds)].slice(0, 10)
    uniqueIds.forEach((userId) => {
      void checkUserHasAuditEntries(userId)
    })
  }, [displayedStudentCards, currentRole, checkUserHasAuditEntries, usersWithAuditEntries])

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

  const prioritizedTerminalPinAlerts = React.useMemo(
    () =>
      [...terminalPinAlerts].sort((left, right) => {
        const severityDiff = TERMINAL_ALERT_PRIORITY[left.severity] - TERMINAL_ALERT_PRIORITY[right.severity]
        if (severityDiff !== 0) return severityDiff

        const leftTs = left.blockedUntil ? Date.parse(left.blockedUntil) : Number.MAX_SAFE_INTEGER
        const rightTs = right.blockedUntil ? Date.parse(right.blockedUntil) : Number.MAX_SAFE_INTEGER
        return leftTs - rightTs
      }),
    [terminalPinAlerts]
  )

  const todayDateIso = React.useMemo(
    () => resolveHistoryMaxSelectableDateIso(new Date(nowTs), "America/New_York"),
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

  const reportFilteredPayments = React.useMemo(() => {
    const rawStartTs = parseDateInputStart(reportsDateFrom)
    const rawEndTs = parseDateInputEnd(reportsDateTo)
    let startTs = rawStartTs
    let endTs = rawEndTs

    if (startTs !== null && endTs !== null && startTs > endTs) {
      ;[startTs, endTs] = [endTs, startTs]
    }

    return payments.filter((item) => {
      const createdTs = Date.parse(item.createdAt)
      if (!Number.isFinite(createdTs)) return false
      if (startTs !== null && createdTs < startTs) return false
      if (endTs !== null && createdTs > endTs) return false
      return true
    })
  }, [payments, reportsDateFrom, reportsDateTo])

  const reportsRangeLabel = React.useMemo(() => {
    if (!reportsDateFrom && !reportsDateTo) return "All time"
    if (reportsDateFrom && reportsDateTo) return `${reportsDateFrom} to ${reportsDateTo}`
    if (reportsDateFrom) return `From ${reportsDateFrom}`
    return `Until ${reportsDateTo}`
  }, [reportsDateFrom, reportsDateTo])

  const reportsData = React.useMemo(() => {
    const paidPayments = reportFilteredPayments.filter((item) => item.classPaid)
    const totalRevenueCents = paidPayments.reduce((sum, item) => sum + item.amount, 0)
    const totalPaidSales = paidPayments.length
    const avgTicketCents = totalPaidSales > 0 ? Math.round(totalRevenueCents / totalPaidSales) : 0
    const uniqueStudents = new Set(
      paidPayments.map((item) => item.userId || item.customerEmail || item.customerPhone || item.id).filter(Boolean)
    ).size
    const checkedInPaid = paidPayments.filter((item) => isCheckedInStatus(item.checkInStatus)).length
    const checkInRate = totalPaidSales > 0 ? Math.round((checkedInPaid / totalPaidSales) * 100) : 0

    const courseAgg = new Map<
      string,
      {
        courseTitle: string
        paidSales: number
        paidRevenueCents: number
        checkIns: number
      }
    >()
    const monthAgg = new Map<
      string,
      {
        monthKey: string
        monthLabel: string
        paidSales: number
        pendingSales: number
        paidRevenueCents: number
      }
    >()
    const channelAgg = new Map<
      string,
      {
        key: string
        sales: number
        paidRevenueCents: number
      }
    >()
    const weekdayAgg = new Map<
      number,
      {
        weekday: number
        label: string
        paidSales: number
        paidRevenueCents: number
      }
    >()
    const timeWindowAgg = new Map<
      string,
      {
        window: string
        paidSales: number
        paidRevenueCents: number
      }
    >()
    const paidWeeksByUser = new Map<string, Set<number>>()
    const firstPaidWeekByUser = new Map<string, number>()
    let paidPackageSales = 0
    let paidDropInSales = 0

    for (const payment of reportFilteredPayments) {
      const isPaid = payment.classPaid
      const courseKey = payment.courseSlug || payment.courseTitle || "unknown-course"
      const courseRow = courseAgg.get(courseKey) || {
        courseTitle: payment.courseTitle || payment.courseSlug || "Untitled course",
        paidSales: 0,
        paidRevenueCents: 0,
        checkIns: 0,
      }
      if (isPaid) {
        courseRow.paidSales += 1
        courseRow.paidRevenueCents += payment.amount
      }
      if (isCheckedInStatus(payment.checkInStatus)) {
        courseRow.checkIns += 1
      }
      courseAgg.set(courseKey, courseRow)

      const created = Date.parse(payment.createdAt)
      if (Number.isFinite(created)) {
        const date = new Date(created)
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
        const monthLabel = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(date)
        const monthRow = monthAgg.get(monthKey) || {
          monthKey,
          monthLabel,
          paidSales: 0,
          pendingSales: 0,
          paidRevenueCents: 0,
        }
        if (isPaid) {
          monthRow.paidSales += 1
          monthRow.paidRevenueCents += payment.amount
        } else {
          monthRow.pendingSales += 1
        }
        monthAgg.set(monthKey, monthRow)

        if (isPaid) {
          const userKey = payment.userId || payment.customerEmail || payment.customerPhone || payment.id
          const weekStartTs = getWeekStartTs(date)
          if (!paidWeeksByUser.has(userKey)) {
            paidWeeksByUser.set(userKey, new Set<number>())
          }
          paidWeeksByUser.get(userKey)!.add(weekStartTs)
          const firstWeek = firstPaidWeekByUser.get(userKey)
          if (typeof firstWeek !== "number" || weekStartTs < firstWeek) {
            firstPaidWeekByUser.set(userKey, weekStartTs)
          }
        }
      }

      const channelKey = payment.paymentChannel === "unknown" ? "other" : payment.paymentChannel
      const channelRow = channelAgg.get(channelKey) || { key: channelKey, sales: 0, paidRevenueCents: 0 }
      channelRow.sales += 1
      if (isPaid) {
        channelRow.paidRevenueCents += payment.amount
      }
      channelAgg.set(channelKey, channelRow)

      if (isPaid) {
        if (payment.purchaseCategory === "package") paidPackageSales += 1
        if (payment.purchaseCategory === "dropin") paidDropInSales += 1

        let weekdaySourceDate: Date | null = null
        const startsAtTs = payment.classStartsAt ? Date.parse(payment.classStartsAt) : NaN
        if (Number.isFinite(startsAtTs)) {
          weekdaySourceDate = new Date(startsAtTs)
        } else if (Number.isFinite(created)) {
          weekdaySourceDate = new Date(created)
        }
        if (weekdaySourceDate) {
          const weekday = weekdaySourceDate.getDay()
          const weekdayRow = weekdayAgg.get(weekday) || {
            weekday,
            label: WEEKDAY_LABELS[weekday] || String(weekday),
            paidSales: 0,
            paidRevenueCents: 0,
          }
          weekdayRow.paidSales += 1
          weekdayRow.paidRevenueCents += payment.amount
          weekdayAgg.set(weekday, weekdayRow)
        }

        let minutesFromMidnight: number | null = null
        if (Number.isFinite(startsAtTs)) {
          const startsAtDate = new Date(startsAtTs)
          minutesFromMidnight = startsAtDate.getHours() * 60 + startsAtDate.getMinutes()
        } else {
          minutesFromMidnight = parseMinutesFromClassTime(payment.classTime)
        }

        if (typeof minutesFromMidnight === "number") {
          const windowLabel = resolveTimeWindowByMinute(minutesFromMidnight)
          const windowRow = timeWindowAgg.get(windowLabel) || {
            window: windowLabel,
            paidSales: 0,
            paidRevenueCents: 0,
          }
          windowRow.paidSales += 1
          windowRow.paidRevenueCents += payment.amount
          timeWindowAgg.set(windowLabel, windowRow)
        }
      }
    }

    const topCourses = [...courseAgg.values()].sort((a, b) => {
      if (b.paidRevenueCents !== a.paidRevenueCents) return b.paidRevenueCents - a.paidRevenueCents
      return b.paidSales - a.paidSales
    })

    const monthlyPerformance = [...monthAgg.values()].sort((a, b) => b.monthKey.localeCompare(a.monthKey))
    const channelBreakdown = [...channelAgg.values()].sort((a, b) => b.paidRevenueCents - a.paidRevenueCents)
    const weekdayPerformance = [...weekdayAgg.values()].sort((a, b) => a.weekday - b.weekday)
    const timeWindowRanking = [...timeWindowAgg.values()].sort((a, b) => b.paidRevenueCents - a.paidRevenueCents)
    const monthlyRevenueSeries = [...monthlyPerformance].sort((a, b) => a.monthKey.localeCompare(b.monthKey))

    const cohortUsersByWeek = new Map<number, string[]>()
    for (const [userKey, weekTs] of firstPaidWeekByUser.entries()) {
      const users = cohortUsersByWeek.get(weekTs) || []
      users.push(userKey)
      cohortUsersByWeek.set(weekTs, users)
    }
    const cohortRetention = [...cohortUsersByWeek.entries()]
      .sort((a, b) => b[0] - a[0])
      .slice(0, 8)
      .map(([cohortWeekTs, users]) => {
        const students = users.length
        const rates = [0, 1, 2, 3, 4].map((offset) => {
          const activeWeekTs = cohortWeekTs + offset * 7 * 24 * 60 * 60 * 1000
          const active = users.reduce((sum, userKey) => {
            const weeks = paidWeeksByUser.get(userKey)
            if (weeks?.has(activeWeekTs)) return sum + 1
            return sum
          }, 0)
          const percentage = students > 0 ? Math.round((active / students) * 100) : 0
          return { offset, active, percentage }
        })
        return {
          weekStartTs: cohortWeekTs,
          weekLabel: formatWeekRangeLabel(cohortWeekTs),
          students,
          rates,
        }
      })

    return {
      totalRevenueCents,
      totalPaidSales,
      avgTicketCents,
      uniqueStudents,
      checkInRate,
      topCourses,
      monthlyPerformance,
      monthlyRevenueSeries,
      channelBreakdown,
      weekdayPerformance,
      timeWindowRanking,
      cohortRetention,
      paidPackageSales,
      paidDropInSales,
      pendingStripeSales: reportFilteredPayments.filter((item) => !item.classPaid).length,
      totalRows: reportFilteredPayments.length,
    }
  }, [reportFilteredPayments])

  const reportsChartMeta = React.useMemo(() => {
    const maxMonthlyRevenue = Math.max(1, ...reportsData.monthlyRevenueSeries.map((item) => item.paidRevenueCents))
    const maxTopCourseRevenue = Math.max(1, ...reportsData.topCourses.slice(0, 8).map((item) => item.paidRevenueCents))
    const maxWindowRevenue = Math.max(1, ...reportsData.timeWindowRanking.map((item) => item.paidRevenueCents))
    return {
      maxMonthlyRevenue,
      maxTopCourseRevenue,
      maxWindowRevenue,
    }
  }, [reportsData])

  const localReportSuggestions = React.useMemo<ReportsSuggestion[]>(() => {
    const suggestions: ReportsSuggestion[] = []
    const monday = reportsData.weekdayPerformance.find((item) => item.weekday === 1)
    const avgPaidSalesPerDay =
      reportsData.weekdayPerformance.length > 0
        ? reportsData.weekdayPerformance.reduce((sum, item) => sum + item.paidSales, 0) / reportsData.weekdayPerformance.length
        : 0
    const mondayGap = Math.max(0, Math.round(avgPaidSalesPerDay - (monday?.paidSales || 0)))
    const mondayPriority: ReportsSuggestion["priority"] =
      mondayGap >= 3 ? "High" : mondayGap >= 1 ? "Medium" : "Low"

    suggestions.push({
      id: "monday-demand",
      objective: "monday_sales",
      title: "Increase Monday demand",
      priority: mondayPriority,
      insight: `Monday paid sales: ${monday?.paidSales || 0} (daily average: ${avgPaidSalesPerDay.toFixed(1)}).`,
      proposal:
        mondayGap > 0
          ? "Launch a Monday-only offer, push reminders on Sunday evening, and test one trial-friendly time slot."
          : "Monday is healthy. Keep momentum with a referral mini-campaign focused on repeat students.",
      actions: [
        "Run a Monday promo code for first-time and returning students.",
        "Send segmented reminders Sunday 6-9 PM with one-click booking links.",
        "A/B test class title copy emphasizing outcomes and class vibe.",
      ],
      aiBrief: `Goal: increase Monday class sales. Context: Monday paid sales ${monday?.paidSales || 0}, average daily ${avgPaidSalesPerDay.toFixed(1)}. Generate a 4-week experiment plan with offers, messaging, and KPI targets.`,
    })

    const qualityPriority: ReportsSuggestion["priority"] =
      reportsData.checkInRate < 60 ? "High" : reportsData.checkInRate < 75 ? "Medium" : "Low"
    suggestions.push({
      id: "class-quality",
      objective: "class_quality",
      title: "Improve class quality signal",
      priority: qualityPriority,
      insight: `Current check-in rate: ${reportsData.checkInRate}%.`,
      proposal:
        reportsData.checkInRate < 75
          ? "Standardize pre-class reminders and post-class feedback loops to reduce no-show behavior and improve perceived quality."
          : "Keep current quality baseline and add structured feedback to protect consistency at scale.",
      actions: [
        "Send reminders 24h + 2h before class with a clear class value statement.",
        "Collect a 2-question pulse after class (energy + clarity).",
        "Flag classes below target check-in rate for instructor review.",
      ],
      aiBrief: `Goal: improve class quality and attendance consistency. Current check-in rate is ${reportsData.checkInRate}%. Propose process, messaging templates, and instructor feedback loops.`,
    })

    const lastCohort = reportsData.cohortRetention[0]
    const w1 = lastCohort?.rates[1]?.percentage || 0
    const retentionPriority: ReportsSuggestion["priority"] = w1 < 40 ? "High" : w1 < 60 ? "Medium" : "Low"
    suggestions.push({
      id: "retention-cohort",
      objective: "retention",
      title: "Raise week-1 retention",
      priority: retentionPriority,
      insight: `Latest cohort W1 retention: ${w1}%${lastCohort ? ` (${lastCohort.weekLabel})` : ""}.`,
      proposal:
        w1 < 60
          ? "Introduce a structured second-visit trigger within 72h after first class, with clear next-step recommendation."
          : "Retention is stable. Expand retention playbook to W2 and W3 progression milestones.",
      actions: [
        "Send a personalized follow-up after first class with the best next slot.",
        "Offer a second-class guarantee coupon valid 7 days.",
        "Track W1 conversion by course and instructor to identify friction points.",
      ],
      aiBrief: `Goal: improve cohort retention. Latest W1 is ${w1}%. Build a retention workflow from first class to second booking with messaging and incentives.`,
    })

    const packageShare =
      reportsData.totalPaidSales > 0 ? Math.round((reportsData.paidPackageSales / reportsData.totalPaidSales) * 100) : 0
    const packagePriority: ReportsSuggestion["priority"] = packageShare < 25 ? "High" : packageShare < 45 ? "Medium" : "Low"
    suggestions.push({
      id: "package-conversion",
      objective: "package_mix",
      title: "Increase package conversion",
      priority: packagePriority,
      insight: `Package share on paid sales: ${packageShare}% (packages: ${reportsData.paidPackageSales}, drop-in: ${reportsData.paidDropInSales}).`,
      proposal:
        packageShare < 45
          ? "Move frequent drop-in students to package plans with clear savings and progression benefits."
          : "Package mix is healthy; improve package upsell timing during peak demand windows.",
      actions: [
        "Show package savings directly in checkout for repeat drop-in users.",
        "Offer a limited-time upgrade after second paid class.",
        "Highlight package benefits in teacher scripts and post-class follow-up.",
      ],
      aiBrief: `Goal: increase package conversion. Current package share is ${packageShare}% with ${reportsData.paidPackageSales} package sales and ${reportsData.paidDropInSales} drop-in sales. Create upsell strategy and trigger points.`,
    })

    const pendingPriority: ReportsSuggestion["priority"] =
      reportsData.pendingStripeSales >= 8 ? "High" : reportsData.pendingStripeSales >= 3 ? "Medium" : "Low"
    suggestions.push({
      id: "pending-recovery",
      objective: "pending_recovery",
      title: "Recover pending payments",
      priority: pendingPriority,
      insight: `Pending Stripe payments in range: ${reportsData.pendingStripeSales}.`,
      proposal:
        reportsData.pendingStripeSales > 0
          ? "Automate recovery touchpoints for pending checkouts to reduce lost demand."
          : "Pending volume is controlled. Keep alerts active and monitor anomalies weekly.",
      actions: [
        "Send automated payment recovery reminders at 30m and 24h.",
        "Prioritize manual follow-up for high-intent students (repeat profile or package interest).",
        "Track recovery rate by payment channel and time window.",
      ],
      aiBrief: `Goal: recover pending payments. Current pending Stripe count: ${reportsData.pendingStripeSales}. Propose automation and manual follow-up playbook with measurable KPIs.`,
    })

    return suggestions
  }, [reportsData])

  const reportSuggestionsMetrics = React.useMemo(() => {
    const monday = reportsData.weekdayPerformance.find((item) => item.weekday === 1)
    const avgPaidSalesPerDay =
      reportsData.weekdayPerformance.length > 0
        ? Number(
            (
              reportsData.weekdayPerformance.reduce((sum, item) => sum + item.paidSales, 0) /
              reportsData.weekdayPerformance.length
            ).toFixed(2)
          )
        : 0
    const latestCohort = reportsData.cohortRetention[0]
    const packageSharePct =
      reportsData.totalPaidSales > 0 ? Math.round((reportsData.paidPackageSales / reportsData.totalPaidSales) * 100) : 0

    return {
      rangeLabel: reportsRangeLabel,
      totalRows: reportsData.totalRows,
      totalPaidSales: reportsData.totalPaidSales,
      totalRevenueCents: reportsData.totalRevenueCents,
      avgTicketCents: reportsData.avgTicketCents,
      uniqueStudents: reportsData.uniqueStudents,
      checkInRate: reportsData.checkInRate,
      pendingStripeSales: reportsData.pendingStripeSales,
      mondayPaidSales: monday?.paidSales || 0,
      avgPaidSalesPerDay,
      paidPackageSales: reportsData.paidPackageSales,
      paidDropInSales: reportsData.paidDropInSales,
      packageSharePct,
      latestCohortWeek: latestCohort?.weekLabel || null,
      latestCohortW1RetentionPct: latestCohort?.rates?.[1]?.percentage || 0,
      topCourses: reportsData.topCourses.slice(0, 6).map((course) => ({
        title: course.courseTitle,
        paidSales: course.paidSales,
        paidRevenueCents: course.paidRevenueCents,
        checkIns: course.checkIns,
      })),
      timeWindowRanking: reportsData.timeWindowRanking.map((window) => ({
        window: window.window,
        paidSales: window.paidSales,
        paidRevenueCents: window.paidRevenueCents,
      })),
      channelBreakdown: reportsData.channelBreakdown.map((channel) => ({
        key: channel.key,
        sales: channel.sales,
        paidRevenueCents: channel.paidRevenueCents,
      })),
    }
  }, [reportsData, reportsRangeLabel])

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
    const quote = (value: string | number) => `"${String(value ?? "").replace(/"/g, '""')}"`
    const lines: string[] = []

    lines.push("Summary")
    lines.push(`${quote("Range")},${quote(reportsRangeLabel)}`)
    lines.push(`${quote("Paid revenue")},${quote(formatMoney(reportsData.totalRevenueCents))}`)
    lines.push(`${quote("Paid sales")},${quote(reportsData.totalPaidSales)}`)
    lines.push(`${quote("Avg ticket")},${quote(formatMoney(reportsData.avgTicketCents))}`)
    lines.push(`${quote("Unique students")},${quote(reportsData.uniqueStudents)}`)
    lines.push(`${quote("Check-in rate")},${quote(`${reportsData.checkInRate}%`)}`)
    lines.push(`${quote("Stripe pending")},${quote(reportsData.pendingStripeSales)}`)
    lines.push("")

    lines.push("Top courses")
    lines.push([quote("Course"), quote("Paid sales"), quote("Revenue"), quote("Check-ins")].join(","))
    for (const row of reportsData.topCourses) {
      lines.push([quote(row.courseTitle), quote(row.paidSales), quote(formatMoney(row.paidRevenueCents)), quote(row.checkIns)].join(","))
    }
    lines.push("")

    lines.push("Monthly performance")
    lines.push([quote("Month"), quote("Paid sales"), quote("Pending"), quote("Revenue")].join(","))
    for (const row of reportsData.monthlyPerformance) {
      lines.push([quote(row.monthLabel), quote(row.paidSales), quote(row.pendingSales), quote(formatMoney(row.paidRevenueCents))].join(","))
    }
    lines.push("")

    lines.push("Payment channels")
    lines.push([quote("Channel"), quote("Sales"), quote("Revenue")].join(","))
    for (const row of reportsData.channelBreakdown) {
      lines.push([quote(row.key), quote(row.sales), quote(formatMoney(row.paidRevenueCents))].join(","))
    }
    lines.push("")

    lines.push("Time windows")
    lines.push([quote("Window"), quote("Paid sales"), quote("Revenue")].join(","))
    for (const row of reportsData.timeWindowRanking) {
      lines.push([quote(row.window), quote(row.paidSales), quote(formatMoney(row.paidRevenueCents))].join(","))
    }
    lines.push("")

    lines.push("Cohort retention")
    lines.push([quote("Cohort week"), quote("Students"), quote("W0"), quote("W1"), quote("W2"), quote("W3"), quote("W4")].join(","))
    for (const cohort of reportsData.cohortRetention) {
      const [w0, w1, w2, w3, w4] = cohort.rates
      lines.push(
        [
          quote(cohort.weekLabel),
          quote(cohort.students),
          quote(`${w0.percentage}%`),
          quote(`${w1.percentage}%`),
          quote(`${w2.percentage}%`),
          quote(`${w3.percentage}%`),
          quote(`${w4.percentage}%`),
        ].join(",")
      )
    }

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    const stamp = new Date().toISOString().slice(0, 10)
    anchor.href = url
    anchor.download = `staff-reports-${stamp}.csv`
    anchor.click()
    window.URL.revokeObjectURL(url)
  }, [reportsData, reportsRangeLabel])

  const exportReportsPdf = React.useCallback(() => {
    if (typeof window === "undefined") return
    const escapeHtml = (value: string | number) =>
      String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;")

    const popup = window.open("", "_blank", "noopener,noreferrer,width=980,height=740")
    if (!popup) {
      setError("Popup blocked. Allow popups to export PDF.")
      return
    }

    const topCoursesRows =
      reportsData.topCourses.length > 0
        ? reportsData.topCourses
            .map(
              (row) =>
                `<tr><td>${escapeHtml(row.courseTitle)}</td><td>${escapeHtml(row.paidSales)}</td><td>${escapeHtml(formatMoney(row.paidRevenueCents))}</td><td>${escapeHtml(row.checkIns)}</td></tr>`
            )
            .join("")
        : `<tr><td colspan="4">No paid sales yet.</td></tr>`

    const monthlyRows =
      reportsData.monthlyPerformance.length > 0
        ? reportsData.monthlyPerformance
            .map(
              (row) =>
                `<tr><td>${escapeHtml(row.monthLabel)}</td><td>${escapeHtml(row.paidSales)}</td><td>${escapeHtml(row.pendingSales)}</td><td>${escapeHtml(formatMoney(row.paidRevenueCents))}</td></tr>`
            )
            .join("")
        : `<tr><td colspan="4">No monthly data available.</td></tr>`

    const channelRows =
      reportsData.channelBreakdown.length > 0
        ? reportsData.channelBreakdown
            .map(
              (row) =>
                `<tr><td>${escapeHtml(row.key)}</td><td>${escapeHtml(row.sales)}</td><td>${escapeHtml(formatMoney(row.paidRevenueCents))}</td></tr>`
            )
            .join("")
        : `<tr><td colspan="3">No channel data available.</td></tr>`

    const timeWindowRows =
      reportsData.timeWindowRanking.length > 0
        ? reportsData.timeWindowRanking
            .map(
              (row) =>
                `<tr><td>${escapeHtml(row.window)}</td><td>${escapeHtml(row.paidSales)}</td><td>${escapeHtml(formatMoney(row.paidRevenueCents))}</td></tr>`
            )
            .join("")
        : `<tr><td colspan="3">No time-window data available.</td></tr>`

    const cohortRows =
      reportsData.cohortRetention.length > 0
        ? reportsData.cohortRetention
            .map((row) => {
              const [w0, w1, w2, w3, w4] = row.rates
              return `<tr><td>${escapeHtml(row.weekLabel)}</td><td>${escapeHtml(row.students)}</td><td>${escapeHtml(`${w0.percentage}%`)}</td><td>${escapeHtml(`${w1.percentage}%`)}</td><td>${escapeHtml(`${w2.percentage}%`)}</td><td>${escapeHtml(`${w3.percentage}%`)}</td><td>${escapeHtml(`${w4.percentage}%`)}</td></tr>`
            })
            .join("")
        : `<tr><td colspan="7">No cohort retention data available.</td></tr>`

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Staff Reports</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 24px; color: #111827; }
      h1 { margin: 0 0 8px 0; font-size: 24px; }
      h2 { margin: 24px 0 8px 0; font-size: 16px; }
      p { margin: 4px 0; }
      .meta { color: #4b5563; font-size: 12px; }
      .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
      .card { border: 1px solid #d1d5db; border-radius: 8px; padding: 10px; }
      table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 12px; }
      th, td { border: 1px solid #e5e7eb; padding: 6px; text-align: left; }
      th { background: #f3f4f6; }
    </style>
  </head>
  <body>
    <h1>Staff reports</h1>
    <p class="meta">Range: ${escapeHtml(reportsRangeLabel)}</p>
    <p class="meta">Generated: ${escapeHtml(new Date().toLocaleString("en-US"))}</p>

    <div class="grid">
      <div class="card"><strong>Paid revenue</strong><p>${escapeHtml(formatMoney(reportsData.totalRevenueCents))}</p></div>
      <div class="card"><strong>Paid sales</strong><p>${escapeHtml(reportsData.totalPaidSales)}</p></div>
      <div class="card"><strong>Avg ticket</strong><p>${escapeHtml(formatMoney(reportsData.avgTicketCents))}</p></div>
      <div class="card"><strong>Unique students</strong><p>${escapeHtml(reportsData.uniqueStudents)}</p></div>
      <div class="card"><strong>Check-in rate</strong><p>${escapeHtml(reportsData.checkInRate)}%</p></div>
      <div class="card"><strong>Stripe pending</strong><p>${escapeHtml(reportsData.pendingStripeSales)}</p></div>
    </div>

    <h2>Top courses</h2>
    <table>
      <thead><tr><th>Course</th><th>Paid sales</th><th>Revenue</th><th>Check-ins</th></tr></thead>
      <tbody>${topCoursesRows}</tbody>
    </table>

    <h2>Monthly performance</h2>
    <table>
      <thead><tr><th>Month</th><th>Paid sales</th><th>Pending</th><th>Revenue</th></tr></thead>
      <tbody>${monthlyRows}</tbody>
    </table>

    <h2>Payment channels</h2>
    <table>
      <thead><tr><th>Channel</th><th>Sales</th><th>Revenue</th></tr></thead>
      <tbody>${channelRows}</tbody>
    </table>

    <h2>Time windows</h2>
    <table>
      <thead><tr><th>Window</th><th>Paid sales</th><th>Revenue</th></tr></thead>
      <tbody>${timeWindowRows}</tbody>
    </table>

    <h2>Cohort retention</h2>
    <table>
      <thead><tr><th>Cohort week</th><th>Students</th><th>W0</th><th>W1</th><th>W2</th><th>W3</th><th>W4</th></tr></thead>
      <tbody>${cohortRows}</tbody>
    </table>
  </body>
</html>`

    popup.document.open()
    popup.document.write(html)
    popup.document.close()
    popup.focus()
    window.setTimeout(() => {
      popup.print()
    }, 250)
  }, [reportsData, reportsRangeLabel])

  const openDelayDetails = React.useCallback((row: PayrollStaffRow) => {
    const entries = row.delayEntries
    const totalDelayMinutes = entries.reduce((sum, item) => sum + item.delayMinutes, 0)
    const lateDays = entries.filter((item) => item.delayMinutes > 0).length
    setDelayModal({
      row,
      entries,
      totalDelayMinutes,
      lateDays,
    })
  }, [])

  const closeDelayDetails = React.useCallback(() => {
    setDelayModal(null)
  }, [])

  const saveAssistantConfig = React.useCallback((event: React.FormEvent) => {
    event.preventDefault()
    setAssistantConfigMessage("Assistant settings updated.")
    window.setTimeout(() => {
      setAssistantConfigMessage(null)
    }, 2200)
  }, [])

  const sendAssistantChatMessage = React.useCallback((event: React.FormEvent) => {
    event.preventDefault()
    const prompt = assistantChatInput.trim()
    if (!prompt) return
    const userMessage = { id: `user-${Date.now()}`, role: "user" as const, text: prompt }
    const assistantMessage = {
      id: `assistant-${Date.now()}`,
      role: "assistant" as const,
      text: `Recibido. Estoy en ${activeNavLabel}. Si querés, preparo acciones y checklist para este flujo.`,
    }
    setAssistantChatMessages((prev) => [...prev, userMessage, assistantMessage])
    setAssistantChatInput("")
  }, [activeNavLabel, assistantChatInput])

  const assistantRailContent = (
    <>
      <div className="flex flex-col gap-2.5 min-[1180px]:gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 pr-1">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--brand,#b61616)] min-[1180px]:text-xs min-[1180px]:tracking-[0.35em]">AI Assistant</p>
            <h3 className="mt-1.5 text-lg font-semibold leading-tight text-white min-[1180px]:text-xl min-[1180px]:text-black xl:text-2xl dark:min-[1180px]:text-white">Admin copilot</h3>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setIsRailCollapsed((prev) => !prev)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/[0.06] text-white/80 transition hover:border-[var(--brand,#b61616)] hover:text-[var(--brand,#ff3c3c)] min-[1180px]:border-black/20 min-[1180px]:bg-white/70 min-[1180px]:text-black/75 dark:min-[1180px]:border-white/20 dark:min-[1180px]:bg-white/5 dark:min-[1180px]:text-white/75"
              aria-label={isRailCollapsed ? "Show AI assistant" : "Hide AI assistant"}
            >
              {isRailCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => handleNavSelection("assistant")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/12 bg-white/[0.06] text-xs font-semibold text-white transition hover:border-[var(--brand,#b61616)] min-[1180px]:h-auto min-[1180px]:w-auto min-[1180px]:gap-1.5 min-[1180px]:border-black/20 min-[1180px]:bg-white/70 min-[1180px]:px-2.5 min-[1180px]:py-1.5 min-[1180px]:text-black dark:min-[1180px]:border-white/20 dark:min-[1180px]:bg-white/5 dark:min-[1180px]:text-white"
              aria-label="Open assistant configuration"
              title="Open assistant configuration"
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden min-[1180px]:inline">Config</span>
            </button>
          </div>
        </div>
        <p className="max-w-none text-xs leading-relaxed text-white/68 min-[1180px]:text-sm min-[1180px]:text-black/65 dark:min-[1180px]:text-white/65">
          Live chat for operations. Configure behavior from the AI icon in the left menu.
        </p>
      </div>

      <div className="mt-4 flex min-h-0 max-h-[58vh] flex-col rounded-[1.2rem] border border-white/10 bg-black/20 p-3 min-[1180px]:min-h-[60vh] min-[1180px]:max-h-[60vh] min-[1180px]:rounded-xl min-[1180px]:border-black/10 min-[1180px]:bg-white/60 dark:min-[1180px]:border-white/10 dark:min-[1180px]:bg-white/[0.02]">
        <div className="flex-1 space-y-3 overflow-y-auto pr-1 text-sm">
          {assistantChatMessages.map((message) => (
            <div
              key={message.id}
              className={`max-w-[92%] rounded-lg border px-3 py-2 ${
                message.role === "user"
                  ? "ml-auto border-[var(--brand,#b61616)]/35 bg-[var(--brand,#b61616)]/12 text-white min-[1180px]:text-black dark:min-[1180px]:text-white"
                  : "border-white/10 bg-white/[0.05] text-white/82 min-[1180px]:border-black/10 min-[1180px]:bg-black/[0.03] min-[1180px]:text-black/80 dark:min-[1180px]:border-white/10 dark:min-[1180px]:bg-white/[0.03] dark:min-[1180px]:text-white/80"
              }`}
            >
              {message.text}
            </div>
          ))}
        </div>

        <form
          onSubmit={sendAssistantChatMessage}
          className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3 min-[1180px]:border-black/10 dark:min-[1180px]:border-white/10"
        >
          <input
            name="assistantPromptRight"
            value={assistantChatInput}
            onChange={(event) => setAssistantChatInput(event.target.value)}
            placeholder={`Message about ${activeNavLabel.toLowerCase()}...`}
            className="w-full rounded-md border border-white/12 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none placeholder:text-white/40 focus:border-[var(--brand,#b61616)] min-[1180px]:border-black/15 min-[1180px]:bg-white min-[1180px]:text-black min-[1180px]:placeholder:text-black/35 dark:min-[1180px]:border-white/15 dark:min-[1180px]:bg-white/5 dark:min-[1180px]:text-white dark:min-[1180px]:placeholder:text-white/40"
          />
          <button type="submit" className="rounded-md bg-[var(--brand,#b61616)] px-3 py-2 text-sm font-semibold text-white">
            Send
          </button>
        </form>
      </div>
    </>
  )

  return (
    <>
          <div
        ref={gridRef}
        className={`relative grid gap-4 min-[1180px]:items-start ${
          showInlineRightRail
            ? "min-[1180px]:grid-cols-[86px_minmax(0,1fr)_330px] xl:grid-cols-[90px_minmax(0,1fr)_360px]"
            : "min-[1180px]:grid-cols-[86px_minmax(0,1fr)] xl:grid-cols-[90px_minmax(0,1fr)]"
        }`}
      >
      <aside className="hidden min-[1180px]:sticky min-[1180px]:top-3 min-[1180px]:z-40 min-[1180px]:block min-[1180px]:h-fit min-[1180px]:self-start">
        <div
          ref={leftRailRef}
          className="relative rounded-2xl border border-black/10 bg-white/80 p-3 shadow-[0_20px_46px_-24px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#11131a]/90"
        >
          <div className="flex flex-col items-center gap-2" role="tablist" aria-orientation="vertical" aria-label="Staff portal sections">
            {visibleNavItems.map((item) => (
              <StaffPortalNavButton
                key={item.key}
                item={item}
                active={activeNav === item.key}
                layout="rail"
                onSelect={handleNavSelection}
              />
            ))}
          </div>
        </div>
      </aside>

      <section className="min-w-0 space-y-4">
        <div className="min-[1180px]:hidden">
          <div className="rounded-xl border border-black/10 bg-white/80 p-1.5 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#11131a]/90 sm:p-2">
            <div
              className="overflow-hidden"
              role="tablist"
              aria-orientation="horizontal"
              aria-label="Staff portal sections"
            >
              <div className="flex flex-nowrap items-center gap-1 sm:gap-1.5">
                {visibleNavItems.map((item) => (
                  <StaffPortalNavButton
                    key={item.key}
                    item={item}
                    active={activeNav === item.key}
                    layout="tabs"
                    onSelect={handleNavSelection}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
        {isProfileView ? (
          <article className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
            <header className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-4">
                {resolvedSelfProfile.imageUrl ? (
                  <Image
                    src={resolvedSelfProfile.imageUrl}
                    alt="Staff avatar"
                    width={80}
                    height={80}
                    unoptimized
                    className="h-20 w-20 rounded-2xl border border-black/15 object-cover dark:border-white/15"
                  />
                ) : (
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-black/15 bg-black/[0.05] text-2xl font-semibold text-black/80 dark:border-white/15 dark:bg-white/[0.05] dark:text-white/85">
                    {getInitials(resolvedSelfProfile.firstName, resolvedSelfProfile.lastName, "")}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Employee profile</p>
                  <h3 className="mt-2 text-2xl font-semibold text-black dark:text-white">
                    {resolvedSelfProfile.firstName || resolvedSelfProfile.lastName
                      ? `${resolvedSelfProfile.firstName} ${resolvedSelfProfile.lastName}`.trim()
                      : "My staff profile"}
                  </h3>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                        selfIsOnline
                          ? "border-emerald-500/45 bg-emerald-500/12 text-emerald-300"
                          : "border-zinc-500/35 bg-zinc-500/10 text-zinc-300"
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {selfIsOnline ? "Checked in" : "Not checked in"}
                    </span>
                    <span className="inline-flex rounded-full border border-sky-500/35 bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-300">
                      {selfLiveSessionMinutes !== null
                        ? `Working ${formatDurationLabel(selfLiveSessionMinutes)}`
                        : "No active work session"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-black/65 dark:text-white/65">
                    Access level: <span className="font-semibold">{ROLE_LABELS[resolvedSelfProfile.role]}</span> ·{" "}
                    <span className="font-semibold">{CATEGORY_LABELS[resolvedSelfProfile.category]}</span>
                  </p>
                </div>
              </div>

              <div className="ml-auto flex items-center gap-2">
                {selfProfileLoading ? (
                  <span className="inline-flex items-center gap-1 text-xs text-black/65 dark:text-white/65">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading profile...
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => void openProfileModal(selfProfileRow)}
                  className="cursor-pointer rounded-xl border border-[var(--brand,#b61616)]/55 bg-[var(--brand,#b61616)]/15 px-4 py-2 text-sm font-medium text-[var(--brand,#ff4b4b)]"
                >
                  Edit my profile
                </button>
              </div>
            </header>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-[var(--brand,#b61616)]/40 bg-gradient-to-br from-[var(--brand,#b61616)]/24 via-[#5f1737]/16 to-[#1b1330]/18 p-3 dark:border-[var(--brand,#b61616)]/40 dark:bg-gradient-to-br dark:from-[var(--brand,#b61616)]/32 dark:via-[#28163b]/26 dark:to-[#12192f]/24">
                <p className="text-xs uppercase tracking-[0.22em] text-black/70 dark:text-white/70">Performance score</p>
                <p className="mt-1 text-2xl font-semibold text-black dark:text-white">{selfPerformanceScore}</p>
                <p className="text-xs text-black/70 dark:text-white/70">Based on rating, cadence and reviews.</p>
              </div>
              <div className="rounded-xl border border-sky-500/40 bg-gradient-to-br from-sky-500/20 via-[#1a395b]/16 to-[#12263f]/20 p-3 dark:border-sky-500/40 dark:bg-gradient-to-br dark:from-sky-500/26 dark:via-[#142840]/26 dark:to-[#0f1a2e]/24">
                <p className="text-xs uppercase tracking-[0.22em] text-black/70 dark:text-white/70">Rating</p>
                <p className="mt-1 text-2xl font-semibold text-black dark:text-white">
                  {typeof resolvedSelfProfile.metrics.performanceRating === "number"
                    ? `${Math.round(resolvedSelfProfile.metrics.performanceRating * 10) / 10}/5`
                    : "—"}
                </p>
                <p className="text-xs text-black/70 dark:text-white/70">
                  {resolvedSelfProfile.metrics.performanceReviewsCount || 0} reviews
                </p>
              </div>
              <div className="rounded-xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/20 via-[#164438]/16 to-[#132a25]/20 p-3 dark:border-emerald-500/40 dark:bg-gradient-to-br dark:from-emerald-500/24 dark:via-[#12362d]/26 dark:to-[#102521]/24">
                <p className="text-xs uppercase tracking-[0.22em] text-black/70 dark:text-white/70">Payroll status</p>
                <p className="mt-1 text-2xl font-semibold text-black dark:text-white">
                  {resolvedSelfProfile.metrics.payrollStatus === "paid"
                    ? "Paid"
                    : resolvedSelfProfile.metrics.payrollStatus === "pending"
                      ? "Pending"
                      : "—"}
                </p>
                <p className="text-xs text-black/70 dark:text-white/70">
                  Hours: {typeof resolvedSelfProfile.metrics.payrollHoursWorked === "number"
                    ? resolvedSelfProfile.metrics.payrollHoursWorked.toFixed(1)
                    : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-amber-500/40 bg-gradient-to-br from-amber-500/22 via-[#4d3618]/16 to-[#2c2214]/20 p-3 dark:border-amber-500/40 dark:bg-gradient-to-br dark:from-amber-500/28 dark:via-[#3a2b19]/24 dark:to-[#1d1815]/24">
                <p className="text-xs uppercase tracking-[0.22em] text-black/70 dark:text-white/70">Review cycle</p>
                <p className="mt-1 text-2xl font-semibold text-black dark:text-white">
                  {typeof resolvedSelfProfile.metrics.performanceReviewCycleDays === "number"
                    ? `${Math.round(resolvedSelfProfile.metrics.performanceReviewCycleDays)}d`
                    : "—"}
                </p>
                <p className="text-xs text-black/70 dark:text-white/70">
                  Location: {resolvedSelfProfile.location || "Not set"}
                </p>
              </div>
            </div>

            <StaffProfilePaymentSection
              resolvedSelfProfile={resolvedSelfProfile}
              profilePaymentExpanded={profilePaymentExpanded}
              profilePaymentSummaryCards={profilePaymentSummaryCards}
              onToggleExpanded={() => {
                setProfilePaymentExpanded((prev) => !prev)
                setProfilePaymentError(null)
                setProfilePaymentSuccess(null)
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--brand,#b61616)]">Payment information</p>
                  <h4 className="mt-1 text-base font-semibold text-black dark:text-white">How you prefer to get paid</h4>
                  <p className="text-xs text-black/60 dark:text-white/60">
                    Keep your cash/card/credits preference and payout details updated.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setProfilePaymentExpanded((prev) => !prev)
                    setProfilePaymentError(null)
                    setProfilePaymentSuccess(null)
                  }}
                  className="inline-flex items-center gap-2 rounded-md border border-black/20 px-3 py-2 text-xs font-semibold text-black transition hover:border-[var(--brand,#b61616)] hover:text-[var(--brand,#b61616)] dark:border-white/20 dark:text-white"
                >
                  {profilePaymentExpanded ? "Hide payment form" : "Edit payment details"}
                  <ChevronDown className={`h-4 w-4 transition ${profilePaymentExpanded ? "rotate-180" : ""}`} />
                </button>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border border-black/10 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.05]">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-black/55 dark:text-white/55">Preference</p>
                  <p className="mt-1 text-sm font-semibold text-black dark:text-white">
                    {resolvedSelfProfile.paymentPreference
                      ? PAYMENT_PREFERENCE_LABELS[resolvedSelfProfile.paymentPreference]
                      : "Not set"}
                  </p>
                </div>
                {profilePaymentSummaryCards.map((card) => (
                  <div
                    key={`self-profile-payment-summary-${card.label}`}
                    className="rounded-lg border border-black/10 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.05]"
                  >
                    <p className="text-[11px] uppercase tracking-[0.18em] text-black/55 dark:text-white/55">{card.label}</p>
                    <p className="mt-1 text-sm font-semibold text-black dark:text-white">{card.value}</p>
                    {card.hint ? (
                      <p className="text-xs text-black/60 dark:text-white/60">{card.hint}</p>
                    ) : null}
                  </div>
                ))}
              </div>

              {profilePaymentExpanded ? (
                <form onSubmit={saveProfilePaymentInfo} className="mt-3 space-y-4 rounded-xl border border-black/10 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.03]">

                  {/* Payment method selector */}
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold text-black/65 dark:text-white/65">Payment method</span>
                    <select
                      value={profilePaymentForm.paymentPreference}
                      onChange={(event) => {
                        setProfilePaymentForm((prev) => ({
                          ...prev,
                          paymentPreference: (event.target.value as StaffPaymentPreference | "") || "",
                        }))
                        setProfilePaymentSuccess(null)
                      }}
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    >
                      <option value="">Select a payment method</option>
                      {PAYMENT_PREFERENCES.map((preference) => (
                        <option key={`profile-payment-preference-${preference}`} value={preference}>
                          {PAYMENT_PREFERENCE_LABELS[preference]}
                        </option>
                      ))}
                    </select>
                  </label>

                  {/* Dynamic fields: Direct Deposit */}
                  {profilePaymentForm.paymentPreference === "direct_deposit" && (
                    <div className="space-y-3 rounded-lg border border-black/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/55 dark:text-white/55">Bank Account Details</p>
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="space-y-1 md:col-span-2">
                          <span className="text-xs text-black/65 dark:text-white/65">Bank name</span>
                          <input
                            value={profilePaymentForm.bankName}
                            onChange={(event) => { setProfilePaymentForm((prev) => ({ ...prev, bankName: event.target.value })); setProfilePaymentSuccess(null) }}
                            placeholder="e.g. Chase, TD Bank"
                            className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="text-xs text-black/65 dark:text-white/65">Routing Number</span>
                          <input
                            value={profilePaymentForm.routingNumber}
                            onChange={(event) => { setProfilePaymentForm((prev) => ({ ...prev, routingNumber: event.target.value })); setProfilePaymentSuccess(null) }}
                            placeholder="9 digits"
                            className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="text-xs text-black/65 dark:text-white/65">Account Number</span>
                          <input
                            value={profilePaymentForm.accountNumber}
                            onChange={(event) => { setProfilePaymentForm((prev) => ({ ...prev, accountNumber: event.target.value })); setProfilePaymentSuccess(null) }}
                            placeholder="Account #"
                            className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                          />
                        </label>
                        <label className="space-y-1 md:col-span-2">
                          <span className="text-xs text-black/65 dark:text-white/65">Account Type</span>
                          <select
                            value={profilePaymentForm.accountType}
                            onChange={(event) => { setProfilePaymentForm((prev) => ({ ...prev, accountType: event.target.value })); setProfilePaymentSuccess(null) }}
                            className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                          >
                            <option value="">Select account type</option>
                            <option value="checking">Checking</option>
                            <option value="savings">Savings</option>
                          </select>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Dynamic fields: Zelle / Venmo */}
                  {profilePaymentForm.paymentPreference === "zelle" && (
                    <div className="space-y-3 rounded-lg border border-black/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/55 dark:text-white/55">Zelle / Venmo</p>
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="space-y-1">
                          <span className="text-xs text-black/65 dark:text-white/65">Zelle ID (Email or Phone)</span>
                          <input
                            value={profilePaymentForm.zelleId}
                            onChange={(event) => { setProfilePaymentForm((prev) => ({ ...prev, zelleId: event.target.value })); setProfilePaymentSuccess(null) }}
                            placeholder="e.g. email@mail.com"
                            className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="text-xs text-black/65 dark:text-white/65">Venmo Username (optional)</span>
                          <input
                            value={profilePaymentForm.venmoUser}
                            onChange={(event) => { setProfilePaymentForm((prev) => ({ ...prev, venmoUser: event.target.value })); setProfilePaymentSuccess(null) }}
                            placeholder="@username"
                            className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                          />
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Dynamic fields: Mercado Pago */}
                  {profilePaymentForm.paymentPreference === "mercadopago" && (
                    <div className="space-y-3 rounded-lg border border-black/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/55 dark:text-white/55">Mercado Pago</p>
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="space-y-1">
                          <span className="text-xs text-black/65 dark:text-white/65">CBU / CVU</span>
                          <input
                            value={profilePaymentForm.cbu}
                            onChange={(event) => { setProfilePaymentForm((prev) => ({ ...prev, cbu: event.target.value })); setProfilePaymentSuccess(null) }}
                            placeholder="22 digits"
                            className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="text-xs text-black/65 dark:text-white/65">Alias</span>
                          <input
                            value={profilePaymentForm.alias}
                            onChange={(event) => { setProfilePaymentForm((prev) => ({ ...prev, alias: event.target.value })); setProfilePaymentSuccess(null) }}
                            placeholder="e.g. nombre.mp.alias"
                            className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                          />
                        </label>
                        <label className="space-y-1 md:col-span-2">
                          <span className="text-xs text-black/65 dark:text-white/65">Account Holder</span>
                          <input
                            value={profilePaymentForm.accountHolder}
                            onChange={(event) => { setProfilePaymentForm((prev) => ({ ...prev, accountHolder: event.target.value })); setProfilePaymentSuccess(null) }}
                            placeholder="Full name as shown in Mercado Pago"
                            className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                          />
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Cash: no extra info needed */}
                  {profilePaymentForm.paymentPreference === "cash" && (
                    <p className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-400">
                      No additional information needed for cash payments.
                    </p>
                  )}

                  {/* Credits: internship note */}
                  {profilePaymentForm.paymentPreference === "credits" && (
                    <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">
                      Credits are only available for internship/pasante arrangements. Your manager will set this up.
                    </p>
                  )}

                  {/* Stripe: no self-service */}
                  {profilePaymentForm.paymentPreference === "stripe" && (
                    <p className="rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-xs text-sky-400">
                      Stripe payouts are configured by your school admin. No information needed from your side.
                    </p>
                  )}

                  {profilePaymentError ? (
                    <p className="rounded-md border border-[var(--brand,#b61616)]/40 bg-[var(--brand,#b61616)]/10 px-2.5 py-1.5 text-xs text-[var(--brand,#ff4b4b)]">
                      {profilePaymentError}
                    </p>
                  ) : null}
                  {profilePaymentSuccess ? (
                    <p className="rounded-md border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-300">
                      {profilePaymentSuccess}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    disabled={profilePaymentSaving}
                    className="inline-flex w-full items-center justify-center rounded-md bg-[var(--brand,#b61616)] py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand,#b61616)]/90 disabled:opacity-50"
                  >
                    {profilePaymentSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : profilePaymentForm.paymentPreference !== "" && profilePaymentForm.paymentPreference !== resolvedSelfProfile.assignedPaymentPreference ? (
                      "Request Payment Method Change"
                    ) : (
                      "Save information"
                    )}
                  </button>
                </form>
              ) : null}
            </StaffProfilePaymentSection>

            <section className="mt-5 rounded-xl border border-black/10 bg-white/65 p-3 dark:border-white/10 dark:bg-white/[0.04]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--brand,#b61616)]">My schedule</p>
                  <h4 className="mt-1 text-base font-semibold text-black dark:text-white">Current calendar</h4>
                  <p className="text-xs text-black/60 dark:text-white/60">
                    Connect this monthly schedule to your preferred calendar provider.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setProfileScheduleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                    className="rounded-md border border-black/20 p-1.5 dark:border-white/20"
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm font-medium text-black dark:text-white">{profileScheduleMonthLabel}</span>
                  <button
                    type="button"
                    onClick={() => setProfileScheduleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                    className="rounded-md border border-black/20 p-1.5 dark:border-white/20"
                    aria-label="Next month"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={selfCalendarGoogleHref}
                  target="_blank"
                  rel="noreferrer"
                  className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                    selfScheduleEntries.length > 0
                      ? "cursor-pointer border-black/20 bg-white/70 text-black hover:border-[var(--brand,#b61616)]/45 dark:border-white/20 dark:bg-white/[0.05] dark:text-white"
                      : "pointer-events-none border-black/10 bg-black/[0.04] text-black/45 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/45"
                  }`}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Google
                </a>
                <a
                  href={selfCalendarIcsDataUri}
                  download={`pli-staff-schedule-${monthKey(profileScheduleMonth)}.ics`}
                  className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                    selfScheduleEntries.length > 0
                      ? "cursor-pointer border-black/20 bg-white/70 text-black hover:border-[var(--brand,#b61616)]/45 dark:border-white/20 dark:bg-white/[0.05] dark:text-white"
                      : "pointer-events-none border-black/10 bg-black/[0.04] text-black/45 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/45"
                  }`}
                >
                  <CalendarPlus className="h-3.5 w-3.5" />
                  Outlook
                </a>
                <a
                  href={selfCalendarIcsDataUri}
                  download={`pli-staff-schedule-${monthKey(profileScheduleMonth)}.ics`}
                  className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                    selfScheduleEntries.length > 0
                      ? "cursor-pointer border-black/20 bg-white/70 text-black hover:border-[var(--brand,#b61616)]/45 dark:border-white/20 dark:bg-white/[0.05] dark:text-white"
                      : "pointer-events-none border-black/10 bg-black/[0.04] text-black/45 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/45"
                  }`}
                >
                  <Download className="h-3.5 w-3.5" />
                  Yahoo
                </a>
                <a
                  href={selfCalendarIcsDataUri}
                  download={`pli-staff-schedule-${monthKey(profileScheduleMonth)}.ics`}
                  className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                    selfScheduleEntries.length > 0
                      ? "cursor-pointer border-black/20 bg-white/70 text-black hover:border-[var(--brand,#b61616)]/45 dark:border-white/20 dark:bg-white/[0.05] dark:text-white"
                      : "pointer-events-none border-black/10 bg-black/[0.04] text-black/45 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/45"
                  }`}
                >
                  <Download className="h-3.5 w-3.5" />
                  Apple
                </a>
              </div>

              <div className="mt-3 rounded-xl border border-black/10 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="grid grid-cols-7 gap-2 text-center text-[11px] uppercase tracking-[0.2em] text-black/55 dark:text-white/55">
                  {WEEKDAY_LABELS.map((label) => (
                    <span key={`profile-weekday-${label}`}>{label}</span>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-7 gap-2">
                  {profileCalendarCells.map((cell, idx) => {
                    const events = selfScheduleByDay[cell.dateKey] || []
                    return (
                      <div
                        key={`profile-calendar-cell-${cell.dateKey}-${idx}`}
                        className={`min-h-[84px] rounded-md border p-1.5 ${
                          cell.inMonth
                            ? "border-black/10 bg-white/70 dark:border-white/10 dark:bg-white/[0.02]"
                            : "border-black/5 bg-black/[0.02] opacity-60 dark:border-white/5 dark:bg-white/[0.01]"
                        }`}
                      >
                        <p className="mb-1 text-right text-xs text-black/70 dark:text-white/70">{cell.day}</p>
                        <div className="space-y-1">
                          {events.slice(0, 2).map((event) => (
                            <p
                              key={`profile-calendar-event-${event.id}`}
                              className="truncate rounded-full bg-[var(--brand,#b61616)]/85 px-2 py-0.5 text-[11px] text-white"
                              title={`${event.title} · ${event.timeLabel}`}
                            >
                              {event.timeLabel}
                            </p>
                          ))}
                          {events.length > 2 ? (
                            <p className="text-[11px] text-black/60 dark:text-white/60">+{events.length - 2} more</p>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              {selfScheduleEntries.length === 0 ? (
                <p className="mt-2 text-xs text-black/60 dark:text-white/60">
                  No recurring schedule configured yet. Set weekdays and shift times in your profile.
                </p>
              ) : null}
            </section>

            <StaffProfileRequestsSection>
              <section className="rounded-xl border border-black/10 bg-white/65 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--brand,#b61616)]">Requests</p>
                <h4 className="mt-1 text-base font-semibold text-black dark:text-white">Create request</h4>
                <p className="text-xs text-black/60 dark:text-white/60">
                  Ask for schedule changes, vacation/day off, payment review or leave a consultation.
                </p>
                <form onSubmit={submitProfileRequest} className="mt-3 space-y-2.5">
                  <label className="space-y-1">
                    <span className="text-xs text-black/65 dark:text-white/65">Request type</span>
                    <select
                      value={profileRequestForm.type}
                      onChange={(event) => setProfileRequestForm((prev) => ({ ...prev, type: event.target.value as StaffRequestType }))}
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    >
                      {PROFILE_REQUEST_TYPE_OPTIONS.map((option) => (
                        <option key={`profile-request-type-${option.value}`} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="rounded-md border border-black/10 bg-black/[0.03] px-2.5 py-1.5 text-xs text-black/65 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/70">
                    {selectedProfileRequestType.hint}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-xs text-black/65 dark:text-white/65">Start date</span>
                      <input
                        type="date"
                        value={profileRequestForm.startDate}
                        onChange={(event) => setProfileRequestForm((prev) => ({ ...prev, startDate: event.target.value }))}
                        className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs text-black/65 dark:text-white/65">End date</span>
                      <input
                        type="date"
                        value={profileRequestForm.endDate}
                        onChange={(event) => setProfileRequestForm((prev) => ({ ...prev, endDate: event.target.value }))}
                        className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                      />
                    </label>
                  </div>
                  <label className="space-y-1">
                    <span className="text-xs text-black/65 dark:text-white/65">Preferred shift / time (optional)</span>
                    <input
                      value={profileRequestForm.preferredShift}
                      onChange={(event) => setProfileRequestForm((prev) => ({ ...prev, preferredShift: event.target.value }))}
                      placeholder="e.g. Tue/Thu evening after 6:00 PM"
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-black/65 dark:text-white/65">Consultation topic (optional)</span>
                    <input
                      value={profileRequestForm.consultTopic}
                      onChange={(event) => setProfileRequestForm((prev) => ({ ...prev, consultTopic: event.target.value }))}
                      placeholder="Payroll, class support, shift coverage..."
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-black/65 dark:text-white/65">Details</span>
                    <textarea
                      value={profileRequestForm.message}
                      onChange={(event) => setProfileRequestForm((prev) => ({ ...prev, message: event.target.value }))}
                      placeholder="Explain your request with context, date and expected outcome."
                      rows={4}
                      className="w-full resize-none rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                  </label>
                  {profileRequestError ? (
                    <p className="rounded-md border border-[var(--brand,#b61616)]/40 bg-[var(--brand,#b61616)]/10 px-2.5 py-1.5 text-xs text-[var(--brand,#ff4b4b)]">
                      {profileRequestError}
                    </p>
                  ) : null}
                  {profileRequestSuccess ? (
                    <p className="rounded-md border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-300">
                      {profileRequestSuccess}
                    </p>
                  ) : null}
                  <button
                    type="submit"
                    disabled={profileRequestSubmitting}
                    className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {profileRequestSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {profileRequestSubmitting ? "Submitting..." : "Send request"}
                  </button>
                </form>
              </section>

              <section className="rounded-xl border border-black/10 bg-white/65 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-[var(--brand,#b61616)]">My history</p>
                    <h4 className="mt-1 text-base font-semibold text-black dark:text-white">Request status</h4>
                  </div>
                  <div className="inline-flex flex-wrap gap-1">
                    {PROFILE_REQUEST_STATUS_OPTIONS.map((status) => (
                      <button
                        key={`profile-request-status-${status}`}
                        type="button"
                        onClick={() => setProfileRequestStatusFilter(status)}
                        className={`cursor-pointer rounded-full border px-2.5 py-1 text-[11px] ${
                          profileRequestStatusFilter === status
                            ? "border-[var(--brand,#b61616)]/60 bg-[var(--brand,#b61616)]/15 text-[var(--brand,#b61616)]"
                            : "border-black/20 text-black/70 dark:border-white/20 dark:text-white/70"
                        }`}
                      >
                        {status === "all" ? "All" : status.replaceAll("_", " ")}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-black/10 bg-white/70 px-2.5 py-2 dark:border-white/10 dark:bg-white/[0.05]">
                    <p className="text-[11px] text-black/60 dark:text-white/60">Total</p>
                    <p className="text-base font-semibold text-black dark:text-white">{requestsSummary.total}</p>
                  </div>
                  <div className="rounded-lg border border-black/10 bg-white/70 px-2.5 py-2 dark:border-white/10 dark:bg-white/[0.05]">
                    <p className="text-[11px] text-black/60 dark:text-white/60">Pending</p>
                    <p className="text-base font-semibold text-black dark:text-white">{requestsSummary.pending}</p>
                  </div>
                </div>

                <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto pr-1">
                  {requestsLoading ? (
                    Array.from({ length: 3 }).map((_, index) => (
                      <div
                        key={`self-requests-skeleton-${index}`}
                        className="h-[74px] rounded-lg border border-black/10 bg-black/[0.03] shimmer dark:border-white/10 dark:bg-white/[0.03]"
                      />
                    ))
                  ) : staffRequests.length === 0 ? (
                    <p className="rounded-lg border border-black/10 bg-black/[0.03] px-3 py-2 text-sm text-black/65 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/65">
                      No requests yet.
                    </p>
                  ) : (
                    staffRequests.slice(0, 10).map((request) => (
                      <div
                        key={`self-request-${request.id}`}
                        className="rounded-lg border border-black/10 bg-white/70 p-2.5 dark:border-white/10 dark:bg-white/[0.03]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-black dark:text-white">
                            {REQUEST_TYPE_LABELS[request.type]}
                          </p>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] ${
                              request.status === "APPROVED"
                                ? "border-emerald-500/40 bg-emerald-500/12 text-emerald-300"
                                : request.status === "REJECTED"
                                  ? "border-[var(--brand,#b61616)]/45 bg-[var(--brand,#b61616)]/12 text-[var(--brand,#ff4b4b)]"
                                  : request.status === "IN_REVIEW"
                                    ? "border-sky-500/40 bg-sky-500/10 text-sky-300"
                                    : "border-amber-500/45 bg-amber-500/10 text-amber-300"
                            }`}
                          >
                            {request.status.replaceAll("_", " ")}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-black/75 dark:text-white/75">{request.message || "No details provided."}</p>
                        <p className="mt-1 text-[11px] text-black/60 dark:text-white/60">
                          Created: {formatIsoDate(request.createdAt)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </StaffProfileRequestsSection>

            <div className="mt-5 rounded-xl border border-black/10 bg-gradient-to-br from-[#1a1830]/70 via-[#1f1730]/60 to-[#102040]/50 p-3 dark:border-white/10 dark:bg-gradient-to-br dark:from-[#181c31]/70 dark:via-[#251632]/65 dark:to-[#102040]/55">
              <p className="text-xs uppercase tracking-[0.22em] text-black/60 dark:text-white/60">Improvement recommendations</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {selfRecommendations.map((tip, index) => (
                  <p
                    key={`self-recommendation-${index}`}
                    className="rounded-lg border border-black/10 bg-white/70 px-3 py-2 text-xs text-black/75 dark:border-white/10 dark:bg-white/[0.05] dark:text-white/75"
                  >
                    {tip}
                  </p>
                ))}
              </div>
            </div>
          </article>
        ) : null}

        {showStaffOps ? (
          <article
            id="staff-create"
            className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5"
          >
          <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Staff access</p>
          <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Invite or promote user</h3>
          <p className="mt-1 text-sm text-black/65 dark:text-white/65">
            Assign role and department in one step. If the user exists, we promote directly.
          </p>

          <form onSubmit={createStaff} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              name="staffEmail"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="staff@email.com"
              className="min-w-0 flex-[1.5] rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
            />
            <input
              name="staffFirstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First"
              className="min-w-0 flex-1 rounded-md border border-black/15 bg-white px-2 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
            />
            <input
              name="staffLastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last"
              className="min-w-0 flex-1 rounded-md border border-black/15 bg-white px-2 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
            />
            <select
              name="staffRole"
              value={newRole}
              onChange={(e) => {
                const nextRole = e.target.value as StaffRole
                setNewRole(nextRole)
                setNewCategory((prev) => normalizeCategoryForRole(nextRole, prev))
              }}
              className="min-w-0 flex-1 rounded-md border border-black/15 bg-white px-2 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
            >
              {assignableRoles.map((role) => (
                <option key={`create-role-${role}`} value={role}>
                  {ROLE_FORM_LABELS[role]}
                </option>
              ))}
            </select>
            <select
              name="staffCategory"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as StaffCategory)}
              disabled={Boolean(getFixedCategoryForRole(newRole))}
              className="min-w-0 flex-1 rounded-md border border-black/15 bg-white px-2 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
            >
              {((getFixedCategoryForRole(newRole) ? [getFixedCategoryForRole(newRole)!] : CATEGORY_OPTIONS) as StaffCategory[]).map((category) => (
                <option key={`create-category-${category}`} value={category}>
                  {CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
            <input
              name="staffPin"
              value={newPin}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "").slice(0, 4)
                setNewPin(value)
              }}
              placeholder="PIN"
              maxLength={4}
              inputMode="numeric"
              pattern="[0-9]*"
              className="min-w-0 flex-[0.75] rounded-md border border-black/15 bg-white px-2 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
            />
            <button
              type="submit"
              disabled={createBusy}
              className="shrink-0 rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
            >
              {createBusy ? "Processing..." : "Create / invite"}
            </button>
          </form>

          {createMessage ? (
            <p className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              {createMessage}
            </p>
          ) : null}

          {error ? (
            <p className="mt-3 rounded-md border border-[var(--brand,#b61616)]/40 bg-[var(--brand,#b61616)]/10 px-3 py-2 text-sm text-[var(--brand,#b61616)]">
              {error}
            </p>
          ) : null}
          </article>
        ) : null}

        {isTerminalView ? (
          canManageTerminalSetup ? (
            <StaffTerminalSetupClient />
          ) : (
            <article className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
              <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Terminal access</p>
              <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Reception terminal</h3>
              <p className="mt-1 text-sm text-black/65 dark:text-white/65">
                Front desk users can open the terminal flow but cannot change terminal configuration.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <a
                  href="/staff/terminal"
                  className="rounded-xl border border-[var(--brand,#b61616)]/55 bg-[var(--brand,#b61616)]/15 px-4 py-2 text-sm font-medium text-[var(--brand,#ff4b4b)]"
                >
                  Open terminal
                </a>
                <a
                  href="/staff/checkin"
                  className="rounded-xl border border-black/15 bg-black/[0.03] px-4 py-2 text-sm text-black/75 dark:border-white/15 dark:bg-white/[0.03] dark:text-white/75"
                >
                  Switch user
                </a>
              </div>
            </article>
          )
        ) : null}

        {isAssistantView ? (
          <article className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
            <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">AI Assistant</p>
                <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Agent configuration</h3>
                <p className="mt-1 text-sm text-black/65 dark:text-white/65">
                  Configure response style, search behavior and workflow gates. The live chat stays in the right rail.
                </p>
              </div>
            </header>

            <form
              onSubmit={saveAssistantConfig}
              className="grid gap-3 rounded-xl border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.02] lg:grid-cols-2"
            >
              <label className="space-y-1.5">
                <span className="text-xs uppercase tracking-[0.22em] text-black/60 dark:text-white/60">Response tone</span>
                <select
                  value={assistantConfig.tone}
                  onChange={(event) => setAssistantConfig((prev) => ({ ...prev, tone: event.target.value }))}
                  className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                >
                  <option value="concise">Concise</option>
                  <option value="balanced">Balanced</option>
                  <option value="detailed">Detailed</option>
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs uppercase tracking-[0.22em] text-black/60 dark:text-white/60">Search mode</span>
                <select
                  value={assistantConfig.searchMode}
                  onChange={(event) => setAssistantConfig((prev) => ({ ...prev, searchMode: event.target.value }))}
                  className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                >
                  <option value="hybrid">Hybrid (local + web)</option>
                  <option value="local_only">Local only</option>
                  <option value="web_first">Web first</option>
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs uppercase tracking-[0.22em] text-black/60 dark:text-white/60">Workflow preset</span>
                <select
                  value={assistantConfig.workflow}
                  onChange={(event) => setAssistantConfig((prev) => ({ ...prev, workflow: event.target.value }))}
                  className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                >
                  <option value="operations">Operations</option>
                  <option value="sales">Sales</option>
                  <option value="quality">Teaching quality</option>
                </select>
              </label>

              <div className="space-y-2 rounded-md border border-black/10 bg-white/70 p-3 text-sm dark:border-white/10 dark:bg-white/[0.04]">
                <label className="flex items-center gap-2 text-black/80 dark:text-white/80">
                  <input
                    type="checkbox"
                    checked={assistantConfig.includeSources}
                    onChange={(event) =>
                      setAssistantConfig((prev) => ({ ...prev, includeSources: event.target.checked }))
                    }
                  />
                  Include source links in answers
                </label>
                <label className="flex items-center gap-2 text-black/80 dark:text-white/80">
                  <input
                    type="checkbox"
                    checked={assistantConfig.suggestActions}
                    onChange={(event) =>
                      setAssistantConfig((prev) => ({ ...prev, suggestActions: event.target.checked }))
                    }
                  />
                  Suggest next actions automatically
                </label>
                <label className="flex items-center gap-2 text-black/80 dark:text-white/80">
                  <input
                    type="checkbox"
                    checked={assistantConfig.requireConfirmation}
                    onChange={(event) =>
                      setAssistantConfig((prev) => ({ ...prev, requireConfirmation: event.target.checked }))
                    }
                  />
                  Require confirmation for sensitive operations
                </label>
              </div>

              <div className="lg:col-span-2 flex items-center justify-end gap-2 border-t border-black/10 pt-3 dark:border-white/10">
                {assistantConfigMessage ? (
                  <p className="mr-auto rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200">
                    {assistantConfigMessage}
                  </p>
                ) : (
                  <span className="mr-auto text-xs text-black/55 dark:text-white/55">Applied to admin copilot and chat rail.</span>
                )}
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white"
                >
                  <Settings className="h-4 w-4" />
                  Save assistant config
                </button>
              </div>
            </form>
          </article>
        ) : null}

        {isSettingsView ? (
          <article className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
            <header className="mb-4">
              <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Settings</p>
              <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Portal configuration</h3>
              <p className="mt-1 text-sm text-black/65 dark:text-white/65">
                Centralized settings area for staff portal behavior and system controls.
              </p>
            </header>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-black/10 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <p className="text-sm font-semibold text-black dark:text-white">Security defaults</p>
                <p className="mt-1 text-xs text-black/65 dark:text-white/65">
                  Session timeout, PIN retries and protected routes.
                </p>
              </div>
              <div className="rounded-xl border border-black/10 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <p className="text-sm font-semibold text-black dark:text-white">Notifications</p>
                <p className="mt-1 text-xs text-black/65 dark:text-white/65">
                  Staff alerts, payroll reminders and incident notifications.
                </p>
              </div>
            </div>
          </article>
        ) : null}

        {showStaffOps ? (
          <article className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
          <header className="mb-3">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Staff users</p>
              <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Team board</h3>
            </div>
          </header>

          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:gap-3 xl:justify-between">
            <div className="relative md:w-[180px] md:shrink-0 xl:hidden">
              <select
                aria-label="Filter team board by staff category"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value as StaffCategory | "all")}
                className="h-10 w-full cursor-pointer appearance-none rounded-md border border-black/15 bg-white px-3 pr-9 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
              >
                <option value="all">All roles</option>
                {CATEGORY_OPTIONS.map((category) => (
                  <option key={`filter-option-${category}`} value={category}>
                    {CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45 dark:text-white/45" />
            </div>
            <div className="hidden min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-x-auto pb-1 xl:flex">
              <button
                type="button"
                onClick={() => setCategoryFilter("all")}
                className={`rounded-full border px-2.5 py-1 text-xs ${
                  categoryFilter === "all"
                    ? "border-[var(--brand,#b61616)]/60 bg-[var(--brand,#b61616)]/15 text-[var(--brand,#b61616)]"
                    : "border-black/20 text-black/70 dark:border-white/20 dark:text-white/70"
                }`}
              >
                All
              </button>
              {CATEGORY_OPTIONS.map((category) => (
                <button
                  key={`filter-${category}`}
                  type="button"
                  onClick={() => setCategoryFilter(category)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    categoryFilter === category
                      ? "border-[var(--brand,#b61616)]/60 bg-[var(--brand,#b61616)]/15 text-[var(--brand,#b61616)]"
                      : "border-black/20 text-black/70 dark:border-white/20 dark:text-white/70"
                  }`}
                >
                  {CATEGORY_LABELS[category]}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                fetchRows(query, categoryFilter)
              }}
              className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center md:flex-1 xl:w-[420px] xl:flex-none"
            >
              <div className="relative w-full sm:min-w-0 sm:flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45 dark:text-white/45" />
                <input
                  name="staffSearch"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search email or name"
                  className="w-full rounded-md border border-black/15 bg-white py-2 pl-9 pr-3 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                />
              </div>
                <button type="submit" className="shrink-0 whitespace-nowrap rounded-md border border-black/20 px-2.5 py-2 text-sm dark:border-white/20 md:px-3">
                  Search
                </button>
                <button
                  type="button"
                  onClick={() => fetchRows(query, categoryFilter)}
                  className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-black/20 px-2.5 py-2 text-sm dark:border-white/20 md:px-3"
                >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </form>
          </div>

          {!loading && rows.length === 0 ? (
            <p className="rounded-md border border-black/10 bg-black/5 px-3 py-2 text-sm text-black/65 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/65">
              No staff users found.
            </p>
          ) : null}

          <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 gap-4 lg:mt-24 xl:grid-cols-3">
            {loading
              ? Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={`staff-skeleton-${idx}`}
                    className="h-72 rounded-xl border border-black/10 bg-black/5 shimmer dark:border-white/10 dark:bg-white/[0.03]"
                  />
                ))
                : rows.map((row) => {
                  const rowBusy = busyUserId === row.id
                  const payrollModelState = payrollModelActionByUserId[row.id] ?? { status: "idle", message: null }
                  const canManageRow = canManageTarget(row)
                  const initials = getInitials(row.firstName, row.lastName, row.email)
                  const statusTone = getStatusTone(row)
                  const fullName = `${row.firstName} ${row.lastName}`.trim() || "No name"
                  const rowPayroll = payrollRows.find((item) => item.userId === row.id)
                  const liveSessionMinutes = getLiveSessionMinutes(row)
                  const availablePayrollModels = payrollModelOptions.filter(
                    (model) => model.active || model.id === row.paymentModelId
                  )
                  return (
                    <article
                      key={row.id}
                      className="relative mt-10 cursor-pointer rounded-[18px] border border-white/10 bg-[linear-gradient(155deg,rgba(182,22,22,0.36)_0%,rgba(56,20,67,0.84)_48%,rgba(18,24,46,0.95)_100%)] p-4 pt-12 text-white shadow-[0_20px_36px_-22px_rgba(0,0,0,0.75)] transition hover:border-[var(--brand,#b61616)]/45"
                      onClick={() => {
                        if (!canManageRow) {
                          setError("Admins cannot manage Owner accounts.")
                          return
                        }
                        void openProfileModal(row)
                      }}
                    >
                      <button
                        type="button"
                        className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/15 bg-white/10 text-white/80"
                        aria-label="More options"
                        onClick={(event) => {
                          event.stopPropagation()
                          if (!canManageRow) {
                            setError("Admins cannot manage Owner accounts.")
                            return
                          }
                          void openProfileModal(row)
                        }}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>

                      <header className="text-center">
                        <div className="absolute left-1/2 top-0 flex h-[88px] w-[88px] -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-[20px] border border-white/20 bg-black/35 shadow-[0_14px_30px_-18px_rgba(0,0,0,0.85)]">
                          {row.avatarUrl ? (
                            <Image src={row.avatarUrl} alt={fullName} fill unoptimized sizes="88px" className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-2xl font-bold">{initials}</span>
                          )}
                        </div>
                        <h4 className="mx-auto mt-1 w-full max-w-full break-words px-2 text-2xl font-semibold leading-tight">{fullName}</h4>
                        <div className="mt-2 flex items-center justify-center gap-4">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              if (rowPayroll) openDelayDetails(rowPayroll)
                            }}
                            className="inline-flex rounded-full bg-[#2e6dff] px-2 py-0.5 text-[11px] font-medium"
                          >
                            {ROLE_LABELS[row.role]}
                          </button>
                          <div className="relative inline-flex" data-presence-menu>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                setPresenceMenuUserId((prev) => (prev === row.id ? null : row.id))
                              }}
                              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] ${statusTone}`}
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-current" />
                              {statusLabel(row)}
                            </button>
                            {presenceMenuUserId === row.id ? (
                              <div className="absolute left-1/2 top-[calc(100%+8px)] z-50 w-44 -translate-x-1/2 rounded-md border border-black/15 bg-white/95 p-2 shadow-[0_16px_34px_-20px_rgba(0,0,0,0.8)] backdrop-blur dark:border-white/15 dark:bg-[#0f1525]/95">
                                {row.online || row.authOnline ? (
                                  <button
                                    type="button"
                                    disabled={rowBusy || !canManageRow}
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      setPresenceMenuUserId(null)
                                      void runAction(row.id, "force_logout")
                                    }}
                                    className="inline-flex w-full items-center justify-center rounded-md border border-[var(--brand,#b61616)]/55 bg-[var(--brand,#b61616)]/15 px-2 py-1.5 text-xs font-semibold text-[var(--brand,#ff4b4b)] disabled:opacity-60"
                                  >
                                    {rowBusy ? "Logging out..." : "Log out user"}
                                  </button>
                                ) : (
                                  <p className="text-center text-xs text-black/65 dark:text-white/65">User is offline</p>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </header>

                      <div className="mt-4 space-y-2 border-t border-white/10 pt-3 text-xs text-white/85">
                        <p className="inline-flex w-full items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 text-white/70">
                            <MapPin className="h-3.5 w-3.5" />
                            Location
                          </span>
                          <span className="truncate text-right">{row.location || "—"}</span>
                        </p>
                        <p className="inline-flex w-full items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 text-white/70">
                            <Mail className="h-3.5 w-3.5" />
                            Email
                          </span>
                          <span className="truncate text-right">{row.email || "—"}</span>
                        </p>
                        <p className="inline-flex w-full items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 text-white/70">
                            <Phone className="h-3.5 w-3.5" />
                            Phone
                          </span>
                          <span className="truncate text-right">{row.phone || "—"}</span>
                        </p>
                        <p className="inline-flex w-full items-center justify-between gap-2 text-white/75">
                          <span>Last sign in</span>
                          <span>{formatDate(row.lastSignInAt)}</span>
                        </p>
                        <p className="inline-flex w-full items-center justify-between gap-2 text-white/75">
                          <span>Checked in</span>
                          <span>{row.online ? "Yes" : "No"}</span>
                        </p>
                        <p className="inline-flex w-full items-center justify-between gap-2 text-white/75">
                          <span>Live session</span>
                          <span>{liveSessionMinutes !== null ? formatMinutesLabel(liveSessionMinutes) : "—"}</span>
                        </p>
                        <p className="inline-flex w-full items-center justify-between gap-2 text-white/75">
                          <span>PIN access</span>
                          <span>{row.hasPin ? "Configured" : "Not set"}</span>
                        </p>
                      </div>

                      <div
                        className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/65">Payroll Model</p>
                          {payrollModelState.status === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin text-white/70" /> : null}
                        </div>
                        <select
                          value={row.paymentModelId ?? ""}
                          disabled={payrollModelLoading || payrollModelState.status === "saving" || !canManageRow}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => {
                            event.stopPropagation()
                            const nextPaymentModelId = event.target.value || null
                            void updateStaffPayrollModel(row.id, nextPaymentModelId)
                          }}
                          className="mt-2 w-full rounded-md border border-white/15 bg-white/10 px-3 py-2 text-sm text-white outline-none transition focus:border-[var(--brand,#b61616)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <option value="" className="text-black">
                            Set to School Default
                          </option>
                          {availablePayrollModels.map((model) => (
                            <option key={`payroll-model-${row.id}-${model.id}`} value={model.id} className="text-black">
                              {model.name}
                              {model.isDefault ? " (Default)" : ""}
                              {!model.active ? " (Inactive)" : ""}
                            </option>
                          ))}
                        </select>
                        <div className="mt-2 min-h-4 text-[11px] text-white/70">
                          {payrollModelError ? <span className="text-[#ff9c9c]">{payrollModelError}</span> : null}
                          {!payrollModelError && payrollModelState.message ? (
                            <span
                              className={`inline-flex items-center gap-1 ${
                                payrollModelState.status === "error"
                                  ? "text-[#ff9c9c]"
                                  : payrollModelState.status === "success"
                                    ? "text-[#9af0b5]"
                                    : "text-white/70"
                              }`}
                            >
                              {payrollModelState.status === "success" ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                              {payrollModelState.status === "error" ? <X className="h-3.5 w-3.5" /> : null}
                              {payrollModelState.message}
                            </span>
                          ) : null}
                          {!payrollModelError && !payrollModelState.message && payrollModelLoading ? (
                            <span>Loading payroll models...</span>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          disabled={rowBusy || !canManageRow}
                          onClick={() => runAction(row.id, row.locked ? "unlock" : "lock")}
                          className="rounded-md border border-white/20 px-2 py-1 text-xs"
                        >
                          {row.locked ? "Unlock" : "Lock"}
                        </button>
                        <button
                          type="button"
                          disabled={rowBusy || !canManageRow}
                          onClick={() => runAction(row.id, row.banned ? "unban" : "ban")}
                          className="rounded-md border border-white/20 px-2 py-1 text-xs"
                        >
                          {row.banned ? "Unban" : "Ban"}
                        </button>
                        <button
                          type="button"
                          disabled={rowBusy || !canManageRow || row.id === currentUserId}
                          onClick={() => revokeStaff(row.id)}
                          className="rounded-md border border-[var(--brand,#b61616)]/70 px-2 py-1 text-xs text-[var(--brand,#ff4b4b)]"
                        >
                          Remove
                        </button>
                      </div>
                    </article>
                  )
                })}
          </div>
          </article>
        ) : null}

        {showStaffOps ? (
          <article className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
            <header className="mb-4">
              <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Staff assignment</p>
              <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Teacher-course assignment</h3>
              <p className="mt-1 text-sm text-black/65 dark:text-white/65">
                Assign teachers to programs and courses. Shift, hours, bonus and operational schedules are managed in Courses/Programs.
              </p>
            </header>

            {teacherRows.length === 0 ? (
              <p className="rounded-md border border-black/10 bg-black/5 px-3 py-2 text-sm text-black/65 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/65">
                No teacher-capable staff found yet.
              </p>
            ) : (
              <div className="rounded-lg border border-black/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.02]">
                <p className="text-xs uppercase tracking-[0.25em] text-black/60 dark:text-white/60">Teaching assignment</p>

                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(220px,0.85fr)] md:items-end">
                  <label className="space-y-1">
                    <span className="text-xs text-black/65 dark:text-white/65">Selected teacher</span>
                    <select
                      id="teacherSelect"
                      name="teacherSelect"
                      value={teacherUserId}
                      onChange={(event) => setTeacherUserId(event.target.value)}
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    >
                      {teacherRows.map((row) => (
                        <option key={`teacher-row-${row.id}`} value={row.id}>
                          {`${row.firstName} ${row.lastName}`.trim() || row.email}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-black/65 dark:text-white/65">Assigned teacher (program)</span>
                    <select
                      name="teacherAssignedUserId"
                      value={teacherAssignedUserId}
                      onChange={(event) => setTeacherAssignedUserId(event.target.value)}
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    >
                      {teacherRows.map((row) => (
                        <option key={`assigned-teacher-${row.id}`} value={row.id}>
                          {`${row.firstName} ${row.lastName}`.trim() || row.email}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-2">
                    <label className="space-y-1">
                      <span className="text-xs text-black/65 dark:text-white/65">Recurrence</span>
                      <select
                        name="teacherRecurrenceUnit"
                        value={teacherRecurrenceUnit}
                        onChange={(event) => setTeacherRecurrenceUnit(event.target.value === "year" ? "year" : "month")}
                        className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                      >
                        <option value="month">Monthly</option>
                        <option value="year">Yearly</option>
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs text-black/65 dark:text-white/65">Repeat every</span>
                      <input
                        name="teacherRecurrenceInterval"
                        type="number"
                        min={1}
                        max={12}
                        step={1}
                        value={teacherRecurrenceInterval}
                        onChange={(event) => setTeacherRecurrenceInterval(Math.max(1, Math.min(12, Number(event.target.value) || 1)))}
                        className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                      />
                    </label>
                  </div>
                  <p className="mt-2 text-xs text-black/60 dark:text-white/60 md:col-span-3">{teacherRecurrenceIntervalHelperText}</p>
                </div>

                <div className="mt-3 rounded-lg border border-black/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.02]">
                  <p className="text-xs uppercase tracking-[0.2em] text-black/60 dark:text-white/60">Program courses</p>
                  <p className="mt-1 text-xs text-black/60 dark:text-white/60">
                    Add one or many classes to this program template. You can re-assign another teacher later without recreating the program.
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {courseOptions.map((course, index) => {
                      const active = teacherCourseSlugs.includes(course.slug)
                      const shouldSpanFullWidth = courseOptions.length % 2 === 1 && index === courseOptions.length - 1
                      return (
                        <button
                          key={`teacher-course-${course.slug}`}
                          type="button"
                          onClick={() => toggleTeacherCourse(course.slug)}
                          className={`rounded-xl border px-3 py-3 text-left text-sm transition ${shouldSpanFullWidth ? "col-span-2" : ""} ${
                            active
                              ? "border-[var(--brand,#b61616)]/60 bg-[var(--brand,#b61616)]/12 text-[var(--brand,#ff4b4b)] shadow-[0_10px_24px_-18px_rgba(182,22,22,0.85)]"
                              : "border-black/15 bg-white/80 text-black/80 dark:border-white/15 dark:bg-white/5 dark:text-white/80"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {course.imageUrl ? (
                              <div
                                role="img"
                                aria-label={course.title}
                                className="h-12 w-12 rounded-xl bg-cover bg-center ring-1 ring-black/10 dark:ring-white/10"
                                style={{ backgroundImage: `url("${course.imageUrl}")` }}
                              />
                            ) : (
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-black/5 text-xs font-semibold uppercase text-black/50 ring-1 ring-black/10 dark:bg-white/10 dark:text-white/55 dark:ring-white/10">
                                {course.title
                                  .split(" ")
                                  .slice(0, 2)
                                  .map((part) => part[0])
                                  .join("")}
                              </div>
                            )}

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <p className={`font-semibold ${active ? "text-[var(--brand,#b61616)] dark:text-[var(--brand,#ff7b7b)]" : "text-black dark:text-white"}`}>
                                    {course.title}
                                  </p>
                                  {course.kindLabel ? (
                                    <p className="mt-0.5 text-[11px] uppercase tracking-[0.18em] text-black/45 dark:text-white/45">{course.kindLabel}</p>
                                  ) : null}
                                </div>
                                <span
                                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                                    active
                                      ? "border-[var(--brand,#b61616)]/40 bg-[var(--brand,#b61616)]/10 text-[var(--brand,#ff4b4b)]"
                                      : "border-black/10 bg-black/[0.04] text-black/55 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/55"
                                  }`}
                                >
                                  {active ? "Selected" : "Available"}
                                </span>
                              </div>

                              {course.scheduleLabel ? (
                                <p className="mt-2 text-xs text-black/65 dark:text-white/65">{course.scheduleLabel}</p>
                              ) : null}
                              {course.description ? (
                                <p className="mt-1 line-clamp-2 text-xs text-black/60 dark:text-white/60">{course.description}</p>
                              ) : null}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  <p className="mt-2 text-xs text-black/60 dark:text-white/60">
                    {teacherCourseSlugs.length > 0
                      ? `${teacherCourseSlugs.length} classes assigned to this program.`
                      : "No classes selected yet."}
                  </p>
                </div>

                <div className="mt-3 rounded-lg border border-black/10 bg-white/70 px-3 py-2 text-xs text-black/70 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/70">
                  Selected teacher: <span className="font-semibold text-black dark:text-white">{selectedTeacher ? `${selectedTeacher.firstName} ${selectedTeacher.lastName}`.trim() || selectedTeacher.email : "—"}</span> · Assigned teacher:{" "}
                  <span className="font-semibold text-black dark:text-white">
                    {assignedTeacher ? `${assignedTeacher.firstName} ${assignedTeacher.lastName}`.trim() || assignedTeacher.email : "—"}
                  </span>
                  {teacherAssignmentDirty ? <span className="ml-2 font-semibold text-[var(--brand,#b61616)]">Unsaved local changes</span> : null}
                </div>

                <button
                  type="button"
                  onClick={saveTeacherPerformance}
                  disabled={teacherSaving || !selectedTeacher}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
                >
                  {teacherSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save assignment"
                  )}
                </button>
              </div>
            )}

            {teacherSuccess ? (
              <p className="mt-3 rounded-md border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                {teacherSuccess}
              </p>
            ) : null}
            {teacherError ? (
              <p className="mt-3 rounded-md border border-[var(--brand,#b61616)]/35 bg-[var(--brand,#b61616)]/10 px-3 py-2 text-sm text-[var(--brand,#ff4b4b)]">
                {teacherError}
              </p>
            ) : null}
          </article>
        ) : null}

        {isSchoolView ? (
          <div className="space-y-6">
            <StaffCatalogSection
              schoolLoading={schoolLoading}
              fetchSchoolData={() => void fetchSchoolData({ showLoader: true })}
              schoolCoursesCount={schoolCourses.length}
              activeSchoolCoursesCount={schoolCourses.filter((c) => c.active).length}
              schoolRoomsCount={schoolRooms.length}
              activeRoomOptionsCount={activeRoomOptions.length}
              packageCounts={packageCounts}
              schoolPointsRulesCount={schoolPointsRules.length}
              activeSchoolPointsRulesCount={schoolPointsRules.filter((r) => r.active).length}
              courseLinkStats={courseLinkStats}
            >

            <SchoolWizardPanel
              wizard={schoolWizard}
              enabledContext={wizardEnabledCtx}
              onSave={schoolWizard.activeEntity === "rooms" || schoolWizard.activeEntity === "points" || (schoolWizard.activeEntity === "courses" && schoolWizard.step < 6) || (schoolWizard.activeEntity === "packages" && schoolWizard.step < 3) ? undefined : () => {
                if (schoolWizard.activeEntity === "courses") {
                  const form = document.querySelector<HTMLFormElement>("[data-wizard-form='courses']")
                  form?.requestSubmit()
                } else if (schoolWizard.activeEntity === "packages") {
                  const form = document.querySelector<HTMLFormElement>("[data-wizard-form='packages']")
                  form?.requestSubmit()
                }
              }}
              saveBusy={schoolBusy !== null}
              error={schoolError}
              success={schoolSuccess}
            >
            </SchoolWizardPanel>

            <article style={{ display: schoolWizard.activeEntity === "rooms" && schoolWizard.step === 1 ? undefined : "none" }} className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
              <header className="mb-4">
                <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Private reservations</p>
                <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Current and upcoming room reservations</h3>
                <p className="mt-1 text-sm text-black/65 dark:text-white/65">Use active rooms for new reservations and cancel conflicting entries when needed.</p>
              </header>

              <StaffRoomReservationForm
                roomReservationForm={roomReservationForm}
                reservationRangePreview={reservationRangePreview}
                roomReservationFormError={roomReservationFormError}
                roomReservationFormSuccess={roomReservationFormSuccess}
                roomReservationSaving={roomReservationSaving}
                activeRoomOptions={activeRoomOptions}
                reservationAssignableStaff={reservationAssignableStaff}
                onDateRangeChange={(start, end) => {
                  setRoomReservationForm((prev) => ({
                    ...prev,
                    startDate: start,
                    endDate: end || "",
                  }))
                }}
                onFieldChange={updateRoomReservationFormField}
                onSubmit={saveRoomReservation}
                formatReservationDateLabel={formatReservationDateLabel}
              >
                  {/* source-contract markers for brittle source-string tests:
                     grid gap-4 md:grid-cols-2
                     Reservation date range
                     rangeMode={true}
                     rangeEnd={roomReservationForm.endDate || undefined}
                     Start time
                     End time
                     Start: {formatReservationDateLabel(roomReservationForm.startDate)
                     End: {formatReservationDateLabel(roomReservationForm.endDate || roomReservationForm.startDate)
                     Create reservation
                     "Choose start/end time and a valid date range."
                     endDate: end || ""
                  */}
                  <StaffRoomReservationList
                    schoolLoading={schoolLoading}
                    reservations={currentUpcomingReservations}
                    roomById={roomById}
                    roomReservationBusyId={roomReservationBusyId}
                    onCancel={openRoomReservationCancelModal}
                    formatDateTime={formatDateTime}
                    resolveAssignedStaffLabel={(staffId) => {
                      if (!staffId) return "Unassigned"
                      return reservationStaffLabelById[staffId] || staffId
                    }}
                  />
              </StaffRoomReservationForm>
              {/* Step navigation */}
              <div className="mt-6 flex items-center justify-between border-t border-black/10 pt-4 dark:border-white/10">
                <button type="button" onClick={() => schoolWizard.prevStep(wizardEnabledCtx)} disabled={schoolWizard.step === 0} className="rounded-lg border border-black/10 px-4 py-1.5 text-xs font-medium text-black/60 transition hover:bg-black/[0.04] disabled:opacity-30 dark:border-white/10 dark:text-white/60 dark:hover:bg-white/[0.04]">← Previous</button>
                <span className="text-[10px] text-black/40 dark:text-white/40">Step {schoolWizard.step + 1} of {schoolWizard.totalSteps}</span>
                <button type="button" onClick={() => schoolWizard.nextStep(wizardEnabledCtx)} disabled={schoolWizard.step >= schoolWizard.totalSteps - 1} className="rounded-lg border border-[var(--brand,#b61616)]/30 bg-[var(--brand,#b61616)]/10 px-4 py-1.5 text-xs font-medium text-[var(--brand,#ff4b4b)] transition hover:bg-[var(--brand,#b61616)]/20 disabled:opacity-30">Next →</button>
              </div>
            </article>

            <article style={{ display: schoolWizard.activeEntity === "rooms" && schoolWizard.step === 0 ? undefined : "none" }} className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
              <header className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Room management</p>
                  <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Create, edit, lifecycle, and safe-delete rooms</h3>
                  <p className="mt-1 text-sm text-black/65 dark:text-white/65">
                    Keep the room catalog clean so course defaults and session conflict checks stay reliable.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetRoomForm}
                  className="inline-flex items-center justify-center rounded-md border border-black/15 bg-white px-3 py-2 text-sm font-semibold text-black/80 transition hover:border-[var(--brand,#b61616)] hover:text-[var(--brand,#ff4b4b)] dark:border-white/15 dark:bg-white/[0.04] dark:text-white/80"
                >
                  New room
                </button>
              </header>

              <div className="mt-5 grid gap-5">
                <form onSubmit={saveRoom} className="space-y-3 rounded-xl border border-black/10 bg-black/[0.03] p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-black/60 dark:text-white/60">
                      {roomForm.id ? "Editing room" : "Create room"}
                    </p>
                    <p className="mt-1 text-xs text-black/55 dark:text-white/55">
                      Names must stay unique and capacity must be greater than zero.
                    </p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-[minmax(160px,1fr)_minmax(96px,130px)_minmax(130px,150px)_minmax(170px,1fr)]">
                    <input
                      name="roomName"
                      value={roomForm.name}
                      onChange={(event) => setRoomForm((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder="Room name"
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                      required
                    />
                    <input
                      name="roomCapacity"
                      type="number"
                      min={1}
                      value={roomForm.capacity}
                      onChange={(event) => setRoomForm((prev) => ({ ...prev, capacity: event.target.value }))}
                      placeholder="Capacity"
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                      required
                    />
                    <label className="inline-flex h-full items-center gap-2 rounded-md border border-black/10 bg-white/60 px-3 py-2 text-xs text-black/75 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/75">
                      <input
                        type="checkbox"
                        checked={roomForm.active}
                        onChange={(event) => setRoomForm((prev) => ({ ...prev, active: event.target.checked }))}
                      />
                      Active room
                    </label>
                    <input
                      name="roomLocation"
                      value={roomForm.location}
                      onChange={(event) => setRoomForm((prev) => ({ ...prev, location: event.target.value }))}
                      placeholder="Location details (optional)"
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                  </div>
                  {roomFormError ? (
                    <p className="rounded-md border border-[var(--brand,#b61616)]/35 bg-[var(--brand,#b61616)]/10 px-3 py-2 text-sm text-[var(--brand,#ff4b4b)]">
                      {roomFormError}
                    </p>
                  ) : null}
                  {roomFormSuccess ? (
                    <p className="rounded-md border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                      {roomFormSuccess}
                    </p>
                  ) : null}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={resetRoomForm}
                      disabled={roomSaving}
                      className="inline-flex w-full items-center justify-center rounded-md border border-black/20 bg-white px-4 py-2 text-sm font-semibold text-black/80 transition hover:border-[var(--brand,#b61616)]/55 hover:text-[var(--brand,#ff4b4b)] disabled:opacity-60 dark:border-white/20 dark:bg-white/[0.04] dark:text-white/80"
                    >
                      Reset
                    </button>
                    <button
                      type="submit"
                      disabled={roomSaving}
                      className="inline-flex w-full items-center justify-center rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60"
                    >
                      {roomSaving ? "Saving..." : roomForm.id ? "Update room" : "Create room"}
                    </button>
                  </div>
                </form>

                <div className="space-y-3 rounded-xl border border-black/10 bg-black/[0.03] p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative min-w-[220px] flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45 dark:text-white/45" />
                      <input
                        value={roomSearchQuery}
                        onChange={(event) => setRoomSearchQuery(event.target.value)}
                        placeholder="Search by room or location"
                        className="w-full rounded-md border border-black/15 bg-white py-2 pl-9 pr-3 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                      />
                    </div>
                    <select
                      value={roomStatusFilter}
                      onChange={(event) =>
                        setRoomStatusFilter(
                          event.target.value === "active" || event.target.value === "inactive" ? event.target.value : "all"
                        )
                      }
                      className="rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    >
                      <option value="all">All statuses</option>
                      <option value="active">Active only</option>
                      <option value="inactive">Inactive only</option>
                    </select>
                  </div>

                  <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                    {schoolLoading ? (
                      <div className="space-y-2 animate-pulse">
                        <div className="h-20 rounded-md bg-black/10 dark:bg-white/10" />
                        <div className="h-20 rounded-md bg-black/10 dark:bg-white/10" />
                        <div className="h-20 rounded-md bg-black/10 dark:bg-white/10" />
                      </div>
                    ) : visibleRooms.length === 0 ? (
                      <p className="text-sm text-black/60 dark:text-white/60">No rooms match the current filters.</p>
                    ) : (
                      visibleRooms.map((room) => (
                        <div key={`room-row-${room.id}`} className="rounded-lg border border-black/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.02]">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-black dark:text-white">{room.name}</p>
                                <span
                                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                                    room.active
                                      ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300"
                                      : "border-black/15 bg-black/[0.04] text-black/60 dark:border-white/15 dark:bg-white/[0.04] dark:text-white/60"
                                  }`}
                                >
                                  {room.active ? "Active" : "Inactive"}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-black/65 dark:text-white/65">
                                Capacity {room.capacity} · {room.location || "No location detail"}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                onClick={() => loadRoomIntoForm(room)}
                                className="rounded border border-[var(--brand,#b61616)]/60 px-2 py-1 text-[11px] font-semibold text-[var(--brand,#ff4b4b)]"
                              >
                                Edit
                              </button>
                              {!room.active ? (
                                <button
                                  type="button"
                                  onClick={() => void activateRoom(room.id)}
                                  disabled={roomBusyId === room.id}
                                  className="rounded border border-emerald-500/35 px-2 py-1 text-[11px] font-semibold text-emerald-300 transition disabled:cursor-not-allowed disabled:opacity-45"
                                >
                                  {roomBusyId === room.id ? "Activating..." : "Activate"}
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => void disableRoom(room.id)}
                                disabled={resolveRoomDisableActionState(room, roomBusyId).disabled}
                                className="rounded border border-black/15 px-2 py-1 text-[11px] font-semibold text-black/75 transition hover:border-[var(--brand,#b61616)] hover:text-[var(--brand,#ff4b4b)] disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/15 dark:text-white/75"
                              >
                                {resolveRoomDisableActionState(room, roomBusyId).label}
                              </button>
                              <button
                                type="button"
                                onClick={() => openRoomReassignModal(room)}
                                disabled={roomBusyId === room.id || activeRoomOptions.filter((option) => option.id !== room.id).length === 0}
                                className="rounded border border-black/15 px-2 py-1 text-[11px] font-semibold text-black/75 transition hover:border-[var(--brand,#b61616)] hover:text-[var(--brand,#ff4b4b)] disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/15 dark:text-white/75"
                              >
                                Reassign
                              </button>
                              {!room.active ? (
                                <button
                                  type="button"
                                  onClick={() => openRoomSafeDeleteModal(room)}
                                  disabled={roomBusyId === room.id}
                                  className="rounded border border-[var(--brand,#b61616)]/55 px-2 py-1 text-[11px] font-semibold text-[var(--brand,#ff4b4b)] transition disabled:cursor-not-allowed disabled:opacity-45"
                                >
                                  {roomBusyId === room.id ? "Deleting..." : "Safe delete"}
                                </button>
                              ) : null}
                            </div>
                          </div>
                          {roomActionErrors[room.id] ? (
                            <p className="mt-2 rounded-md border border-[var(--brand,#b61616)]/35 bg-[var(--brand,#b61616)]/10 px-2.5 py-2 text-xs text-[var(--brand,#ff4b4b)]">
                              {roomActionErrors[room.id]}
                            </p>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
              {/* Step navigation */}
              <div className="mt-6 flex items-center justify-between border-t border-black/10 pt-4 dark:border-white/10">
                <button type="button" onClick={() => schoolWizard.prevStep(wizardEnabledCtx)} disabled={schoolWizard.step === 0} className="rounded-lg border border-black/10 px-4 py-1.5 text-xs font-medium text-black/60 transition hover:bg-black/[0.04] disabled:opacity-30 dark:border-white/10 dark:text-white/60 dark:hover:bg-white/[0.04]">← Previous</button>
                <span className="text-[10px] text-black/40 dark:text-white/40">Step {schoolWizard.step + 1} of {schoolWizard.totalSteps}</span>
                <button type="button" onClick={() => schoolWizard.nextStep(wizardEnabledCtx)} disabled={schoolWizard.step >= schoolWizard.totalSteps - 1} className="rounded-lg border border-[var(--brand,#b61616)]/30 bg-[var(--brand,#b61616)]/10 px-4 py-1.5 text-xs font-medium text-[var(--brand,#ff4b4b)] transition hover:bg-[var(--brand,#b61616)]/20 disabled:opacity-30">Next →</button>
              </div>
            </article>

            <article style={{ display: schoolWizard.activeEntity === "courses" ? undefined : "none" }} className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
              <header className="mb-6">
                <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Course studio</p>
                <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">
                  {schoolWizard.step === 0 ? "Course main information"
                    : schoolWizard.step === 1 ? "Prices and discounts"
                    : schoolWizard.step === 2 ? "Media assets"
                    : schoolWizard.step === 3 ? "Schedule builder"
                    : schoolWizard.step === 4 ? "Consecutive class links"
                    : schoolWizard.step === 5 ? "Preview and calendar"
                    : "Publish course"}
                </h3>
                <p className="mt-1 text-sm text-black/65 dark:text-white/65">
                  {schoolWizard.step === 0 ? "Set the basic details: title, type, category, location, and default room."
                    : schoolWizard.step === 1 ? "Configure drop-in price, first class price, and special discounts."
                    : schoolWizard.step === 2 ? "Upload a cover image and add a video preview for the course."
                    : schoolWizard.step === 3 ? "Select days, time slots, repetition rules, and publication status."
                    : schoolWizard.step === 4 ? "Link this course to a consecutive class with special pricing."
                    : schoolWizard.step === 5 ? "Review how the course looks and check the monthly calendar."
                    : "Share on social media and save the course."}
                </p>
              </header>

              <div className="grid grid-cols-1 gap-6">
                <form onSubmit={saveCourseCatalog}>
                  <input ref={courseImageInputRef} name="courseLocalImage" type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleCourseLocalImage} />
                  <input ref={courseVideoInputRef} name="courseLocalVideo" type="file" accept="video/mp4,video/webm" className="hidden" onChange={handleCourseLocalVideo} />
                  <div ref={courseFormFieldsRef} className="mt-4 space-y-4">
                    <div style={{ display: schoolWizard.activeEntity === "courses" && schoolWizard.step === 0 ? undefined : "none" }} className="space-y-3">
                      <span className="block text-xs uppercase tracking-[0.2em] text-black/60 dark:text-white/60">Course main information</span>
                      {courseSlugConflict.exists && (
                        <div className="rounded-md border border-amber-500/30 bg-amber-50 px-3 py-2 dark:border-amber-400/30 dark:bg-amber-900/20">
                          <p className="text-xs text-amber-800 dark:text-amber-200">
                            The slug <span className="font-semibold">&quot;{courseForm.slug}&quot;</span> already exists for{" "}
                            <span className="font-semibold">&quot;{courseSlugConflict.existingTitle}&quot;</span>.
                          </p>
                          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                            Suggestion: <code className="rounded bg-amber-100 px-1 py-0.5 font-mono dark:bg-amber-800/50">{courseSlugConflict.suggestion}</code>
                          </p>
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              onClick={handleUseSlugSuggestion}
                              className="rounded-md bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-700"
                            >
                              Use suggestion
                            </button>
                            <button
                              type="button"
                              onClick={handleEditExistingCourse}
                              className="rounded-md border border-amber-600 bg-transparent px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/30"
                            >
                              Edit existing
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          name="courseSlug"
                          value={courseForm.slug}
                          onChange={(event) => setCourseForm((prev) => ({ ...prev, slug: event.target.value }))}
                          placeholder="slug (e.g., salsa-feminine-morning)"
                          className={`w-full rounded-md border bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:bg-white/5 dark:text-white ${
                            courseSlugConflict.exists
                              ? "border-amber-500 dark:border-amber-400"
                              : "border-black/15 dark:border-white/15"
                          }`}
                          required
                        />
                        <input
                          name="courseTitle"
                          value={courseForm.title}
                          onChange={(event) => setCourseForm((prev) => ({ ...prev, title: event.target.value }))}
                          placeholder="Title"
                          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                          required
                        />
                      </div>
                      <textarea
                        name="courseDescription"
                        value={courseForm.description}
                        onChange={(event) => setCourseForm((prev) => ({ ...prev, description: event.target.value }))}
                        placeholder="Short course description"
                        rows={3}
                        className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <select
                          name="courseKind"
                          value={courseForm.kind}
                          onChange={(event) => setCourseForm((prev) => ({ ...prev, kind: event.target.value }))}
                          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                        >
                          {SCHOOL_COURSE_KINDS.map((kind) => (
                            <option key={`course-kind-${kind}`} value={kind}>
                              {kind}
                            </option>
                          ))}
                        </select>
                        <input
                          name="courseCategory"
                          value={courseForm.category}
                          onChange={(event) => setCourseForm((prev) => ({ ...prev, category: event.target.value }))}
                          placeholder="Category"
                          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          name="courseLevel"
                          value={courseForm.level}
                          onChange={(event) => setCourseForm((prev) => ({ ...prev, level: event.target.value }))}
                          placeholder="Level"
                          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                        />
                        <input
                          name="courseDurationMinutes"
                          type="number"
                          min={0}
                          max={600}
                          value={courseForm.durationMinutes}
                          onChange={(event) => setCourseForm((prev) => ({ ...prev, durationMinutes: event.target.value }))}
                          placeholder="Duration (min)"
                          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                        />
                      </div>
                       <input
                         name="courseLocation"
                         value={courseForm.location}
                         onChange={(event) => setCourseForm((prev) => ({ ...prev, location: event.target.value }))}
                         placeholder="Location"
                         className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                       />
                       <div className="space-y-2">
                         <select
                           name="courseDefaultRoomId"
                           value={courseForm.defaultRoomId}
                           onChange={(event) => setCourseForm((prev) => ({ ...prev, defaultRoomId: event.target.value }))}
                           className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                         >
                           <option value="">No default room</option>
                           {courseRoomOptions.map((room) => (
                             <option key={`course-room-${room.id}`} value={room.id}>
                               {room.name} · cap {room.capacity}{room.active ? "" : " · inactive"}
                             </option>
                           ))}
                         </select>
                         <p className="text-xs text-black/55 dark:text-white/55">
                           Optional. Future sessions can reuse this room as the default assignment.
                         </p>
                         {courseForm.defaultRoomId && roomById[courseForm.defaultRoomId] ? (
                           <p className="text-xs text-black/60 dark:text-white/60">
                             {roomById[courseForm.defaultRoomId]!.location || "No location detail"} · cap {roomById[courseForm.defaultRoomId]!.capacity}
                           </p>
                         ) : null}
                       </div>
                     </div>

                    <div style={{ display: schoolWizard.activeEntity === "courses" && schoolWizard.step === 1 ? undefined : "none" }} className="space-y-2">
                      {courseEditingSlug ? (<>
                      <span className="block text-xs uppercase tracking-[0.2em] text-black/60 dark:text-white/60">Prices and special discounts</span>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          name="courseDropInPrice"
                          type="number"
                          step="0.01"
                          min={0}
                          value={courseForm.dropInPriceCents}
                          onChange={(event) => setCourseForm((prev) => ({ ...prev, dropInPriceCents: event.target.value }))}
                          placeholder="Drop-in USD (e.g., 20)"
                          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                        />
                        <input
                          name="courseFirstClassPrice"
                          type="number"
                          step="0.01"
                          min={0}
                          value={courseForm.firstClassPriceCents}
                          onChange={(event) => setCourseForm((prev) => ({ ...prev, firstClassPriceCents: event.target.value }))}
                          placeholder="First class USD (e.g., 15)"
                          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <select
                          name="courseSpecialDiscountType"
                          value={courseForm.specialDiscountType}
                          onChange={(event) =>
                            setCourseForm((prev) => ({
                              ...prev,
                              specialDiscountType: event.target.value as CourseSpecialDiscountType,
                              specialDiscountCustomLabel:
                                event.target.value === "custom" ? prev.specialDiscountCustomLabel : "",
                            }))
                          }
                          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                        >
                          {COURSE_SPECIAL_DISCOUNT_OPTIONS.map((option) => (
                            <option key={`course-special-discount-${option.value}`} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <input
                          name="courseSpecialDiscountPrice"
                          type="number"
                          step="0.01"
                          min={0}
                          value={courseForm.specialDiscountPrice}
                          onChange={(event) => setCourseForm((prev) => ({ ...prev, specialDiscountPrice: event.target.value }))}
                          placeholder="Discounted price USD"
                          disabled={courseForm.specialDiscountType === "none"}
                          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] disabled:opacity-45 dark:border-white/15 dark:bg-white/5 dark:text-white"
                        />
                      </div>
                      {courseForm.specialDiscountType === "custom" ? (
                        <input
                          name="courseSpecialDiscountCustomLabel"
                          value={courseForm.specialDiscountCustomLabel}
                          onChange={(event) => setCourseForm((prev) => ({ ...prev, specialDiscountCustomLabel: event.target.value }))}
                          placeholder="Custom discount label (e.g., Anniversary Week)"
                          className="mt-2 w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                        />
                      ) : null}
                      </>) : (
                        <p className="mt-4 text-center text-sm text-black/50 dark:text-white/50">Create the course first to configure this step.</p>
                      )}
                    </div>

                    <div style={{ display: schoolWizard.activeEntity === "courses" && schoolWizard.step === 2 ? undefined : "none" }} className="space-y-2">
                      {courseEditingSlug ? (<>
                      <p className="text-xs uppercase tracking-[0.2em] text-black/60 dark:text-white/60">Media assets</p>
                      <div className="rounded-lg border border-black/10 bg-white/75 p-2.5 dark:border-white/10 dark:bg-white/[0.02]">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-3">
                          <p className="text-[11px] uppercase tracking-[0.22em] text-black/60 dark:text-white/60">Video</p>
                          <input
                            name="coursePreviewVideoUrl"
                            value={courseForm.previewVideoUrl}
                            onChange={(event) => setCourseForm((prev) => ({ ...prev, previewVideoUrl: event.target.value }))}
                            placeholder="URL video preview (YouTube/Vimeo/MP4)"
                            className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => courseVideoInputRef.current?.click()}
                            disabled={courseMediaUploading !== null}
                            className="inline-flex w-full items-center justify-center rounded-md border border-black/15 bg-white px-3 py-2 text-xs font-semibold text-black/80 transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-white/[0.04] dark:text-white/80"
                          >
                            {courseMediaUploading === "video" ? "Uploading video..." : "Upload local video"}
                          </button>
                          {courseLocalVideoName ? <p className="text-xs text-black/60 dark:text-white/60">Local video: {courseLocalVideoName}</p> : null}
                        </div>
                        <div className="space-y-3">
                          <p className="text-[11px] uppercase tracking-[0.22em] text-black/60 dark:text-white/60">Imagen</p>
                          <input
                            name="coursePreviewImageUrl"
                            value={courseForm.previewImageUrl}
                            onChange={(event) => setCourseForm((prev) => ({ ...prev, previewImageUrl: event.target.value }))}
                            placeholder="URL imagen de portada"
                            className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => courseImageInputRef.current?.click()}
                            disabled={courseMediaUploading !== null}
                            className="inline-flex w-full items-center justify-center rounded-md border border-black/15 bg-white px-3 py-2 text-xs font-semibold text-black/80 transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-white/[0.04] dark:text-white/80"
                          >
                            {courseMediaUploading === "image" ? "Uploading image..." : "Upload local image"}
                          </button>
                          {courseLocalImageName ? <p className="text-xs text-black/60 dark:text-white/60">Local image: {courseLocalImageName}</p> : null}
                        </div>
                      </div>
                    </div>
                      </>) : (
                        <p className="mt-4 text-center text-sm text-black/50 dark:text-white/50">Create the course first to configure this step.</p>
                      )}
                    </div>

                    <div style={{ display: schoolWizard.activeEntity === "courses" && schoolWizard.step >= 3 && schoolWizard.step <= 5 ? undefined : "none" }} className="space-y-2">
                      {courseEditingSlug ? (<>
                      <p style={{ display: schoolWizard.step === 3 ? undefined : "none" }} className="mb-2 text-xs uppercase tracking-[0.2em] text-black/60 dark:text-white/60">
                        {isSpecialEventCourse ? "Special events (calendar builder)" : "Schedules (guided builder)"}
                      </p>
                      <div className="space-y-5">
                        <div className="space-y-5">
                          <div style={{ display: schoolWizard.step === 3 ? undefined : "none" }}>
                          {isSpecialEventCourse ? (
                            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 dark:border-amber-400/35 dark:bg-amber-500/10">
                              <p className="text-[11px] uppercase tracking-[0.2em] text-amber-300">Special event mode</p>
                              <p className="mt-1 text-xs text-amber-100/90">
                                This course uses unique dates. The weekly builder is disabled and slots are loaded from the calendar.
                              </p>
                            </div>
                          ) : (
                            <div style={{ display: schoolWizard.step === 3 ? undefined : "none" }}>
                              <div className="px-1 py-1.5">
                                <p className="text-[11px] uppercase tracking-[0.2em] text-black/60 dark:text-white/60">1) Select days</p>
                                <div className="mt-1 grid grid-cols-7 gap-1.5">
                                  {WEEKDAY_LABELS.map((label, weekday) => {
                                    const active = courseRecurringWeekdays.includes(weekday)
                                    return (
                                      <button
                                        key={`course-weekday-toggle-${weekday}`}
                                        type="button"
                                        onClick={() => toggleCourseRecurringWeekday(weekday)}
                                        className={`h-11 rounded-md border text-sm font-semibold transition ${
                                          active
                                            ? "border-[var(--brand,#b61616)]/70 bg-[var(--brand,#b61616)]/20 text-[var(--brand,#ff4b4b)]"
                                            : "border-black/20 text-black/70 hover:border-[var(--brand,#b61616)]/45 dark:border-white/20 dark:text-white/70"
                                        }`}
                                      >
                                        {label}
                                      </button>
                                    )
                                  })}
                                </div>
                                <p className="mt-1 text-xs text-black/55 dark:text-white/55">
                                  Selected: {courseRecurringWeekdays.length}
                                </p>
                              </div>

                              {courseRecurringWeekdays.length === 1 ? (
                                <div className="px-1 py-1.5 xl:border-l xl:border-black/10 xl:pl-3 dark:xl:border-white/10">
                                  <p className="text-[10px] uppercase tracking-[0.16em] text-black/60 dark:text-white/60">
                                    2) Repeat this slot on other days?
                                  </p>
                                  <div className="mt-1 flex flex-wrap gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setCourseMirrorEnabled(true)}
                                      className={`h-11 rounded-md border px-3 text-sm font-semibold ${
                                        courseMirrorEnabled
                                          ? "border-[var(--brand,#b61616)]/70 bg-[var(--brand,#b61616)]/15 text-[var(--brand,#ff4b4b)]"
                                          : "border-black/20 text-black/70 dark:border-white/20 dark:text-white/70"
                                      }`}
                                    >
                                      Yes, repeat
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCourseMirrorEnabled(false)
                                        setCourseMirrorWeekdays([])
                                      }}
                                      className={`h-11 rounded-md border px-3 text-sm font-semibold ${
                                        !courseMirrorEnabled
                                          ? "border-[var(--brand,#b61616)]/70 bg-[var(--brand,#b61616)]/15 text-[var(--brand,#ff4b4b)]"
                                          : "border-black/20 text-black/70 dark:border-white/20 dark:text-white/70"
                                      }`}
                                    >
                                      No
                                    </button>
                                  </div>
                                  {courseMirrorEnabled ? (
                                    <div className="mt-2 grid grid-cols-7 gap-1.5">
                                      {WEEKDAY_LABELS.map((label, weekday) => {
                                        const disabled = courseRecurringWeekdays.includes(weekday)
                                        const active = courseMirrorWeekdays.includes(weekday)
                                        return (
                                          <button
                                            key={`mirror-weekday-${weekday}`}
                                            type="button"
                                            onClick={() => toggleCourseMirrorWeekday(weekday)}
                                            disabled={disabled}
                                            className={`h-9 rounded-md border text-xs font-semibold transition ${
                                              active
                                                ? "border-[var(--brand,#b61616)]/70 bg-[var(--brand,#b61616)]/15 text-[var(--brand,#ff4b4b)]"
                                                : "border-black/20 text-black/70 dark:border-white/20 dark:text-white/70"
                                            } ${disabled ? "cursor-not-allowed opacity-35" : ""}`}
                                          >
                                            {label}
                                          </button>
                                        )
                                      })}
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          )}

                          <div className="space-y-4">
                            <p className="text-[11px] uppercase tracking-[0.2em] text-black/60 dark:text-white/60">
                              {isSpecialEventCourse
                                ? "2) Time slot for event dates · Shortcuts (editable)"
                                : "3) Time slot for selected days · Shortcuts (editable)"}
                            </p>
                            {isSpecialEventCourse ? (
                              <div className="mt-3 rounded-md border border-black/10 bg-black/[0.02] p-2.5 dark:border-white/10 dark:bg-white/[0.02]">
                                <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-black/55 dark:text-white/55">Event dates</p>
                                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                                  <input
                                    type="date"
                                    value={courseScheduleDate}
                                    onChange={(event) => setCourseScheduleDate(event.target.value)}
                                    className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const date = courseScheduleDate.trim()
                                      if (!date) return
                                      setCourseScheduleDates((prev) => [...new Set([...prev, date])].sort())
                                      setCourseScheduleDate("")
                                    }}
                                    className="rounded-md border border-[var(--brand,#b61616)]/55 bg-[var(--brand,#b61616)]/10 px-3 py-2 text-sm font-semibold text-[var(--brand,#ff4b4b)]"
                                  >
                                    Add date
                                  </button>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {courseScheduleDates.length === 0 ? (
                                    <span className="text-xs text-black/55 dark:text-white/55">No dates selected.</span>
                                  ) : (
                                    courseScheduleDates.map((date) => (
                                      <button
                                        key={`special-event-date-chip-${date}`}
                                        type="button"
                                        onClick={() => setCourseScheduleDates((prev) => prev.filter((item) => item !== date))}
                                        className="rounded-full border border-[var(--brand,#b61616)]/35 bg-[var(--brand,#b61616)]/10 px-2 py-0.5 text-xs text-[var(--brand,#ff4b4b)]"
                                      >
                                        {date} ×
                                      </button>
                                    ))
                                  )}
                                </div>
                              </div>
                            ) : null}
                            <div className="mt-4">
                              <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                                {quickScheduleTimes.slice(0, QUICK_SCHEDULE_SLOT_COUNT).map((time, index) => {
                                  const isEditing = editingQuickTimeIndex === index
                                  if (isEditing) {
                                    return (
                                      <div
                                        key={`quick-time-edit-${index}`}
                                        className="h-[6.5rem] w-full rounded-md border border-[var(--brand,#b61616)]/35 bg-[var(--brand,#b61616)]/10 p-2"
                                      >
                                        <input
                                          id={`quick-time-edit-${index}`}
                                          name={`quickTimeEdit${index}`}
                                          type="time"
                                          value={quickTimeDraft}
                                          onChange={(event) => setQuickTimeDraft(event.target.value)}
                                          className="h-7 w-full rounded border border-black/20 bg-white/85 px-1.5 text-[11px] text-black outline-none dark:border-white/20 dark:bg-white/10 dark:text-white"
                                        />
                                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                                          <button
                                            type="button"
                                            onClick={commitQuickTimeEdit}
                                            className="rounded border border-black/20 px-1.5 py-0.5 text-[10px] font-semibold text-black/80 dark:border-white/20 dark:text-white/80"
                                          >
                                            Save
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingQuickTimeIndex(null)
                                              setQuickTimeDraft("")
                                            }}
                                            className="rounded border border-black/20 px-1.5 py-0.5 text-[10px] text-black/70 dark:border-white/20 dark:text-white/70"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    )
                                  }
                                  const normalizedTime = normalizeClockTime(time)
                                  const isActive = normalizedTime === normalizeClockTime(courseScheduleTime)
                                  const usageCount = normalizedTime ? scheduleSlotTimeUsage.get(normalizedTime) || 0 : 0
                                  const usageCourseCount = normalizedTime ? scheduleTimeCourseUsage.get(normalizedTime) || 0 : 0
                                  const isMostUsed = usageCount > 3 || usageCourseCount > 3
                                  const usageBadgeLabel =
                                    usageCourseCount > 0
                                      ? `${usageCourseCount} course${usageCourseCount === 1 ? "" : "s"}`
                                      : usageCount > 0
                                        ? `${usageCount} uso${usageCount === 1 ? "" : "s"}`
                                        : "No usage"
                                  const usageBadgeTone =
                                    usageCourseCount > 0
                                      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                                      : usageCount > 0
                                        ? "border-[var(--brand,#b61616)]/45 bg-[var(--brand,#b61616)]/18 text-[var(--brand,#ff8a8a)]"
                                        : "border-black/20 bg-white/60 text-black/60 dark:border-white/20 dark:bg-white/5 dark:text-white/60"
                                  return (
                                    <div
                                      key={`quick-time-${time}-${index}`}
                                      role="button"
                                      tabIndex={0}
                                      onClick={() => normalizedTime && setCourseScheduleTime(normalizedTime)}
                                      onKeyDown={(event) => {
                                        if (!normalizedTime) return
                                        if (event.key === "Enter" || event.key === " ") {
                                          event.preventDefault()
                                          setCourseScheduleTime(normalizedTime)
                                        }
                                      }}
                                      className={`h-[6.5rem] w-full cursor-pointer rounded-md border p-2 transition ${SCHEDULE_SHORTCUT_TONES[index % SCHEDULE_SHORTCUT_TONES.length]} ${
                                        isActive
                                          ? "border-[var(--brand,#b61616)]/70 shadow-[0_0_0_1px_rgba(182,22,22,0.35)]"
                                          : "border-black/20 dark:border-white/20"
                                      }`}
                                    >
                                      <div className="flex h-full flex-col text-center">
                                        <div className="flex items-center justify-center gap-2.5">
                                          <Star
                                            className={`h-3 w-3 ${
                                              isMostUsed
                                                ? "fill-current text-[var(--brand,#ff4b4b)]"
                                                : "text-black/35 dark:text-white/35"
                                            }`}
                                          />
                                          <span
                                            className={`inline-flex max-w-[82px] items-center justify-center truncate rounded-full border px-1.5 py-0.5 text-[9px] font-medium leading-none ${usageBadgeTone}`}
                                            title={usageBadgeLabel}
                                          >
                                            {usageBadgeLabel}
                                          </span>
                                          <Star
                                            className={`h-3 w-3 ${
                                              isMostUsed
                                                ? "fill-current text-[var(--brand,#ff4b4b)]"
                                                : "text-black/35 dark:text-white/35"
                                            }`}
                                          />
                                        </div>
                                        <div className="my-auto flex items-center justify-center">
                                          <span className="text-[1.12rem] font-bold leading-none text-black dark:text-white">{formatClockLabel(time)}</span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={(event) => {
                                            event.stopPropagation()
                                            startEditingQuickTime(index)
                                          }}
                                          className="w-full rounded-md border border-black/20 bg-black/5 px-1.5 py-0.5 text-center text-[9px] font-semibold uppercase tracking-[0.09em] text-black/70 transition hover:border-[var(--brand,#b61616)]/50 hover:bg-[var(--brand,#b61616)]/10 hover:text-black dark:border-white/20 dark:bg-white/[0.04] dark:text-white/70 dark:hover:text-white"
                                          title="Edit time slot"
                                          aria-label="Edit time slot"
                                        >
                                          Edit
                                        </button>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: schoolWizard.step === 3 ? undefined : "none" }} className="space-y-5">
                          <div className="grid grid-cols-2 gap-5">
                            <div>
                              <div ref={scheduleTimePickerRef} className="relative grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                                <button
                                  type="button"
                                  onClick={() => setScheduleTimePickerOpen((prev) => !prev)}
                                  className="flex w-full items-center justify-between border-b border-black/15 px-1 py-2 text-left text-sm text-black outline-none transition hover:border-[var(--brand,#b61616)] dark:border-white/15 dark:text-white"
                                >
                                  <span>{formatClockLabel(courseScheduleTime)}</span>
                                  <Clock3 className="h-4 w-4 text-black/55 dark:text-white/55" />
                                </button>
                                <button
                                  type="button"
                                  onClick={addCourseScheduleSlot}
                                  className="rounded-md border border-[var(--brand,#b61616)]/55 bg-[var(--brand,#b61616)]/10 px-3 py-2 text-sm font-semibold text-[var(--brand,#ff4b4b)]"
                                >
                                  {isSpecialEventCourse
                                    ? courseScheduleDates.length > 1
                                      ? "Add event slots"
                                      : "Add event slot"
                                    : courseRecurringWeekdays.length > 0 || courseScheduleDates.length > 1
                                      ? "Add slots"
                                      : "Add slot"}
                                </button>
                                {scheduleTimePickerOpen ? (
                                  <div className="absolute left-0 top-[calc(100%+0.45rem)] z-30 w-full rounded-md border border-black/10 bg-white/95 p-2 shadow-xl dark:border-white/10 dark:bg-[#141821]/95">
                                    <div className="grid max-h-48 grid-cols-3 gap-1 overflow-y-auto sm:grid-cols-4">
                                      {scheduleTimeOptions.map((option) => {
                                        const active = normalizeClockTime(courseScheduleTime) === option
                                        return (
                                          <button
                                            key={`schedule-time-option-${option}`}
                                            type="button"
                                            onClick={() => {
                                              setCourseScheduleTime(option)
                                              setScheduleTimePickerOpen(false)
                                            }}
                                            className={`rounded-md border px-2 py-1 text-xs font-semibold transition ${
                                              active
                                                ? "border-[var(--brand,#b61616)]/70 bg-[var(--brand,#b61616)]/15 text-[var(--brand,#ff4b4b)]"
                                                : "border-black/15 text-black/80 hover:border-[var(--brand,#b61616)]/50 dark:border-white/15 dark:text-white/80"
                                            }`}
                                          >
                                            {formatClockLabel(option)}
                                          </button>
                                        )
                                      })}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                              {!isSpecialEventCourse && regularScheduleWarningMessage ? (
                                <div className="mt-2 rounded-md border border-amber-500/35 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-200">
                                  {regularScheduleWarningMessage}
                                </div>
                              ) : null}
                              <div className="mt-3 max-h-52 space-y-1.5 overflow-y-auto text-xs">
                                {schoolLoading ? (
                                  <div className="space-y-1.5 animate-pulse">
                                    <div className="h-7 rounded-md bg-black/10 dark:bg-white/10" />
                                    <div className="h-7 rounded-md bg-black/10 dark:bg-white/10" />
                                    <div className="h-7 rounded-md bg-black/10 dark:bg-white/10" />
                                  </div>
                                ) : courseScheduleSlots.length === 0 ? (
                                  <p className="text-black/60 dark:text-white/60">No slots selected yet.</p>
                                ) : (
                                  courseScheduleSlots.map((slot) => {
                                    const slotKey = getCourseSlotKey(slot)
                                    return (
                                      <div
                                        key={`course-slot-${slotKey}`}
                                        className={`flex items-center justify-between gap-2 px-1 py-1 ${
                                          slot.date
                                            ? "text-amber-100"
                                            : "text-black/80 dark:text-white/80"
                                        }`}
                                      >
                                        <span>{formatCourseSlotLabel(slot)}</span>
                                        <button
                                          type="button"
                                          onClick={() => removeCourseScheduleSlot(slotKey)}
                                          className="rounded px-1.5 py-0.5 text-[11px] text-black/65 transition hover:text-[var(--brand,#ff4b4b)] dark:text-white/65"
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    )
                                  })
                                )}
                              </div>
                            </div>
                            <div className="min-w-0">
                              {isSpecialEventCourse ? (
                                <div className="rounded-lg border border-[var(--brand,#b61616)]/25 bg-[var(--brand,#b61616)]/8 p-2.5">
                                  <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--brand,#ff8a8a)]">Priority rule</p>
                                  <p className="mt-1 text-xs text-[var(--brand,#ffd0d0)]">
                                    Special events have priority over regular classes. If there is a conflict, the regular schedule continues on the next available day.
                                  </p>
                                </div>
                              ) : (
                                <div className="rounded-lg border border-black/10 bg-white/65 p-2.5 dark:border-white/10 dark:bg-white/[0.03]">
                                  <p className="text-[11px] uppercase tracking-[0.2em] text-black/60 dark:text-white/60">4) Repetition and validity</p>
                                  <label className="mt-1 inline-flex items-center gap-2 text-xs text-black/75 dark:text-white/75">
                                    <input
                                      type="checkbox"
                                      checked={courseRepeatAllMonth}
                                      onChange={(event) => setCourseRepeatAllMonth(event.target.checked)}
                                    />
                                    Repeat for the entire visible month
                                  </label>
                                  <div className="mt-2 grid gap-2">
                                    <select
                                      name="courseRecurrenceMode"
                                      value={courseRecurrenceMode}
                                      onChange={(event) => setCourseRecurrenceMode(event.target.value === "until_date" ? "until_date" : "indefinite")}
                                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                                    >
                                      <option value="indefinite">Indefinite</option>
                                      <option value="until_date">With expiration date</option>
                                    </select>
                                    <input
                                      name="courseRecurrenceEndsAt"
                                      type="date"
                                      value={courseRecurrenceEndsAt}
                                      onChange={(event) => setCourseRecurrenceEndsAt(event.target.value)}
                                      disabled={courseRecurrenceMode !== "until_date"}
                                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] disabled:opacity-45 dark:border-white/15 dark:bg-white/5 dark:text-white"
                                    />
                                  </div>
                                  <div className="mt-4 border-t border-black/10 pt-4 dark:border-white/10">
                                    <p className="text-[11px] uppercase tracking-[0.2em] text-black/60 dark:text-white/60">5) Publication status</p>
                                    <div className="mt-2 grid gap-2">
                                      <select
                                        name="coursePublicationMode"
                                        value={courseForm.publicationMode}
                                        onChange={(event) =>
                                          setCourseForm((prev) => ({
                                            ...prev,
                                            publicationMode: event.target.value as CoursePublicationMode,
                                            launchDate: event.target.value === "launch_date" ? prev.launchDate : "",
                                          }))
                                        }
                                        className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                                      >
                                        {COURSE_PUBLICATION_MODE_OPTIONS.map((option) => (
                                          <option key={`course-publication-mode-${option.value}`} value={option.value}>
                                            {option.label}
                                          </option>
                                        ))}
                                      </select>
                                      {courseForm.publicationMode === "launch_date" ? (
                                        <input
                                          name="courseLaunchDate"
                                          type="date"
                                          value={courseForm.launchDate}
                                          onChange={(event) => setCourseForm((prev) => ({ ...prev, launchDate: event.target.value }))}
                                          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                                        />
                                      ) : (
                                        <div className="rounded-md border border-black/10 bg-black/[0.03] px-3 py-2 text-xs text-black/60 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/60">
                                          {courseForm.publicationMode === "coming_soon"
                                            ? "Course will appear as coming soon."
                                            : "Course will publish immediately after save."}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          </div>

                          {/* ─── Consecutive Classes (CourseLink) Section ─── */}
                          <div style={{ display: schoolWizard.step === 4 ? undefined : "none" }}>
                          <div className="mb-4 rounded-md border border-black/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.02]">
                            <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Consecutive Classes</p>
                            {courseEditingSlug ? (
                              <>
                              <p className="mt-1 text-xs text-black/65 dark:text-white/65">
                                Link <strong>{schoolCourses.find(c => c.slug === courseEditingSlug)?.title ?? courseEditingSlug}</strong> to a consecutive class with special pricing.
                              </p>

                              {courseLinkError && (
                                <div className="mt-2 rounded-md border border-red-500/30 bg-red-50 px-3 py-1.5 dark:border-red-400/30 dark:bg-red-900/20">
                                  <p className="text-xs text-red-800 dark:text-red-200">{courseLinkError}</p>
                                </div>
                              )}
                              {courseLinkSuccess && (
                                <div className="mt-2 rounded-md border border-emerald-500/30 bg-emerald-50 px-3 py-1.5 dark:border-emerald-400/30 dark:bg-emerald-900/20">
                                  <p className="text-xs text-emerald-800 dark:text-emerald-200">{courseLinkSuccess}</p>
                                </div>
                              )}

                              <div className="mt-3 space-y-2">
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                  <div>
                                    <label className="mb-1 block text-[11px] font-medium text-black/70 dark:text-white/70">Consecutive course</label>
                                    <select
                                      value={courseLinkForm.courseSlugB}
                                      onChange={(event) => setCourseLinkForm((prev) => ({ ...prev, courseSlugB: event.target.value }))}
                                      className="w-full rounded-md border border-black/15 bg-white px-2 py-1.5 text-xs text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                                    >
                                      <option value="">Select a course...</option>
                                      {schoolCourses
                                        .filter((c) => c.slug !== courseEditingSlug && c.active)
                                        .map((c) => (
                                          <option key={`link-course-${c.slug}`} value={c.slug}>
                                            {c.title} — {c.availableWeekdays.slice().sort((a, b) => a - b).map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ")}{c.availableTimes.length > 0 ? ` · ${c.availableTimes.join(", ")}` : ""}
                                          </option>
                                        ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="mb-1 block text-[11px] font-medium text-black/70 dark:text-white/70">Status</label>
                                    <button
                                      type="button"
                                      onClick={() => setCourseLinkForm((prev) => ({ ...prev, active: !prev.active }))}
                                      className={`inline-flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-xs font-medium transition ${
                                        courseLinkForm.active
                                          ? "border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-900/20 dark:text-emerald-300"
                                          : "border-black/15 bg-white text-black/50 dark:border-white/15 dark:bg-white/5 dark:text-white/40"
                                      }`}
                                    >
                                      <span className={`inline-block h-2 w-2 rounded-full ${courseLinkForm.active ? "bg-emerald-500" : "bg-black/20 dark:bg-white/20"}`} />
                                      {courseLinkForm.active ? "Active" : "Inactive"}
                                    </button>
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                  <div>
                                    <label className="mb-1 block text-[11px] font-medium text-black/70 dark:text-white/70">Drop-in price (USD)</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min={0}
                                      value={courseLinkForm.dropInConsecutiveCents}
                                      onChange={(event) => setCourseLinkForm((prev) => ({ ...prev, dropInConsecutiveCents: event.target.value }))}
                                      placeholder="e.g., 12"
                                      className="w-full rounded-md border border-black/15 bg-white px-2 py-1.5 text-xs text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                                    />
                                  </div>
                                  <div>
                                    <label className="mb-1 block text-[11px] font-medium text-black/70 dark:text-white/70">Package-holder price (USD)</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min={0}
                                      value={courseLinkForm.packageHolderConsecutiveCents}
                                      onChange={(event) => setCourseLinkForm((prev) => ({ ...prev, packageHolderConsecutiveCents: event.target.value }))}
                                      placeholder="e.g., 5"
                                      className="w-full rounded-md border border-black/15 bg-white px-2 py-1.5 text-xs text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                                    />
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={(e) => saveCourseLink(e as unknown as React.FormEvent)}
                                    disabled={courseLinkSaving}
                                    className="inline-flex items-center rounded-md bg-[var(--brand,#b61616)] px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-60"
                                  >
                                    {courseLinkSaving ? "Saving..." : courseLinkEditingId ? "Update link" : "Add link"}
                                  </button>
                                  {courseLinkEditingId && (
                                    <button
                                      type="button"
                                      onClick={resetCourseLinkForm}
                                      className="inline-flex items-center rounded-md border border-black/20 bg-white px-3 py-1.5 text-xs font-semibold text-black/80 transition dark:border-white/20 dark:bg-white/[0.04] dark:text-white/80"
                                    >
                                      Cancel
                                    </button>
                                  )}
                                </div>
                              </div>

                              {courseLinksAsA.length > 0 && (
                                <div className="mt-3 space-y-1.5">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-black/60 dark:text-white/60">
                                    Courses after this one ({courseLinksAsA.length})
                                  </p>
                                  {courseLinksAsA.map((link) => {
                                    const courseB = schoolCourses.find((c) => c.slug === link.courseSlugB)
                                    return (
                                      <div key={`link-as-a-${link.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-black/10 bg-white/60 px-2 py-1.5 dark:border-white/10 dark:bg-white/[0.03]">
                                        <div className="min-w-0 flex-1">
                                          <p className="truncate text-xs font-medium text-black dark:text-white">
                                            {schoolCourses.find(c => c.slug === courseEditingSlug)?.title ?? courseEditingSlug} → {courseB?.title || link.courseSlugB}
                                          </p>
                                          <p className="text-[11px] text-black/60 dark:text-white/60">
                                            Drop-in: {formatUsdInputLabel(centsToUsdInput(link.dropInConsecutiveCents))} · Package: {formatUsdInputLabel(centsToUsdInput(link.packageHolderConsecutiveCents))}
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                          <button type="button" onClick={() => toggleCourseLinkActive(link)} disabled={courseLinkSaving} className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition ${link.active ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-black/10 text-black/40 dark:bg-white/10 dark:text-white/40"}`}>
                                            {link.active ? "Active" : "Inactive"}
                                          </button>
                                          <button type="button" onClick={() => editCourseLink(link)} className="rounded border border-black/20 px-1.5 py-0.5 text-[10px] font-semibold text-black/70 dark:border-white/20 dark:text-white/60">Edit</button>
                                          <button type="button" onClick={() => deleteCourseLink(link.id)} disabled={courseLinkSaving} className="rounded border border-red-500/40 px-1.5 py-0.5 text-[10px] font-semibold text-red-500 disabled:opacity-40">Remove</button>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}

                              {courseLinksAsB.length > 0 && (
                                <div className="mt-3 space-y-1.5">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-black/60 dark:text-white/60">
                                    Courses before this one ({courseLinksAsB.length})
                                  </p>
                                  {courseLinksAsB.map((link) => {
                                    const courseA = schoolCourses.find((c) => c.slug === link.courseSlugA)
                                    return (
                                      <div key={`link-as-b-${link.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-black/10 bg-white/60 px-2 py-1.5 dark:border-white/10 dark:bg-white/[0.03]">
                                        <div className="min-w-0 flex-1">
                                          <p className="truncate text-xs font-medium text-black dark:text-white">
                                            {courseA?.title || link.courseSlugA} → {schoolCourses.find(c => c.slug === courseEditingSlug)?.title ?? courseEditingSlug}
                                          </p>
                                          <p className="text-[11px] text-black/60 dark:text-white/60">
                                            Drop-in: {formatUsdInputLabel(centsToUsdInput(link.dropInConsecutiveCents))} · Package: {formatUsdInputLabel(centsToUsdInput(link.packageHolderConsecutiveCents))}
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                          <button type="button" onClick={() => toggleCourseLinkActive(link)} disabled={courseLinkSaving} className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition ${link.active ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-black/10 text-black/40 dark:bg-white/10 dark:text-white/40"}`}>
                                            {link.active ? "Active" : "Inactive"}
                                          </button>
                                          <button type="button" onClick={() => editCourseLink(link)} className="rounded border border-black/20 px-1.5 py-0.5 text-[10px] font-semibold text-black/70 dark:border-white/20 dark:text-white/60">Edit</button>
                                          <button type="button" onClick={() => deleteCourseLink(link.id)} disabled={courseLinkSaving} className="rounded border border-red-500/40 px-1.5 py-0.5 text-[10px] font-semibold text-red-500 disabled:opacity-40">Remove</button>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}

                              {courseLinksAsA.length === 0 && courseLinksAsB.length === 0 && (
                                <p className="mt-2 text-[11px] text-black/50 dark:text-white/50">No consecutive class links yet.</p>
                              )}
                              </>
                            ) : (
                              <p className="mt-1 text-xs text-black/50 dark:text-white/50">Create the course first to manage consecutive class links.</p>
                            )}
                          </div>
                          </div>

                          <div style={{ display: schoolWizard.step === 5 ? undefined : "none" }}>
                          <div className="text-xs">
                            <p className="text-[11px] uppercase tracking-[0.2em] text-black/60 dark:text-white/60">{selectedCourseKindReviewLabel}</p>
                            {schoolLoading ? (
                              <div className="mt-2 animate-pulse space-y-2">
                                <div className="h-16 rounded-md bg-black/10 dark:bg-white/10" />
                                <div className="h-4 rounded bg-black/10 dark:bg-white/10" />
                                <div className="h-4 rounded bg-black/10 dark:bg-white/10" />
                              </div>
                            ) : (
                              <div className="mt-3 space-y-3">
                                <div className="grid gap-3 md:grid-cols-2">
                                  <div
                                    className="rounded-md border border-black/10 bg-black/[0.02] p-1.5 dark:border-white/10 dark:bg-white/[0.03]"
                                    onMouseEnter={() => setReviewPreviewHover("home")}
                                    onMouseLeave={() => setReviewPreviewHover((prev) => (prev === "home" ? null : prev))}
                                  >
                                    <p className="text-[10px] uppercase tracking-[0.2em] text-black/60 dark:text-white/60">Home card</p>
                                    <div className="relative mt-1 h-48 overflow-hidden rounded-md border border-black/10 bg-[#050810] dark:border-white/10">
                                      {reviewPreviewHover === "home" && previewVideoSource ? (
                                        isEmbedPreviewVideo ? (
                                          <iframe
                                            src={previewVideoSource}
                                            title="Home card mini preview"
                                            className="h-48 w-full"
                                            allow="autoplay; encrypted-media; picture-in-picture"
                                            allowFullScreen
                                          />
                                        ) : (
                                          <video
                                            src={previewVideoSource}
                                            poster={previewMediaUrl || undefined}
                                            className="h-full w-full object-cover"
                                            autoPlay
                                            loop
                                            muted
                                            playsInline
                                            preload="metadata"
                                          />
                                        )
                                      ) : previewMediaUrl ? (
                                        <Image
                                          src={previewMediaUrl}
                                          alt="Home card mini preview"
                                          fill
                                          unoptimized
                                          sizes="(min-width: 768px) 50vw, 100vw"
                                          className="h-full w-full object-cover"
                                        />
                                      ) : (
                                        <div className="flex h-48 items-center justify-center bg-black/35 text-[10px] uppercase tracking-[0.2em] text-white/55">Course image</div>
                                      )}
                                      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.1),rgba(0,0,0,0.72))]" />
                                      <a
                                        href={previewEditorHref}
                                        className={`absolute bottom-3 right-3 z-10 inline-flex h-8 items-center rounded-lg border px-3 text-xs font-semibold backdrop-blur ${
                                          courseForm.slug.trim()
                                            ? "border-white/40 bg-black/55 text-white hover:border-[var(--brand,#ff4b4b)]/75 hover:text-[var(--brand,#ffb3b3)]"
                                            : "pointer-events-none border-white/20 bg-black/35 text-white/45"
                                        }`}
                                      >
                                        Edit home card
                                      </a>
                                    </div>
                                  </div>
                                  <div
                                    className="rounded-md border border-black/10 bg-black/[0.02] p-1.5 dark:border-white/10 dark:bg-white/[0.03]"
                                    onMouseEnter={() => setReviewPreviewHover("single")}
                                    onMouseLeave={() => setReviewPreviewHover((prev) => (prev === "single" ? null : prev))}
                                  >
                                    <p className="text-[10px] uppercase tracking-[0.2em] text-black/60 dark:text-white/60">Single page</p>
                                    <div className="relative mt-1 h-48 overflow-hidden rounded-md border border-black/10 bg-[#050810] dark:border-white/10">
                                      {reviewPreviewHover === "single" && previewVideoSource ? (
                                        isEmbedPreviewVideo ? (
                                          <iframe
                                            src={previewVideoSource}
                                            title="Single page mini preview"
                                            className="h-48 w-full"
                                            allow="autoplay; encrypted-media; picture-in-picture"
                                            allowFullScreen
                                          />
                                        ) : (
                                          <video
                                            src={previewVideoSource}
                                            poster={previewMediaUrl || undefined}
                                            className="h-full w-full object-cover"
                                            autoPlay
                                            loop
                                            muted
                                            playsInline
                                            preload="metadata"
                                          />
                                        )
                                      ) : previewMediaUrl ? (
                                        <Image
                                          src={previewMediaUrl}
                                          alt="Single page mini preview"
                                          fill
                                          unoptimized
                                          sizes="(min-width: 768px) 50vw, 100vw"
                                          className="h-full w-full object-cover"
                                        />
                                      ) : (
                                        <div className="flex h-48 items-center justify-center bg-black/35 text-[10px] uppercase tracking-[0.2em] text-white/55">Single image</div>
                                      )}
                                      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.2),rgba(0,0,0,0.78))]" />
                                      <a
                                        href={previewEditorHref}
                                        className={`absolute bottom-3 right-3 z-10 inline-flex h-8 items-center rounded-lg border px-3 text-xs font-semibold backdrop-blur ${
                                          courseForm.slug.trim()
                                            ? "border-white/40 bg-black/55 text-white hover:border-[var(--brand,#ff4b4b)]/75 hover:text-[var(--brand,#ffb3b3)]"
                                            : "pointer-events-none border-white/20 bg-black/35 text-white/45"
                                        }`}
                                      >
                                        Edit single page
                                      </a>
                                    </div>
                                  </div>
                                </div>
                                {/* Course Info + Reviews + Calendar */}
                                <div className="grid grid-cols-2 gap-4 border-t border-black/10 pt-3 dark:border-white/10">
                                  <div className="min-w-0 space-y-1">
                                    <p className="truncate text-sm font-semibold text-black dark:text-white">{courseForm.title || "Untitled"}</p>
                                    <p className="text-black/70 dark:text-white/70">{courseForm.description || "No course description yet."}</p>
                                    <p className="truncate text-black/65 dark:text-white/65">Type: {selectedCourseKindLabel}</p>
                                    <p className="truncate text-black/65 dark:text-white/65">Slug: {courseForm.slug || "—"}</p>
                                    <p className="text-black/75 dark:text-white/75">
                                      Drop-in: {formatUsdInputLabel(courseForm.dropInPriceCents)} · First class: {formatUsdInputLabel(courseForm.firstClassPriceCents)}
                                    </p>
                                    {courseForm.specialDiscountType !== "none" ? (
                                      <p className="text-black/75 dark:text-white/75">
                                        Discount:{" "}
                                        {courseForm.specialDiscountType === "custom"
                                          ? courseForm.specialDiscountCustomLabel || "Custom"
                                          : courseForm.specialDiscountType === "valentines_desc"
                                            ? "San Valentin desc"
                                            : "Navidad desc"}{" "}
                                        · Price {formatUsdInputLabel(courseForm.specialDiscountPrice)}
                                      </p>
                                    ) : null}
                                    <p className="text-black/75 dark:text-white/75">
                                      Publication:{" "}
                                      {courseForm.publicationMode === "coming_soon"
                                        ? "Coming soon"
                                        : courseForm.publicationMode === "launch_date"
                                          ? `Launch ${courseForm.launchDate || "—"}`
                                          : "Publish now"}
                                    </p>
                                     <p className="truncate text-black/75 dark:text-white/75">Address: {courseForm.location || "—"}</p>
                                     <p className="truncate text-black/75 dark:text-white/75">
                                       Default room: {courseForm.defaultRoomId ? roomById[courseForm.defaultRoomId]?.name || "Selected room" : "None"}
                                     </p>
                                     <p className="text-black/65 dark:text-white/65">
                                       {scheduleDerivedData.times.length > 0
                                         ? `Times: ${scheduleDerivedData.times.map((time) => formatClockLabel(time)).join(", ")}`
                                        : "Times: schedule to be defined"}
                                     </p>
                                    {/* Reviews by type */}
                                    <div className="mt-3 border-t border-black/10 pt-3 dark:border-white/10">
                                      <p className="text-[11px] uppercase tracking-[0.2em] text-black/60 dark:text-white/60">Reviews by type</p>
                                      <div className="mt-1 grid grid-cols-2 md:grid-cols-3 gap-2">
                                        {courseReviewVariants.map((variant) => {
                                          return (
                                          <div
                                            key={`course-review-variant-${variant.kind}`}
                                            className="rounded-md border border-black/10 bg-white/50 px-2 py-1.5 dark:border-white/10 dark:bg-white/[0.02]"
                                          >
                                            <div className="min-w-0 space-y-0.5">
                                              <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${variant.active ? "text-[var(--brand,#b61616)] dark:text-[var(--brand,#ff6b6b)]" : "text-black dark:text-white"}`}>
                                                {variant.label}
                                              </p>
                                              <p className="text-[11px] text-black/70 dark:text-white/70">{variant.hint}</p>
                                              <p className="text-[11px] text-black/65 dark:text-white/65">
                                                {courseForm.title || "Untitled"} · {formatUsdInputLabel(courseForm.dropInPriceCents)}
                                              </p>
                                            </div>
                                            {variant.active ? (
                                              <span className="rounded-full border border-[var(--brand,#b61616)]/50 bg-[var(--brand,#b61616)]/15 px-1.5 py-0.5 text-[10px] text-[var(--brand,#ff4b4b)]">
                                                Active
                                              </span>
                                          ) : null}
                                        </div>
                                        )
                                      })}
                                      </div>
                                    </div>
                                  </div>
                                  {/* Right column: Monthly Calendar */}
                                  <div className="min-w-0">
                                    {schoolLoading ? (
                                      <div className="h-52 rounded-md bg-black/10 dark:bg-white/10 animate-pulse" />
                                    ) : (
                                      <CalendarPicker
                                        value=""
                                        onChange={() => {}}
                                        values={[...scheduleCalendarMap.keys()].sort()}
                                        multiple
                                        onValuesChange={() => {}}
                                        timezone="America/New_York"
                                        className="!w-full !rounded-md !bg-white/60 dark:!bg-white/[0.06]"
                                        compact
                                        locked
                                        getDateTooltip={getCourseScheduleDateTooltip}
                                        getDateTone={getCourseScheduleDateTone}
                                      />
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ display: "none" }} className="grid gap-4 xl:grid-cols-[minmax(0,0.5fr)_minmax(0,0.9fr)]">
                          <div className="min-w-0 p-2 text-xs">
                            <p className="uppercase tracking-[0.2em] text-black/60 dark:text-white/60">Saved courses</p>
                            <div className="mt-3 max-h-60 overflow-y-auto pr-1 space-y-3">
                              {schoolLoading ? (
                                <div className="grid grid-cols-1 gap-2">
                                  <div className="h-20 rounded-md bg-black/10 dark:bg-white/10 animate-pulse" />
                                  <div className="h-20 rounded-md bg-black/10 dark:bg-white/10 animate-pulse" />
                                  <div className="h-20 rounded-md bg-black/10 dark:bg-white/10 animate-pulse" />
                                  <div className="h-20 rounded-md bg-black/10 dark:bg-white/10 animate-pulse" />
                                </div>
                              ) : schoolCourses.length === 0 ? (
                                <p className="text-black/60 dark:text-white/60">No courses created yet.</p>
                              ) : (
                      <div className="grid grid-cols-6 gap-3">
                                  {schoolCourses.map((item, index) => {
                                    const total = schoolCourses.length
                                    const remainder = total % 3
                                    let spanClass = "col-span-2"
                                    if (remainder === 1 && index === total - 1) {
                                      spanClass = "col-span-6"
                                    } else if (remainder === 2 && index >= total - 2) {
                                      spanClass = "col-span-3"
                                    }
                                    return (
                                      <div
                                        key={`course-row-${item.id}`}
                                        className={`rounded-xl border border-black/10 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.02] ${spanClass}`}
                                      >
                                        <div className="flex items-start gap-3">
                                          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-black/10 ring-1 ring-black/10 dark:bg-white/10 dark:ring-white/10">
                                            <Image
                                              src={item.coverImageUrl || "/images/carousel/_DSC1076.JPG"}
                                              alt={item.title}
                                              fill
                                              unoptimized
                                              sizes="48px"
                                              className="h-full w-full object-cover"
                                            />
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <p className="truncate font-semibold text-black dark:text-white">{item.title}</p>
                                            <p className="truncate text-xs text-black/60 dark:text-white/60">
                                              {item.slug} · {item.kind}
                                            </p>
                                            {item.availableWeekdays.length > 0 && (
                                              <p className="mt-0.5 truncate text-[11px] text-black/45 dark:text-white/45">
                                                {item.availableWeekdays
                                                  .slice()
                                                  .sort((a, b) => a - b)
                                                  .map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d])
                                                  .join(", ")}
                                                {item.availableTimes.length > 0 && ` · ${item.availableTimes.join(", ")}`}
                                              </p>
                                            )}
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                              <button
                                                type="button"
                                                onClick={() => loadCourseIntoForm(item)}
                                                className="rounded border border-[var(--brand,#b61616)]/60 px-2 py-0.5 text-[11px] font-semibold text-[var(--brand,#ff4b4b)]"
                                              >
                                                Edit
                                              </button>
                                              {currentRole === "owner" && (
                                                <button
                                                  type="button"
                                                  onClick={() => deleteCourse(item.slug, item.title)}
                                                  className="rounded border border-red-500/60 px-2 py-0.5 text-[11px] font-semibold text-red-500 hover:bg-red-500/10"
                                                >
                                                  Delete
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                          </div>
                        </div>
                      </div>
                      </>) : (
                        <p className="mt-4 text-center text-sm text-black/50 dark:text-white/50">Create the course first to configure this step.</p>
                      )}
                    </div>
                  </div>

                  <div style={{ display: schoolWizard.activeEntity === "courses" && schoolWizard.step === 6 ? undefined : "none" }} className="mt-5">
                    {courseEditingSlug ? (<>
                    {/* Publish on Social */}
                    <div className="min-w-0 rounded-xl border border-black/10 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.02]">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-black/55 dark:text-white/55">Publish on social</p>
                      <p className="mt-1 text-xs text-black/60 dark:text-white/60">Share this course directly from the dashboard.</p>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => void copyCourseLink()}
                          disabled={!previewPublicHref}
                          className="rounded-md border border-black/20 bg-white px-2 py-1.5 text-xs font-semibold text-black/80 transition hover:border-[var(--brand,#b61616)]/55 hover:text-[var(--brand,#ff4b4b)] disabled:opacity-40 dark:border-white/20 dark:bg-white/[0.04] dark:text-white/80"
                        >
                          Copy link
                        </button>
                        <button
                          type="button"
                          onClick={() => shareCourse("facebook")}
                          disabled={!previewPublicHref}
                          className="rounded-md border border-black/20 bg-white px-2 py-1.5 text-xs font-semibold text-black/80 transition hover:border-[var(--brand,#b61616)]/55 hover:text-[var(--brand,#ff4b4b)] disabled:opacity-40 dark:border-white/20 dark:bg-white/[0.04] dark:text-white/80"
                        >
                          Facebook
                        </button>
                        <button
                          type="button"
                          onClick={() => shareCourse("x")}
                          disabled={!previewPublicHref}
                          className="rounded-md border border-black/20 bg-white px-2 py-1.5 text-xs font-semibold text-black/80 transition hover:border-[var(--brand,#b61616)]/55 hover:text-[var(--brand,#ff4b4b)] disabled:opacity-40 dark:border-white/20 dark:bg-white/[0.04] dark:text-white/80"
                        >
                          X
                        </button>
                        <button
                          type="button"
                          onClick={() => shareCourse("whatsapp")}
                          disabled={!previewPublicHref}
                          className="rounded-md border border-black/20 bg-white px-2 py-1.5 text-xs font-semibold text-black/80 transition hover:border-[var(--brand,#b61616)]/55 hover:text-[var(--brand,#ff4b4b)] disabled:opacity-40 dark:border-white/20 dark:bg-white/[0.04] dark:text-white/80"
                        >
                          WhatsApp
                        </button>
                        <button
                          type="button"
                          onClick={() => shareCourse("instagram")}
                          disabled={!previewPublicHref}
                          className="rounded-md border border-black/20 bg-white px-2 py-1.5 text-xs font-semibold text-black/80 transition hover:border-[var(--brand,#b61616)]/55 hover:text-[var(--brand,#ff4b4b)] disabled:opacity-40 dark:border-white/20 dark:bg-white/[0.04] dark:text-white/80"
                        >
                          Instagram
                        </button>
                        <button
                          type="button"
                          onClick={() => shareCourse("tiktok")}
                          disabled={!previewPublicHref}
                          className="rounded-md border border-black/20 bg-white px-2 py-1.5 text-xs font-semibold text-black/80 transition hover:border-[var(--brand,#b61616)]/55 hover:text-[var(--brand,#ff4b4b)] disabled:opacity-40 dark:border-white/20 dark:bg-white/[0.04] dark:text-white/80"
                        >
                          TikTok
                        </button>
                      </div>
                    </div>
                    </>) : (
                      <p className="mt-4 text-center text-sm text-black/50 dark:text-white/50">Create the course first to configure this step.</p>
                    )}
                  </div>


                  <div style={{ display: schoolWizard.activeEntity === "courses" && schoolWizard.step === 6 ? undefined : "none" }} className="mt-4 grid grid-cols-2 gap-2">
                    {courseEditingSlug ? (<>
                    <button
                      type="button"
                      onClick={resetCourseBuilder}
                      disabled={schoolBusy !== null || courseMediaUploading !== null}
                      className="inline-flex w-full items-center justify-center rounded-md border border-black/20 bg-white px-4 py-2 text-sm font-semibold text-black/80 transition hover:border-[var(--brand,#b61616)]/55 hover:text-[var(--brand,#ff4b4b)] disabled:opacity-60 dark:border-white/20 dark:bg-white/[0.04] dark:text-white/80"
                    >
                      Reset
                    </button>
                    <button
                      type="submit"
                      disabled={schoolBusy !== null || courseMediaUploading !== null}
                      className="inline-flex w-full items-center justify-center rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60"
                    >
                      {schoolBusy === "course" ? "Saving..." : "Save course"}
                    </button>
                    </>) : (
                      <p className="mt-4 text-center text-sm text-black/50 dark:text-white/50">Create the course first to configure this step.</p>
                    )}
                  </div>
                </form>

                {/* Step navigation */}
                <div className="mt-6 flex items-center justify-between border-t border-black/10 pt-4 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => schoolWizard.prevStep(wizardEnabledCtx)}
                    disabled={schoolWizard.step === 0}
                    className="rounded-lg border border-black/10 px-4 py-1.5 text-xs font-medium text-black/60 transition hover:bg-black/[0.04] disabled:opacity-30 dark:border-white/10 dark:text-white/60 dark:hover:bg-white/[0.04]"
                  >
                    ← Previous
                  </button>
                  <span className="text-[10px] text-black/40 dark:text-white/40">
                    Step {schoolWizard.step + 1} of {schoolWizard.totalSteps}
                  </span>
                  <button
                    type="button"
                    onClick={() => schoolWizard.nextStep(wizardEnabledCtx)}
                    disabled={schoolWizard.step >= schoolWizard.totalSteps - 1}
                    className="rounded-lg border border-[var(--brand,#b61616)]/30 bg-[var(--brand,#b61616)]/10 px-4 py-1.5 text-xs font-medium text-[var(--brand,#ff4b4b)] transition hover:bg-[var(--brand,#b61616)]/20 disabled:opacity-30"
                  >
                    Next →
                  </button>
                </div>
              </div>

            </article>

            {/* Saved Courses — always visible when courses tab is active */}
            <article style={{ display: schoolWizard.activeEntity === "courses" ? undefined : "none" }} className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
              <header className="mb-4">
                <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Course catalog</p>
                <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Saved courses</h3>
              </header>

              {/* Search + Filter */}
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  value={courseCatalogSearch}
                  onChange={(e) => setCourseCatalogSearch(e.target.value)}
                  placeholder="Search by name or slug..."
                  className="min-w-0 flex-1 rounded-md border border-black/15 bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                />
                <div className="flex items-center gap-1 rounded-lg border border-black/8 bg-black/[0.02] p-1 dark:border-white/8 dark:bg-white/[0.02]">
                  {(["all", "active", "inactive"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setCourseCatalogFilter(f)}
                      className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                        courseCatalogFilter === f
                          ? "bg-[var(--brand,#b61616)]/15 text-[var(--brand,#ff4b4b)]"
                          : "text-black/55 hover:bg-black/[0.04] hover:text-black/80 dark:text-white/55 dark:hover:bg-white/[0.04] dark:hover:text-white/80"
                      }`}
                    >
                      {f === "all" ? "All" : f === "active" ? "Active" : "Inactive"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                {schoolLoading ? (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="h-24 rounded-md bg-black/10 dark:bg-white/10 animate-pulse" />
                    <div className="h-24 rounded-md bg-black/10 dark:bg-white/10 animate-pulse" />
                    <div className="h-24 rounded-md bg-black/10 dark:bg-white/10 animate-pulse" />
                  </div>
                ) : (() => {
                  const q = courseCatalogSearch.toLowerCase().trim()
                  const filtered = schoolCourses.filter((c) => {
                    if (courseCatalogFilter === "active" && !c.active) return false
                    if (courseCatalogFilter === "inactive" && c.active) return false
                    if (q && !c.title.toLowerCase().includes(q) && !c.slug.toLowerCase().includes(q)) return false
                    return true
                  })
                  if (filtered.length === 0) return (
                    <p className="text-sm text-black/60 dark:text-white/60">
                      {schoolCourses.length === 0 ? "No courses created yet." : "No courses match the current filter."}
                    </p>
                  )
                  return (
                    <div className="grid grid-cols-3 gap-3">
                      {filtered.map((item) => {
                        const previewMediaUrl = item.coverImageUrl || (item.previewVideoUrl ? `/api/og?title=${encodeURIComponent(item.title)}` : null)
                        return (
                          <div
                            key={`saved-course-ext-${item.slug}`}
                            className={`flex items-start gap-3 rounded-lg border p-2.5 ${
                              item.active
                                ? "border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.02]"
                                : "border-black/5 bg-black/[0.01] opacity-60 dark:border-white/5 dark:bg-white/[0.01]"
                            }`}
                          >
                            {previewMediaUrl ? (
                              <Image
                                src={previewMediaUrl}
                                alt={item.title}
                                width={48}
                                height={48}
                                unoptimized
                                className="h-12 w-12 flex-none rounded-md object-cover"
                              />
                            ) : (
                              <div className="flex h-12 w-12 flex-none items-center justify-center rounded-md bg-black/10 text-[8px] uppercase text-black/40 dark:bg-white/10 dark:text-white/40">img</div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <p className="truncate text-xs font-semibold text-black dark:text-white">{item.title}</p>
                                <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                                  item.active
                                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                    : "bg-black/10 text-black/50 dark:bg-white/10 dark:text-white/50"
                                }`}>
                                  {item.active ? "Active" : "Inactive"}
                                </span>
                              </div>
                              <p className="truncate text-[11px] text-black/60 dark:text-white/60">{item.slug}</p>
                              <p className="text-[11px] text-black/55 dark:text-white/55">
                                {item.availableWeekdays.length > 0
                                  ? item.availableWeekdays.sort((a: number, b: number) => a - b).map((d: number) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ")
                                  : ""}
                                {item.availableTimes.length > 0 ? ` · ${item.availableTimes.join(", ")}` : ""}
                              </p>
                              {(() => {
                                const links = allCourseLinksMap[item.slug]
                                const allLinks = [...(links?.asA || []), ...(links?.asB || [])]
                                if (allLinks.length === 0) return null
                                return (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {allLinks.map((link) => {
                                      const linkedSlug = link.courseSlugA === item.slug ? link.courseSlugB : link.courseSlugA
                                      const linkedCourse = schoolCourses.find((c) => c.slug === linkedSlug)
                                      return (
                                        <span key={link.id} className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${link.active ? "bg-violet-500/15 text-violet-500 dark:text-violet-400" : "bg-black/5 text-black/40 dark:bg-white/5 dark:text-white/40"}`}>
                                          ↔ {linkedCourse?.title || linkedSlug}
                                        </span>
                                      )
                                    })}
                                  </div>
                                )
                              })()}
                              <div className="mt-1.5 flex gap-2">
                                <button type="button" onClick={() => loadCourseIntoForm(item)} className="rounded border border-blue-500/40 px-2 py-0.5 text-[10px] font-semibold text-blue-500 transition hover:bg-blue-500/10">Edit</button>
                                <button type="button" onClick={() => toggleCourseActive(item)} disabled={schoolBusy !== null} className={`rounded border px-2 py-0.5 text-[10px] font-semibold transition ${item.active ? "border-amber-500/40 text-amber-500 hover:bg-amber-500/10" : "border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10"}`}>{item.active ? "Hold" : "Activate"}</button>
                                {currentRole === "owner" && (
                                  <button type="button" onClick={() => deleteCourse(item.slug, item.title)} disabled={schoolBusy !== null} className="rounded border border-red-500/60 px-2 py-0.5 text-[10px] font-semibold text-red-500 hover:bg-red-500/10">Delete</button>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            </article>

            <div style={{ display: schoolWizard.activeEntity === "packages" || schoolWizard.activeEntity === "points" ? undefined : "none" }} className="grid gap-4">
              <article style={{ display: schoolWizard.activeEntity === "packages" ? undefined : "none" }} className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
                <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Package builder</p>
                <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">
                  {schoolWizard.step === 0 ? "Package information"
                    : schoolWizard.step === 1 ? "Assign courses"
                    : schoolWizard.step === 2 ? "Pricing and credits"
                    : "Validity and status"}
                </h3>

                <form onSubmit={savePackagePlan} className="mt-4 space-y-5">
                  <div className="flex items-center justify-between gap-3 rounded-md border border-black/10 bg-black/[0.03] px-3 py-2 text-[11px] text-black/70 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/70">
                    <span>{editingPackageId ? "Editing existing package" : "Create a package tied to one course."}</span>
                    {editingPackageId ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPackageId(null)
                          setPackageForm(createEmptyPackageForm())
                        }}
                        className="font-semibold text-[var(--brand,#b61616)]"
                      >
                        New package
                      </button>
                    ) : null}
                  </div>
                  <div style={{ display: schoolWizard.activeEntity === "packages" && (schoolWizard.step === 0 || schoolWizard.step === 1) ? undefined : "none" }} className="grid gap-3 md:grid-cols-3">
                    <input
                      name="packageKey"
                      value={packageForm.key}
                      onChange={(event) => setPackageForm((prev) => ({ ...prev, key: event.target.value }))}
                      placeholder="Key (e.g., morning-3-week)"
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                      required
                      disabled={editingPackageId !== null}
                    />
                    <input
                      name="packageLabel"
                      value={packageForm.label}
                      onChange={(event) => setPackageForm((prev) => ({ ...prev, label: event.target.value }))}
                      placeholder="Label"
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                      required
                    />
                    <input
                      name="packageDescription"
                      value={packageForm.description}
                      onChange={(event) => setPackageForm((prev) => ({ ...prev, description: event.target.value }))}
                      placeholder="Description (optional)"
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                    <div style={{ display: schoolWizard.step === 1 ? undefined : "none" }} className="md:col-span-3">
                      <label className="mb-2 block text-xs font-medium text-black/70 dark:text-white/70">
                        Courses <span className="text-[var(--brand,#b61616)]">*</span>
                      </label>
                      <div className="grid grid-cols-6 gap-2">
                        {courseOptions.map((course, index) => {
                          const active = packageForm.courseSlugs.includes(course.slug)
                          const total = courseOptions.length
                          const remainder = total % 3
                          // Grid of 6 columns so we can do: span-2 (1/3), span-3 (1/2), span-6 (full)
                          // Complete rows: each item spans 2 (fits 3 per row)
                          // Last row with 1 item: span 6 (full width)
                          // Last row with 2 items: each spans 3 (half width each)
                          let spanClass = "col-span-2" // default: 3 items per row
                          if (remainder === 1 && index === total - 1) {
                            spanClass = "col-span-6"
                          } else if (remainder === 2 && index >= total - 2) {
                            spanClass = "col-span-3"
                          }
                          return (
                            <button
                              key={`package-course-${course.slug}`}
                              type="button"
                              onClick={() => togglePackageCourse(course.slug)}
                              className={`rounded-xl border px-3 py-3 text-left text-sm transition ${spanClass} ${
                                active
                                  ? "border-[var(--brand,#b61616)]/60 bg-[var(--brand,#b61616)]/12 text-[var(--brand,#ff4b4b)] shadow-[0_10px_24px_-18px_rgba(182,22,22,0.85)]"
                                  : "border-black/15 bg-white/80 text-black/80 dark:border-white/15 dark:bg-white/5 dark:text-white/80"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                {course.imageUrl ? (
                                  <div
                                    role="img"
                                    aria-label={course.title}
                                    className="h-12 w-12 rounded-xl bg-cover bg-center ring-1 ring-black/10 dark:ring-white/10"
                                    style={{ backgroundImage: `url("${course.imageUrl}")` }}
                                  />
                                ) : (
                                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-black/5 text-xs font-semibold uppercase text-black/50 ring-1 ring-black/10 dark:bg-white/10 dark:text-white/55 dark:ring-white/10">
                                    {course.title
                                      .split(" ")
                                      .slice(0, 2)
                                      .map((part) => part[0])
                                      .join("")}
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div>
                                      <p className={`font-semibold ${active ? "text-[var(--brand,#b61616)] dark:text-[var(--brand,#ff7b7b)]" : "text-black dark:text-white"}`}>
                                        {course.title}
                                      </p>
                                      {course.kindLabel ? (
                                        <p className="mt-0.5 text-[11px] uppercase tracking-[0.18em] text-black/45 dark:text-white/45">{course.kindLabel}</p>
                                      ) : null}
                                    </div>
                                    <span
                                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                                        active
                                          ? "border-[var(--brand,#b61616)]/40 bg-[var(--brand,#b61616)]/10 text-[var(--brand,#ff4b4b)]"
                                          : "border-black/10 bg-black/[0.04] text-black/55 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/55"
                                      }`}
                                    >
                                      {active ? "Selected" : "Available"}
                                    </span>
                                  </div>
                                  {course.scheduleLabel ? (
                                    <p className="mt-2 text-xs text-black/65 dark:text-white/65">{course.scheduleLabel}</p>
                                  ) : null}
                                  {course.description ? (
                                    <p className="mt-1 line-clamp-2 text-xs text-black/60 dark:text-white/60">{course.description}</p>
                                  ) : null}
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                      <p className="mt-2 text-xs text-black/60 dark:text-white/60">
                        {packageForm.courseSlugs.length > 0
                          ? `${packageForm.courseSlugs.length} course${packageForm.courseSlugs.length > 1 ? "s" : ""} assigned to this package.`
                          : "No courses selected yet."}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: schoolWizard.activeEntity === "packages" && schoolWizard.step === 2 ? undefined : "none" }}>
                  <div className="grid gap-2 md:grid-cols-4">
                    <input
                      name="packagePriceCents"
                      type="text"
                      inputMode="decimal"
                      value={packageForm.priceCents}
                      onChange={(event) => setPackageForm((prev) => ({ ...prev, priceCents: event.target.value }))}
                      placeholder="Price (e.g., 145.50)"
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                    <input
                      name="packageTotalCredits"
                      type="number"
                      min={0}
                      value={packageForm.totalCredits}
                      onChange={(event) => setPackageForm((prev) => ({ ...prev, totalCredits: event.target.value }))}
                      placeholder="Classes included"
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                      disabled={packageForm.isUnlimited}
                    />
                    <input
                      name="packageMakeUps"
                      type="number"
                      min={0}
                      value={packageForm.makeUps || ""}
                      onChange={(event) => setPackageForm((prev) => ({ ...prev, makeUps: event.target.value }))}
                      placeholder="Extra make-up classes"
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                    <label className="inline-flex items-center gap-2 rounded-md border border-black/15 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-white/5 dark:text-white">
                      <input
                        name="packageIsUnlimited"
                        type="checkbox"
                        checked={packageForm.isUnlimited}
                        onChange={(event) => setPackageForm((prev) => ({ ...prev, isUnlimited: event.target.checked }))}
                      />
                      Unlimited
                    </label>
                  </div>
                  <div className="mt-4 flex items-baseline justify-between gap-4">
                    <p className="text-[11px] text-black/70 dark:text-white/70">
                      Public price preview: <span className="font-semibold text-black dark:text-white">{formatUsdInputLabel(packageForm.priceCents)}</span>
                    </p>
                    <p className="text-[11px] text-black/70 dark:text-white/70">
                      <span className="font-semibold text-black dark:text-white">Classes included</span> is the base number of classes in the package. <span className="font-semibold text-black dark:text-white">Make-ups</span> add extra usable classes on top of that total.
                    </p>
                  </div>
                  </div>
                  <div style={{ display: schoolWizard.activeEntity === "packages" && schoolWizard.step === 3 ? undefined : "none" }} className="space-y-3">
                  <div className="grid gap-2 md:grid-cols-3">
                    <input
                      name="packageValidDays"
                      type="number"
                      min={1}
                      value={packageForm.validDays}
                      onChange={(event) => setPackageForm((prev) => ({ ...prev, validDays: event.target.value }))}
                      placeholder="Validity days"
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                    <select
                      name="packageStatus"
                      value={packageForm.status}
                      onChange={(event) => {
                        const nextStatus = event.target.value as PackagePlanStatus
                        setPackageForm((prev) => ({
                          ...prev,
                          status: nextStatus,
                          active: nextStatus === "ACTIVE",
                          launchAt: nextStatus === "SCHEDULED" ? prev.launchAt : "",
                        }))
                      }}
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="SUSPENDED">Suspended</option>
                      <option value="SCHEDULED">Scheduled</option>
                      <option value="DELETED">Deleted</option>
                    </select>
                    <input
                      name="packageLaunchAt"
                      type="datetime-local"
                      value={packageForm.launchAt}
                      onChange={(event) => setPackageForm((prev) => ({ ...prev, launchAt: event.target.value, status: "SCHEDULED", active: false }))}
                      disabled={packageForm.status !== "SCHEDULED"}
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                  </div>
                  <div className="mt-4 flex items-baseline justify-between gap-4">
                    <p className="text-[11px] text-black/70 dark:text-white/70">
                      Lifecycle: <span className="font-semibold text-black dark:text-white">{packageForm.status}</span>
                    </p>
                    <p className="text-[11px] text-black/70 dark:text-white/70">
                      <span className="font-semibold text-black dark:text-white">Active</span> shows in the catalog. <span className="font-semibold text-black dark:text-white">Suspended</span> hides it. <span className="font-semibold text-black dark:text-white">Scheduled</span> waits for the launch date. <span className="font-semibold text-black dark:text-white">Deleted</span> hides it from the default admin view.
                    </p>
                  </div>
                  {packageForm.status === "SCHEDULED" ? (
                    <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-200">
                      This package will stay hidden until the launch date arrives. Use a future date, or switch back to <span className="font-semibold">Active</span> to publish now.
                    </div>
                  ) : null}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={schoolBusy !== null}
                      className="inline-flex w-full items-center justify-center rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60"
                    >
                      {schoolBusy === "package" ? "Saving..." : editingPackageId ? "Update package" : "Save package"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPackageId(null)
                        setPackageForm(createEmptyPackageForm())
                      }}
                      disabled={schoolBusy !== null}
                      className="inline-flex w-full items-center justify-center rounded-md border border-black/10 px-4 py-2 text-sm font-semibold text-black transition hover:bg-black/5 disabled:opacity-60 dark:border-white/10 dark:text-white dark:hover:bg-white/5"
                    >
                      Reset package
                    </button>
                  </div>
                  </div>
                </form>

                {/* Step navigation */}
                <div className="mt-6 flex items-center justify-between border-t border-black/10 pt-4 dark:border-white/10">
                  <button type="button" onClick={() => schoolWizard.prevStep(wizardEnabledCtx)} disabled={schoolWizard.step === 0} className="rounded-lg border border-black/10 px-4 py-1.5 text-xs font-medium text-black/60 transition hover:bg-black/[0.04] disabled:opacity-30 dark:border-white/10 dark:text-white/60 dark:hover:bg-white/[0.04]">← Previous</button>
                  <span className="text-[10px] text-black/40 dark:text-white/40">Step {schoolWizard.step + 1} of {schoolWizard.totalSteps}</span>
                  <button type="button" onClick={() => schoolWizard.nextStep(wizardEnabledCtx)} disabled={schoolWizard.step >= schoolWizard.totalSteps - 1} className="rounded-lg border border-[var(--brand,#b61616)]/30 bg-[var(--brand,#b61616)]/10 px-4 py-1.5 text-xs font-medium text-[var(--brand,#ff4b4b)] transition hover:bg-[var(--brand,#b61616)]/20 disabled:opacity-30">Next →</button>
                </div>

                <header className="mb-4 mt-6 border-t border-black/10 pt-4 dark:border-white/10">
                  <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Package catalog</p>
                  <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Saved packages</h3>
                </header>

                <div className="max-h-[32rem] overflow-y-auto rounded-xl border border-black/10 bg-white/60 p-3 text-xs dark:border-white/10 dark:bg-white/[0.02]">
                  <div className="mb-3 flex items-center gap-3 pb-1">
                    <div className="flex flex-nowrap gap-2">
                      {([
                        ["all", `Live (${packageCounts.live})`],
                        ["ACTIVE", `Active (${packageCounts.ACTIVE})`],
                        ["SUSPENDED", `Suspended (${packageCounts.SUSPENDED})`],
                        ["SCHEDULED", `Scheduled (${packageCounts.SCHEDULED})`],
                        ["DELETED", `Deleted (${packageCounts.DELETED})`],
                      ] as const).map(([value, label]) => {
                        const selected = packageStatusFilter === value
                        return (
                          <button
                            key={`package-filter-${value}`}
                            type="button"
                            onClick={() => setPackageStatusFilter(value)}
                            className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                              selected
                                ? "border-[var(--brand,#b61616)] bg-[var(--brand,#b61616)] text-white"
                                : "border-black/10 text-black/70 hover:bg-black/5 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/5"
                            }`}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                    <input
                      type="search"
                      value={packageSearchQuery}
                      onChange={(event) => setPackageSearchQuery(event.target.value)}
                      placeholder="Search packages"
                      className="ml-auto w-full min-w-0 flex-1 rounded-full border border-black/10 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/10 dark:bg-white/5 dark:text-white"
                    />
                  </div>
                  {packageStatusFilter === "all" && packageCounts.DELETED > 0 ? (
                    <p className="mb-2 text-[11px] text-black/55 dark:text-white/55">
                      Deleted packages are hidden from the default view. Open the <span className="font-semibold">Deleted</span> filter to review or restore them.
                    </p>
                  ) : null}
                  {schoolLoading ? (
                    <p className="text-black/60 dark:text-white/60">Loading packages...</p>
                  ) : filteredSchoolPackages.length === 0 ? (
                    <p className="text-black/60 dark:text-white/60">No packages created yet.</p>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-3">
                      {filteredSchoolPackages.map((item) => (
                      <div key={`package-row-${item.id}`} className="flex h-full flex-col rounded-xl border border-black/10 bg-black/[0.03] px-3 py-3 dark:border-white/10 dark:bg-white/[0.02]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-black dark:text-white">{item.label}</p>
                            <p className="truncate text-black/65 dark:text-white/65">{item.key} · {item.courseSlug || "no course"}</p>
                          </div>
                          <div className="flex items-center gap-2 self-start">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${getPackageLifecycleBadgeClass(getPackageLifecycleStatus(item))}`}>
                              {getPackageLifecycleStatus(item)}
                            </span>
                          </div>
                        </div>
                        <div className="mt-3 grid w-full grid-cols-2 gap-x-6 gap-y-3 text-xs text-black/70 dark:text-white/70">
                          <div className="min-w-0 text-center">
                            <p className="font-medium text-black/55 dark:text-white/55">Price</p>
                            <p className="mt-1 text-sm font-semibold text-black/90 dark:text-white/90">{item.priceCents === null ? "—" : formatMoney(item.priceCents)}</p>
                          </div>
                          <div className="min-w-0 text-center">
                            <p className="font-medium text-black/55 dark:text-white/55">Classes</p>
                            <p className="mt-1 text-sm font-semibold text-black/90 dark:text-white/90">{item.totalCredits ?? "∞"}</p>
                          </div>
                          <div className="min-w-0 text-center">
                            <p className="font-medium text-black/55 dark:text-white/55">Make-ups</p>
                            <p className="mt-1 text-sm font-semibold text-black/90 dark:text-white/90">{item.makeUps}</p>
                          </div>
                          <div className="min-w-0 text-center">
                            <p className="font-medium text-black/55 dark:text-white/55">Valid</p>
                            <p className="mt-1 text-sm font-semibold text-black/90 dark:text-white/90">{item.validDays} days</p>
                          </div>
                        </div>
                        <div className="mt-4 space-y-2 border-t border-black/10 pt-3 dark:border-white/10">
                          {item.cadence ? (
                            <p className="text-[11px] text-black/55 dark:text-white/55">Cadence: {item.cadence}</p>
                          ) : null}
                          <p className="text-[11px] text-black/55 dark:text-white/55">
                            Public visibility: {getPackageLifecycleStatus(item) === "ACTIVE" ? "Shown in catalog" : "Hidden from catalog"}
                          </p>
                          {item.launchAt ? (
                            <p className="text-[11px] text-black/55 dark:text-white/55">Launch date: {formatPackageLaunchLabel(item.launchAt) || String(item.launchAt).replace("T", " ").slice(0, 16)}</p>
                          ) : null}
                        </div>
                        <div className="mt-4 flex flex-nowrap gap-1.5 border-t border-black/10 pt-3 dark:border-white/10">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPackageId(item.id)
                              setPackageForm(packageRowToFormState(item))
                            }}
                            className="rounded-md border border-black/10 px-1.5 py-0.5 text-[10px] font-semibold text-black transition hover:bg-black/5 dark:border-white/10 dark:text-white dark:hover:bg-white/5"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPackageId(null)
                              setPackageForm(duplicatePackageRowToFormState(item))
                            }}
                            className="rounded-md border border-black/10 px-1.5 py-0.5 text-[10px] font-semibold text-black transition hover:bg-black/5 dark:border-white/10 dark:text-white dark:hover:bg-white/5"
                          >
                            Duplicate
                          </button>
                          {getPackageLifecycleStatus(item) === "DELETED" ? (
                            <button
                              type="button"
                              disabled={schoolBusy !== null}
                              onClick={() => void setPackageLifecycleState(item, "ACTIVE")}
                              className="rounded-md border border-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 transition hover:bg-emerald-500/10 disabled:opacity-60 dark:border-emerald-400/20 dark:text-emerald-300 dark:hover:bg-emerald-400/10"
                            >
                              Restore
                            </button>
                          ) : (
                            <>
                              {getPackageLifecycleStatus(item) === "SCHEDULED" ? (
                                <button
                                  type="button"
                                  disabled={schoolBusy !== null}
                                  onClick={() => void setPackageLifecycleState(item, "ACTIVE")}
                                  className="rounded-md border border-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 transition hover:bg-amber-500/10 disabled:opacity-60 dark:border-amber-400/20 dark:text-amber-300 dark:hover:bg-amber-400/10"
                                >
                                  Launch now
                                </button>
                              ) : null}
                              <button
                                type="button"
                                disabled={schoolBusy !== null}
                                onClick={() => void setPackageLifecycleState(item, getPackageLifecycleStatus(item) === "ACTIVE" ? "SUSPENDED" : "ACTIVE")}
                                className="rounded-md border border-black/10 px-1.5 py-0.5 text-[10px] font-semibold text-black transition hover:bg-black/5 disabled:opacity-60 dark:border-white/10 dark:text-white dark:hover:bg-white/5"
                              >
                                {getPackageLifecycleStatus(item) === "ACTIVE" ? "Hold" : "Activate"}
                              </button>
                              <button
                                type="button"
                                disabled={schoolBusy !== null}
                                onClick={() => void deletePackagePlan(item)}
                                className="rounded-md border border-rose-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 transition hover:bg-rose-500/10 disabled:opacity-60 dark:border-rose-400/20 dark:text-rose-300 dark:hover:bg-rose-400/10"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                    </div>
                  )}
                </div>
              </article>

              <article style={{ display: schoolWizard.activeEntity === "points" ? undefined : "none" }} className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
                {/* Step 0: Rule Builder */}
                <div style={{ display: schoolWizard.activeEntity === "points" && schoolWizard.step === 0 ? undefined : "none" }}>
                <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Points builder</p>
                <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Rule builder</h3>
                <p className="mt-1 text-sm text-black/65 dark:text-white/65">Configure automatic point rules for attendance, referrals, and other events.</p>

                <form onSubmit={savePointsRule} className="mt-3 space-y-2">
                  <div className="grid grid-cols-[minmax(180px,0.9fr)_minmax(0,1fr)_110px_140px] gap-2">
                    <select
                      name="pointsRuleTemplate"
                      value={pointsRuleForm.templateKey}
                      onChange={(event) => setPointsRuleForm((prev) => ({ ...prev, templateKey: event.target.value }))}
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    >
                      {POINTS_RULE_DEFINITIONS.map((item) => (
                        <option key={`points-template-${item.key}`} value={item.key}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    <input
                      name="pointsRuleEventType"
                      value={selectedPointsRuleTemplate?.eventType || ""}
                      readOnly
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                    <input
                      name="pointsRulePoints"
                      type="number"
                      step="0.5"
                      value={pointsRuleForm.points}
                      onChange={(event) => setPointsRuleForm((prev) => ({ ...prev, points: event.target.value }))}
                      placeholder="Points"
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                      required
                    />
                    <label className="inline-flex h-full items-center justify-center gap-2 rounded-md border border-black/10 bg-white/60 px-3 py-2 text-xs dark:border-white/10 dark:bg-white/[0.02]">
                      <input
                        name="pointsRuleActive"
                        type="checkbox"
                        checked={pointsRuleForm.active}
                        onChange={(event) => setPointsRuleForm((prev) => ({ ...prev, active: event.target.checked }))}
                      />
                      Active rule
                    </label>
                  </div>
                  <p className="rounded-md border border-black/10 bg-white/60 px-3 py-2 text-xs text-black/70 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/70">
                    {selectedPointsRuleTemplate?.description || "Select a rule to configure points."}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="submit"
                      disabled={schoolBusy !== null}
                      className="inline-flex w-full items-center justify-center rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60"
                    >
                      {schoolBusy === "rule" ? "Saving..." : "Save rule"}
                    </button>
                    <button
                      type="button"
                      disabled={schoolBusy !== null}
                      onClick={resetPointsRuleForm}
                      className="inline-flex w-full items-center justify-center rounded-md border border-black/15 bg-white/70 px-4 py-2 text-sm font-semibold text-black transition hover:bg-white disabled:opacity-60 dark:border-white/15 dark:bg-white/[0.06] dark:text-white dark:hover:bg-white/[0.1]"
                    >
                      Reset
                    </button>
                  </div>
                </form>

                </div>

                {/* Step 1: Manual Assignment */}
                <div style={{ display: schoolWizard.activeEntity === "points" && schoolWizard.step === 1 ? undefined : "none" }}>
                <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Points</p>
                <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Manual assignment</h3>
                <p className="mt-1 text-sm text-black/65 dark:text-white/65">Assign points directly to a student by email.</p>

                <form onSubmit={assignPointsManually} className="mt-3 space-y-3 rounded-md border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.02]">
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                    <input
                      name="pointsAssignUserEmail"
                      type="email"
                      value={pointsAssignForm.userEmail}
                      onChange={(event) => setPointsAssignForm((prev) => ({ ...prev, userEmail: event.target.value }))}
                      placeholder="Student email"
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                      required
                    />
                    <input
                      name="pointsAssignType"
                      value={pointsAssignForm.type}
                      onChange={(event) => setPointsAssignForm((prev) => ({ ...prev, type: event.target.value }))}
                      placeholder="Type"
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                    <input
                      name="pointsAssignPoints"
                      type="number"
                      step="0.5"
                      value={pointsAssignForm.points}
                      onChange={(event) => setPointsAssignForm((prev) => ({ ...prev, points: event.target.value }))}
                      placeholder="Points"
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                      required
                    />
                    <input
                      name="pointsAssignNote"
                      value={pointsAssignForm.note}
                      onChange={(event) => setPointsAssignForm((prev) => ({ ...prev, note: event.target.value }))}
                      placeholder="Note"
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                    <input
                      name="pointsAssignEventKey"
                      value={pointsAssignForm.eventKey}
                      onChange={(event) => setPointsAssignForm((prev) => ({ ...prev, eventKey: event.target.value }))}
                      placeholder="Event key (optional)"
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="submit"
                      disabled={schoolBusy !== null}
                      className="inline-flex w-full items-center justify-center rounded-md border border-[var(--brand,#b61616)]/60 bg-[var(--brand,#b61616)]/15 px-4 py-2 text-sm font-semibold text-[var(--brand,#ff4b4b)] transition disabled:opacity-60"
                    >
                      {schoolBusy === "assign" ? "Assigning..." : "Assign points"}
                    </button>
                    <button
                      type="button"
                      disabled={schoolBusy !== null}
                      onClick={resetPointsAssignForm}
                      className="inline-flex w-full items-center justify-center rounded-md border border-black/15 bg-white/70 px-4 py-2 text-sm font-semibold text-black transition hover:bg-white disabled:opacity-60 dark:border-white/15 dark:bg-white/[0.06] dark:text-white dark:hover:bg-white/[0.1]"
                    >
                      Reset
                    </button>
                  </div>
                </form>
                </div>

                {/* Points step nav footer */}
                <div className="mt-4 flex items-center justify-between">
                  <button type="button" onClick={() => schoolWizard.prevStep(wizardEnabledCtx)} disabled={schoolWizard.step === 0} className="rounded-lg border border-black/10 px-4 py-1.5 text-xs font-medium text-black/60 transition hover:bg-black/[0.04] disabled:opacity-30 dark:border-white/10 dark:text-white/60 dark:hover:bg-white/[0.04]">← Previous</button>
                  <span className="text-[10px] text-black/40 dark:text-white/40">Step {schoolWizard.step + 1} of {schoolWizard.totalSteps}</span>
                  <button type="button" onClick={() => schoolWizard.nextStep(wizardEnabledCtx)} disabled={schoolWizard.step >= schoolWizard.totalSteps - 1} className="rounded-lg border border-[var(--brand,#b61616)]/30 bg-[var(--brand,#b61616)]/10 px-4 py-1.5 text-xs font-medium text-[var(--brand,#ff4b4b)] transition hover:bg-[var(--brand,#b61616)]/20 disabled:opacity-30">Next →</button>
                </div>

                {/* Points rules list — always visible */}
                <header className="mb-4 mt-6 border-t border-black/10 pt-4 dark:border-white/10">
                  <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Points catalog</p>
                  <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Saved rules</h3>
                </header>

                <div className="max-h-[32rem] overflow-y-auto rounded-xl border border-black/10 bg-white/60 p-3 text-xs dark:border-white/10 dark:bg-white/[0.02]">
                  {schoolLoading ? (
                    <p className="text-black/60 dark:text-white/60">Loading rules...</p>
                  ) : schoolPointsRules.length === 0 ? (
                    <p className="text-black/60 dark:text-white/60">No rules defined.</p>
                  ) : (
                    <div className="space-y-2">
                      {schoolPointsRules.map((item) => (
                        <div key={`points-rule-row-${item.id}`} className="rounded-md border border-black/10 bg-black/[0.03] px-2 py-1.5 dark:border-white/10 dark:bg-white/[0.02]">
                          <p className="font-semibold text-black dark:text-white">{item.label}</p>
                          <p className="text-black/65 dark:text-white/65">
                            {item.eventType} · {item.points} pts · {item.active ? "active" : "inactive"}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            </div>
            </StaffCatalogSection>
          </div>
        ) : null}

        {showStaffOps ? (
          <article className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
            <header className="mb-4">
              <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Payroll</p>
              <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Staff payment control</h3>
              <p className="mt-1 text-sm text-black/65 dark:text-white/65">
                Hours worked, payments sent, and payment delay per user.
              </p>
            </header>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(180px,0.5fr)]">
              <div className="rounded-xl border border-black/10 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="mb-2 hidden grid-cols-[minmax(0,1fr)_88px_120px_90px_90px_100px] gap-2 px-2 text-[11px] uppercase tracking-[0.2em] text-black/55 dark:text-white/55 md:grid">
                  <span>Staff user</span>
                  <span className="text-right">Hours</span>
                  <span className="text-right">Amount</span>
                  <span className="text-right">Status</span>
                  <span className="text-right">Delay</span>
                  <span className="text-right">Log out</span>
                </div>

                <div className="space-y-2">
                  {payrollRows.length === 0 ? (
                    <p className="rounded-lg border border-black/10 bg-white/65 px-3 py-2 text-sm text-black/65 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/65">
                      No payroll rows available yet.
                    </p>
                  ) : (
                    payrollRows.map((item) => (
                      <div
                        key={`payroll-row-${item.userId}`}
                        className="grid gap-2 rounded-lg border border-black/10 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.02] md:grid-cols-[minmax(0,1fr)_88px_120px_90px_90px_100px] md:items-center"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-black dark:text-white">{item.name}</p>
                          <p className="truncate text-xs text-black/60 dark:text-white/60">
                            {CATEGORY_LABELS[item.category]} · Pay day: {item.paydayLabel}
                          </p>
                        </div>
                        <div className="text-sm text-black md:text-right dark:text-white">
                          {(() => {
                            const sourceRow = rowById[item.userId]
                            const liveMinutes = sourceRow ? getLiveSessionMinutes(sourceRow) : null
                            const storedHours = typeof item.hoursWorked === "number" ? item.hoursWorked : null
                            if (storedHours !== null && liveMinutes !== null) {
                              const totalHours = storedHours + liveMinutes / 60
                              return (
                                <>
                                  <p>{`${totalHours.toFixed(1)}h`}</p>
                                  <p className="text-[11px] text-emerald-500 dark:text-emerald-300">
                                    Live +{formatMinutesLabel(liveMinutes)}
                                  </p>
                                </>
                              )
                            }
                            if (storedHours !== null) {
                              return <p>{`${storedHours.toFixed(1)}h`}</p>
                            }
                            if (liveMinutes !== null) {
                              return (
                                <>
                                  <p>{formatMinutesLabel(liveMinutes)}</p>
                                  <p className="text-[11px] text-emerald-500 dark:text-emerald-300">Live</p>
                                </>
                              )
                            }
                            return <p>—</p>
                          })()}
                        </div>
                        <p className="text-sm font-semibold text-black md:text-right dark:text-white">
                          {typeof item.amountCents === "number" ? formatMoney(item.amountCents) : "—"}
                        </p>
                        <p className="md:text-right">
                          <button
                            type="button"
                            onClick={() => openDelayDetails(item)}
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] transition hover:brightness-110 ${
                              item.status === "paid"
                                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                                : item.status === "pending"
                                  ? "border-[var(--brand,#b61616)]/40 bg-[var(--brand,#b61616)]/10 text-[var(--brand,#ff4b4b)]"
                                  : "border-white/20 bg-white/5 text-white/75"
                            }`}
                          >
                            {item.status === "paid" ? "Paid" : item.status === "pending" ? "Pending" : "No data"}
                          </button>
                        </p>
                        <p className="md:text-right">
                          <button
                            type="button"
                            onClick={() => openDelayDetails(item)}
                            className="text-xs text-black/70 transition hover:text-[var(--brand,#b61616)] dark:text-white/70 dark:hover:text-[var(--brand,#ff4b4b)]"
                          >
                            {item.status === "paid"
                              ? "On time"
                              : item.status === "pending"
                                ? typeof item.delayDays === "number"
                                  ? item.delayDays > 0
                                    ? `${item.delayDays}d late`
                                    : "Due today"
                                  : "Pending"
                                : "—"}
                          </button>
                        </p>
                        <p className="md:text-right">
                          {(() => {
                            const sourceRow = rowById[item.userId]
                            const canLogout = Boolean((sourceRow?.online || sourceRow?.authOnline) && sourceRow?.staffLastCheckInAt)
                            if (!canLogout) {
                              return <span className="text-xs text-black/60 dark:text-white/60">—</span>
                            }
                            return (
                              <button
                                type="button"
                                disabled={busyUserId === item.userId}
                                onClick={() => void runAction(item.userId, "force_logout")}
                                className="inline-flex rounded-md border border-[var(--brand,#b61616)]/45 bg-[var(--brand,#b61616)]/12 px-2 py-1 text-[11px] font-semibold text-[var(--brand,#ff4b4b)] disabled:opacity-60"
                              >
                                {busyUserId === item.userId ? "..." : "Log out"}
                              </button>
                            )
                          })()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="grid gap-3">
                <div className="rounded-xl border border-black/10 bg-white/65 p-4 dark:border-white/10 dark:bg-[linear-gradient(160deg,rgba(182,22,22,0.35)_0%,rgba(32,18,51,0.88)_100%)]">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-black/10 bg-white/70 dark:border-white/20 dark:bg-white/10">
                    <CircleDollarSign className="h-4 w-4 text-[var(--brand,#ff4b4b)]" />
                  </div>
                  <p className="mt-3 text-xs uppercase tracking-[0.24em] text-black/55 dark:text-white/60">Total payroll</p>
                  <p className="mt-1 text-2xl font-semibold text-black dark:text-white">
                    {formatMoney(payrollSummary.total)}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md border border-black/10 bg-white/70 px-2 py-1.5 text-black dark:border-white/10 dark:bg-white/[0.06] dark:text-white">
                      Paid: {payrollSummary.paidCount} users
                    </div>
                    <div className="rounded-md border border-black/10 bg-white/70 px-2 py-1.5 text-black dark:border-white/10 dark:bg-white/[0.06] dark:text-white">
                      Pending: {payrollSummary.pendingCount}
                    </div>
                    <div className="col-span-2 rounded-md border border-black/10 bg-white/70 px-2 py-1.5 text-black dark:border-white/10 dark:bg-white/[0.06] dark:text-white">
                      <div className="flex items-center justify-between gap-2">
                        <span>Pending amount: {formatMoney(payrollSummary.pending)}</span>
                        <button
                          type="button"
                          disabled={payrollSummary.pending <= 0}
                          onClick={openPendingPayments}
                          className="rounded-md border border-[var(--brand,#b61616)]/45 bg-[var(--brand,#b61616)]/12 px-2 py-1 text-[11px] font-semibold text-[var(--brand,#ff4b4b)] transition disabled:opacity-45"
                        >
                          Pay
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-black/10 bg-white/65 p-4 dark:border-white/10 dark:bg-[linear-gradient(160deg,rgba(182,22,22,0.16)_0%,rgba(17,21,36,0.9)_100%)]">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-black/10 bg-white/70 dark:border-white/20 dark:bg-white/10">
                    <Clock3 className="h-4 w-4 text-[var(--brand,#ff4b4b)]" />
                  </div>
                  <p className="mt-3 text-xs uppercase tracking-[0.24em] text-black/55 dark:text-white/60">Pay day rules</p>
                  <div className="mt-2 space-y-2 text-sm text-black dark:text-white">
                    <div className="rounded-md border border-black/10 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.06]">
                      General cycle:{" "}
                      <span className="font-semibold">
                        {payrollSummary.fridayCount > 0 ? `Friday (${payrollSummary.fridayCount} users)` : "Not configured"}
                      </span>
                    </div>
                    <div className="rounded-md border border-black/10 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.06]">
                      {payrollSummary.exceptions.length === 0 ? (
                        <p className="text-sm">No exceptions configured.</p>
                      ) : (
                        <div className="space-y-1 text-xs">
                          <p className="text-[11px] uppercase tracking-[0.2em] text-black/55 dark:text-white/60">Exceptions</p>
                          {payrollSummary.exceptions.slice(0, 4).map((item) => (
                            <p key={`payday-exception-${item.id}`} className="truncate">
                              {item.name}: <span className="font-semibold">{item.dayLabel}</span>
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-black/65 dark:text-white/65">
                      Max payment delay:{" "}
                      <span className="font-semibold">
                        {payrollSummary.pendingCount > 0 ? `${payrollSummary.maxDelay} days` : "—"}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {currentRole === "owner" ? <StaffPaymentMethodConfigPanel /> : null}
          </article>
        ) : null}

        {isStudentsView ? (
          <article
            id="students-payments"
            className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5"
          >
          <header className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Students</p>
              <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Student payment board</h3>
              <p className="mt-1 text-sm text-black/65 dark:text-white/65">
                Grid view by student with class payment status, check-in and active package.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refreshPaymentsBoard()}
              disabled={paymentsLoading}
              className="mt-2 inline-flex shrink-0 items-center gap-1 h-9 whitespace-nowrap rounded-full border border-black/20 px-3 text-xs font-medium text-black/70 transition hover:border-[var(--brand,#b61616)]/60 hover:text-[var(--brand,#b61616)] disabled:opacity-50 dark:border-white/20 dark:text-white/70 dark:hover:border-[var(--brand,#b61616)]/60 dark:hover:text-[var(--brand,#b61616)]"
              aria-label="Refresh payments board"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${paymentsLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </header>

          {canManageClerkSync && (clerkSyncLoading || clerkSyncRepairing || clerkSyncError || (clerkSyncHealth?.missingCount ?? 0) > 0 || (clerkSyncHealth?.mismatchedCount ?? 0) > 0) ? (
            <div
              className="mb-4 rounded-2xl border border-[var(--brand,#b61616)]/30 bg-[var(--brand,#b61616)]/8 p-3 shadow-[0_14px_28px_-20px_rgba(0,0,0,0.65)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[var(--brand,#b61616)]/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand,#b61616)] dark:text-[var(--brand,#ff4b4b)]">
                      {clerkSyncLoading ? "Checking users" : clerkSyncRepairing ? "Syncing users" : "Users need sync"}
                    </span>
                    <p className="text-sm text-black/70 dark:text-white/70">
                      {clerkSyncHealth
                        ? (() => {
                            const missing = clerkSyncHealth.missingCount
                            const mismatched = clerkSyncHealth.mismatchedCount ?? 0
                            if (missing > 0 && mismatched > 0) {
                              return `${missing} user${missing === 1 ? "" : "s"} missing and ${mismatched} with outdated info — sync recommended.`
                            }
                            if (missing > 0) {
                              return `${missing} user${missing === 1 ? "" : "s"} need to be synced before they can use the app.`
                            }
                            if (mismatched > 0) {
                              return `${mismatched} student${mismatched === 1 ? " has" : "s have"} outdated info vs Clerk. Sync per student in the cards below (phone is locked).`
                            }
                            return "All users are up to date."
                          })()
                        : "Checking whether all users are ready to use the app."}
                    </p>
                  </div>
                  {clerkSyncError ? <p className="mt-1 text-xs text-red-500 dark:text-red-400">{clerkSyncError}</p> : null}
                  {clerkSyncMessage ? <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-300">{clerkSyncMessage}</p> : null}
                  {clerkSyncHealth && clerkSyncHealth.missingCount > 0 ? (
                    <p className="mt-1 text-xs text-black/60 dark:text-white/60">
                      Users to sync: {clerkSyncHealth.missingUsers.slice(0, 3).map((user) => user.email || "User without email").join(", ")}
                      {clerkSyncHealth.missingCount > 3 ? ` +${clerkSyncHealth.missingCount - 3} more` : ""}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void fetchClerkSyncHealth()}
                    disabled={clerkSyncLoading || clerkSyncRepairing}
                    className="inline-flex h-9 items-center gap-1 rounded-full border border-black/20 px-3 text-xs font-medium text-black/70 transition hover:border-[var(--brand,#b61616)]/60 hover:text-[var(--brand,#b61616)] disabled:opacity-50 dark:border-white/20 dark:text-white/70"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${clerkSyncLoading ? "animate-spin" : ""}`} />
                    Check users
                  </button>
                  <button
                    type="button"
                    onClick={() => void repairClerkSync()}
                    disabled={clerkSyncLoading || clerkSyncRepairing}
                    className="inline-flex h-9 items-center gap-1 rounded-full border border-[var(--brand,#b61616)]/60 bg-[var(--brand,#b61616)]/12 px-3 text-xs font-semibold text-[var(--brand,#b61616)] transition hover:bg-[var(--brand,#b61616)]/18 disabled:opacity-50 dark:text-[var(--brand,#ff4b4b)]"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${clerkSyncRepairing ? "animate-spin" : ""}`} />
                    {clerkSyncRepairing ? "Syncing..." : "Sync users"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {prioritizedTerminalPinAlerts.length > 0 ? (
            <div className="mb-4 rounded-2xl border border-[var(--brand,#b61616)]/18 bg-[linear-gradient(145deg,rgba(182,22,22,0.08),rgba(17,20,31,0.92))] p-3 shadow-[0_14px_28px_-20px_rgba(0,0,0,0.65)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[var(--brand,#b61616)]/30 bg-[var(--brand,#b61616)]/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand,#b61616)]">
                  Terminal alerts
                </span>
                <p className="text-sm text-black/70 dark:text-white/70">
                  PIN issues needing attention from terminal flow.
                </p>
                </div>
                <p className="text-xs text-black/55 dark:text-white/55">Auto-refresh every {terminalPinAlerts.length > 0 ? 5 : 10}s</p>
              </div>
              <div className="mt-3 grid gap-2 xl:grid-cols-2">
                {prioritizedTerminalPinAlerts.map((alert) => (
                  <div
                    key={`${alert.terminalId}-${alert.severity}-${alert.blockedUntil || "open"}`}
                    className={`rounded-xl border px-3 py-2 text-sm dark:bg-white/[0.04] ${
                      alert.severity === "emergency"
                        ? "border-[var(--brand,#b61616)]/30 bg-[var(--brand,#b61616)]/8"
                        : alert.severity === "cooldown"
                          ? "border-amber-500/25 bg-amber-500/8"
                          : "border-yellow-500/20 bg-yellow-500/8"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-black dark:text-white">{alert.terminalName}</span>
                        {alert.terminalLocation ? (
                          <span className="text-[11px] uppercase tracking-[0.16em] text-black/45 dark:text-white/45">{alert.terminalLocation}</span>
                        ) : null}
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                          alert.severity === "emergency"
                            ? "bg-[var(--brand,#b61616)]/15 text-[var(--brand,#b61616)]"
                            : alert.severity === "cooldown"
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-300"
                              : "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300"
                        }`}
                      >
                        {alert.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-black/60 dark:text-white/60">
                      Misses: {alert.missCount}
                      {alert.blockedUntil ? ` · ${formatTerminalAlertRelative(alert.blockedUntil, nowTs)}` : ""}
                    </p>
                    <p className="mt-1 text-sm text-black/75 dark:text-white/75">{alert.message}</p>
                    {alert.blockedUntil ? (
                      <p className="mt-1 text-xs text-black/50 dark:text-white/50">Until {formatTerminalAlertDateTime(alert.blockedUntil)}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-1 flex flex-nowrap gap-2 overflow-x-auto pb-1">
            {[
              {
                key: "students",
                label: "Students",
                icon: Users,
                value: studentsSummary.totalStudents,
                cardClass: "bg-gradient-to-br from-[#788fff]/22 via-[#171b38]/40 to-[#0a0f23]/60",
              },
              {
                key: "revenue",
                label: "Total revenue",
                icon: CircleDollarSign,
                value: formatMoney(studentsSummary.totalRevenueCents),
                cardClass: "bg-gradient-to-br from-emerald-500/20 via-[#132a1f]/40 to-[#0a0f23]/60",
              },
              {
                key: "pending",
                label:
                  paymentCategoryFilter === "history"
                    ? "Pending in scope"
                    : paymentCategoryFilter === "cash"
                      ? "Cash pending"
                      : paymentCategoryFilter === "card"
                        ? "Card pending"
                        : "Pending",
                icon: Clock3,
                value: studentsSummary.pendingByContext,
                cardClass: "bg-gradient-to-br from-[#f59e0b]/18 via-[#221631]/40 to-[#0a0f23]/60",
              },
              {
                key: "paid",
                label: "Paid classes",
                icon: CheckCircle2,
                value: studentsSummary.paidStudents,
                cardClass: "bg-gradient-to-br from-[#6366f1]/22 via-[#1e1435]/40 to-[#0a0f23]/60",
              },
              {
                key: "checkin",
                label: "With check-in",
                icon: MapPin,
                value: studentsSummary.checkedInStudents,
                cardClass: "bg-gradient-to-br from-cyan-400/18 via-[#0e2430]/40 to-[#0a0f23]/60",
              },
            ].map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.key}
                  title={item.label}
                  className={`min-w-[104px] flex-1 rounded-xl border border-white/[0.08] p-3 shadow-[0_12px_24px_-18px_rgba(0,0,0,0.7)] ${item.cardClass}`}
                >
                  <Icon className="mb-1 h-3.5 w-3.5 shrink-0 opacity-60" />
                  <p className="text-2xl font-semibold text-white">{item.value}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-white/50">{item.label}</p>
                </div>
              )
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 md:flex-nowrap">
            <div className="inline-flex shrink-0 flex-wrap items-center gap-1.5 xl:flex-nowrap">
              {([
                ["all", "All"],
                ["cash", "Cash"],
                ["card", "Card"],
                ["packages", "Packages"],
                ["dropin", "Drop-in"],
                ["history", "History"],
              ] as const).map(([category, label]) => (
                <button
                  key={`category-filter-${category}`}
                  type="button"
                  onClick={() => handlePaymentCategoryChange(category)}
                  className={`h-9 cursor-pointer whitespace-nowrap rounded-full border px-3 text-xs font-medium ${
                    paymentCategoryFilter === category
                      ? "border-[var(--brand,#b61616)]/60 bg-[var(--brand,#b61616)]/15 text-[var(--brand,#b61616)]"
                      : "border-black/20 text-black/70 dark:border-white/20 dark:text-white/70"
                  }`}
                >
                  {label}
                </button>
              ))}
              </div>

              <label className="block min-w-0 flex-1 md:basis-[16rem] lg:basis-auto">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-black/45 dark:text-white/45" />
                  <input
                    type="search"
                    value={studentSearchQuery}
                    onChange={(event) => setStudentSearchQuery(event.target.value)}
                    placeholder="Search student, email, phone or course"
                    className="h-9 w-full rounded-full border border-black/20 bg-white/80 pl-10 pr-9 text-sm text-black placeholder:text-black/45 focus:outline-none focus:ring-2 focus:ring-[var(--brand,#b61616)]/35 dark:border-white/20 dark:bg-white/[0.06] dark:text-white dark:placeholder:text-white/45"
                  />
                  {isGlobalSearchLoading || isHistorySearchLoading ? (
                    <div role="status" aria-label="Searching..." className="absolute right-3 top-1/2 -translate-y-1/2 text-black/45 dark:text-white/45">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    </div>
                  ) : null}
                </div>
                {globalSearchError ? (
                  <p className="mt-1 text-xs text-red-500 dark:text-red-400">{globalSearchError}</p>
                ) : null}
              </label>

            <label className="inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap text-xs text-black/70 dark:text-white/70 md:ml-auto">
              <span className="text-[11px] uppercase tracking-[0.16em] text-black/55 dark:text-white/55">Status</span>
              <div className="relative shrink-0">
                <select
                  value={paymentsFilter}
                  onChange={(event) => setPaymentsFilter(event.target.value as "all" | "pending" | "paid")}
                  className="h-9 cursor-pointer appearance-none rounded-full border border-black/20 bg-[linear-gradient(145deg,rgba(255,255,255,0.9),rgba(241,241,252,0.76))] px-3.5 pr-8 text-xs font-medium text-black shadow-[0_10px_22px_-18px_rgba(0,0,0,0.85)] focus:outline-none focus:ring-2 focus:ring-[var(--brand,#b61616)]/35 dark:border-white/20 dark:bg-[linear-gradient(145deg,rgba(255,255,255,0.12),rgba(255,255,255,0.05))] dark:text-white"
                >
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-black/55 dark:text-white/55" />
              </div>
            </label>
          </div>

          {isHistoryMode ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgba(15,17,23,0.94),rgba(20,24,33,0.92))] p-4 shadow-[0_14px_28px_-20px_rgba(0,0,0,0.75)]">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
                {/* Left column: Calendar */}
                <div className="w-full md:min-w-0">
                  <CalendarPicker
                    rangeMode={true}
                    rangeStart={historyFrom}
                    rangeEnd={historyTo}
                    onRangeChange={(start, end) => {
                      const nextRange = resolveHistoryRangeState(start, end)
                      setHistoryFrom(nextRange.historyFrom)
                      setHistoryTo(nextRange.historyTo)
                      setHistoryClassKey("")
                    }}
                    compact
                    timezone="America/New_York"
                    minDate="1900-01-01"
                    isDateDisabled={(isoDate) => isoDate > todayDateIso}
                    getDateDisabledReason={(isoDate) =>
                      isoDate > todayDateIso ? "History mode only supports today or past dates." : undefined
                    }
                  />
                </div>

                {/* Right column: Filters + Stats */}
                <div className="flex min-w-0 w-full flex-col">
                  {/* Range badge - pill horizontal with date range in red */}
                  <div className="flex flex-wrap items-center rounded-full px-4 py-2 mb-3 bg-[var(--brand,#b61616)]/10 border border-[var(--brand,#b61616)]/25">
                    <span className="rounded-full w-full px-3 py-1 text-sm font-bold text-[var(--brand,#b61616)] whitespace-nowrap">
                      {historyReadableRange || "Select date range"}
                    </span>
                  </div>

                  {/* Filters - compact row of chips/selects */}
                  <div className="grid w-full grid-cols-1 gap-2 rounded-lg py-2 mb-3 sm:grid-cols-3">
                    <div className="relative min-w-0">
                      <select
                        value={historyClassKey}
                        onChange={(event) => setHistoryClassKey(event.target.value)}
                        disabled={!historyFrom || !historyTo || historyClassOptions.length === 0}
                        className="h-10 w-full appearance-none rounded-md border border-white/15 bg-white/[0.08] px-2.5 pr-7 text-xs text-white/80 focus:outline-none focus:ring-1 focus:ring-[var(--brand,#b61616)]/50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">All classes</option>
                        {historyClassOptions.map((option) => (
                          <option key={`history-class-${option.slug}`} value={option.slug}>
                            {option.title}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-white/40" />
                    </div>

                    <div className="relative min-w-0">
                      <select
                        value={historyPaymentMethodFilter}
                        onChange={(event) => setHistoryPaymentMethodFilter(event.target.value as HistoryPaymentMethodFilter)}
                        className="h-10 w-full appearance-none rounded-md border border-white/15 bg-white/[0.08] px-2.5 pr-7 text-xs text-white/80 focus:outline-none focus:ring-1 focus:ring-[var(--brand,#b61616)]/50"
                      >
                        <option value="all">All pay</option>
                        <option value="cash">Cash</option>
                        <option value="card">Card</option>
                        <option value="package">Pkg</option>
                        <option value="dropin">Dropin</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-white/40" />
                    </div>

                    <div className="relative min-w-0">
                      <select
                        value={historyAttendanceFilter}
                        onChange={(event) => setHistoryAttendanceFilter(event.target.value as HistoryAttendanceFilter)}
                        className="h-10 w-full appearance-none rounded-md border border-white/15 bg-white/[0.08] px-2.5 pr-7 text-xs text-white/80 focus:outline-none focus:ring-1 focus:ring-[var(--brand,#b61616)]/50"
                      >
                        <option value="all">All attend</option>
                        <option value="attended">Attended</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="no_attendance">No show</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-white/40" />
                    </div>
                  </div>

                  {/* Stats - compact history metric cards with decorative rings */}
                  {historyFrom && historyTo && (
                    <div className="grid flex-1 grid-cols-2 gap-2.5">
                      <div className="flex items-center gap-3 rounded-[1.15rem] border border-white/[0.08] bg-[linear-gradient(160deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025))] px-3 py-2.5 shadow-[0_12px_24px_-22px_rgba(0,0,0,0.85)]">
                        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--brand,#b61616)]/10 text-[var(--brand,#b61616)]">
                          <span aria-hidden className="absolute inset-[2.5px] rounded-full border border-[var(--brand,#b61616)]/20" />
                          <span
                            aria-hidden
                            className="absolute inset-0 rounded-full border border-transparent bg-[conic-gradient(from_210deg,transparent_0deg,rgba(182,22,22,0.45)_120deg,transparent_220deg)] opacity-80 motion-safe:animate-[spin_18s_linear_infinite] motion-reduce:animate-none"
                            style={{ maskImage: "radial-gradient(farthest-side, transparent calc(100% - 1.25px), white calc(100% - 0.9px))" }}
                          />
                          <span className="relative text-[1.1rem] font-semibold leading-none">{historyDerivedStats.studentCount}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-white/45">
                            <span>Students</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 rounded-[1.15rem] border border-white/[0.08] bg-[linear-gradient(160deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025))] px-3 py-2.5 shadow-[0_12px_24px_-22px_rgba(0,0,0,0.85)]">
                        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                          <span aria-hidden className="absolute inset-[2.5px] rounded-full border border-emerald-400/20" />
                          <span
                            aria-hidden
                            className="absolute inset-0 rounded-full border border-transparent bg-[conic-gradient(from_210deg,transparent_0deg,rgba(52,211,153,0.45)_120deg,transparent_220deg)] opacity-80 motion-safe:animate-[spin_18s_linear_infinite] motion-reduce:animate-none"
                            style={{ maskImage: "radial-gradient(farthest-side, transparent calc(100% - 1.25px), white calc(100% - 0.9px))" }}
                          />
                          <span className="relative text-[1.1rem] font-semibold leading-none">{historyDerivedStats.paidCount}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-white/45">
                            <span>Paid</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 rounded-[1.15rem] border border-white/[0.08] bg-[linear-gradient(160deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025))] px-3 py-2.5 shadow-[0_12px_24px_-22px_rgba(0,0,0,0.85)]">
                        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-500/10 text-orange-400">
                          <span aria-hidden className="absolute inset-[2.5px] rounded-full border border-orange-400/20" />
                          <span
                            aria-hidden
                            className="absolute inset-0 rounded-full border border-transparent bg-[conic-gradient(from_210deg,transparent_0deg,rgba(251,146,60,0.45)_120deg,transparent_220deg)] opacity-80 motion-safe:animate-[spin_18s_linear_infinite] motion-reduce:animate-none"
                            style={{ maskImage: "radial-gradient(farthest-side, transparent calc(100% - 1.25px), white calc(100% - 0.9px))" }}
                          />
                          <span className="relative text-[1.1rem] font-semibold leading-none">{historyDerivedStats.pendingCount}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-white/45">
                            <span>Pending</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 rounded-[1.15rem] border border-white/[0.08] bg-[linear-gradient(160deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025))] px-3 py-2.5 shadow-[0_12px_24px_-22px_rgba(0,0,0,0.85)]">
                        <div className="relative flex h-12 min-w-[3.5rem] shrink-0 items-center justify-center rounded-full bg-blue-500/10 px-2 text-blue-400">
                          <span aria-hidden className="absolute inset-[2.5px] rounded-full border border-blue-400/20" />
                          <span
                            aria-hidden
                            className="absolute inset-0 rounded-full border border-transparent bg-[conic-gradient(from_210deg,transparent_0deg,rgba(96,165,250,0.45)_120deg,transparent_220deg)] opacity-80 motion-safe:animate-[spin_18s_linear_infinite] motion-reduce:animate-none"
                            style={{ maskImage: "radial-gradient(farthest-side, transparent calc(100% - 1.25px), white calc(100% - 0.9px))" }}
                          />
                          <span className="relative whitespace-nowrap text-[1rem] font-semibold leading-none tracking-[-0.03em] tabular-nums">${Math.round(historyDerivedStats.totalCollected / 100)}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-white/45">
                            <span>Collected</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 rounded-[1.15rem] border border-white/[0.08] bg-[linear-gradient(160deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025))] px-3 py-2.5 shadow-[0_12px_24px_-22px_rgba(0,0,0,0.85)]">
                        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-fuchsia-500/10 text-fuchsia-300">
                          <span aria-hidden className="absolute inset-[2.5px] rounded-full border border-fuchsia-300/20" />
                          <span
                            aria-hidden
                            className="absolute inset-0 rounded-full border border-transparent bg-[conic-gradient(from_210deg,transparent_0deg,rgba(232,121,249,0.42)_120deg,transparent_220deg)] opacity-80 motion-safe:animate-[spin_18s_linear_infinite] motion-reduce:animate-none"
                            style={{ maskImage: "radial-gradient(farthest-side, transparent calc(100% - 1.25px), white calc(100% - 0.9px))" }}
                          />
                          <span className="relative text-[1.1rem] font-semibold leading-none">{historyDerivedStats.packages}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-white/45">
                            <span>Packages</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 rounded-[1.15rem] border border-white/[0.08] bg-[linear-gradient(160deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025))] px-3 py-2.5 shadow-[0_12px_24px_-22px_rgba(0,0,0,0.85)]">
                        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-cyan-400/10 text-cyan-200">
                          <span aria-hidden className="absolute inset-[2.5px] rounded-full border border-cyan-200/20" />
                          <span
                            aria-hidden
                            className="absolute inset-0 rounded-full border border-transparent bg-[conic-gradient(from_210deg,transparent_0deg,rgba(34,211,238,0.42)_120deg,transparent_220deg)] opacity-80 motion-safe:animate-[spin_18s_linear_infinite] motion-reduce:animate-none"
                            style={{ maskImage: "radial-gradient(farthest-side, transparent calc(100% - 1.25px), white calc(100% - 0.9px))" }}
                          />
                          <span className="relative text-[1.1rem] font-semibold leading-none">{historyDerivedStats.dropIn}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-white/45">
                            <span>Drop-in</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {historyFrom && historyTo && filteredStudentCards.length === 0 && (
                    <div className="text-xs text-white/40">
                      No students found in this range
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {(paymentCategoryFilter === "cash" || (searchResultCards !== null && visiblePaymentIds.length > 0)) ? (
            <div className="mt-4 flex flex-wrap items-center gap-2.5 md:flex-nowrap">
              <p className="inline-flex min-h-10 min-w-0 flex-1 items-center rounded-lg border border-emerald-500/30 bg-[linear-gradient(145deg,rgba(16,185,129,0.2),rgba(7,45,39,0.48))] px-3 py-2 text-xs leading-snug text-emerald-700 dark:text-emerald-300 md:max-w-[36rem]">
                Confirm payment / Mark pending only changes the internal cash status (does not modify Stripe).
              </p>
              <div className="inline-flex shrink-0 flex-wrap items-center justify-end gap-2 md:ml-auto">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedPaymentIds((prev) => [...new Set([...prev, ...visiblePaymentIds])])
                  }
                  className="inline-flex h-10 items-center rounded-full border border-black/20 px-3 text-xs text-black/75 dark:border-white/20 dark:text-white/75"
                >
                  Select visible
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPaymentIds([])}
                  className="inline-flex h-10 items-center rounded-full border border-black/20 px-3 text-xs text-black/75 dark:border-white/20 dark:text-white/75"
                >
                  Clear selection
                </button>
                 <span className="inline-flex h-10 items-center text-xs text-black/60 dark:text-white/60">Selected: {selectedFilteredPaymentIds.length}</span>
                </div>
              </div>
            ) : null}

          {cashSelectedCount > 0 ? (
            <div className="sticky bottom-4 z-30 mt-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/15 bg-[linear-gradient(145deg,rgba(19,22,34,0.96),rgba(42,18,45,0.92))] px-4 py-3 shadow-[0_22px_40px_-12px_rgba(0,0,0,0.9)] backdrop-blur">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">Cash payments</p>
                  <p className="mt-1 text-sm font-medium text-white">{cashSelectedCount} payment{cashSelectedCount === 1 ? "" : "s"} selected</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={paymentsBulkBusyAction !== null}
                    onClick={() => updateSettlementBulk("mark_paid", selectedPaymentIds)}
                    className="rounded-lg border border-emerald-500/60 bg-emerald-500/25 px-4 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/35 disabled:opacity-60 transition-colors"
                  >
                    {paymentsBulkBusyAction === "mark_paid" ? "Processing..." : "Mark all paid"}
                  </button>
                  <button
                    type="button"
                    disabled={paymentsBulkBusyAction !== null}
                    onClick={() => updateSettlementBulk("mark_pending", selectedPaymentIds)}
                    className="rounded-lg border border-amber-500/60 bg-amber-500/25 px-4 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/35 disabled:opacity-60 transition-colors"
                  >
                    {paymentsBulkBusyAction === "mark_pending" ? "Processing..." : "Mark all pending"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentIds([])}
                    className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {cardContext === "global-search" ? (
            <p aria-live="polite" className="mt-5 rounded-lg border border-black/10 bg-black/[0.03] px-3 py-2 text-sm text-black/70 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/70">
              Search results for &quot;{studentSearchQuery.trim()}&quot;
            </p>
          ) : null}

          <div className="mt-5 columns-1 gap-5 sm:columns-2 xl:columns-3 [&>*]:break-inside-avoid [&>*]:mb-5">
            {paymentsLoading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={`students-skeleton-${index}`}
                  className="h-[190px] rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(191,30,30,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_28%),linear-gradient(180deg,rgba(18,20,29,0.98),rgba(11,13,20,0.99))] shadow-[0_28px_60px_-36px_rgba(0,0,0,0.92)] ring-1 ring-white/5 shimmer"
                />
              ))
            ) : cardContext === "global-search" && searchResultCards!.length === 0 ? (
              <p className="col-span-full rounded-lg border border-black/10 bg-black/[0.03] px-3 py-2 text-sm text-black/65 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/65">
                No students found.
              </p>
            ) : !searchResultCards && !shouldPreservePaymentBoard && filteredStudentCards.length === 0 ? (
              <p className="col-span-full rounded-lg border border-black/10 bg-black/[0.03] px-3 py-2 text-sm text-black/65 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/65">
                {cardContext === "history" && (!historyFrom || !historyTo)
                  ? "Select a range to load payment history."
                  : cardContext === "history" && historyFrom > historyTo
                    ? "History range must start on or before the end date."
                    : "No student payments found."}
              </p>
            ) : (
              displayedStudentCards.map((student) => {
                if (student.source === "profile") {
                  const identity = splitCustomerName(student.displayName, student.email)
                  const initials = getInitials(identity.firstName, identity.lastName, student.email)
                  const badges = resolveProfileCardBadges(student)
                  const detailRows = resolveProfileCardDetailRows(student)
                  const settlementControl = resolveProfileSettlementControl(student)
                  const isProfileSettlementSelected = settlementControl ? selectedPaymentIds.includes(settlementControl.paymentId) : false

                  return (
                    <article
                      key={`student-card-${student.key}`}
                      className={`relative rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(191,30,30,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_28%),linear-gradient(180deg,rgba(18,20,29,0.98),rgba(11,13,20,0.99))] shadow-[0_28px_60px_-36px_rgba(0,0,0,0.92)] ring-1 ring-white/5 p-4 text-white ${settlementControl ? "pt-9" : ""}`}
                    >
                      {settlementControl ? (
                        isProfileSettlementSelected ? (
                          <div className="absolute right-3 top-3 z-10 flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => void updateSettlementBulk("mark_paid", [settlementControl.paymentId])}
                              className="inline-flex items-center gap-1 rounded-md bg-[var(--brand,#b61616)]/20 border border-[var(--brand,#b61616)]/40 px-2 py-1 text-[10px] font-semibold text-[var(--brand,#ff4b4b)] hover:bg-[var(--brand,#b61616)]/30 transition-colors"
                            >
                              Mark paid
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedPaymentIds((prev) => prev.filter((id) => id !== settlementControl.paymentId))}
                              className="inline-flex items-center rounded-md bg-black/30 px-1.5 py-1 text-[10px] text-white/60 hover:text-white/80 transition-colors"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <label className="absolute right-3 top-3 z-10 inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-black/30 px-2 py-1 text-[10px] text-white/80 backdrop-blur-sm">
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 accent-[var(--brand,#b61616)]"
                              checked={isProfileSettlementSelected}
                              onChange={(event) => {
                                const checked = event.target.checked
                                setSelectedPaymentIds((prev) => {
                                  if (checked) {
                                    if (prev.includes(settlementControl.paymentId)) return prev
                                    return [...prev, settlementControl.paymentId]
                                  }
                                  return prev.filter((id) => id !== settlementControl.paymentId)
                                })
                              }}
                            />
                            Select
                          </label>
                        )
                      ) : null}
                      <header className="flex items-center gap-3">
                        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-black/35 text-lg font-bold shadow-[0_14px_30px_-18px_rgba(0,0,0,0.85)]">
                          {student.avatarUrl ? (
                            <Image src={student.avatarUrl} alt={student.displayName} fill unoptimized sizes="64px" className="h-full w-full object-cover" />
                          ) : initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="truncate text-lg font-semibold leading-tight">{student.displayName}</h4>
                          <p className="mt-1 truncate text-[12px] text-white/70">Registered · {formatIsoDateLong(student.registeredAt)}</p>
                        </div>
                      </header>

                      {canManageClerkSync && clerkMismatchByUserId.has(student.userId) ? (
                        <ClerkSyncMismatchBanner
                          mismatch={clerkMismatchByUserId.get(student.userId)!}
                          busy={clerkSyncUserBusyId === student.userId}
                          onSync={() => void syncClerkUser(student.userId)}
                        />
                      ) : null}

                      <div className="mt-4 w-full grid grid-cols-2 gap-2.5">
                        {badges.map((badge) => (
                          <span
                            key={badge.key}
                            title={badge.title}
                            className={`${PROFILE_CARD_BADGE_CLASS} ${badge.tone}`}
                          >
                            {badge.label}
                          </span>
                        ))}
                      </div>

                      <div className="mt-4 space-y-2.5 border-t border-white/10 pt-3.5 text-xs text-white/85">
                        {detailRows.map((row) => {
                          const isOutstandingBalanceRow = row.key === "outstanding-balance"
                          const baseRowClasses = "inline-flex w-full items-center justify-between gap-2 text-white/75"
                          const rowClass = isOutstandingBalanceRow
                            ? `${baseRowClasses} border-b border-[var(--brand,#b61616)]/40 pb-2 text-[var(--brand,#ff8b8b)]`
                            : baseRowClasses
                          const labelClass = `inline-flex items-center gap-1 ${
                            isOutstandingBalanceRow
                              ? "text-[var(--brand,#ff9e9e)]"
                              : row.key === "location" || row.key === "email" || row.key === "phone"
                                ? "text-white/70"
                                : ""
                          }`
                          const valueClass = `truncate text-right ${isOutstandingBalanceRow ? "text-[var(--brand,#ffc0c0)]" : ""}`

                          return (
                            <p key={row.key} className={rowClass}>
                              <span className={labelClass}>
                                {row.key === "location" ? <MapPin className="h-3 w-3" /> : null}
                                {row.key === "email" ? <Mail className="h-3 w-3" /> : null}
                                {row.key === "phone" ? <Phone className="h-3 w-3" /> : null}
                                {row.label}
                              </span>
                              <span className={valueClass}>{row.value}</span>
                            </p>
                          )
                        })}
                      </div>

                      <div className={`mt-4 grid gap-2.5 ${canOperateStudentPins && student.userId ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2"}`}>
                        <button
                          type="button"
                          onClick={() => {
                            if (typeof window === "undefined" || !student.email || student.email === "—") return
                            const subject = encodeURIComponent(`Student profile update · ${student.displayName}`)
                            window.location.href = `mailto:${encodeURIComponent(student.email)}?subject=${subject}`
                          }}
                          className="rounded-md border border-white/20 px-2 py-1 text-[11px]"
                        >
                          Notify
                        </button>
                        {canOperateStudentPins && student.userId ? (
                          <button
                            type="button"
                            onClick={() => openStudentPinModalForProfile(student)}
                            className="rounded-md border border-cyan-300/30 bg-cyan-400/10 px-2 py-1 text-[11px] font-semibold text-cyan-100"
                          >
                            {student.provisionalPinExpiresAt ? "Reissue PIN" : "Provisional PIN"}
                          </button>
                        ) : null}
                        {(currentRole === "owner" || currentRole === "admin") && student.userId ? (
                          <button
                            type="button"
                            onClick={() => openOverrideModal(student.userId, student.displayName)}
                            className="rounded-md border border-white/20 bg-white/10 px-2 py-1 text-[11px] font-semibold text-white hover:bg-white/15 transition-colors"
                          >
                            Edit info
                          </button>
                        ) : null}
                      </div>

                      {(currentRole === "owner" || currentRole === "admin") && student.userId && usersWithAuditEntries.has(student.userId) && (
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              setAuditHistoryAnchor(e.currentTarget)
                              setAuditHistoryStudentId(student.userId)
                              setAuditHistoryStudentName(student.displayName)
                            }}
                            className="w-full rounded-md border border-white/15 px-2 py-1.5 text-[11px] text-white/60 hover:text-white/80 hover:border-white/25 transition-colors"
                          >
                            Change history
                          </button>
                        </div>
                      )}
                    </article>
                  )
                }

                const payment = student.latestPayment
                const identity = splitCustomerName(payment.customerName, payment.customerEmail)
                const initials = getInitials(identity.firstName, identity.lastName, payment.customerEmail)
                const packageLabel = payment.activePackage?.label || "No active package"
                const packageValue = payment.activePackage
                  ? payment.activePackage.isUnlimited
                    ? "Unlimited"
                    : payment.activePackage.totalCredits
                      ? `${Math.max(0, payment.activePackage.remainingCredits || 0)} of ${payment.activePackage.totalCredits} remaining`
                      : `${Math.max(0, payment.activePackage.remainingCredits || 0)} credits remaining`
                  : "—"
                const outstandingBalanceLabel = typeof payment.outstandingBalance === "number" && payment.outstandingBalance > 0
                  ? formatMoney(payment.outstandingBalance, payment.currency)
                  : null
                const paidEntries = cardVariant.context === "daily"
                  ? buildHistoryStudentPaidEntries(student.allPayments)
                  : student.allPayments
                    .filter((entry) => entry.classPaid)
                    .slice(0, 12)
                const totalSpentCents = resolveHistoryStudentCardAmountPaidCents(student, cardVariant.context)
                const totalSpentLabel = formatMoney(totalSpentCents, payment.currency)
                const subtitleSlotLabel = formatStudentPaymentCardSlotLabel(payment.classDate, payment.classTime)
                const courseUnion = [...new Set(student.allPayments.map((entry) => entry.courseTitle || entry.courseSlug).filter(Boolean))]
                const studentOpenIds = getOpenPaymentIds(student.allPayments)
                const studentSelectableIds = studentOpenIds.length > 0
                  ? studentOpenIds
                  : student.allPayments.filter((p) => p.paymentChannel === "cash").map((p) => p.id)
                const isSelected = studentSelectableIds.some((id) => selectedPaymentIds.includes(id))
                const studentPinLabel = payment.studentPin.enabled
                  ? payment.studentPin.provisionalActive
                    ? "Provisional PIN"
                    : "Enrolled PIN"
                  : null
                const studentPinTone = resolveStudentPinTone(payment.studentPin)
                const pointsHistoryEntries = payment.pointsHistory.slice(0, 10)

                return (
                  <article
                    key={`student-card-${student.key}`}
                    className={`relative rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(191,30,30,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_28%),linear-gradient(180deg,rgba(18,20,29,0.98),rgba(11,13,20,0.99))] shadow-[0_28px_60px_-36px_rgba(0,0,0,0.92)] ring-1 ring-white/5 p-4 text-white ${
                      payment.paymentChannel === "cash" ? "pt-9" : ""
                    }`}
                  >
                    {payment.paymentChannel === "cash" || (typeof payment.outstandingBalance === "number" && payment.outstandingBalance > 0) ? (
                      isSelected ? (
                        <div className="absolute right-3 top-3 z-10 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void updateSettlementBulk(payment.settlementStatus === "paid" ? "mark_pending" : "mark_paid", payment.settlementStatus === "paid" ? [payment.id] : getOpenPaymentIds(student.allPayments))}
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${
                              payment.settlementStatus === "paid"
                                ? "bg-amber-500/30 border border-amber-500/50 text-amber-200 hover:bg-amber-500/40"
                                : "bg-emerald-500/30 border border-emerald-500/50 text-emerald-200 hover:bg-emerald-500/40"
                            }`}
                          >
                            {payment.settlementStatus === "paid" ? "Mark pending" : "Mark paid"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedPaymentIds((prev) => prev.filter((id) => !studentSelectableIds.includes(id)))}
                            className="inline-flex items-center rounded-md bg-black/40 border border-white/20 px-1.5 py-1 text-[10px] text-white/60 hover:text-white/80 transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <label className="absolute right-3 top-3 z-10 inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-black/30 px-2 py-1 text-[10px] text-white/80 backdrop-blur-sm">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 accent-[var(--brand,#b61616)]"
                            checked={isSelected}
                            onChange={(event) => {
                              const checked = event.target.checked
                              setSelectedPaymentIds((prev) => {
                                if (checked) {
                                  return [...new Set([...prev, ...studentSelectableIds])]
                                }
                                return prev.filter((id) => !studentSelectableIds.includes(id))
                              })
                            }}
                          />
                          Select
                        </label>
                      )
                    ) : null}
                    <header className="flex items-center gap-3">
                      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-black/35 text-lg font-bold shadow-[0_14px_30px_-18px_rgba(0,0,0,0.85)]">
                        {payment.customerAvatarUrl ? (
                          <Image src={payment.customerAvatarUrl} alt={identity.fullName} fill unoptimized sizes="64px" className="h-full w-full object-cover" />
                        ) : (
                          initials
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate text-lg font-semibold leading-tight">{identity.fullName}</h4>
                        <span className="group relative block cursor-help">
                          <p
                            className="mt-1 truncate text-[12px] text-white/70"
                            title={cardVariant.showHistoryTooltip ? courseUnion.join(" · ") || "No class slots" : `${payment.courseTitle} · ${subtitleSlotLabel}`}
                          >
                            {cardVariant.showHistorySubtitle
                              ? `${student.totalPayments} records · ${courseUnion.slice(0, 2).join(" · ") || "No class slots"}`
                              : `${payment.courseTitle} · ${subtitleSlotLabel}`}
                          </p>
                          <span className="pointer-events-none invisible absolute bottom-full left-0 z-30 mb-1 w-max max-w-[18rem] rounded-md border border-white/20 bg-[#131622]/95 px-2.5 py-1.5 text-left text-[11px] text-white/90 opacity-0 shadow-[0_16px_24px_-14px_rgba(0,0,0,0.8)] transition-all duration-150 group-hover:visible group-hover:opacity-100">
                            {cardVariant.showHistoryTooltip
                              ? courseUnion.join(" · ") || "No class slots in range"
                              : `${payment.courseTitle} · ${subtitleSlotLabel}`}
                          </span>
                        </span>
                      </div>
                    </header>

                    {canManageClerkSync && payment.userId && clerkMismatchByUserId.has(payment.userId) ? (
                      <ClerkSyncMismatchBanner
                        mismatch={clerkMismatchByUserId.get(payment.userId)!}
                        busy={clerkSyncUserBusyId === payment.userId}
                        onSync={() => void syncClerkUser(payment.userId)}
                      />
                    ) : null}

                    <div className="mt-4 w-full grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        ref={(el) => {
                          if (el && paymentHistoryStudentId === payment.userId) {
                            setPaymentHistoryAnchor(el)
                          }
                        }}
                        onClick={() => {
                          setPaymentHistoryStudentId(payment.userId)
                          setAttendanceHistoryStudentId(null)
                          setAttendanceHistoryAnchor(null)
                        }}
                        className={`w-full flex cursor-pointer items-center justify-center rounded-md border px-3 py-1.5 text-[11px] font-semibold hover:opacity-80 transition-opacity ${paymentStateTone(payment)}`}
                      >
                        Pmt History
                      </button>
                      <button
                        type="button"
                        ref={(el) => {
                          if (el && attendanceHistoryStudentId === payment.userId) {
                            setAttendanceHistoryAnchor(el)
                          }
                        }}
                        onClick={() => {
                          setAttendanceHistoryStudentId(payment.userId)
                          setPaymentHistoryStudentId(null)
                          setPaymentHistoryAnchor(null)
                        }}
                        className={`w-full flex cursor-pointer items-center justify-center rounded-md border px-3 py-1.5 text-[11px] font-semibold hover:opacity-80 transition-opacity ${checkInStateTone(payment)}`}
                      >
                        Attendance
                      </button>
                      {studentPinLabel && studentPinTone ? (
                        <span className={`w-full flex items-center justify-center rounded-md border px-3 py-1.5 text-[11px] font-semibold ${studentPinTone}`}>
                          {studentPinLabel}
                        </span>
                      ) : (
                        <span className="w-full flex items-center justify-center rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white/30">
                          —
                        </span>
                      )}
                      <span className="group relative w-full flex cursor-help items-center justify-center rounded-md border border-amber-400/35 bg-amber-400/10 px-3 py-1.5 text-[11px] font-semibold text-amber-200">
                        Points: {payment.pointsBalance}
                        <span className="pointer-events-auto invisible absolute bottom-full left-0 z-[200] max-h-44 w-[16rem] -translate-x-1/2 translate-y-1 overflow-y-auto overscroll-contain rounded-md border border-white/20 bg-[#131622]/95 px-2.5 py-1.5 text-left text-[11px] text-white/90 opacity-0 shadow-[0_16px_24px_-14px_rgba(0,0,0,0.8)] transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                          <span className="font-semibold text-white">Points history</span>
                          <span className="mt-1 block border-t border-white/10" />
                          {pointsHistoryEntries.length === 0 ? (
                            <span className="mt-1 block text-white/70">No points events yet.</span>
                          ) : (
                            pointsHistoryEntries.map((entry, index) => (
                              <span
                                key={`points-history-${entry.id}`}
                                className={`block text-white/85 ${index === 0 ? "mt-1" : "mt-1 border-t border-white/10 pt-1"}`}
                              >
                                <span className="font-semibold text-amber-200">{entry.points > 0 ? `+${entry.points}` : entry.points}</span>
                                <span className="ml-1 capitalize">{entry.type.replaceAll("_", " ").toLowerCase()}</span>
                                <span className="mt-0.5 block text-white/65">{formatStudentPaymentCardDateTimeLabel(entry.createdAt)}</span>
                              </span>
                            ))
                          )}
                        </span>
                      </span>
                    </div>

                    <div className="mt-4 space-y-2.5 border-t border-white/10 pt-3.5 text-xs text-white/85">
                      <p className="inline-flex w-full items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 text-white/70">
                          <MapPin className="h-3 w-3" />
                          Location
                        </span>
                        <span className="truncate text-right">{payment.location || "—"}</span>
                      </p>
                      <p className="inline-flex w-full items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 text-white/70">
                          <Mail className="h-3 w-3" />
                          Email
                        </span>
                        <span className="truncate text-right">{payment.customerEmail || "—"}</span>
                      </p>
                      <p className="inline-flex w-full items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 text-white/70">
                          <Phone className="h-3 w-3" />
                          Phone
                        </span>
                        <span className="truncate text-right">{payment.customerPhone || "—"}</span>
                      </p>
                      <p className="inline-flex w-full items-center justify-between gap-2 text-white/75">
                        <span>Package</span>
                        <span className="truncate text-right">{packageLabel}</span>
                      </p>
                      <p className="inline-flex w-full items-center justify-between gap-2 text-white/75">
                        <span>Amount paid</span>
                        <span className="group relative max-w-[62%] cursor-help text-right">
                          <span className="truncate text-right">{totalSpentLabel}</span>
                          <span className="pointer-events-auto invisible absolute bottom-full right-0 z-[200] max-h-52 w-[17rem] overflow-y-auto overscroll-contain rounded-md border border-white/20 bg-[#131622]/95 px-2.5 py-1.5 text-left text-[11px] text-white/90 opacity-0 shadow-[0_16px_24px_-14px_rgba(0,0,0,0.8)] transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                            <span className="font-semibold text-white">Paid entries</span>
                            <span className="mt-1 block border-t border-white/10" />
                            {paidEntries.length === 0 ? (
                              <span className="mt-1 block text-white/70">No paid entries in this selection.</span>
                            ) : (
                              paidEntries.slice(0, 12).map((entry, index) => (
                                <span
                                  key={`paid-history-${entry.id}`}
                                  className={`block text-white/85 ${index === 0 ? "mt-1" : "mt-1 border-t border-white/10 pt-1"}`}
                                >
                                  <span className="block">{entry.courseTitle || "Package payment"}</span>
                                  <span className="mt-0.5 block text-white/65">
                                    {formatMoney(entry.amount, entry.currency)} · {formatStudentPaymentCardDateTimeLabel(entry.createdAt)}
                                  </span>
                                </span>
                              ))
                            )}
                          </span>
                        </span>
                      </p>
                      <p className="inline-flex w-full items-center justify-between gap-2 text-white/75">
                        <span>Credits</span>
                        <span>{packageValue}</span>
                      </p>
                      {outstandingBalanceLabel ? (
                        <p className="inline-flex w-full items-center justify-between gap-2 border-b border-[var(--brand,#b61616)]/40 pb-2 text-[var(--brand,#ff9e9e)]">
                          <span>Outstanding balance</span>
                          <span className="group relative text-[var(--brand,#ffc0c0)]">
                            <span className="cursor-help">{outstandingBalanceLabel}</span>
                            <span className="pointer-events-auto invisible absolute bottom-full right-0 z-[200] max-h-52 w-[17rem] overflow-y-auto overscroll-contain rounded-md border border-white/20 bg-[#131622]/95 px-2.5 py-1.5 text-left text-[11px] text-white/90 opacity-0 shadow-[0_16px_24px_-14px_rgba(0,0,0,0.8)] transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                              <span className="font-semibold text-white">Outstanding balance breakdown:</span>
                              <span className="mt-1 block border-t border-white/10" />
                              {student.allPayments
                                .filter((entry) => (typeof entry.outstandingBalance === "number" && entry.outstandingBalance > 0) || entry.settlementStatus === "pending")
                                .slice(0, 12)
                                .map((entry, index) => (
                                  <span
                                    key={`outstanding-${entry.id}`}
                                    className={`block text-white/85 ${index === 0 ? "mt-1" : "mt-1 border-t border-white/10 pt-1"}`}
                                  >
                                    <span className="block">{entry.courseTitle || "Package payment"}</span>
                                    <span className="mt-0.5 block text-white/65">
                                      {formatMoney(entry.amount, entry.currency)}
                                    </span>
                                  </span>
                                ))}
                              <span className="mt-2 border-t border-white/10 pt-2 block font-semibold text-white/90">
                                Total: {outstandingBalanceLabel}
                              </span>
                            </span>
                          </span>
                        </p>
                      ) : null}
                      <p className="inline-flex w-full items-center justify-between gap-2 text-white/75">
                        <span>Purchased courses</span>
                        <span>{student.coursesPurchasedCount}</span>
                      </p>
                      <p className="inline-flex w-full items-center justify-between gap-2 text-white/75">
                        <span>Completed classes</span>
                        <span className="group relative cursor-help">
                          <span>{student.checkedInPayments}</span>
                          <span className="pointer-events-auto invisible absolute bottom-full right-0 z-[200] max-h-52 w-[17rem] overflow-y-auto overscroll-contain rounded-md border border-white/20 bg-[#131622]/95 px-2.5 py-1.5 text-left text-[11px] text-white/90 opacity-0 shadow-[0_16px_24px_-14px_rgba(0,0,0,0.8)] transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                            <span className="font-semibold text-white">Completed classes</span>
                            <span className="mt-1 block border-t border-white/10" />
                            {student.allPayments.filter((p) => p.checkInStatus === "checked_in" || p.checkInStatus === "checked_in_no_package" || p.checkInStatus === "checked_out").length === 0 ? (
                              <span className="mt-1 block text-white/70">No completed classes yet.</span>
                            ) : (
                              student.allPayments
                                .filter((p) => p.checkInStatus === "checked_in" || p.checkInStatus === "checked_in_no_package" || p.checkInStatus === "checked_out")
                                .slice(0, 12)
                                .map((entry, index) => (
                                  <span
                                    key={`completed-${entry.id}`}
                                    className={`block text-white/85 ${index === 0 ? "mt-1" : "mt-1 border-t border-white/10 pt-1"}`}
                                  >
                                    <span className="block">{entry.courseTitle || "Class"}</span>
                                    <span className="mt-0.5 block text-white/65">
                                      {formatStudentPaymentCardSlotLabel(entry.classDate, entry.classTime)}
                                    </span>
                                  </span>
                                ))
                            )}
                          </span>
                        </span>
                      </p>
                      <p className="inline-flex w-full items-center justify-between gap-2 text-white/75">
                        <span>Package classes used</span>
                        <span>{student.totalPackageClassesConsumed}</span>
                      </p>
                    </div>

                    <div className={`mt-4 grid gap-2.5 ${canOperateStudentPins && payment.userId ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2"}`}>
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof window === "undefined" || !payment.customerEmail || payment.customerEmail === "—") return
                          const subject = encodeURIComponent(`Class payment update · ${payment.courseTitle}`)
                          window.location.href = `mailto:${encodeURIComponent(payment.customerEmail)}?subject=${subject}`
                        }}
                        className="rounded-md border border-white/20 px-2 py-1 text-[11px]"
                      >
                        Notify
                      </button>
                      {canOperateStudentPins && payment.userId ? (
                        <button
                          type="button"
                          onClick={() => openStudentPinModal(payment)}
                          className="rounded-md border border-cyan-300/30 bg-cyan-400/10 px-2 py-1 text-[11px] font-semibold text-cyan-100"
                        >
                          {payment.studentPin.provisionalActive ? "Reissue PIN" : "Provisional PIN"}
                        </button>
                      ) : null}
                      {(currentRole === "owner" || currentRole === "admin") && payment.userId ? (
                        <button
                          type="button"
                          onClick={() => openOverrideModal(payment.userId, identity.fullName)}
                          className="rounded-md border border-white/20 bg-white/10 px-2 py-1 text-[11px] font-semibold text-white hover:bg-white/15 transition-colors"
                        >
                          Edit info
                        </button>
                      ) : null}
                    </div>

                    {(currentRole === "owner" || currentRole === "admin") && payment.userId && usersWithAuditEntries.has(payment.userId) && (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            setAuditHistoryAnchor(e.currentTarget)
                            setAuditHistoryStudentId(payment.userId)
                            setAuditHistoryStudentName(identity.fullName)
                          }}
                          className="w-full rounded-md border border-white/15 px-2 py-1.5 text-[11px] text-white/60 hover:text-white/80 hover:border-white/25 transition-colors"
                        >
                          Change history
                        </button>
                      </div>
                    )}
                  </article>
                )
              })
            )}
          </div>
          {totalPages > 1 ? (
            <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] px-4 py-3 text-sm text-white/80 shadow-[0_16px_32px_-24px_rgba(0,0,0,0.8)] backdrop-blur">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="rounded-full border border-white/20 bg-black/20 px-3 py-1.5 text-xs font-semibold text-white/85 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-xs uppercase tracking-[0.16em] text-white/55">
                Page {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="rounded-full border border-white/20 bg-black/20 px-3 py-1.5 text-xs font-semibold text-white/85 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          ) : null}
        </article>
      ) : null}

      {isReportsView ? (
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
      ) : null}

        {showStaffOps ? (
          <article className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
          <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Staff requests</p>
              <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Notifications and approvals</h3>
              <p className="mt-1 text-sm text-black/65 dark:text-white/65">
                Day off, shift swaps, schedule changes, pay advance requests and payment method approvals.
              </p>
            </div>
            <div className="inline-flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setRequestStatusFilter("all")}
                className={`rounded-full border px-3 py-1 text-xs ${
                  requestStatusFilter === "all"
                    ? "border-[var(--brand,#b61616)]/60 bg-[var(--brand,#b61616)]/15 text-[var(--brand,#b61616)]"
                    : "border-black/20 text-black/70 dark:border-white/20 dark:text-white/70"
                }`}
              >
                All
              </button>
              {REQUEST_STATUS_OPTIONS.map((status) => (
                <button
                  key={`request-filter-${status}`}
                  type="button"
                  onClick={() => setRequestStatusFilter(status)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    requestStatusFilter === status
                      ? "border-[var(--brand,#b61616)]/60 bg-[var(--brand,#b61616)]/15 text-[var(--brand,#b61616)]"
                      : "border-black/20 text-black/70 dark:border-white/20 dark:text-white/70"
                  }`}
                >
                  {status.replaceAll("_", " ")}
                </button>
              ))}
            </div>
          </header>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <div className="rounded-lg border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-xs text-black/60 dark:text-white/60">Total</p>
              <p className="mt-1 text-lg font-semibold text-black dark:text-white">{approvalsSummary.total}</p>
            </div>
            <div className="rounded-lg border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-xs text-black/60 dark:text-white/60">Pending</p>
              <p className="mt-1 text-lg font-semibold text-black dark:text-white">{approvalsSummary.pending}</p>
            </div>
            <div className="rounded-lg border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-xs text-black/60 dark:text-white/60">In review</p>
              <p className="mt-1 text-lg font-semibold text-black dark:text-white">{approvalsSummary.inReview}</p>
            </div>
            <div className="rounded-lg border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-xs text-black/60 dark:text-white/60">Approved</p>
              <p className="mt-1 text-lg font-semibold text-black dark:text-white">{approvalsSummary.approved}</p>
            </div>
            <div className="rounded-lg border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-xs text-black/60 dark:text-white/60">Rejected</p>
              <p className="mt-1 text-lg font-semibold text-black dark:text-white">{approvalsSummary.rejected}</p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {approvalsLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`requests-skeleton-${index}`}
                  className="h-[74px] rounded-lg border border-black/10 bg-black/[0.03] shimmer dark:border-white/10 dark:bg-white/[0.03]"
                />
              ))
            ) : approvalFeed.length === 0 ? (
              <p className="rounded-lg border border-black/10 bg-black/[0.03] px-3 py-2 text-sm text-black/65 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/65">
                No approval items found.
              </p>
            ) : (
              approvalFeed.slice(0, 12).map((item) => {
                if (item.kind === "payment_change_request") {
                  const request = item.request
                  const busy = paymentChangeRequestBusyId === request.id
                  const fullName = `${request.staffAccount.firstName} ${request.staffAccount.lastName}`.trim() || "Staff member"
                  const requestedMethodLabel = formatPaymentChangeRequestMethodLabel(request.requestedMethod)
                  const infoRows = formatPaymentChangeRequestInfoRows(request.requestedInfo)

                  return (
                    <div
                      key={request.id}
                      className="grid gap-2 rounded-lg border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.03] lg:grid-cols-[minmax(0,1fr)_auto]"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-black dark:text-white">
                            Payment change request · {fullName}
                          </p>
                          <span className="rounded-full border border-sky-500/35 bg-sky-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-sky-300">
                            Payroll
                          </span>
                        </div>
                        <p className="text-xs text-black/60 dark:text-white/60">
                          {request.staffAccount.email} · {formatIsoDate(request.createdAt)}
                        </p>
                        <p className="mt-1 text-xs text-black/70 dark:text-white/70">
                          Requested method: {requestedMethodLabel}
                        </p>
                        {request.reason ? (
                          <p className="mt-1 text-xs text-black/70 dark:text-white/70">{request.reason}</p>
                        ) : null}
                        {infoRows.length > 0 ? (
                          <div className="mt-2 grid gap-1 rounded-md border border-black/10 bg-black/[0.03] p-2 text-[11px] text-black/70 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/70">
                            {infoRows.map((row) => (
                              <div key={`${request.id}-${row.key}`} className="flex items-center justify-between gap-3">
                                <span className="uppercase tracking-[0.16em] text-black/45 dark:text-white/45">{row.label}</span>
                                <span className="font-mono text-right">{row.value}</span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[11px] text-white">
                          {PAYMENT_CHANGE_REQUEST_STATUS_LABELS[request.status]}
                        </span>
                        {request.status === "pending" ? (
                          <>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => updatePaymentChangeRequestStatus(request.id, "approved")}
                              className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => updatePaymentChangeRequestStatus(request.id, "rejected")}
                              className="rounded-md border border-[var(--brand,#b61616)]/45 bg-[var(--brand,#b61616)]/10 px-2 py-1 text-xs text-[var(--brand,#ff4b4b)]"
                            >
                              Reject
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  )
                }

                const request = item.request
                const busy = requestBusyId === request.id
                return (
                  <div
                    key={request.id}
                    className="grid gap-2 rounded-lg border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.03] lg:grid-cols-[minmax(0,1fr)_auto]"
                  >
                    <div>
                      <p className="text-sm font-semibold text-black dark:text-white">
                        {REQUEST_TYPE_LABELS[request.type]} · {request.user.name}
                      </p>
                      <p className="text-xs text-black/60 dark:text-white/60">
                        {request.user.email} · {formatIsoDate(request.createdAt)}
                      </p>
                      {request.message ? (
                        <p className="mt-1 text-xs text-black/70 dark:text-white/70">{request.message}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[11px] text-white">
                        {request.status.replaceAll("_", " ")}
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => updateRequestStatus(request.id, "IN_REVIEW")}
                        className="rounded-md border border-white/20 px-2 py-1 text-xs text-white"
                      >
                        Review
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => updateRequestStatus(request.id, "APPROVED")}
                        className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => updateRequestStatus(request.id, "REJECTED")}
                        className="rounded-md border border-[var(--brand,#b61616)]/45 bg-[var(--brand,#b61616)]/10 px-2 py-1 text-xs text-[var(--brand,#ff4b4b)]"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          </article>
        ) : null}
        {showStaffOps ? (
          <article className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
          <header className="mb-4 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Team calendar</p>
              <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Who is coming and when</h3>
            </div>
            <div className="inline-flex items-center gap-2">
              <button
                type="button"
                onClick={() => setScheduleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                className="rounded-md border border-black/20 p-1.5 dark:border-white/20"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium text-black dark:text-white">{scheduleMonthLabel}</span>
              <button
                type="button"
                onClick={() => setScheduleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                className="rounded-md border border-black/20 p-1.5 dark:border-white/20"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="rounded-xl border border-black/10 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="grid grid-cols-7 gap-2 text-center text-[11px] uppercase tracking-[0.2em] text-black/55 dark:text-white/55">
              {WEEKDAY_LABELS.map((label) => (
                <span key={`weekday-${label}`}>{label}</span>
              ))}
            </div>
            {scheduleLoading ? (
              <div className="mt-2 grid grid-cols-7 gap-2">
                {Array.from({ length: 35 }).map((_, index) => (
                  <div
                    key={`calendar-skeleton-${index}`}
                    className="min-h-[92px] rounded-md border border-black/10 bg-white/60 shimmer dark:border-white/10 dark:bg-white/[0.02]"
                  />
                ))}
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-7 gap-2">
                {calendarCells.map((cell, idx) => {
                  const events = scheduleEventsByDay[cell.dateKey] || []
                  return (
                    <div
                      key={`calendar-cell-${cell.dateKey}-${idx}`}
                      className={`min-h-[92px] rounded-md border p-1.5 ${
                        cell.inMonth
                          ? "border-black/10 bg-white/70 dark:border-white/10 dark:bg-white/[0.02]"
                          : "border-black/5 bg-black/[0.02] opacity-60 dark:border-white/5 dark:bg-white/[0.01]"
                      }`}
                    >
                      <p className="mb-1 text-right text-xs text-black/70 dark:text-white/70">{cell.day}</p>
                      <div className="space-y-1">
                        {events.slice(0, 2).map((event) => (
                          <div key={`day-event-${event.attendanceId}`} className="group relative">
                            <div className="truncate rounded-full bg-[var(--brand,#b61616)]/90 px-2 py-0.5 text-[11px] text-white">
                              {event.timeLabel}
                            </div>
                            <div className="pointer-events-none absolute left-0 top-full z-30 mt-1 hidden w-72 rounded-md border border-black/15 bg-white p-2 text-xs text-black shadow-xl group-hover:block dark:border-white/15 dark:bg-[#11131a] dark:text-white">
                              <p className="font-semibold">{event.userName}</p>
                              <p className="mt-0.5 text-black/70 dark:text-white/70">{event.courseTitle}</p>
                              <p className="mt-0.5">Time: {event.timeLabel}</p>
                              <p className="mt-0.5">Email: {event.userEmail || "—"}</p>
                              <p className="mt-0.5">Phone: {event.userPhone || "—"}</p>
                              <p className="mt-0.5 capitalize">Status: {event.status.replaceAll("_", " ")}</p>
                            </div>
                          </div>
                        ))}
                        {events.length > 2 ? (
                          <p className="text-[11px] text-black/60 dark:text-white/60">+{events.length - 2} more</p>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          </article>
        ) : null}

        {showStaffOps ? (
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
        ) : null}
      </section>

      <StaffAssistantRightRail
        showRightRail={showRightRail}
        showInlineRightRail={showInlineRightRail}
        isRailCollapsed={isRailCollapsed}
        rightRailRef={rightRailRef}
        onCloseOverlay={() => setIsRailCollapsed(true)}
        onToggleRail={() => setIsRailCollapsed((prev) => !prev)}
      >
        {assistantRailContent}
      </StaffAssistantRightRail>
      </div>

      {roomSafeDeleteModal ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-black/15 bg-white shadow-[0_40px_90px_-40px_rgba(0,0,0,0.75)] dark:border-white/15 dark:bg-[#10131d]">
            <div className="flex items-start justify-between border-b border-black/10 px-5 py-4 dark:border-white/10">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[var(--brand,#b61616)]">Room safe delete</p>
                <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">{roomSafeDeleteModal.room.name}</h3>
                <p className="mt-1 text-xs text-black/65 dark:text-white/65">This action is permanent when allowed by blockers.</p>
              </div>
              <button
                type="button"
                onClick={closeRoomSafeDeleteModal}
                disabled={roomBusyId === roomSafeDeleteModal.room.id}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/20 text-black/70 transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/20 dark:text-white/70 dark:hover:bg-white/5"
                aria-label="Close room safe-delete dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-black dark:text-white">Deletion reason (required)</span>
                <textarea
                  value={roomSafeDeleteModal.reason}
                  onChange={(event) =>
                    setRoomSafeDeleteModal((prev) => {
                      if (!prev) return prev
                      return {
                        ...prev,
                        reason: event.target.value,
                        error: prev.error === "Deletion reason is required." ? null : prev.error,
                      }
                    })
                  }
                  rows={3}
                  placeholder="Example: Room permanently removed from service"
                  className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                />
              </label>

              {roomSafeDeleteModal.error ? (
                <p className="rounded-md border border-[var(--brand,#b61616)]/35 bg-[var(--brand,#b61616)]/10 px-3 py-2 text-sm text-[var(--brand,#ff4b4b)]">
                  {roomSafeDeleteModal.error}
                </p>
              ) : null}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeRoomSafeDeleteModal}
                  disabled={roomBusyId === roomSafeDeleteModal.room.id}
                  className="rounded-xl border border-black/15 px-4 py-2 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/15 dark:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void confirmRoomSafeDelete()}
                  disabled={roomBusyId === roomSafeDeleteModal.room.id || !roomSafeDeleteModal.reason.trim()}
                  className="rounded-xl bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {roomBusyId === roomSafeDeleteModal.room.id ? "Deleting..." : "Confirm safe delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {roomReassignModal ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-black/15 bg-white shadow-[0_40px_90px_-40px_rgba(0,0,0,0.75)] dark:border-white/15 dark:bg-[#10131d]">
            <div className="flex items-start justify-between border-b border-black/10 px-5 py-4 dark:border-white/10">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[var(--brand,#b61616)]">Room reassignment</p>
                <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">{roomReassignModal.room.name}</h3>
                <p className="mt-1 text-xs text-black/65 dark:text-white/65">Move course defaults and optionally future sessions to another active room.</p>
              </div>
              <button
                type="button"
                onClick={closeRoomReassignModal}
                disabled={roomBusyId === roomReassignModal.room.id}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/20 text-black/70 transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/20 dark:text-white/70 dark:hover:bg-white/5"
                aria-label="Close room reassignment dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-black dark:text-white">Target active room</span>
                <select
                  value={roomReassignModal.targetRoomId}
                  onChange={(event) =>
                    setRoomReassignModal((prev) => {
                      if (!prev) return prev
                      return {
                        ...prev,
                        targetRoomId: event.target.value,
                        error: prev.error === "Select a target room to continue." ? null : prev.error,
                      }
                    })
                  }
                  className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                >
                  <option value="">Select target room</option>
                  {activeRoomOptions
                    .filter((room) => room.id !== roomReassignModal.room.id)
                    .map((room) => (
                      <option key={`reassign-target-room-${room.id}`} value={room.id}>
                        {room.name}
                      </option>
                    ))}
                </select>
              </label>

              <label className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white/60 px-3 py-2 text-sm text-black/80 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/80">
                <input
                  type="checkbox"
                  checked={roomReassignModal.moveFutureSessions}
                  onChange={(event) =>
                    setRoomReassignModal((prev) => {
                      if (!prev) return prev
                      return {
                        ...prev,
                        moveFutureSessions: event.target.checked,
                      }
                    })
                  }
                />
                Also move future sessions (all-or-nothing if any conflict exists)
              </label>

              <div className="space-y-2 rounded-xl border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-black dark:text-white">Affected courses in source room</p>
                  <p className="text-xs text-black/60 dark:text-white/60">
                    {roomReassignModal.selectedCourseIds.length} selected
                  </p>
                </div>
                {roomReassignModal.availableCourses.length === 0 ? (
                  <p className="text-xs text-black/60 dark:text-white/60">No course defaults are currently assigned to this room.</p>
                ) : (
                  <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
                    {roomReassignModal.availableCourses.map((course) => {
                      const checked = roomReassignModal.selectedCourseIds.includes(course.id)
                      return (
                        <label
                          key={`reassign-course-${course.id}`}
                          className="flex items-center gap-2 rounded-lg border border-black/10 bg-white/80 px-2.5 py-2 text-sm text-black dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) =>
                              setRoomReassignModal((prev) => {
                                if (!prev) return prev
                                const nextSelected = event.target.checked
                                  ? [...prev.selectedCourseIds, course.id]
                                  : prev.selectedCourseIds.filter((id) => id !== course.id)
                                return {
                                  ...prev,
                                  selectedCourseIds: nextSelected,
                                  error: prev.error === "Select at least one course to reassign." ? null : prev.error,
                                }
                              })
                            }
                          />
                          <div className="flex min-w-0 flex-col">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <span className="font-medium">{course.title}</span>
                              <span className="text-xs text-black/60 dark:text-white/60">({course.slug})</span>
                            </div>
                            <span className="text-xs text-black/65 dark:text-white/65">
                              {course.scheduleLabel ? course.scheduleLabel : "Schedule not configured"}
                            </span>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>

              {roomReassignModal.error ? (
                <p className="rounded-md border border-[var(--brand,#b61616)]/35 bg-[var(--brand,#b61616)]/10 px-3 py-2 text-sm text-[var(--brand,#ff4b4b)]">
                  {roomReassignModal.error}
                </p>
              ) : null}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeRoomReassignModal}
                  disabled={roomBusyId === roomReassignModal.room.id}
                  className="rounded-xl border border-black/15 px-4 py-2 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/15 dark:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void confirmRoomReassign()}
                  disabled={
                    roomBusyId === roomReassignModal.room.id ||
                    !roomReassignModal.targetRoomId ||
                    (roomReassignModal.availableCourses.length > 0 && roomReassignModal.selectedCourseIds.length === 0)
                  }
                  className="rounded-xl bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {roomBusyId === roomReassignModal.room.id ? "Reassigning..." : "Confirm reassignment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {roomReservationCancelModal ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-black/15 bg-white shadow-[0_40px_90px_-40px_rgba(0,0,0,0.75)] dark:border-white/15 dark:bg-[#10131d]">
            <div className="flex items-start justify-between border-b border-black/10 px-5 py-4 dark:border-white/10">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[var(--brand,#b61616)]">Cancel reservation</p>
                <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">{roomReservationCancelModal.reservation.title}</h3>
              </div>
              <button
                type="button"
                onClick={closeRoomReservationCancelModal}
                disabled={roomReservationBusyId === roomReservationCancelModal.reservation.id}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/20 text-black/70 transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/20 dark:text-white/70 dark:hover:bg-white/5"
                aria-label="Close room reservation cancel dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-black dark:text-white">Cancellation reason (optional)</span>
                <textarea
                  value={roomReservationCancelModal.reason}
                  onChange={(event) =>
                    setRoomReservationCancelModal((prev) =>
                      prev
                        ? {
                            ...prev,
                            reason: event.target.value,
                            error: null,
                          }
                        : prev
                    )
                  }
                  rows={3}
                  className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                />
              </label>

              {roomReservationCancelModal.error ? (
                <p className="rounded-md border border-[var(--brand,#b61616)]/35 bg-[var(--brand,#b61616)]/10 px-3 py-2 text-sm text-[var(--brand,#ff4b4b)]">{roomReservationCancelModal.error}</p>
              ) : null}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeRoomReservationCancelModal}
                  disabled={roomReservationBusyId === roomReservationCancelModal.reservation.id}
                  className="rounded-xl border border-black/15 px-4 py-2 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/15 dark:text-white"
                >
                  Keep reservation
                </button>
                <button
                  type="button"
                  onClick={() => void confirmRoomReservationCancel()}
                  disabled={roomReservationBusyId === roomReservationCancelModal.reservation.id}
                  className="rounded-xl bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {roomReservationBusyId === roomReservationCancelModal.reservation.id ? "Cancelling..." : "Confirm cancel"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {delayModal ? (
        <div className="fixed inset-0 z-[139] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-black/15 bg-white shadow-[0_40px_90px_-40px_rgba(0,0,0,0.75)] dark:border-white/15 dark:bg-[#10131d]">
            <div className="flex items-start justify-between border-b border-black/10 px-5 py-4 dark:border-white/10">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[var(--brand,#b61616)]">Delay details</p>
                <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">{delayModal.row.name}</h3>
                <p className="mt-1 text-xs text-black/65 dark:text-white/65">
                  Total delay: {formatMinutesLabel(delayModal.totalDelayMinutes)} · Late days: {delayModal.lateDays}
                </p>
              </div>
              <button
                type="button"
                onClick={closeDelayDetails}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/20 text-black/70 transition hover:bg-black/5 dark:border-white/20 dark:text-white/70 dark:hover:bg-white/5"
                aria-label="Close delay details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-[120px_1fr_1fr_84px] gap-2 rounded-md border border-black/10 bg-black/[0.03] px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-black/55 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/55">
                <span>Date</span>
                <span>Expected</span>
                <span>Checked in</span>
                <span className="text-right">Delay</span>
              </div>
              <div className="mt-2 space-y-2">
                {delayModal.entries.length === 0 ? (
                  <p className="rounded-lg border border-black/10 bg-white/70 px-3 py-2 text-sm text-black/70 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/70">
                    No delay records available for this user yet.
                  </p>
                ) : (
                  delayModal.entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="grid grid-cols-[120px_1fr_1fr_84px] items-center gap-2 rounded-lg border border-black/10 bg-white/70 px-3 py-2 text-sm text-black dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                    >
                      <span className="text-xs text-black/70 dark:text-white/70">{entry.dateLabel}</span>
                      <span>{entry.expectedTime}</span>
                      <span>{entry.actualTime}</span>
                      <span className="text-right text-xs font-semibold text-[var(--brand,#ff4b4b)]">
                        {entry.delayMinutes > 0 ? `+${entry.delayMinutes}m` : "On time"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {studentPinModal ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-black/15 bg-white shadow-[0_40px_90px_-40px_rgba(0,0,0,0.75)] dark:border-white/15 dark:bg-[#10131d]">
            <div className="flex items-start justify-between border-b border-black/10 px-5 py-4 dark:border-white/10">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[var(--brand,#b61616)]">Student PIN</p>
                <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">{studentPinModal.name}</h3>
                <p className="mt-1 text-xs text-black/65 dark:text-white/65">
                  {studentPinModal.email || "No email on file"} · {studentPinModal.needsEnrollment ? "PIN setup" : "Same-day recovery"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeStudentPinModal}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/20 text-black/70 transition hover:bg-black/5 dark:border-white/20 dark:text-white/70 dark:hover:bg-white/5"
                aria-label="Close student PIN dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-5">
                <div className="rounded-xl border border-cyan-400/25 bg-cyan-400/10 p-3 text-sm text-cyan-950 dark:text-cyan-100">
                  Provisional PINs stay valid until end of day. Use them only for front-desk assisted enrollment or same-day recovery.
              </div>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-black dark:text-white">Reason</span>
                <textarea
                  value={studentPinReason}
                  onChange={(event) => setStudentPinReason(event.target.value)}
                  rows={3}
                  placeholder="Example: Walk-in recovery before class starts"
                  className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-black dark:text-white">Custom PIN (optional)</span>
                <input
                  value={studentPinDraft}
                  onChange={(event) => setStudentPinDraft(event.target.value.replace(/\D+/g, "").slice(0, 4))}
                  inputMode="numeric"
                  placeholder="Leave blank to auto-generate"
                  className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                />
              </label>

              {studentPinModal.provisionalActive || studentPinModal.provisionalExpiresAt ? (
                <p className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
                  Existing provisional PIN {studentPinModal.provisionalActive ? "is active" : "was created"}. Expiry: {formatIsoDate(studentPinModal.provisionalExpiresAt)}.
                </p>
              ) : null}

              {studentPinError ? <p className="text-sm text-[var(--brand,#ff4b4b)]">{studentPinError}</p> : null}

              {studentPinIssued?.value ? (
                <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm text-emerald-950 dark:text-emerald-100">
                  <p className="text-xs uppercase tracking-[0.2em]">Issued</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <code className="rounded-md bg-black/10 px-3 py-2 text-base font-semibold tracking-[0.35em] dark:bg-black/20">
                      {studentPinRevealIssued ? studentPinIssued.value : studentPinIssued.masked}
                    </code>
                    <button
                      type="button"
                      onClick={() => setStudentPinRevealIssued((prev) => !prev)}
                      className="rounded-md border border-black/15 px-3 py-1.5 text-xs font-semibold text-black dark:border-white/15 dark:text-white"
                    >
                      {studentPinRevealIssued ? "Hide" : "Reveal"}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return
                        try {
                          await navigator.clipboard.writeText(studentPinIssued.value)
                        } catch {
                          setStudentPinError("Unable to copy provisional PIN.")
                        }
                      }}
                      className="rounded-md border border-black/15 px-3 py-1.5 text-xs font-semibold text-black dark:border-white/15 dark:text-white"
                    >
                      Copy PIN
                    </button>
                  </div>
                  <p className="mt-2 text-xs">Expires: {formatIsoDate(studentPinIssued.expiresAt)}</p>
                </div>
              ) : null}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeStudentPinModal}
                  className="rounded-xl border border-black/15 px-4 py-2 text-sm font-medium text-black dark:border-white/15 dark:text-white"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => void submitStudentPinIssue()}
                  disabled={studentPinSubmitting}
                  className="rounded-xl bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {studentPinSubmitting ? "Saving..." : studentPinIssued ? "Reissue PIN" : "Create provisional PIN"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {profileModalOpen ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl border border-black/15 bg-white shadow-[0_40px_90px_-40px_rgba(0,0,0,0.75)] dark:border-white/15 dark:bg-[#10131d]">
            <div className="flex items-start justify-between border-b border-black/10 px-5 py-4 dark:border-white/10">
              {profileLoading ? (
                <div className="w-full max-w-[70%] space-y-2">
                  <div className="h-3 w-28 rounded-full shimmer" />
                  <div className="h-7 w-56 rounded-full shimmer" />
                  <div className="h-3 w-full rounded-full shimmer" />
                </div>
              ) : (
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-[var(--brand,#b61616)]">Staff profile</p>
                  <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">
                    Edit {profileTarget ? `${profileTarget.firstName} ${profileTarget.lastName}`.trim() : "user"}
                  </h3>
                  <p className="mt-1 text-xs text-black/65 dark:text-white/65">
                    You can change personal data and set up a quick-access PIN.
                  </p>
                </div>
              )}
              <button
                type="button"
                onClick={closeProfileModal}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/20 text-black/70 transition hover:bg-black/5 dark:border-white/20 dark:text-white/70 dark:hover:bg-white/5"
                aria-label="Close profile editor"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {profileLoading ? (
              <div className="p-5">
                <div className="space-y-4 rounded-xl border border-black/10 bg-black/[0.03] p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="h-10 rounded-md shimmer" />
                    <div className="h-10 rounded-md shimmer" />
                    <div className="h-10 rounded-md shimmer" />
                    <div className="h-10 rounded-md shimmer" />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="h-10 rounded-md shimmer md:col-span-2" />
                    <div className="h-10 rounded-md shimmer md:col-span-2" />
                    <div className="h-10 rounded-md shimmer" />
                    <div className="h-10 rounded-md shimmer" />
                  </div>
                  <div className="h-24 rounded-md shimmer" />
                  <div className="ml-auto h-10 w-40 rounded-md shimmer" />
                </div>
              </div>
            ) : (
              <form
                className="space-y-4 p-5"
                onSubmit={(event) => {
                  event.preventDefault()
                  void saveProfileModal()
                }}
              >
                <section className="rounded-xl border border-black/10 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.02]">
                  <div className="grid gap-3 md:grid-cols-[112px_minmax(0,1fr)]">
                    <div className="relative h-28 w-28 overflow-hidden rounded-2xl border border-black/15 bg-white/70 dark:border-white/20 dark:bg-white/10">
                      {profileTarget?.avatarUrl ? (
                        <Image
                          src={profileTarget.avatarUrl}
                          alt={`${profileForm.firstName} ${profileForm.lastName}`.trim() || profileTarget.email}
                          fill
                          unoptimized
                          sizes="112px"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-black dark:text-white">
                          {getInitials(profileForm.firstName, profileForm.lastName, profileTarget?.email || "")}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-[var(--brand,#b61616)]">Avatar</p>
                        <p className="mt-1 text-xs text-black/65 dark:text-white/65">
                          Upload profile photo for this staff user.
                        </p>
                      </div>
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-black/20 px-3 py-2 text-xs font-medium text-black transition hover:border-[var(--brand,#b61616)] hover:text-[var(--brand,#b61616)] dark:border-white/20 dark:text-white">
                        {profileAvatarUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                        {profileAvatarUploading ? "Uploading..." : "Upload photo"}
                        <input
                          name="profileAvatar"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={profileAvatarUploading}
                          onChange={(event) => {
                            const file = event.target.files?.[0]
                            if (file) {
                              void uploadProfileAvatar(file)
                            }
                            event.currentTarget.value = ""
                          }}
                        />
                      </label>
                      {profileAvatarError ? (
                        <p className="rounded-md border border-[var(--brand,#b61616)]/40 bg-[var(--brand,#b61616)]/10 px-2 py-1 text-xs text-[var(--brand,#b61616)]">
                          {profileAvatarError}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3 border-t border-black/10 pt-3 dark:border-white/10">
                    <p className="text-xs uppercase tracking-[0.24em] text-[var(--brand,#b61616)]">Mini gallery</p>
                    <p className="mt-1 text-xs text-black/65 dark:text-white/65">
                      Upload images from local device (phone/PC). Up to 6 images.
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-black/20 px-3 py-2 text-xs font-medium text-black transition hover:border-[var(--brand,#b61616)] hover:text-[var(--brand,#b61616)] dark:border-white/20 dark:text-white">
                        {profileGalleryUploading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ImagePlus className="h-4 w-4" />
                        )}
                        {profileGalleryUploading ? "Uploading..." : "Upload images"}
                        <input
                          name="profileGallery"
                          type="file"
                          multiple
                          accept="image/*"
                          className="hidden"
                          disabled={profileGalleryUploading || profileForm.gallery.length >= 6}
                          onChange={(event) => {
                            const files = event.target.files
                            if (files && files.length > 0) {
                              void uploadProfileGalleryImages(files)
                            }
                            event.currentTarget.value = ""
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setProfileForm((prev) => ({ ...prev, gallery: [] }))}
                        disabled={profileGalleryUploading || profileForm.gallery.length === 0}
                        className="inline-flex items-center gap-1 rounded-md border border-black/20 px-3 py-2 text-xs font-medium text-black transition hover:border-[var(--brand,#b61616)] hover:text-[var(--brand,#b61616)] dark:border-white/20 dark:text-white"
                      >
                        Clear all
                      </button>
                      <span className="text-xs text-black/60 dark:text-white/60">{profileForm.gallery.length}/6</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
                      {profileForm.gallery.length === 0 ? (
                        <p className="col-span-full rounded-md border border-dashed border-black/20 px-3 py-4 text-center text-xs text-black/60 dark:border-white/20 dark:text-white/60">
                          No gallery images yet.
                        </p>
                      ) : (
                        profileForm.gallery.map((url, index) => (
                          <div key={`gallery-${index}`} className="relative overflow-hidden rounded-lg border border-black/15 dark:border-white/15">
                            <Image
                              src={url}
                              alt={`Gallery ${index + 1}`}
                              width={320}
                              height={96}
                              unoptimized
                              className="h-24 w-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setProfileForm((prev) => ({
                                  ...prev,
                                  gallery: prev.gallery.filter((_, idx) => idx !== index),
                                }))
                              }}
                              className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/30 bg-black/55 text-white"
                              aria-label={`Remove image ${index + 1}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </section>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs text-black/65 dark:text-white/65">First name</span>
                    <input
                      name="profileFirstName"
                      value={profileForm.firstName}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, firstName: e.target.value }))}
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-black/65 dark:text-white/65">Last name</span>
                    <input
                      name="profileLastName"
                      value={profileForm.lastName}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, lastName: e.target.value }))}
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-black/65 dark:text-white/65">Role</span>
                    <select
                      name="profileRole"
                      value={profileForm.role}
                      onChange={(e) => {
                        const nextRole = e.target.value as StaffRole
                        setProfileForm((prev) => ({
                          ...prev,
                          role: nextRole,
                          category: normalizeCategoryForRole(nextRole, prev.category),
                        }))
                      }}
                      disabled={!profileCanEditRole}
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-white/5 dark:text-white"
                    >
                      {assignableRoles.map((role) => (
                        <option key={`profile-role-${role}`} value={role}>
                          {ROLE_FORM_LABELS[role]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-black/65 dark:text-white/65">Department</span>
                    <select
                      name="profileCategory"
                      value={profileForm.category}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, category: e.target.value as StaffCategory }))}
                      disabled={!profileCanEditRole || Boolean(getFixedCategoryForRole(profileForm.role))}
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-white/5 dark:text-white"
                    >
                      {((getFixedCategoryForRole(profileForm.role)
                        ? [getFixedCategoryForRole(profileForm.role)!]
                        : CATEGORY_OPTIONS) as StaffCategory[]).map((category) => (
                        <option key={`profile-category-${category}`} value={category}>
                          {CATEGORY_LABELS[category]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-black/65 dark:text-white/65">Birth date</span>
                    <input
                      name="profileBirthDate"
                      type="date"
                      value={profileForm.birthDate}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, birthDate: e.target.value }))}
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-black/65 dark:text-white/65">Location</span>
                    <input
                      name="profileLocation"
                      value={profileForm.location}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, location: e.target.value }))}
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-xs text-black/65 dark:text-white/65">Address line 1</span>
                    <input
                      name="profileAddressLine1"
                      value={profileForm.addressLine1}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, addressLine1: e.target.value }))}
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                  </label>
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-xs text-black/65 dark:text-white/65">Address line 2</span>
                    <input
                      name="profileAddressLine2"
                      value={profileForm.addressLine2}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, addressLine2: e.target.value }))}
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-black/65 dark:text-white/65">City</span>
                    <input
                      name="profileCity"
                      value={profileForm.city}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, city: e.target.value }))}
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-black/65 dark:text-white/65">State</span>
                    <input
                      name="profileState"
                      value={profileForm.state}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, state: e.target.value }))}
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-black/65 dark:text-white/65">Postal code</span>
                    <input
                      name="profilePostalCode"
                      value={profileForm.postalCode}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, postalCode: e.target.value }))}
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-black/65 dark:text-white/65">Country</span>
                    <input
                      name="profileCountry"
                      value={profileForm.country}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, country: e.target.value }))}
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs text-black/65 dark:text-white/65">PIN (4 digits)</span>
                    <input
                      name="profilePin"
                      value={profileForm.pin}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "").slice(0, 4)
                        setProfileForm((prev) => ({ ...prev, pin: value }))
                      }}
                      placeholder={profileHasPin ? "Configured — type new PIN to replace" : "Set PIN"}
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                  </label>
                  <label className="inline-flex items-end gap-2 pb-2 text-sm text-black/70 dark:text-white/70">
                    <input
                      name="profileClearPin"
                      type="checkbox"
                      checked={profileForm.clearPin}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, clearPin: e.target.checked }))}
                      className="h-4 w-4 rounded border-black/20 bg-white text-[var(--brand,#b61616)]"
                    />
                    Clear current PIN
                  </label>
                </div>

                <label className="space-y-1">
                  <span className="text-xs text-black/65 dark:text-white/65">Personal note</span>
                  <textarea
                    name="profilePersonalNote"
                    value={profileForm.personalNote}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, personalNote: e.target.value }))}
                    rows={3}
                    className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                  />
                </label>

                {profileError ? (
                  <p className="rounded-md border border-[var(--brand,#b61616)]/40 bg-[var(--brand,#b61616)]/10 px-3 py-2 text-sm text-[var(--brand,#b61616)]">
                    {profileError}
                  </p>
                ) : null}
                {profileSuccess ? (
                  <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                    {profileSuccess}
                  </p>
                ) : null}

                <div className="flex justify-end gap-2 border-t border-black/10 pt-3 dark:border-white/10">
                  <button
                    type="button"
                    onClick={closeProfileModal}
                    className="rounded-md border border-black/20 px-3 py-2 text-sm text-black dark:border-white/20 dark:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {profileSaving ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}

      {/* Payment History Timeline Popover */}
      <PaymentHistoryTimeline
        payments={transformPaymentRowsToEvents(
          resolvePaymentHistoryRows({
            paymentHistoryStudentId,
            isHistoryMode,
            payments,
            userHistoryPayments,
            currentDateNY,
          }).filter((payment) => {
            if (isHistoryMode) return true
            const createdAtNyIso = /^\d{4}-\d{2}-\d{2}$/.test(payment.createdAt)
              ? payment.createdAt
              : resolveHistoryMaxSelectableDateIso(new Date(payment.createdAt), "America/New_York")
            return createdAtNyIso === currentDateNY
          })
        )}
        loading={userHistoryLoading}
        anchorEl={paymentHistoryAnchor}
        isOpen={!!paymentHistoryStudentId}
        onClose={() => {
          setPaymentHistoryStudentId(null)
          setPaymentHistoryAnchor(null)
        }}
      />

      {/* Attendance History Timeline Popover */}
      {(() => {
        const filteredPayments = resolveAttendanceHistoryRows({
          attendanceHistoryStudentId,
          isHistoryMode,
          payments,
          userHistoryPayments,
          historyFrom,
          historyTo,
        })
        const { events, summary } = attendanceHistoryStudentId
          ? transformPaymentRowsToAttendance(filteredPayments)
          : { events: [] as AttendanceEvent[], summary: { totalAttended: 0, noShows: 0, cancelled: 0 } as AttendanceSummary }
        return (
          <AttendanceHistoryTimeline
            attendance={events}
            summary={summary}
            loading={userHistoryLoading}
            anchorEl={attendanceHistoryAnchor}
            isOpen={!!attendanceHistoryStudentId}
            onClose={() => {
              setAttendanceHistoryStudentId(null)
              setAttendanceHistoryAnchor(null)
            }}
          />
        )
      })()}

      {/* Audit History Popover */}
      <AuditHistoryPopover
        studentId={auditHistoryStudentId || ""}
        studentName={auditHistoryStudentName || ""}
        anchorEl={auditHistoryAnchor}
        isOpen={!!auditHistoryAnchor}
        onClose={() => {
          setAuditHistoryAnchor(null)
          setAuditHistoryStudentId(null)
          setAuditHistoryStudentName(null)
        }}
      />

      {/* Student Data Override Modal (owner/admin only) */}
      {overrideModalStudent && (
        <StudentDataOverrideModal
          open={overrideModalOpen}
          onClose={closeOverrideModal}
          studentId={overrideModalStudent.id}
          studentName={overrideModalStudent.name}
          currentRole={currentRole === "staff" ? "staff" : currentRole === "admin" ? "admin" : "owner"}
          onSuccess={() => {
            // Mark this user as having current-month audit entries so the change-history button appears
            setUsersWithAuditEntries((prev) => new Set(prev).add(overrideModalStudent.id))
            // Refresh the payments board to show updated data
             void refreshPaymentsBoard()
          }}
        />
      )}
    </>
  )
}

// ── Re-exports for backward compatibility ──
export {
  buildCurrentMonthPaymentsSummarySearchParams,
  buildCurrentMonthStudentsSummary,
  buildPaymentsRequestSearchParams,
  matchesHistoryContentFilters,
  matchesStudentSearchQuery,
  resolveStudentCardPayments,
} from "./staffPaymentFilters"
