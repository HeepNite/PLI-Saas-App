export type HistoryCardPaymentLike = {
  id: string
  userId: string
  customerEmail: string
  courseSlug: string
  courseTitle: string
  paymentChannel: "cash" | "card" | "unknown" | "package_credit"
  purchaseCategory: "package" | "dropin" | "other"
  amount: number
  currency: string
  classPaid: boolean
  createdAt: string
  classDate: string | null
  classTime: string | null
  classStartsAt: string | null
  attendanceId: string | null
  checkInStatus: "checked_in" | "checked_in_no_package" | "checked_out" | "scheduled" | "none"
  checkInAt: string | null
  checkedOutAt: string | null
  packageClassNumber: number | null
  fundingPayment?: {
    id: string
    amount: number
    currency: string
    createdAt: string
    courseTitle: string | null
  } | null
  completedClassesTotal?: number
  packageClassesUsedTotal?: number
}

export type HistoryCardPaidEntry = {
  id: string
  amount: number
  currency: string
  createdAt: string
  courseTitle: string | null
}

export type HistoryStudentCardAggregate<TPayment extends HistoryCardPaymentLike = HistoryCardPaymentLike> = {
  source: "payment"
  key: string
  allPayments: TPayment[]
  latestPayment: TPayment
  latestAttendedPayment: TPayment | null
  totalPayments: number
  totalCollectedCents: number
  paidPayments: number
  checkedInPayments: number
  coursesPurchasedCount: number
  totalPackageClassesConsumed: number
  completedClassesTotal: number
  packageClassesUsedTotal: number
}

const toTimestamp = (value: string | null | undefined) => {
  if (!value) return Number.NEGATIVE_INFINITY
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY
}

const isAttendedPayment = (payment: HistoryCardPaymentLike) =>
  payment.checkInStatus === "checked_in" || payment.checkInStatus === "checked_in_no_package" || payment.checkInStatus === "checked_out"

const isCollectedPayment = (payment: HistoryCardPaymentLike) =>
  payment.classPaid && payment.paymentChannel !== "package_credit"

const byLatestPayment = <TPayment extends HistoryCardPaymentLike>(a: TPayment, b: TPayment) => {
  const diff = toTimestamp(b.createdAt) - toTimestamp(a.createdAt)
  if (diff !== 0) return diff
  return b.id.localeCompare(a.id)
}

const byLatestAttendance = <TPayment extends HistoryCardPaymentLike>(a: TPayment, b: TPayment) => {
  const aTime = Math.max(toTimestamp(a.classStartsAt), toTimestamp(a.checkedOutAt), toTimestamp(a.checkInAt), toTimestamp(a.createdAt))
  const bTime = Math.max(toTimestamp(b.classStartsAt), toTimestamp(b.checkedOutAt), toTimestamp(b.checkInAt), toTimestamp(b.createdAt))
  if (aTime !== bTime) return bTime - aTime
  return byLatestPayment(a, b)
}

const byLatestPaidEntry = (a: HistoryCardPaidEntry, b: HistoryCardPaidEntry) => {
  const diff = toTimestamp(b.createdAt) - toTimestamp(a.createdAt)
  if (diff !== 0) return diff
  return b.id.localeCompare(a.id)
}

export const buildHistoryStudentPaidEntries = <TPayment extends HistoryCardPaymentLike>(payments: TPayment[]) => {
  const deduped = new Map<string, HistoryCardPaidEntry>()

  for (const payment of payments) {
    const fundingPayment = payment.fundingPayment || null

    if (fundingPayment) {
      deduped.set(fundingPayment.id, {
        id: fundingPayment.id,
        amount: fundingPayment.amount,
        currency: fundingPayment.currency,
        createdAt: fundingPayment.createdAt,
        courseTitle: fundingPayment.courseTitle,
      })
      continue
    }

    if (!isCollectedPayment(payment)) continue

    deduped.set(payment.id, {
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      createdAt: payment.createdAt,
      courseTitle: payment.courseTitle,
    })
  }

  return [...deduped.values()].sort(byLatestPaidEntry)
}

