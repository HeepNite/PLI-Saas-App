const SUCCESSFUL_PURCHASE_STATUSES = new Set(["paid", "succeeded", "completed"])

export const normalizePersistedPurchaseStatus = (status: string | null | undefined) => {
  const normalized = status?.trim().toLowerCase()
  if (!normalized) return "unknown"
  return SUCCESSFUL_PURCHASE_STATUSES.has(normalized) ? "paid" : normalized
}
