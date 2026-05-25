import { centsToUsdInput, toLocalIsoDate } from "./staffAdminFormatters"
import { isCompletedClassEvidence, isPaymentPaidForUi } from "./paymentState"
import type {
  HistoryAttendanceFilter,
  HistoryContentFilterInput,
  HistoryPaymentMethodFilter,
  PackageFormState,
  PackagePlanStatus,
  PaymentCategoryFilter,
  PaymentRow,
  PaymentsApiSummary,
  SchoolPackageRow,
} from "./staffAdminTypes"

const COMPLETED_PAYMENT_STATUS_VALUES = new Set(["succeeded", "paid", "completed"])

export const isCompletedPaymentStatusValue = (status: unknown) =>
  typeof status === "string" && COMPLETED_PAYMENT_STATUS_VALUES.has(status.trim().toLowerCase())

export const resolveDirectClassRevenueCents = <
  TPayment extends Pick<PaymentRow, "id" | "amount" | "classPaid" | "fundingPayment" | "purchaseCategory" | "settlementStatus" | "paymentStatus" | "packageId" | "serviceId">
>(payments: TPayment[]) => {
  const paidPurchases = new Map<string, number>()
  for (const payment of payments) {
    const isDirectClassPurchase = payment.purchaseCategory !== "package" || Boolean(payment.serviceId)
    if (!isDirectClassPurchase) continue
    if (!payment.classPaid && payment.settlementStatus !== "paid" && !isCompletedPaymentStatusValue(payment.paymentStatus)) continue
    paidPurchases.set(payment.id, payment.amount)
  }
  return [...paidPurchases.values()].reduce((sum, amount) => sum + amount, 0)
}

export const matchesPaymentCategory = (
  row: Pick<PaymentRow, "paymentChannel" | "purchaseCategory">,
  category: PaymentCategoryFilter
) => {
  if (category === "all") return true
  if (category === "history") return true
  if (category === "cash") return row.paymentChannel === "cash"
  if (category === "card") return row.paymentChannel === "card" || row.paymentChannel === "unknown"
  if (category === "packages") return row.purchaseCategory === "package"
  if (category === "dropin") return row.purchaseCategory === "dropin"
  return true
}

export const matchesStripeStatus = (
  row: {
    classPaid: PaymentRow["classPaid"]
    purchaseCategory: PaymentRow["purchaseCategory"]
    fundingPayment?: PaymentRow["fundingPayment"]
    checkInStatus?: PaymentRow["checkInStatus"]
    packageId?: PaymentRow["packageId"]
  },
  filter: "all" | "pending" | "paid"
) => {
  if (filter === "all") return true
  if (filter === "paid") return isPaymentPaidForUi(row)
  return !isPaymentPaidForUi(row)
}

export const matchesStudentSearchQuery = (
  row: Pick<PaymentRow, "customerName" | "customerEmail" | "customerPhone" | "courseTitle" | "courseSlug" | "location" | "activePackage">,
  searchTerm: string
) => {
  const normalizedSearchTerm = searchTerm.trim().toLowerCase()
  if (!normalizedSearchTerm) return true

  const haystack = [
    row.customerName,
    row.customerEmail,
    row.customerPhone,
    row.courseTitle,
    row.courseSlug,
    row.location || "",
    row.activePackage?.label || "",
  ]
    .join(" ")
    .toLowerCase()

  return haystack.includes(normalizedSearchTerm)
}

export const matchesHistoryPaymentMethod = (
  row: Pick<PaymentRow, "paymentChannel" | "purchaseCategory">,
  filter: HistoryPaymentMethodFilter
) => {
  if (filter === "all") return true
  if (filter === "cash") return row.paymentChannel === "cash"
  if (filter === "card") return row.paymentChannel === "card"
  if (filter === "package") return row.purchaseCategory === "package"
  return row.purchaseCategory === "dropin"
}

export const matchesHistoryAttendanceFilter = (
  row: Pick<PaymentRow, "checkInStatus" | "purchaseCategory" | "packageId" | "classPaid" | "fundingPayment">,
  filter: HistoryAttendanceFilter
) => {
  if (filter === "all") return true
  if (filter === "attended") return isCompletedClassEvidence(row)
  if (filter === "scheduled") return row.checkInStatus === "scheduled"
  return row.checkInStatus === "none"
}

export const matchesHistoryContentFilters = (
  row: HistoryContentFilterInput,
  filters: {
    classKey: string
    paymentMethodFilter: HistoryPaymentMethodFilter
    attendanceFilter: HistoryAttendanceFilter
    paymentsFilter: "all" | "pending" | "paid"
  }
) => {
  return (
    (!filters.classKey || row.courseSlug === filters.classKey) &&
    matchesHistoryPaymentMethod(row, filters.paymentMethodFilter) &&
    matchesHistoryAttendanceFilter(row, filters.attendanceFilter) &&
    matchesStripeStatus(row, filters.paymentsFilter)
  )
}

