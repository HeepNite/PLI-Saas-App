import {
  asText,
  attendanceSlotKey,
  isCompletedPaymentStatus,
  normalizePaymentChannel,
  normalizePurchaseCategory,
  normalizePurchaseSource,
  resolveCanonicalName,
} from "@/app/api/staff/payments/shared"
import { isStripeFailureInfo, type StripeFailureInfo } from "@/lib/stripe-failure"
import type { PaymentsMode } from "@/app/api/staff/payments/payments-request"
import { PAYMENT_CHANNEL, SETTLEMENT_STATUS } from "@/lib/payment-constants"
import { ATTENDANCE_STATUS } from "@/lib/attendance-constants"

type CheckInStatus = "checked_in" | "checked_in_no_package" | "checked_out" | "scheduled" | "none"

type PaymentRowSource = {
  userId: string
  metadata: Record<string, unknown>
  settlementStatus: string
  settlementNote: string | null
  settledAt: string | null
  classDate: string | null
  classTime: string | null
  classStartsAt: Date | null
  purchase: {
    id: string
    specialClassId?: string | null
    packageId: string | null
    serviceId: string | null
    courseSlug: string | null
    courseTitle: string | null
    status: string
    stripePaymentIntentId: string | null
    stripeCheckoutSessionId: string | null
    amount: number
    currency: string
    createdAt: Date
    updatedAt: Date
    name: string | null
    email: string | null
    phone: string | null
    metadata: unknown
  }
}

type AttendanceRow = {
  id: string
  status: string
  checkedInAt: string | null
  checkedOutAt: string | null
  packagePurchaseId: string | null
}

type ActivePackageRow = {
  packagePurchaseId: string
  packageId: string
  packageLabel: string | null
  totalCredits: number | null
  remainingCredits: number | null
  isUnlimited: boolean
  expiresAt: string | null
  status: string
}

type StudentPinRow = {
  enabled: boolean
  enrolled: boolean
  locked: boolean
  needsEnrollment: boolean
  permanentStatus: string | null
  provisionalActive: boolean
  provisionalExpiresAt: string | null
}

type FundingPaymentRow = unknown

type StaffPaymentRowContext = {
  mode: PaymentsMode
  clerkNameByUserId: Map<string, string>
  dbNameByUserId: Map<string, string | null>
  dbEmailByUserId: Map<string, string>
  dbPhoneByUserId: Map<string, string>
  avatarByUserId: Map<string, string>
  courseLocationBySlug: Map<string | null, string | null>
  dropInPriceBySlug: Map<string | null, number>
  isSpecialEventBySlug: Map<string, boolean>
  pointsByUser: Map<string, number>
  pointsHistoryByUser: Map<string, unknown[]>
  attendanceById: Map<string, AttendanceRow>
  todayAttendanceByPurchaseId: Map<string, AttendanceRow>
  attendanceBySlot: Map<string, AttendanceRow>
  activePackageByUser: Map<string, ActivePackageRow>
  activePackageClassesUsedById: Map<string, number>
  completedClassesByUser: Map<string, number>
  completedOverrideByUser: Map<string, number | null>
  packageUsedOverrideByUser: Map<string, number | null>
  outstandingBalanceByUser: Map<string, number>
  packagePurchaseIdByPurchaseId: Map<string, string>
  packageClassNumberByUsageKey: Map<string, number>
  fundingPurchaseByPackagePurchaseId: Map<string, FundingPaymentRow>
  studentPinByUserId: Map<string, StudentPinRow>
}

const defaultStudentPin: StudentPinRow = {
  enabled: false,
  enrolled: false,
  locked: false,
  needsEnrollment: false,
  permanentStatus: null,
  provisionalActive: false,
  provisionalExpiresAt: null,
}

