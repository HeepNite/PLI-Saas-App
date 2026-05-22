import type { AttendanceEvent, AttendanceSummary } from "@/components/front/staff/AttendanceHistoryTimeline"
import type { PaymentEvent } from "@/components/front/staff/PaymentHistoryTimeline"

type PaymentChannel = "cash" | "card" | "unknown" | "package_credit"
type PurchaseCategory = "package" | "dropin" | "other"
type CheckInStatus = "checked_in" | "checked_in_no_package" | "checked_out" | "scheduled" | "none"

type ActivePackage = {
  label: string
  isUnlimited: boolean
  totalCredits: number | null
  remainingCredits: number | null
}

type StripeFailure = {
  error?: {
    message?: string
    code?: string
    declineCode?: string
  } | null
  card?: {
    brand?: string
    last4?: string
  } | null
}

type PaymentTimelineRow = {
  id: string
  userId: string
  attendanceId: string | null
  paymentChannel: PaymentChannel
  purchaseCategory: PurchaseCategory
  amount: number
  paymentStatus: string
  settlementStatus: "pending" | "paid"
  createdAt: string
  classDate: string | null
  classTime: string | null
  courseTitle: string | null
  courseSlug: string | null
  packageId: string | null
  serviceId: string | null
  outstandingBalance: number | null
  stripeFailure?: StripeFailure | null
  checkInStatus: CheckInStatus
  checkInAt: string | null
  checkedOutAt: string | null
  activePackage?: ActivePackage | null
}

const toLocalIsoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`

const resolveHistoryDateIso = (referenceDate: Date, timeZone = "America/New_York") => {
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

export function transformPaymentRowsToEvents(rows: PaymentTimelineRow[]): PaymentEvent[] {
  const monetaryPayments = rows.filter((row) => {
    if (row.paymentChannel === "package_credit") return false
    if (row.amount <= 0) return false
    return true
  })

  return monetaryPayments.map((row) => {
    let method: PaymentEvent["method"]
    if (row.paymentChannel === "cash") {
      method = "cash"
    } else if (row.paymentChannel === "card") {
      method = "card"
    } else {
      method = "other"
    }

    let productType: PaymentEvent["productType"]
    if (row.purchaseCategory === "package" || row.packageId) {
      productType = "package"
    } else if (row.purchaseCategory === "dropin" || row.serviceId) {
      productType = "dropin"
    } else {
      productType = "other"
    }

    let status: PaymentEvent["status"]
    if (row.paymentStatus === "refunded" || row.paymentStatus === "cancelled") {
      status = row.paymentStatus === "cancelled" ? "cancelled" : "refunded"
    } else if (row.settlementStatus === "paid" || row.paymentStatus === "paid" || row.paymentStatus === "succeeded") {
      status = "paid"
    } else {
      status = "pending"
    }

    return {
      id: row.id,
      date: new Date(row.createdAt),
      amount: row.amount / 100,
      method,
      product: row.courseTitle || row.purchaseCategory || "Payment",
      productType,
      status,
      debt: typeof row.outstandingBalance === "number" && row.outstandingBalance > 0 ? row.outstandingBalance / 100 : undefined,
      failureInfo: row.stripeFailure
        ? {
            message: row.stripeFailure.error?.message,
            code: row.stripeFailure.error?.code,
            declineCode: row.stripeFailure.error?.declineCode,
            cardBrand: row.stripeFailure.card?.brand,
            cardLast4: row.stripeFailure.card?.last4,
          }
        : null,
    }
  })
}

export function transformPaymentRowsToAttendance(
  rows: PaymentTimelineRow[],
): { events: AttendanceEvent[]; summary: AttendanceSummary } {
  const events: AttendanceEvent[] = []
  let totalAttended = 0
  let noShows = 0

  for (const row of rows) {
    const hasAttendedStatus =
      row.checkInStatus === "checked_in" ||
      row.checkInStatus === "checked_in_no_package" ||
      row.checkInStatus === "checked_out"

    const hasRealAttendanceEvidence =
      hasAttendedStatus ||
      (Boolean(row.checkedOutAt) && row.checkInStatus !== "scheduled" && row.checkInStatus !== "none")

    const hasCheckInTimestamp = Boolean(row.checkInAt)
    const isPackageCredit = row.paymentChannel === "package_credit"

    if (isPackageCredit && (!hasRealAttendanceEvidence || !hasCheckInTimestamp)) continue
    if (!isPackageCredit && !row.attendanceId && row.checkInStatus === "none") continue

    const isCashPendingSettlement = row.paymentChannel === "cash" && row.settlementStatus === "pending"

    let status: AttendanceEvent["status"]
    if (isCashPendingSettlement) {
      status = "booked"
    } else if (isPackageCredit && hasRealAttendanceEvidence && hasCheckInTimestamp) {
      status = "attended"
    } else if (isPackageCredit && row.checkInStatus === "scheduled") {
      status = "booked"
    } else if (hasAttendedStatus && hasCheckInTimestamp) {
      status = "attended"
    } else if (row.checkInStatus === "scheduled") {
      status = "booked"
    } else {
      status = "no-show"
    }

    if (status === "attended") totalAttended++
    else if (status === "no-show") noShows++

    let eventDate: Date
    if (row.classDate) {
      const [year, month, day] = row.classDate.split("-").map(Number)
      eventDate = new Date(year, month - 1, day)
    } else {
      eventDate = new Date(row.createdAt)
    }

    const attendanceTime = (() => {
      if (status !== "attended") return row.classTime || "00:00"
      if (!row.checkInAt) return row.classTime || "00:00"
      const parsed = new Date(row.checkInAt)
      if (Number.isNaN(parsed.getTime())) return row.classTime || "00:00"
      const hours = String(parsed.getHours()).padStart(2, "0")
      const minutes = String(parsed.getMinutes()).padStart(2, "0")
      return `${hours}:${minutes}`
    })()

    const isPackageRow = isPackageCredit || row.purchaseCategory === "package" || Boolean(row.packageId)
    const classLabel = row.courseTitle || row.courseSlug || "Class"
    const timeLabel = row.classTime
      ? (() => {
          const [h, m] = row.classTime.split(":").map(Number)
          if (!Number.isFinite(h)) return ""
          const suffix = h >= 12 ? "PM" : "AM"
          const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
          return ` · ${hour12}${m ? `:${String(m).padStart(2, "0")}` : ""}${suffix}`
        })()
      : ""
    events.push({
      id: [row.attendanceId || "no-attendance", row.id].join(":"),
      date: eventDate,
      time: attendanceTime,
      className: `${classLabel}${timeLabel}`,
      classType: isPackageRow ? "Package" : "Drop-in",
      packageName: isPackageRow ? row.activePackage?.label : undefined,
      status,
    })
  }

  const latestPkg = rows.find((r) => r.activePackage)?.activePackage
  const summary: AttendanceSummary = {
    totalAttended,
    noShows,
    cancelled: 0,
    activePackage: latestPkg
      ? {
          name: latestPkg.label,
          totalClasses: latestPkg.isUnlimited ? null : latestPkg.totalCredits,
          classesUsed: latestPkg.totalCredits && latestPkg.remainingCredits != null ? latestPkg.totalCredits - latestPkg.remainingCredits : 0,
          classesRemaining: latestPkg.isUnlimited ? null : latestPkg.remainingCredits,
          isUnlimited: latestPkg.isUnlimited,
        }
      : undefined,
  }

  return { events, summary }
}

export const resolveAttendanceHistoryRows = (input: {
  attendanceHistoryStudentId: string | null
  isHistoryMode: boolean
  payments: PaymentTimelineRow[]
  userHistoryPayments: PaymentTimelineRow[]
  historyFrom: string
  historyTo: string
}) => {
  if (!input.attendanceHistoryStudentId) return []

  const sourcePayments = input.isHistoryMode
    ? input.userHistoryPayments
    : input.payments.filter((payment) => payment.userId === input.attendanceHistoryStudentId)

  if (!input.isHistoryMode || !input.historyFrom || !input.historyTo) {
    return sourcePayments
  }

  return sourcePayments.filter(
    (payment) =>
      Boolean(payment.classDate) &&
      payment.classDate! >= input.historyFrom &&
      payment.classDate! <= input.historyTo
  )
}

export const resolvePaymentHistoryRows = (input: {
  paymentHistoryStudentId: string | null
  isHistoryMode: boolean
  payments: PaymentTimelineRow[]
  userHistoryPayments: PaymentTimelineRow[]
  currentDateNY?: string
}) => {
  if (!input.paymentHistoryStudentId) return []

  const resolveCreatedAtNyIso = (createdAt: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(createdAt)) return createdAt
    const parsed = new Date(createdAt)
    if (Number.isNaN(parsed.getTime())) return ""
    return resolveHistoryDateIso(parsed, "America/New_York")
  }

  if (!input.isHistoryMode) {
    const studentRows = input.payments.filter((payment) => payment.userId === input.paymentHistoryStudentId)
    if (!input.currentDateNY) return studentRows
    return studentRows.filter((payment) => {
      const createdAtNyIso = resolveCreatedAtNyIso(payment.createdAt)
      return createdAtNyIso === input.currentDateNY
    })
  }
  return input.userHistoryPayments
}
