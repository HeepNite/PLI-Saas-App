import type { StaffRole } from "@/lib/security/staff-role"
import type {
  StaffCategory,
  StaffPaymentInfo,
  StaffPaymentPreference,
} from "@/lib/security/staff-category"
import type { StaffRequestStatus, StaffRequestType } from "@/lib/security/staff-request"
import type { StripeFailureInfo } from "@/lib/stripe-failure"
import type {
  CoursePublicationMode,
  CourseSpecialDiscountType,
  ReportsObjectiveFilter,
} from "./staffAdminConstants"

export type StaffUserRow = {
  id: string
  paymentModelId: string | null
  email: string
  phone: string
  avatarUrl: string
  location: string
  hasPin: boolean
  firstName: string
  lastName: string
  role: StaffRole
  category: StaffCategory
  payrollHoursWorked: number | null
  payrollHourlyRate: number | null
  payrollStatus: "paid" | "pending" | null
  payrollPaydayWeekday: number | null
  payrollDelayEntries: PayrollDelayEntry[]
  performanceRating: number | null
  performanceReviewsCount: number | null
  performanceReviewCycleDays: number | null
  teacherType: string
  teacherAssignedUserId: string
  teacherRecurrenceUnit: "month" | "year"
  teacherRecurrenceInterval: number | null
  teacherCourseSlugs: string[]
  teacherWeekdays: number[]
  teacherShiftStart: string
  teacherShiftEnd: string
  teacherWeeklyHours: number | null
  teacherBonusTargetHours: number | null
  banned: boolean
  locked: boolean
  online: boolean
  authOnline: boolean
  lastActiveAt: number | null
  staffLastCheckInAt: number | null
  createdAt: number
  lastSignInAt: number | null
}

export type ScheduleEvent = {
  attendanceId: string
  status: string
  startsAtIso: string
  timeLabel: string
  courseSlug: string
  courseTitle: string
  userId: string
  userName: string
  userEmail: string
  userPhone: string
}

export type WebCashArrival = {
  attendanceId: string
  userName: string
  courseTitle: string
  cashAmountCents: number
  checkedInAt: string
}

export type PaymentRow = {
  id: string
  userId: string
  courseSlug: string
  courseTitle: string
  customerName: string
  customerEmail: string
  customerPhone: string
  customerAvatarUrl: string | null
  packageId: string | null
  serviceId: string | null
  paymentChannel: "cash" | "card" | "unknown" | "package_credit"
  purchaseSource?: "web" | "kiosk" | "front_desk" | "admin" | "unknown"
  purchaseCategory: "package" | "dropin" | "other"
  amount: number
  currency: string
  paymentStatus: string
  settlementStatus: "pending" | "paid"
  settlementNote: string
  settledAt: string | null
  createdAt: string
  updatedAt: string
  classDate: string | null
  classTime: string | null
  classStartsAt: string | null
  location: string | null
  pointsBalance: number
  pointsHistory: Array<{
    id: string
    type: string
    points: number
    createdAt: string
    source: string | null
    courseSlug: string | null
    milestone: number | null
  }>
  classPaid: boolean
  dueAmountCents?: number | null
  attendanceId: string | null
  checkInStatus: "checked_in" | "checked_in_no_package" | "checked_out" | "scheduled" | "none"
  checkInAt: string | null
  checkedOutAt: string | null
  activePackage: {
    id: string
    label: string
    totalCredits: number | null
    remainingCredits: number | null
    isUnlimited: boolean
    expiresAt: string | null
    status: string
  } | null
  studentPin: {
    enabled: boolean
    enrolled: boolean
    locked: boolean
    needsEnrollment: boolean
    permanentStatus: string | null
    provisionalActive: boolean
    provisionalExpiresAt: string | null
  }
  packageClassNumber: number | null
  fundingPayment?: {
    id: string
    amount: number
    currency: string
    createdAt: string
    courseTitle: string | null
  } | null
  completedClassesTotal: number
  packageClassesUsedTotal: number
  outstandingBalance: number | null
  stripeFailure?: StripeFailureInfo | null
}

export type HistoryClassOption = {
  slug: string
  title: string
}

export type PaymentsApiSummary = {
  totalItems: number
  totalCollected: number
  pendingSettlement: number
  paidSettlement: number
  pendingStripe: number
  paidStripe: number
}

export type PaymentCategoryFilter = "all" | "cash" | "card" | "packages" | "dropin" | "history"
export type HistoryPaymentMethodFilter = "all" | "cash" | "card" | "package" | "dropin"
export type HistoryAttendanceFilter = "all" | "attended" | "scheduled" | "no_attendance"
export type HistoryContentFilterInput = {
  courseSlug: string
  paymentChannel: "cash" | "card" | "unknown" | "package_credit"
  purchaseCategory: "package" | "dropin" | "other"
  packageId: string | null
  classPaid: boolean
  fundingPayment?: PaymentRow["fundingPayment"]
  checkInStatus: "checked_in" | "checked_in_no_package" | "checked_out" | "scheduled" | "none"
}

