type CheckInStatus = "checked_in" | "checked_in_no_package" | "checked_out" | "scheduled" | "none"

type FundingPayment = {
  id: string
  amount: number
  currency: string
  createdAt: string
  courseTitle: string | null
}

type StudentPin = {
  enabled: boolean
  provisionalActive: boolean
}

type PaymentStateRow = {
  classPaid: boolean
  purchaseCategory: "package" | "dropin" | "other"
  paymentChannel: "cash" | "card" | "unknown" | "package_credit"
  settlementStatus: "pending" | "paid"
  checkInStatus: CheckInStatus
  packageId: string | null
  fundingPayment?: FundingPayment | null
}

export const isCheckedInStatus = (value: CheckInStatus) => value === "checked_in" || value === "checked_in_no_package"

export const isCompletedAttendanceStatus = (value: CheckInStatus) => isCheckedInStatus(value) || value === "checked_out"

const isPackageBackedDailyCheckIn = (
  row: {
    checkInStatus?: CheckInStatus
    fundingPayment?: FundingPayment | null
    purchaseCategory: PaymentStateRow["purchaseCategory"]
    packageId?: string | null
  }
) => {
  if (!row.checkInStatus || !isCheckedInStatus(row.checkInStatus)) return false
  return Boolean(row.fundingPayment || row.purchaseCategory === "package" || row.packageId)
}

export const isPaymentPaidForUi = (
  row: {
    classPaid: PaymentStateRow["classPaid"]
    purchaseCategory: PaymentStateRow["purchaseCategory"]
    fundingPayment?: FundingPayment | null
    checkInStatus?: CheckInStatus
    packageId?: string | null
  }
) => {
  if (row.fundingPayment) return true
  if (isPackageBackedDailyCheckIn(row)) return true
  if (row.purchaseCategory === "package") return Boolean(row.fundingPayment)
  return row.classPaid
}

export const isDirectPaidClassEvidence = (
  row: Pick<PaymentStateRow, "purchaseCategory" | "packageId" | "classPaid" | "fundingPayment" | "checkInStatus">
) => row.purchaseCategory !== "package" && !row.packageId && isPaymentPaidForUi(row)

export const isCompletedClassEvidence = (
  row: Pick<PaymentStateRow, "checkInStatus" | "purchaseCategory" | "packageId" | "classPaid" | "fundingPayment">
) => isCompletedAttendanceStatus(row.checkInStatus) || isDirectPaidClassEvidence(row)

export const paymentStateLabel = (
  row: {
    paymentChannel: PaymentStateRow["paymentChannel"]
    settlementStatus: PaymentStateRow["settlementStatus"]
    classPaid: PaymentStateRow["classPaid"]
    purchaseCategory: PaymentStateRow["purchaseCategory"]
    fundingPayment?: FundingPayment | null
    checkInStatus?: CheckInStatus
    packageId?: string | null
  }
) => {
  if (row.paymentChannel === "cash") {
    return row.settlementStatus === "paid" ? "Cash paid" : "Cash pending"
  }
  if (row.fundingPayment || isPackageBackedDailyCheckIn(row)) {
    return "Package paid"
  }
  if (row.paymentChannel === "card") {
    return isPaymentPaidForUi(row) ? "Card paid" : "Card pending"
  }
  if (row.purchaseCategory === "package") {
    return isPaymentPaidForUi(row) ? "Package paid" : "Package pending"
  }
  return isPaymentPaidForUi(row) ? "Paid" : "Pending"
}

export const resolveDailyVisiblePayment = <TRow extends {
  checkInStatus: CheckInStatus
  fundingPayment?: FundingPayment | null
  purchaseCategory: PaymentStateRow["purchaseCategory"]
  packageId: string | null
}>(payments: TRow[]) => {
  return payments.find((payment) => isPackageBackedDailyCheckIn(payment)) || payments[0] || null
}

export const checkInStateTone = (row: { checkInStatus: CheckInStatus }) => {
  if (isCheckedInStatus(row.checkInStatus)) return "border-violet-400/40 bg-violet-400/12 text-violet-200"
  if (row.checkInStatus === "checked_out") return "border-cyan-400/40 bg-cyan-400/12 text-cyan-200"
  if (row.checkInStatus === "scheduled") return "border-amber-500/45 bg-amber-500/10 text-amber-300"
  if (isDirectPaidClassEvidence(row as Pick<PaymentStateRow, "purchaseCategory" | "packageId" | "classPaid" | "fundingPayment" | "checkInStatus">)) return "border-violet-400/40 bg-violet-400/12 text-violet-200"
  return "border-[var(--brand,#b61616)]/50 bg-[var(--brand,#b61616)]/15 text-[var(--brand,#ff4b4b)]"
}

export const resolveStudentPinTone = (studentPin: StudentPin) => {
  if (!studentPin.enabled) return null
  if (studentPin.provisionalActive) return "border-cyan-400/35 bg-cyan-400/10 text-cyan-200"
  return "border-blue-400/40 bg-blue-400/12 text-blue-200"
}