const resolveChildDropInCategory = (input: {
  purchasePackageId: string | null
  metadataPackageId: string
  isConsecutiveChild: boolean
  serviceId: string
}) => {
  if (input.isConsecutiveChild && !input.purchasePackageId) {
    return {
      packageId: "",
      purchaseCategory: normalizePurchaseCategory({ packageId: "", serviceId: input.serviceId }),
    }
  }

  const packageId = input.purchasePackageId || input.metadataPackageId
  return {
    packageId,
    purchaseCategory: normalizePurchaseCategory({ packageId, serviceId: input.serviceId }),
  }
}

const resolveSettlementStatus = (input: {
  paymentChannel: string
  currentSettlementStatus: string
  isPaid: boolean
  hasOutstandingBalance: boolean
}) => {
  if (input.paymentChannel === PAYMENT_CHANNEL.CASH) {
    return input.currentSettlementStatus
  }

  return input.isPaid ? SETTLEMENT_STATUS.PAID : input.currentSettlementStatus
}

const resolveCheckInStatus = (attendanceStatus: string | null | undefined): CheckInStatus => {
  if (
    attendanceStatus === ATTENDANCE_STATUS.CHECKED_IN ||
    attendanceStatus === ATTENDANCE_STATUS.CHECKED_IN_NO_PACKAGE ||
    attendanceStatus === ATTENDANCE_STATUS.CHECKED_OUT ||
    attendanceStatus === ATTENDANCE_STATUS.SCHEDULED
  ) {
    return attendanceStatus
  }

  return "none"
}