export type ReportsSuggestion = {
  id: string
  objective: Exclude<ReportsObjectiveFilter, "all">
  title: string
  priority: "High" | "Medium" | "Low"
  insight: string
  proposal: string
  actions: string[]
  aiBrief: string
}

export type ReportsSuggestionsApiResponse = {
  ok?: boolean
  provider?: "mock" | "custom-http"
  usedFallback?: boolean
  warning?: string | null
  suggestions?: ReportsSuggestion[]
  error?: string
}

export type StaffRequestRow = {
  id: string
  type: StaffRequestType
  status: StaffRequestStatus
  message: string
  meta: Record<string, unknown>
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  user: {
    id: string
    name: string
    email: string
    phone: string
  }
}

export type StaffRequestSummary = {
  total: number
  pending: number
  inReview: number
  approved: number
  rejected: number
}

export type PaymentChangeRequestStatus = "pending" | "approved" | "rejected" | "cancelled"

export type StaffPaymentChangeRequestRow = {
  id: string
  staffAccountId: string
  requestedMethod: string
  requestedInfo: unknown
  reason: string | null
  status: PaymentChangeRequestStatus
  createdAt: string
  staffAccount: {
    firstName: string
    lastName: string
    email: string
  }
}

export type StaffApprovalFeedItem =
  | {
      id: string
      createdAt: string
      kind: "staff_request"
      request: StaffRequestRow
    }
  | {
      id: string
      createdAt: string
      kind: "payment_change_request"
      request: StaffPaymentChangeRequestRow
    }

export type SelfProfileMetrics = {
  performanceRating: number | null
  performanceReviewsCount: number | null
  performanceReviewCycleDays: number | null
  payrollHoursWorked: number | null
  payrollHourlyRate: number | null
  payrollStatus: "paid" | "pending" | null
  payrollPaydayWeekday: number | null
}

export type SelfProfileSnapshot = {
  firstName: string
  lastName: string
  imageUrl: string
  location: string
  role: StaffRole
  category: StaffCategory
  paymentPreference: StaffPaymentPreference | null
  assignedPaymentPreference: StaffPaymentPreference | null
  paymentInfo: StaffPaymentInfo | null
  metrics: SelfProfileMetrics
  presence: {
    online: boolean
    authOnline: boolean
    lastSignInAt: number | null
    staffLastCheckInAt: number | null
    status: "online" | "offline" | null
  }
  teaching: {
    teacherCourseSlugs: string[]
    teacherWeekdays: number[]
    teacherShiftStart: string
    teacherShiftEnd: string
  }
}

export type StaffPaymentForm = {
  paymentPreference: StaffPaymentPreference | ""
  cbu: string
  alias: string
  accountHolder: string
  mercadoPagoId: string
  bankName: string
  routingNumber: string
  accountNumber: string
  zelleId: string
  venmoUser: string
  accountType: string
}

export type ProfileRequestFormState = {
  type: StaffRequestType
  message: string
  startDate: string
  endDate: string
  preferredShift: string
  consultTopic: string
}

export type PayrollStaffRow = {
  userId: string
  name: string
  role: StaffRole
  category: StaffCategory
  hoursWorked: number | null
  hourlyRate: number | null
  amountCents: number | null
  status: "paid" | "pending" | "unknown"
  delayDays: number | null
  paydayWeekday: number | null
  paydayLabel: string
  dueDateLabel: string | null
  delayEntries: PayrollDelayEntry[]
}

export type PayrollDelayEntry = {
  id: string
  dateLabel: string
  expectedTime: string
  actualTime: string
  delayMinutes: number
}

export type StaffPaymentModelOption = {
  id: string
  name: string
  active: boolean
  isDefault: boolean
}

export type PayrollModelActionState = {
  status: "idle" | "saving" | "success" | "error"
  message: string | null
}

export type PayrollDelayModalState = {
  row: PayrollStaffRow
  entries: PayrollDelayEntry[]
  totalDelayMinutes: number
  lateDays: number
}

export type StudentPinModalState = {
  userId: string
  name: string
  email: string
  needsEnrollment: boolean
  provisionalActive: boolean
  provisionalExpiresAt: string | null
}

export type RoomSafeDeleteModalState = {
  room: RoomRow
  reason: string
  error: string | null
}

export type RoomReassignModalState = {
  room: RoomRow
  targetRoomId: string
  moveFutureSessions: boolean
  availableCourses: Array<{ id: string; title: string; slug: string; scheduleLabel: string | null }>
  selectedCourseIds: string[]
  error: string | null
}