export const resolveHistoryStudentCardAmountPaidCents = <TPayment extends HistoryCardPaymentLike>(
  student: Pick<HistoryStudentCardAggregate<TPayment>, "allPayments" | "totalCollectedCents">,
  context: CardContext
) => {
  if (context !== "daily") return student.totalCollectedCents
  return buildHistoryStudentPaidEntries(student.allPayments).reduce((sum, entry) => sum + entry.amount, 0)
}

export const buildHistoryStudentCard = <TPayment extends HistoryCardPaymentLike>(
  payments: TPayment[],
  explicitKey?: string,
  options?: { mode?: "daily" | "history" }
): HistoryStudentCardAggregate<TPayment> | null => {
  if (payments.length === 0) return null

  const mode = options?.mode || "daily"

  // API already scopes rows by mode/range; keep client aggregation pure.
  const scopedPayments = payments

  const allPayments = [...scopedPayments].sort(byLatestPayment)
  if (allPayments.length === 0) return null
  const latestPayment = allPayments[0]
  const latestAttendedPayment = [...allPayments].filter(isAttendedPayment).sort(byLatestAttendance)[0] || null
  const courseKeys = new Set(allPayments.map((payment) => payment.courseSlug || payment.courseTitle || payment.id))
  const packageAttendanceKeys = new Set(
    allPayments
      .filter((payment) => typeof payment.packageClassNumber === "number")
      .map((payment) => payment.attendanceId || payment.id)
  )
  const payloadCompletedTotal = allPayments.find((payment) => typeof payment.completedClassesTotal === "number")?.completedClassesTotal
  const payloadPackageUsedTotal = allPayments.find((payment) => typeof payment.packageClassesUsedTotal === "number")?.packageClassesUsedTotal
  const visibleCompletedClasses = allPayments.filter(isAttendedPayment).length
  const visiblePackageClassesUsed = packageAttendanceKeys.size
  const completedClassesTotal = typeof payloadCompletedTotal === "number" ? payloadCompletedTotal : visibleCompletedClasses
  const packageClassesUsedTotal = typeof payloadPackageUsedTotal === "number" ? payloadPackageUsedTotal : visiblePackageClassesUsed

  return {
    source: "payment",
    key: explicitKey || latestPayment.userId || latestPayment.customerEmail || latestPayment.id,
    allPayments,
    latestPayment,
    latestAttendedPayment,
    totalPayments: allPayments.length,
    totalCollectedCents: allPayments.filter(isCollectedPayment).reduce((sum, payment) => sum + payment.amount, 0),
    paidPayments: allPayments.filter(isCollectedPayment).length,
    checkedInPayments:
      mode === "history" && typeof payloadCompletedTotal === "number"
        ? payloadCompletedTotal
        : visibleCompletedClasses,
    coursesPurchasedCount: courseKeys.size,
    totalPackageClassesConsumed:
      mode === "history" && typeof payloadPackageUsedTotal === "number"
        ? payloadPackageUsedTotal
        : visiblePackageClassesUsed,
    completedClassesTotal,
    packageClassesUsedTotal,
  }
}

export const buildHistoryStudentCards = <TPayment extends HistoryCardPaymentLike>(
  payments: TPayment[],
  options?: { mode?: "daily" | "history" }
) => {
  const grouped = new Map<string, TPayment[]>()

  for (const payment of payments) {
    const key = payment.userId || payment.customerEmail || payment.id
    const bucket = grouped.get(key)
    if (bucket) {
      bucket.push(payment)
      continue
    }
    grouped.set(key, [payment])
  }

  return [...grouped.entries()]
    .map(([key, groupedPayments]) => buildHistoryStudentCard(groupedPayments, key, options))
    .filter((card): card is HistoryStudentCardAggregate<TPayment> => Boolean(card))
    .sort((a, b) => byLatestPayment(a.latestPayment, b.latestPayment))
}

