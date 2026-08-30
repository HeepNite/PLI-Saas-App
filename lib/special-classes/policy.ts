import type { StaffCategory, StaffSubCategory } from "@/lib/security/staff-category"
import type { StaffRole } from "@/lib/security/staff-role"

export const SPECIAL_CLASS_HOLD_MS = 3 * 60_000

// Single source of truth for the statuses that count as an occupied seat
// across every special-class capacity/occupancy query site.
export const CAPACITY_STATUSES = ["paid", "succeeded", "completed", "capture_pending", "cash_pending"]
export const SPECIAL_CLASS_CASH_IDEMPOTENCY_PREFIX = "special-class-cash:"
export const SPECIAL_CLASS_CASH_PURCHASE_FILTER = {
  idempotencyKey: { startsWith: SPECIAL_CLASS_CASH_IDEMPOTENCY_PREFIX },
}

const OCCUPIED_STATUSES = new Set(CAPACITY_STATUSES)

export const isCountedSpecialClassPurchase = (
  purchase: { status: string; holdExpiresAt: Date | null },
  now: Date,
) => {
  const status = purchase.status.trim().toLowerCase()
  if (OCCUPIED_STATUSES.has(status)) return true
  return status === "pending" && purchase.holdExpiresAt !== null && purchase.holdExpiresAt > now
}

export const canManageSpecialClassDefinition = (
  role: StaffRole | null | undefined,
  category: StaffCategory | null | undefined,
  subCategory?: StaffSubCategory | null,
) => {
  void category
  void subCategory
  return role === "owner" || role === "admin"
}

export const canOperateSpecialClassRoster = (
  role: StaffRole | null | undefined,
  category: StaffCategory | null | undefined,
  subCategory?: StaffSubCategory | null,
) =>
  canManageSpecialClassDefinition(role, category, subCategory) ||
  (role === "staff" && (category === "front_desk" || (category === "guest" && subCategory === "front_desk")))

export const isPublishableSpecialClass = (
  input: {
    startsAt: Date
    capacity: number
    title: string
    description: string
    currency: string
    priceCents: number
  },
  now: Date,
) =>
  input.startsAt > now &&
  Number.isInteger(input.capacity) && input.capacity > 0 &&
  input.title.trim().length > 0 &&
  input.description.trim().length > 0 &&
  /^[a-z]{3}$/i.test(input.currency) &&
  Number.isInteger(input.priceCents) && input.priceCents > 0

export const canTransitionSpecialClass = (current: string, next: string) => {
  if (current === next) return true
  if (current === "draft") return next === "published"
  if (current === "published") return next === "closed" || next === "cancelled"
  return false
}
