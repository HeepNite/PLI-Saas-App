import type { StudentProfileCard } from "@/components/front/staff/historyCardAggregates"

import { formatIsoDate, formatMoney } from "./staffAdminFormatters"
import type { PaymentRow } from "./staffAdminTypes"
import {
  checkInStateTone,
  isDirectPaidClassEvidence,
  isPaymentPaidForUi,
} from "./paymentState"
import {
  formatIsoDateLong,
  formatStudentPaymentCardDateTimeLabel,
} from "./studentPaymentCardFormatters"

export const getInitials = (firstName: string, lastName: string, email: string) => {
  const a = firstName?.trim()?.[0] || ""
  const b = lastName?.trim()?.[0] || ""
  const initials = `${a}${b}`.toUpperCase()
  if (initials) return initials
  return (email?.trim()?.[0] || "S").toUpperCase()
}

export const paymentStateTone = (row: PaymentRow) => {
  if (row.paymentChannel === "cash") {
    if (row.settlementStatus === "paid") return "border-emerald-500/40 bg-emerald-500/12 text-emerald-300"
    return "border-amber-500/45 bg-amber-500/10 text-amber-300"
  }
  if (isPaymentPaidForUi(row)) return "border-emerald-500/40 bg-emerald-500/12 text-emerald-300"
  return "border-[var(--brand,#b61616)]/45 bg-[var(--brand,#b61616)]/12 text-[var(--brand,#ff4b4b)]"
}

export const checkInStateLabel = (row: PaymentRow, options?: { includePurchaseCategory?: boolean }) => {
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
export const PROFILE_CARD_BADGE_CLASS = "w-full flex items-center justify-center rounded-md border px-2 py-1.5 text-xs font-semibold"

const profilePinBadgeLabel = (status: StudentProfileCard["pinStatus"]) => {
  if (status === "provisional") return "Prov PIN"
  if (status === "enrolled") return "PIN enrolled"
  return "No PIN"
}

type ProfileBadge = {
  key: string
  label: string
  tone: string
  title?: string
}

type PackageBadgeInput =
  | { isUnlimited: boolean; totalCredits: number | null; remainingCredits: number | null }
  | null
  | undefined

// Compact package badge shared by both card renderers. Shows remaining/total classes
// (e.g. "Pkg 5/8"), not the plan name. Non-package students read as "Drop-in".
// Colors are intentionally non-caution — amber/yellow is reserved for real warnings.
export const resolvePackageBadge = (activePackage: PackageBadgeInput) => {
  if (!activePackage) {
    return { label: "Drop-in", tone: "border-sky-400/40 bg-sky-400/12 text-sky-200" }
  }
  const tone = "border-emerald-400/35 bg-emerald-400/10 text-emerald-200"
  if (activePackage.isUnlimited) return { label: "Unlimited", tone }
  const remaining = Math.max(0, activePackage.remainingCredits ?? 0)
  if (activePackage.totalCredits) return { label: `Pkg ${remaining}/${activePackage.totalCredits}`, tone }
  return { label: `Pkg ${remaining} left`, tone }
}

export const resolveProfileCardBadges = (student: StudentProfileCard) => {
  const details = resolveProfileCardDetails(student)
  return [
    {
      key: "points",
      label: `Points: ${student.pointsBalance}`,
      tone: "border-fuchsia-400/35 bg-fuchsia-400/10 text-fuchsia-200",
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
      key: "package",
      ...resolvePackageBadge(student.activePackage),
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

export const resolveVisibleProfileSettlementIds = (students: StudentProfileCard[]) =>
  [
    ...new Set(
      students
        .map((student) => resolveProfileSettlementControl(student)?.paymentId)
        .filter((paymentId): paymentId is string => Boolean(paymentId))
    ),
  ]

export const getOpenPaymentIds = (allPayments: PaymentRow[]): string[] => {
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
      : student.activePackage.totalCredits
        ? `${Math.max(0, student.remainingCredits || 0)} of ${student.activePackage.totalCredits} remaining`
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

export const splitCustomerName = (name: string, email: string) => {
  const source = name.trim() || email.trim()
  const parts = source.split(/\s+/).filter(Boolean)
  const firstName = parts[0] || ""
  const lastName = parts.slice(1).join(" ")
  return { firstName, lastName, fullName: source || "Student" }
}
