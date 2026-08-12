import type { StaffCategory, StaffSubCategory } from "@/lib/security/staff-category"
import type { StaffRole } from "@/lib/security/staff-role"

export const STAFF_PORTAL_SECTIONS = [
  "users",
  "students",
  "schedule",
  "terminals",
  "reports",
  "assistant",
  "settings",
  "profile",
  "teacher_dashboard",
] as const

export type StaffPortalSection = (typeof STAFF_PORTAL_SECTIONS)[number]
export type StaffPermission = "studentPinOps" | "studentOps"

const UNIQUE_ORDER: StaffPortalSection[] = [...STAFF_PORTAL_SECTIONS]

const uniqSections = (sections: StaffPortalSection[]) =>
  UNIQUE_ORDER.filter((section) => sections.includes(section))

export const resolveStaffPortalSections = (
  role: StaffRole | null | undefined,
  category: StaffCategory | null | undefined,
  subCategory?: StaffSubCategory | null
): StaffPortalSection[] => {
  if (role === "owner") return [...STAFF_PORTAL_SECTIONS]

  if (role === "admin") {
    return STAFF_PORTAL_SECTIONS.filter((section) => section !== "settings")
  }

  if (role === "staff" && category === "front_desk") {
    return ["students", "terminals", "profile"]
  }

  // Guest with subCategory: resolve based on subCategory value
  if (role === "staff" && category === "guest" && subCategory) {
    if (subCategory === "teacher") return ["teacher_dashboard", "profile"]
    if (subCategory === "front_desk") return ["students", "terminals", "profile"]
    if (subCategory === "manager") return ["profile"]
    return ["profile"]
  }

  if (role === "staff") {
    return ["profile"]
  }

  return []
}

export const canAccessStaffPortalSection = (
  role: StaffRole | null | undefined,
  category: StaffCategory | null | undefined,
  section: StaffPortalSection,
  subCategory?: StaffSubCategory | null
) => resolveStaffPortalSections(role, category, subCategory).includes(section)

export const getDefaultStaffPortalSection = (
  role: StaffRole | null | undefined,
  category: StaffCategory | null | undefined,
  subCategory?: StaffSubCategory | null
): StaffPortalSection | null => {
  const allowed = resolveStaffPortalSections(role, category, subCategory)
  return allowed.length > 0 ? allowed[0] : null
}

export const mergeStaffPortalSections = (...chunks: StaffPortalSection[][]) => {
  const merged = chunks.flatMap((chunk) => chunk)
  return uniqSections(merged)
}

export const hasExplicitStaffPermission = (
  role: StaffRole | null | undefined,
  category: StaffCategory | null | undefined,
  permission: StaffPermission,
  subCategory?: StaffSubCategory | null
) => {
  if (permission === "studentPinOps") {
    if (role === "owner") return true
    if (role === "staff" && category === "front_desk") return true
    if (role === "staff" && category === "guest" && subCategory === "front_desk") return true
    return role === "admin" && category === "manager"
  }
  if (permission === "studentOps") {
    return canOperateStudentEdits(role, category, subCategory)
  }
  return false
}

/**
 * Returns true when the caller is allowed to perform operational student edits
 * (e.g. opening the student Edit info modal or submitting student profile
 * corrections). This is intentionally narrower than full users-section access:
 * owner, admin, and front-desk staff can operate; other staff categories cannot.
 */
export const canOperateStudentEdits = (
  role: StaffRole | null | undefined,
  category: StaffCategory | null | undefined,
  subCategory?: StaffSubCategory | null
): boolean => {
  if (role === "owner") return true
  if (role === "admin") return true
  if (role === "staff" && category === "front_desk") return true
  if (role === "staff" && category === "guest" && subCategory === "front_desk") return true
  return false
}

export const canGrantCashPackage = (
  role: StaffRole | null | undefined,
  category: StaffCategory | null | undefined,
  subCategory?: StaffSubCategory | null
): boolean => {
  if (role === "owner" || role === "admin") return true
  if (role !== "staff") return false
  if (category === "front_desk" || category === "manager" || category === "partner") return true
  return category === "guest" && (subCategory === "front_desk" || subCategory === "manager")
}
