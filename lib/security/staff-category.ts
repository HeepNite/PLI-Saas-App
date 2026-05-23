export const STAFF_CATEGORIES = ["front_desk", "manager", "teacher", "guest", "partner"] as const
export type StaffCategory = (typeof STAFF_CATEGORIES)[number]

export const STAFF_SUB_CATEGORIES = ["front_desk", "manager", "teacher"] as const
export type StaffSubCategory = (typeof STAFF_SUB_CATEGORIES)[number]

export type StaffPaymentInfo = {
  cbu?: string
  alias?: string
  accountHolder?: string
  mercadoPagoId?: string
  bankName?: string
  routingNumber?: string
  accountNumber?: string
  zelleId?: string
  venmoUser?: string
  accountType?: string
}

export const PAYMENT_PREFERENCES = [
  "cash",
  "card",
  "direct_deposit",
  "zelle",
  "mercadopago",
  "stripe",
  "credits", // Internship/pasante only
] as const
export type StaffPaymentPreference = (typeof PAYMENT_PREFERENCES)[number]

const STAFF_CATEGORY_SET = new Set<StaffCategory>(STAFF_CATEGORIES)
const STAFF_SUB_CATEGORY_SET = new Set<StaffSubCategory>(STAFF_SUB_CATEGORIES)

export const parseStaffCategory = (value: unknown): StaffCategory | null => {
  if (typeof value !== "string") return null
  const normalized = value.trim().toLowerCase()
  return STAFF_CATEGORY_SET.has(normalized as StaffCategory) ? (normalized as StaffCategory) : null
}

export const parseStaffSubCategory = (value: unknown): StaffSubCategory | null => {
  if (typeof value !== "string") return null
  const normalized = value.trim().toLowerCase()
  return STAFF_SUB_CATEGORY_SET.has(normalized as StaffSubCategory) ? (normalized as StaffSubCategory) : null
}

/**
 * Normalize legacy categories to the new guest+subCategory model.
 * This handles Clerk metadata that hasn't been migrated yet.
 *
 * Returns { category, subCategory } where:
 * - category is the normalized StaffCategory (always "guest" for legacy roles)
 * - subCategory is the extracted StaffSubCategory (or null if not applicable)
 *
 * Examples:
 *   "guest_staff" → { category: "guest", subCategory: null }
 *   "teacher"     → { category: "guest", subCategory: "teacher" }
 *   "front_desk"  → { category: "guest", subCategory: "front_desk" }
 *   "manager"     → { category: "guest", subCategory: "manager" }
 *   "guest"       → { category: "guest", subCategory: null }
 *   "partner"     → { category: "partner", subCategory: null }
 */
export const normalizeStaffCategoryWithSubCategory = (
  rawCategory: string | null | undefined
): { category: StaffCategory; subCategory: StaffSubCategory | null } => {
  if (!rawCategory) return { category: "guest", subCategory: null }

  const normalized = rawCategory.trim().toLowerCase()

  // Legacy guest_staff → guest
  if (normalized === "guest_staff") return { category: "guest", subCategory: null }

  // Legacy role-as-category → guest with subCategory
  if (normalized === "teacher") return { category: "guest", subCategory: "teacher" }
  if (normalized === "front_desk") return { category: "guest", subCategory: "front_desk" }
  if (normalized === "manager") return { category: "guest", subCategory: "manager" }

  // New model: explicit guest
  if (normalized === "guest") return { category: "guest", subCategory: null }

  // Partner and other explicit categories stay as-is
  const parsed = parseStaffCategory(rawCategory)
  if (parsed) return { category: parsed, subCategory: null }

  return { category: "guest", subCategory: null }
}

/**
 * Legacy normalization for places that only need the category.
 * Prefer normalizeStaffCategoryWithSubCategory when you also need the subCategory.
 */
const normalizeLegacyCategory = (value: string): StaffCategory | null => {
  if (value === "guest_staff") return "guest"
  return null
}

export const extractStaffCategoryFromMetadata = (metadata: unknown): StaffCategory | null => {
  if (!metadata || typeof metadata !== "object") return null
  const record = metadata as Record<string, unknown>
  const parsed = parseStaffCategory(record.staffCategory)
  if (parsed) return parsed
  // Fallback: check for legacy categories
  if (typeof record.staffCategory === "string") {
    return normalizeLegacyCategory(record.staffCategory)
  }
  return null
}

/**
 * Extract the normalized category AND subCategory from Clerk metadata.
 * This is the preferred function for resolving staff sections and access.
 * It normalizes legacy teacher/front_desk/manager → guest + subCategory.
 */
export const extractStaffCategoryWithSubCategoryFromMetadata = (
  metadata: unknown
): { category: StaffCategory; subCategory: StaffSubCategory | null } => {
  if (!metadata || typeof metadata !== "object") return { category: "guest", subCategory: null }
  const record = metadata as Record<string, unknown>

  // First check for explicit subCategory (new model)
  const explicitSubCategory = extractStaffSubCategoryFromMetadata(record)
  if (explicitSubCategory) {
    // New model: guest + explicit subCategory
    return { category: "guest", subCategory: explicitSubCategory }
  }

  // Fall back to raw category with legacy normalization
  const rawCategory =
    typeof record.staffCategory === "string" ? record.staffCategory : null
  return normalizeStaffCategoryWithSubCategory(rawCategory)
}