export const buildStaffPaymentResponseRow = (item: PaymentRowSource, context: StaffPaymentRowContext) => {
  const purchase = item.purchase
  const metadataParentPurchaseId = asText(item.metadata.parentPurchaseId)
  const metadataConsecutiveLinkedFrom = asText(item.metadata.consecutiveLinkedFrom)
  const isConsecutiveChild = Boolean(metadataParentPurchaseId || metadataConsecutiveLinkedFrom)
  const courseSlug = purchase.courseSlug
  const paymentStatus = purchase.status
  const metadataPackageId = asText(item.metadata.packageId)
  const serviceId = purchase.serviceId || asText(item.metadata.serviceId)
  const { packageId, purchaseCategory } = resolveChildDropInCategory({
    purchasePackageId: purchase.packageId,
    metadataPackageId,
    isConsecutiveChild,
    serviceId,
  })
  const paymentChannel = normalizePaymentChannel({
    metadata: item.metadata,
    status: paymentStatus,
    stripePaymentIntentId: purchase.stripePaymentIntentId,
    stripeCheckoutSessionId: purchase.stripeCheckoutSessionId,
  })
  const isPackageCredit = paymentChannel === PAYMENT_CHANNEL.PACKAGE_CREDIT

  const metadataAttendanceId = asText(item.metadata.attendanceId) || null
  const explicitAttendance = metadataAttendanceId ? context.attendanceById.get(metadataAttendanceId) || null : null
  const purchaseLinkedAttendance = context.todayAttendanceByPurchaseId.get(purchase.id) || null
  const slotKey = item.classStartsAt && courseSlug
    ? attendanceSlotKey(item.userId, courseSlug, item.classStartsAt.getTime())
    : null
  const slotAttendance = slotKey ? context.attendanceBySlot.get(slotKey) || null : null
  const resolvedAttendance = isPackageCredit
    ? explicitAttendance || purchaseLinkedAttendance
    : explicitAttendance || purchaseLinkedAttendance || slotAttendance
  const activePackage = context.activePackageByUser.get(item.userId)
  const metadataPackagePurchaseId = asText(item.metadata.packagePurchaseId) || null
  const linkedPackagePurchaseId =
    context.packagePurchaseIdByPurchaseId.get(purchase.id) || metadataPackagePurchaseId || resolvedAttendance?.packagePurchaseId || null
  const isPaid = isCompletedPaymentStatus(paymentStatus)
  const normalizedSettlementStatus = resolveSettlementStatus({
    paymentChannel,
    currentSettlementStatus: item.settlementStatus,
    isPaid,
    hasOutstandingBalance: (context.outstandingBalanceByUser.get(item.userId) ?? 0) > 0,
  })
  const checkInStatus = resolveCheckInStatus(resolvedAttendance?.status)
  const packageClassesUsedTotal = context.packageUsedOverrideByUser.get(item.userId)
    ?? (activePackage
      ? (context.activePackageClassesUsedById.get(activePackage.packagePurchaseId) || 0)
      : 0)
  const completedClassesTotal = context.completedOverrideByUser.get(item.userId)
    ?? (context.mode === "today"
      ? (context.completedClassesByUser.get(item.userId) || 0)
      : Math.max(context.completedClassesByUser.get(item.userId) || 0, packageClassesUsedTotal))

  return {
    id: purchase.id,
    userId: item.userId,
    courseSlug,
    courseTitle: purchase.courseTitle || courseSlug,
    isSpecialEvent:
      Boolean(purchase.specialClassId) ||
      (courseSlug ? context.isSpecialEventBySlug.get(courseSlug) === true : false),
    customerName: resolveCanonicalName(
      context.clerkNameByUserId.get(item.userId),
      context.dbNameByUserId.get(item.userId),
      purchase.name,
    ),
    customerEmail: purchase.email || context.dbEmailByUserId.get(item.userId) || "—",
    customerPhone: purchase.phone || context.dbPhoneByUserId.get(item.userId) || "—",
    customerAvatarUrl: context.avatarByUserId.get(item.userId) || null,
    packageId: packageId || null,
    serviceId: serviceId || null,
    paymentChannel,
    purchaseSource: normalizePurchaseSource(item.metadata),
    purchaseCategory,
    amount: purchase.amount,
    currency: purchase.currency,
    paymentStatus,
    settlementStatus: normalizedSettlementStatus,
    settlementNote: item.settlementNote,
    settledAt: item.settledAt,
    createdAt: purchase.createdAt.toISOString(),
    updatedAt: purchase.updatedAt.toISOString(),
    classDate: item.classDate,
    classTime: item.classTime,
    classStartsAt: item.classStartsAt ? item.classStartsAt.toISOString() : null,
    location: context.courseLocationBySlug.get(courseSlug) || null,
    pointsBalance: context.pointsByUser.get(item.userId) || 0,
    pointsHistory: context.pointsHistoryByUser.get(item.userId) || [],
    classPaid: isPaid,
    // Effective price to collect for zero-amount unpaid bookings (the bulk
    // settlement route charges the course drop-in price for these).
    dueAmountCents:
      purchase.amount === 0 && !isPaid ? context.dropInPriceBySlug.get(courseSlug) ?? null : null,
    attendanceId: resolvedAttendance?.id ?? null,
    checkInStatus,
    checkInAt: resolvedAttendance?.checkedInAt ?? null,
    checkedOutAt: resolvedAttendance?.checkedOutAt ?? null,
    activePackage: activePackage
      ? {
          id: activePackage.packageId,
          label: activePackage.packageLabel || activePackage.packageId,
          totalCredits: activePackage.totalCredits,
          remainingCredits: activePackage.remainingCredits,
          isUnlimited: activePackage.isUnlimited,
          expiresAt: activePackage.expiresAt,
          status: activePackage.status,
        }
      : null,
    completedClassesTotal,
    packageClassesUsedTotal,
    outstandingBalance: (() => {
      const value = context.outstandingBalanceByUser.get(item.userId)
      return typeof value === "number" && value > 0 ? value : null
    })(),
    studentPin: context.studentPinByUserId.get(item.userId) || defaultStudentPin,
    packageClassNumber:
      context.mode === "history" && linkedPackagePurchaseId && slotAttendance?.id
        ? context.packageClassNumberByUsageKey.get(`${linkedPackagePurchaseId}|${slotAttendance.id}`) ?? null
        : null,
    fundingPayment: linkedPackagePurchaseId ? context.fundingPurchaseByPackagePurchaseId.get(linkedPackagePurchaseId) || null : null,
    stripeFailure: isStripeFailureInfo((purchase.metadata as Record<string, unknown> | null)?.stripeFailure)
      ? ((purchase.metadata as Record<string, unknown>).stripeFailure as StripeFailureInfo)
      : null,
  }
}
