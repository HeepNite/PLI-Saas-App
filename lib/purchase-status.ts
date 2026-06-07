export const SUCCESSFUL_PURCHASE_STATUSES: string[] = ["paid", "succeeded", "completed"]
const SUCCESSFUL_PURCHASE_STATUS_SET = new Set(SUCCESSFUL_PURCHASE_STATUSES)

export const normalizePersistedPurchaseStatus = (status: string | null | undefined) => {
  const normalized = status?.trim().toLowerCase()
  if (!normalized) return "unknown"
  return SUCCESSFUL_PURCHASE_STATUS_SET.has(normalized) ? "paid" : normalized
}
