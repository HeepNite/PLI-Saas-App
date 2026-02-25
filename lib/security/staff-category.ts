export const STAFF_CATEGORIES = ["front_desk", "manager", "teacher", "guest_staff", "partner"] as const
export type StaffCategory = (typeof STAFF_CATEGORIES)[number]

const STAFF_CATEGORY_SET = new Set<StaffCategory>(STAFF_CATEGORIES)

export const parseStaffCategory = (value: unknown): StaffCategory | null => {
  if (typeof value !== "string") return null
  const normalized = value.trim().toLowerCase()
  return STAFF_CATEGORY_SET.has(normalized as StaffCategory) ? (normalized as StaffCategory) : null
}

export const extractStaffCategoryFromMetadata = (metadata: unknown): StaffCategory | null => {
  if (!metadata || typeof metadata !== "object") return null
  const record = metadata as Record<string, unknown>
  return parseStaffCategory(record.staffCategory)
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
    default:
      return "Guest staff"
  }
}
