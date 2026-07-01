import React from "react"

export type EntityType = "attendance" | "payment" | "package" | "stats"

export type TabDef = {
  key: EntityType
  label: string
  icon: React.ComponentType<{ className?: string }>
}

export type SessionItem = {
  id: string
  courseSlug: string
  title: string | null
  startsAt: string
  location: string | null
  existingAttendanceStatus: string | null
  existingAttendancePaymentSource?: "package" | "dropin" | null
}

export type CourseOption = {
  slug: string
  title: string
}

export type PackageOption = {
  id: string
  label: string
  status: string
  remainingCredits: number | null
  usedCredits: number | null
  totalCredits: number | null
  isUnlimited: boolean
  expiresAt: string | null
}

export type PurchaseOption = {
  id: string
  label: string
  amount: number
  currency: string
  status: string
  settlementStatus: string
  outstandingBalance: number
  paymentMethod: string
  createdAt: string
}

export type FormState = {
  entity: EntityType
  reason: string
  // Attendance fields
  attendanceAction: "add" | "remove" | "update"
  attendanceSessionIds: string[]
  attendanceStatus: string
  // Payment fields
  paymentPurchaseId: string
  paymentAmount: string
  paymentSettlementStatus: string
  paymentOutstandingBalance: string
  paymentMethod: string
  // Package fields
  packagePurchaseId: string
  packageRemainingCredits: string
  packageUsedCredits: string
  packageExpiresAt: string
  packageStatus: string
  // Stats fields
  statsCompletedClasses: string
  statsPackageClassesUsed: string
}

export type SubmitState = "idle" | "submitting" | "success" | "error"

export const ATTENDANCE_ACTIONS = [
  { value: "add", label: "Add attendance" },
  { value: "remove", label: "Remove attendance" },
  { value: "update", label: "Update status" },
]

export const ATTENDANCE_STATUSES = [
  { value: "checked_in", label: "Checked in" },
  { value: "checked_in_no_package", label: "Checked in (drop-in)" },
  { value: "checked_out", label: "Checked out" },
  { value: "scheduled", label: "Scheduled" },
  { value: "no_show", label: "No show" },
]

export const SETTLEMENT_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "partial", label: "Partial" },
]

export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "transfer", label: "Transfer" },
  { value: "other", label: "Other" },
]

export const PACKAGE_STATUSES = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
]

export const hasFormValue = (value: string) => value.trim().length > 0

export function createEmptyFormState(): FormState {
  return {
    entity: "attendance",
    reason: "",
    attendanceAction: "add",
    attendanceSessionIds: [],
    attendanceStatus: "checked_in",
    paymentPurchaseId: "",
    paymentAmount: "",
    paymentSettlementStatus: "pending",
    paymentOutstandingBalance: "",
    paymentMethod: "cash",
    packagePurchaseId: "",
    packageRemainingCredits: "",
    packageUsedCredits: "",
    packageExpiresAt: "",
    packageStatus: "active",
    statsCompletedClasses: "",
    statsPackageClassesUsed: "",
  }
}

/** Maps raw attendance status to user-friendly display label */
export function formatAttendanceStatus(status: string): string {
  switch (status) {
    case "checked_in":
      return "checked in"
    case "checked_in_no_package":
      return "drop-in"
    case "checked_out":
      return "checked out"
    case "scheduled":
      return "scheduled"
    case "no_show":
      return "no show"
    default:
      return status.replace(/_/g, " ")
  }
}

export function formatAttendanceBadge(session: SessionItem): string {
  if (session.existingAttendancePaymentSource === "package") return "package"
  if (session.existingAttendancePaymentSource === "dropin") return "drop-in"
  return formatAttendanceStatus(session.existingAttendanceStatus ?? "")
}