export const extractStaffCategoryWithSubCategoryFromUser = (user: {
  publicMetadata?: unknown
  privateMetadata?: unknown
  unsafeMetadata?: unknown
}) => {
  const fromPublic = extractStaffCategoryWithSubCategoryFromMetadata(user.publicMetadata)
  if (fromPublic.category !== "guest" || fromPublic.subCategory !== null) return fromPublic

  const fromPrivate = extractStaffCategoryWithSubCategoryFromMetadata(user.privateMetadata)
  if (fromPrivate.category !== "guest" || fromPrivate.subCategory !== null) return fromPrivate

  return extractStaffCategoryWithSubCategoryFromMetadata(user.unsafeMetadata)
}

export const extractStaffCategoryFromClaims = (claims: unknown): StaffCategory | null => {
  if (!claims || typeof claims !== "object") return null
  const record = claims as Record<string, unknown>
  return (
    extractStaffCategoryFromMetadata(record.metadata) ||
    extractStaffCategoryFromMetadata(record.public_metadata) ||
    extractStaffCategoryFromMetadata(record.private_metadata)
  )
}

export const extractStaffCategoryFromUserMetadata = (user: {
  publicMetadata?: unknown
  privateMetadata?: unknown
  unsafeMetadata?: unknown
}) =>
  extractStaffCategoryFromMetadata(user.publicMetadata) ||
  extractStaffCategoryFromMetadata(user.privateMetadata) ||
  extractStaffCategoryFromMetadata(user.unsafeMetadata)

export const applyStaffCategoryToMetadata = (existing: unknown, category: StaffCategory) => {
  const safe = existing && typeof existing === "object" ? (existing as Record<string, unknown>) : {}
  return {
    ...safe,
    staffCategory: category,
  }
}

export const removeStaffCategoryFromMetadata = (existing: unknown) => {
  if (!existing || typeof existing !== "object") return {}
  const safe = { ...(existing as Record<string, unknown>) }
  delete safe.staffCategory
  return safe
}

export const extractStaffSubCategoryFromMetadata = (metadata: unknown): StaffSubCategory | null => {
  if (!metadata || typeof metadata !== "object") return null
  const record = metadata as Record<string, unknown>
  return parseStaffSubCategory(record.staffSubCategory)
}

export const extractStaffSubCategoryFromUserMetadata = (user: {
  publicMetadata?: unknown
  privateMetadata?: unknown
  unsafeMetadata?: unknown
}) =>
  extractStaffSubCategoryFromMetadata(user.publicMetadata) ||
  extractStaffSubCategoryFromMetadata(user.privateMetadata) ||
  extractStaffSubCategoryFromMetadata(user.unsafeMetadata)

export const applyStaffSubCategoryToMetadata = (existing: unknown, subCategory: StaffSubCategory | null) => {
  const safe = existing && typeof existing === "object" ? (existing as Record<string, unknown>) : {}
  if (subCategory === null) {
    const result = { ...safe }
    delete result.staffSubCategory
    return result
  }
  return {
    ...safe,
    staffSubCategory: subCategory,
  }
}

export const staffCategoryLabel = (value: StaffCategory) => {
  switch (value) {
    case "front_desk":
      return "Front desk"
    case "manager":
      return "Manager"
    case "teacher":
      return "Teacher"
    case "partner":
      return "Partner"
    case "guest":
      return "Guest"
    default:
      return "Guest"
  }
}

type PaymentValidationResult =
  | { ok: true }
  | { ok: false; error: string; status: 422 }

const paymentValidationError = (error: string): PaymentValidationResult => ({ ok: false, error, status: 422 })

export const validatePaymentInfo = (
  paymentPreference: string,
  paymentInfo: StaffPaymentInfo | null | undefined,
): PaymentValidationResult => {
  const normalizedPreference = paymentPreference.trim().toLowerCase()
  const info = paymentInfo ?? {}

  if (!PAYMENT_PREFERENCES.includes(normalizedPreference as StaffPaymentPreference)) {
    return paymentValidationError("Invalid payment preference")
  }

  if (
    normalizedPreference === "cash" ||
    normalizedPreference === "card" ||
    normalizedPreference === "credits" ||
    normalizedPreference === "stripe"
  ) {
    return { ok: true }
  }

  if (normalizedPreference === "direct_deposit") {
    const routingNumber = info.routingNumber?.trim() ?? ""
    const accountNumber = info.accountNumber?.trim() ?? ""
    const accountType = info.accountType?.trim().toLowerCase() ?? ""
    const accountHolder = info.accountHolder?.trim() ?? ""

    if (!routingNumber) return paymentValidationError("routingNumber is required")
    if (!/^\d{9}$/.test(routingNumber)) return paymentValidationError("routingNumber must be exactly 9 digits")
    if (!accountNumber) return paymentValidationError("accountNumber is required")
    if (!/^\d{4,17}$/.test(accountNumber)) return paymentValidationError("accountNumber must be 4-17 digits")
    if (!accountType) return paymentValidationError("accountType is required")
    if (accountType !== "checking" && accountType !== "savings") {
      return paymentValidationError("accountType must be checking or savings")
    }
    if (!accountHolder) return paymentValidationError("accountHolder is required")

    return { ok: true }
  }

  if (normalizedPreference === "zelle") {
    const zelleId = info.zelleId?.trim() ?? ""
    const venmoUser = info.venmoUser?.trim() ?? ""
    if (!zelleId && !venmoUser) {
      return paymentValidationError("zelleId or venmoUser is required")
    }
    return { ok: true }
  }

  if (normalizedPreference === "mercadopago") {
    const mercadoPagoId = info.mercadoPagoId?.trim() ?? ""
    const cbu = info.cbu?.trim() ?? ""
    const alias = info.alias?.trim() ?? ""
    if (!mercadoPagoId && !cbu && !alias) {
      return paymentValidationError("mercadoPagoId, cbu, or alias is required")
    }
    return { ok: true }
  }

  return paymentValidationError("Invalid payment preference")
}