export const isHistoryAttendanceMatch = (
  payment: HistoryCardPaymentLike,
  filter: "all" | "attended" | "scheduled" | "no_attendance"
) => {
  if (filter === "all") return true
  if (filter === "attended") return isAttendedPayment(payment)
  if (filter === "scheduled") return payment.checkInStatus === "scheduled"
  return payment.checkInStatus === "none"
}

export type PinStatus = {
  kind: string
  expiresAt: string | null
  isActive: true
}

export type CardCheckInStatus = "checked_in" | "checked_in_no_package" | "checked_out" | "scheduled" | "none"

export type ActivePackage = {
  label: string
  remainingCredits: number | null
  isUnlimited: boolean
  expiresAt: string | null
}

export type ProfileLastPayment = {
  date: string
  amountCents: number
  purchaseCategory: "package" | "dropin"
  courseTitle: string | null
  paymentChannel: "cash" | "card" | "unknown"
}

export type ProfileLastCourse = {
  courseTitle: string | null
  courseSlug: string | null
}

export type ProfilePinStatus = "enrolled" | "provisional" | "none"

export type ProfileCashSettlement = {
  paymentId: string
  settlementStatus: "pending" | "paid"
  settlementNote: string
}

export type ProfileLatestClassAttended = {
  courseTitle: string | null
  courseSlug: string | null
  startsAt: string
  location: string | null
}

export type StudentProfileCard = {
  source: "profile"
  key: string
  userId: string
  displayName: string
  email: string
  phone: string | null
  avatarUrl: string | null
  registeredAt: string
  checkInStatus: CardCheckInStatus
  latestClassAttended: ProfileLatestClassAttended | null
  latestCheckInAt: string | null
  lastPayment: ProfileLastPayment | null
  lastCourse: ProfileLastCourse | null
  paymentStatus: string | null
  activePackage: ActivePackage | null
  remainingCredits: number | null
  outstandingBalance: number | null
  pinStatus: ProfilePinStatus
  provisionalPinExpiresAt?: string
  cashSettlement: ProfileCashSettlement | null
  pendingSettlement: ProfileCashSettlement | null
  pointsBalance: number
}

export type AnyStudentCard = HistoryStudentCardAggregate | StudentProfileCard

// ============================================================
// Card Context Variants — explicit presentation config
// ============================================================

export type CardContext = "daily" | "history" | "global-search"

export type CardVariantConfig = {
  context: CardContext
  showCheckout: boolean
  showCashBulkSelection: boolean
  showPinActions: boolean
  showMailCopyActions: boolean
  showHistorySubtitle: boolean
  showHistoryTooltip: boolean
  showLatestClassAttended: boolean
  showActivePackage: boolean
  showCheckInStatus: boolean
}

export const resolveCardContext = (
  isHistoryMode: boolean,
  hasSearchResults: boolean
): CardContext => {
  if (hasSearchResults) return "global-search"
  if (isHistoryMode) return "history"
  return "daily"
}

export const CARD_VARIANT_CONFIGS: Record<CardContext, CardVariantConfig> = {
  daily: {
    context: "daily",
    showCheckout: true,
    showCashBulkSelection: true,
    showPinActions: true,
    showMailCopyActions: true,
    showHistorySubtitle: false,
    showHistoryTooltip: false,
    showLatestClassAttended: true,
    showActivePackage: true,
    showCheckInStatus: true,
  },
  history: {
    context: "history",
    showCheckout: false,
    showCashBulkSelection: true,
    showPinActions: true,
    showMailCopyActions: true,
    showHistorySubtitle: true,
    showHistoryTooltip: true,
    showLatestClassAttended: false,
    showActivePackage: false,
    showCheckInStatus: false,
  },
  "global-search": {
    context: "global-search",
    showCheckout: true,
    showCashBulkSelection: true,
    showPinActions: true,
    showMailCopyActions: true,
    showHistorySubtitle: false,
    showHistoryTooltip: false,
    showLatestClassAttended: true,
    showActivePackage: true,
    showCheckInStatus: true,
  },
}

export const resolveCardVariant = (context: CardContext): CardVariantConfig =>
  CARD_VARIANT_CONFIGS[context]
