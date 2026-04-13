import type { StaffPaymentInfo } from "@/lib/security/staff-category"

export type StaffProfilePayoutMode = "direct_deposit" | "zelle" | "mercadopago" | null

const maskNumber = (value: string | undefined): string => {
  if (!value) return "Not set"
  const str = value.trim()
  return str.length > 3 ? `•••• ${str.slice(-3)}` : str
}

export type StaffProfilePaymentSummaryCard = {
  label: string
  value: string
  hint?: string
}

const sanitizePaymentText = (value: unknown, max = 120): string => {
  if (typeof value !== "string") return ""
  return value.trim().slice(0, max)
}

export const normalizeStaffProfilePaymentInfo = (value: unknown): StaffPaymentInfo | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const nextPaymentInfo: StaffPaymentInfo = {}

  const cbu = sanitizePaymentText(record.cbu, 32)
  const alias = sanitizePaymentText(record.alias, 80)
  const accountHolder = sanitizePaymentText(record.accountHolder, 120)
  const mercadoPagoId = sanitizePaymentText(record.mercadoPagoId, 120)
  const bankName = sanitizePaymentText(record.bankName, 120)
  const routingNumber = sanitizePaymentText(record.routingNumber, 32)
  const accountNumber = sanitizePaymentText(record.accountNumber, 32)
  const zelleId = sanitizePaymentText(record.zelleId, 120)
  const venmoUser = sanitizePaymentText(record.venmoUser, 120)
  const accountType = sanitizePaymentText(record.accountType, 40)

  if (cbu) nextPaymentInfo.cbu = cbu
  if (alias) nextPaymentInfo.alias = alias
  if (accountHolder) nextPaymentInfo.accountHolder = accountHolder
  if (mercadoPagoId) nextPaymentInfo.mercadoPagoId = mercadoPagoId
  if (bankName) nextPaymentInfo.bankName = bankName
  if (routingNumber) nextPaymentInfo.routingNumber = routingNumber
  if (accountNumber) nextPaymentInfo.accountNumber = accountNumber
  if (zelleId) nextPaymentInfo.zelleId = zelleId
  if (venmoUser) nextPaymentInfo.venmoUser = venmoUser
  if (accountType) nextPaymentInfo.accountType = accountType

  return Object.keys(nextPaymentInfo).length > 0 ? nextPaymentInfo : null
}

export const toStaffProfilePaymentInfoPayload = (paymentInfo: StaffPaymentInfo): StaffPaymentInfo | null => {
  const normalized = normalizeStaffProfilePaymentInfo(paymentInfo)
  return normalized && Object.keys(normalized).length > 0 ? normalized : null
}

export const resolveStaffProfilePayoutMode = (paymentInfo: StaffPaymentInfo | null): StaffProfilePayoutMode => {
  if (!paymentInfo) return null

  if (paymentInfo.bankName || paymentInfo.routingNumber || paymentInfo.accountNumber || paymentInfo.accountType) {
    return "direct_deposit"
  }

  if (paymentInfo.zelleId || paymentInfo.venmoUser) {
    return "zelle"
  }

  if (paymentInfo.cbu || paymentInfo.alias || paymentInfo.accountHolder || paymentInfo.mercadoPagoId) {
    return "mercadopago"
  }

  return null
}

const formatAccountTypeLabel = (value: string | undefined): string => {
  if (!value) return ""
  const normalized = value.trim().toLowerCase()
  if (normalized === "checking") return "Checking"
  if (normalized === "savings") return "Savings"
  return value.trim()
}

export const resolveStaffProfilePaymentSummaryCards = (
  paymentInfo: StaffPaymentInfo | null
): StaffProfilePaymentSummaryCard[] => {
  const payoutMode = resolveStaffProfilePayoutMode(paymentInfo)

  if (payoutMode === "direct_deposit") {
    const accountTypeLabel = formatAccountTypeLabel(paymentInfo?.accountType)
    return [
      { label: "Bank", value: paymentInfo?.bankName || "Not set" },
      { label: "Routing", value: maskNumber(paymentInfo?.routingNumber) },
      {
        label: "Account",
        value: maskNumber(paymentInfo?.accountNumber),
        hint: accountTypeLabel || undefined,
      },
    ]
  }

  if (payoutMode === "zelle") {
    return [
      { label: "Zelle ID", value: paymentInfo?.zelleId || "Not set" },
      ...(paymentInfo?.venmoUser ? [{ label: "Venmo", value: paymentInfo.venmoUser }] : []),
    ]
  }

  if (payoutMode === "mercadopago") {
    return [
      ...(paymentInfo?.accountHolder ? [{ label: "Account Holder", value: paymentInfo.accountHolder }] : []),
      { label: "CBU / CVU", value: maskNumber(paymentInfo?.cbu) },
      ...(paymentInfo?.alias ? [{ label: "Alias", value: paymentInfo.alias }] : []),
    ]
  }

  return [{ label: "Payout details", value: "Not configured yet" }]
}