export type RoomReservationRow = {
  id: string
  roomId: string
  title: string
  reason: string
  category: string | null
  startsAt: string
  endsAt: string
  status: string
  assignedStaffClerkUserId: string | null
  cancellationReason: string | null
}

export type RoomReservationCancelModalState = {
  reservation: RoomReservationRow
  reason: string
  error: string | null
}

export type StaffProfileForm = {
  firstName: string
  lastName: string
  role: StaffRole
  category: StaffCategory
  birthDate: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  postalCode: string
  country: string
  personalNote: string
  location: string
  gallery: string[]
  pin: string
  clearPin: boolean
}

export type SchoolCourseRow = {
  id: string
  slug: string
  title: string
  kind: string
  category: string | null
  description: string | null
  coverImageUrl: string | null
  previewVideoUrl: string | null
  dropInPriceCents: number | null
  firstClassPriceCents: number | null
  level: string | null
  durationMinutes: number | null
  location: string | null
  defaultRoomId: string | null
  availableWeekdays: number[]
  availableTimes: string[]
  scheduleRules: unknown | null
  active: boolean
  createdAt: string
}

export type RoomRow = {
  id: string
  name: string
  capacity: number
  location: string | null
  active: boolean
}

export type PackagePlanStatus = "ACTIVE" | "SUSPENDED" | "SCHEDULED" | "DELETED"
export type PackageStatusFilter = "all" | PackagePlanStatus

export type AssignmentCourseOption = {
  slug: string
  title: string
  description: string | null
  imageUrl: string | null
  scheduleLabel: string | null
  kindLabel: string | null
}

export type SchoolPackageRow = {
  id: string
  key: string
  courseSlug: string | null
  courseSlugs: string[]
  label: string
  description: string | null
  priceCents: number | null
  cadence: string | null
   status?: PackagePlanStatus | null
   launchAt?: string | null
  totalCredits: number | null
  makeUps: number
  validDays: number
  isUnlimited: boolean
  active: boolean
  createdAt: string
}

export type PointsRuleRow = {
  id: string
  key: string
  label: string
  description: string | null
  eventType: string
  points: number
  active: boolean
  createdAt: string
}

export type CourseFormState = {
  slug: string
  title: string
  kind: string
  category: string
  description: string
  previewImageUrl: string
  previewVideoUrl: string
  dropInPriceCents: string
  firstClassPriceCents: string
  level: string
  durationMinutes: string
  location: string
  defaultRoomId: string
  publicationMode: CoursePublicationMode
  launchDate: string
  specialDiscountType: CourseSpecialDiscountType
  specialDiscountCustomLabel: string
  specialDiscountPrice: string
  availableTimesCsv: string
  active: boolean
}

export type CourseLinkRow = {
  id: string
  courseSlugA: string
  courseSlugB: string
  dropInConsecutiveCents: number
  packageHolderConsecutiveCents: number
  active: boolean
}

export type CourseLinkFormState = {
  courseSlugB: string
  dropInConsecutiveCents: string
  packageHolderConsecutiveCents: string
  active: boolean
}

export type CourseScheduleSlot = {
  date?: string
  weekday?: number
  recurring?: boolean
  time: string
}

export type CourseScheduleRuleEntry = {
  weekday: number
  times: string[]
}

export type CourseSpecialEventEntry = {
  date: string
  times: string[]
  label: string | null
}

export type CoursePublicationSettings = {
  mode: CoursePublicationMode
  launchDate: string | null
}

export type CourseSpecialDiscountSettings = {
  type: CourseSpecialDiscountType
  label: string | null
  priceCents: number | null
}

export type CourseScheduleRulesPayload = {
  mode: "regular" | "special_event"
  weeklyDaysTarget: number
  repeatAllMonth: boolean
  recurrenceMode: "indefinite" | "until_date"
  recurrenceEndsAt: string | null
  rules: CourseScheduleRuleEntry[]
  specialEvents: CourseSpecialEventEntry[]
  publication?: CoursePublicationSettings
  specialDiscount?: CourseSpecialDiscountSettings
}

export type PackageFormState = {
  id: string
  key: string
  courseSlugs: string[]
  label: string
  description: string
  priceCents: string
  cadence: string
  status: PackagePlanStatus
  launchAt: string
  totalCredits: string
  makeUps: string
  validDays: string
  isUnlimited: boolean
  active: boolean
}

export type PointsRuleFormState = {
  templateKey: string
  points: string
  active: boolean
}

export type PointsAssignFormState = {
  userEmail: string
  type: string
  points: string
  note: string
  eventKey: string
}

export type TeacherAssignmentFormState = {
  assignedUserId: string
  recurrenceUnit: "month" | "year"
  recurrenceInterval: number
  courseSlugs: string[]
}
