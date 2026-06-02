import type { StaffRequestStatus } from "@/lib/security/staff-request"

import type {
  StaffApprovalFeedItem,
  StaffPaymentChangeRequestRow,
  StaffRequestRow,
  StaffRequestSummary,
} from "./staffAdminTypes"

const PAYMENT_CHANGE_REQUEST_STATUS_TO_STAFF_STATUS: Record<
  Exclude<StaffPaymentChangeRequestRow["status"], "cancelled">,
  Exclude<StaffRequestStatus, "IN_REVIEW">
> = {
  pending: "PENDING",
  approved: "APPROVED",
  rejected: "REJECTED",
}

export const PAYMENT_CHANGE_REQUEST_STATUS_LABELS: Record<StaffPaymentChangeRequestRow["status"], string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
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

export const isVisiblePaymentChangeRequest = (
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