export const resolveStudentCardPayments = (
  payments: PaymentRow[],
  options: {
    isHistoryMode: boolean
    historyClassKey: string
    historyPaymentMethodFilter: HistoryPaymentMethodFilter
    historyAttendanceFilter: HistoryAttendanceFilter
    paymentCategoryFilter: PaymentCategoryFilter
    paymentsFilter: "all" | "pending" | "paid"
    studentSearchQuery: string
  }
) => {
  const contentFilteredPayments = payments.filter((payment) => {
    if (options.isHistoryMode) {
      return matchesHistoryContentFilters(payment, {
        classKey: options.historyClassKey,
        paymentMethodFilter: options.historyPaymentMethodFilter,
        attendanceFilter: options.historyAttendanceFilter,
        paymentsFilter: "all",
      })
    }

    return matchesPaymentCategory(payment, options.paymentCategoryFilter)
  })

  if (!options.studentSearchQuery.trim()) {
    return contentFilteredPayments.filter((payment) => matchesStripeStatus(payment, options.paymentsFilter))
  }

  const searchMatchedPayments = contentFilteredPayments.filter((payment) => matchesStudentSearchQuery(payment, options.studentSearchQuery))
  if (searchMatchedPayments.length === 0) return []

  const statusMatchedPayments = searchMatchedPayments.filter((payment) => matchesStripeStatus(payment, options.paymentsFilter))
  return statusMatchedPayments.length > 0 ? statusMatchedPayments : searchMatchedPayments
}

export const buildPaymentsRequestSearchParams = (input: {
  isHistoryMode: boolean
  historyFrom: string
  historyTo: string
  studentSearchQuery?: string
}) => {
  const searchParams = new URLSearchParams()
  const normalizedStudentSearchQuery = input.studentSearchQuery?.trim() || ""
  if (normalizedStudentSearchQuery) {
    searchParams.set("q", normalizedStudentSearchQuery)
  }
  if (!input.isHistoryMode) return searchParams
  searchParams.set("mode", "history")
  searchParams.set("from", input.historyFrom)
  searchParams.set("to", input.historyTo)
  return searchParams
}

export const buildCurrentMonthPaymentsSummarySearchParams = (referenceDate = new Date()) => {
  const monthStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1)
  const monthEnd = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0)

  return buildPaymentsRequestSearchParams({
    isHistoryMode: true,
    historyFrom: toLocalIsoDate(monthStart),
    historyTo: toLocalIsoDate(monthEnd),
  })
}

export const buildCurrentMonthStudentsSummary = (input: {
  summary: PaymentsApiSummary
  studentCount: number
  checkedInStudents: number
}) => ({
  totalStudents: input.studentCount,
  paidStudents: input.summary.paidStripe,
  checkedInStudents: input.checkedInStudents,
  totalRevenueCents: input.summary.totalCollected,
  pendingByContext: input.summary.pendingStripe + input.summary.pendingSettlement,
})

export const createEmptyPackageForm = (): PackageFormState => ({
  id: "",
  key: "",
  courseSlugs: [],
  label: "",
  description: "",
  priceCents: "",
  cadence: "",
  status: "ACTIVE",
  launchAt: "",
  totalCredits: "",
  makeUps: "0",
  validDays: "180",
  isUnlimited: false,
  active: true,
})

export const packageRowToFormState = (item: SchoolPackageRow): PackageFormState => ({
  id: item.id,
  key: item.key,
  courseSlugs: item.courseSlugs ?? (item.courseSlug ? [item.courseSlug] : []),
  label: item.label,
  description: item.description || "",
  priceCents: centsToUsdInput(item.priceCents),
  cadence: item.cadence || "",
  status: item.status || (item.active ? "ACTIVE" : "SUSPENDED"),
  launchAt: item.launchAt ? String(item.launchAt).slice(0, 16) : "",
  totalCredits: item.totalCredits === null ? "" : String(item.totalCredits),
  makeUps: String(item.makeUps),
  validDays: String(item.validDays),
  isUnlimited: item.isUnlimited,
  active: item.active,
})

export const getPackageLifecycleStatus = (item: SchoolPackageRow): PackagePlanStatus => {
  return item.status || (item.active ? "ACTIVE" : "SUSPENDED")
}

export const duplicatePackageRowToFormState = (item: SchoolPackageRow): PackageFormState => ({
  ...packageRowToFormState(item),
  id: "",
  key: `${item.key}-copy`,
  label: `${item.label} Copy`,
})
