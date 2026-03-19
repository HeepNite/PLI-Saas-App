import type { StaffCategory } from "@/lib/security/staff-category"
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
] as const

export type StaffPortalSection = (typeof STAFF_PORTAL_SECTIONS)[number]

const UNIQUE_ORDER: StaffPortalSection[] = [...STAFF_PORTAL_SECTIONS]

const uniqSections = (sections: StaffPortalSection[]) =>
  UNIQUE_ORDER.filter((section) => sections.includes(section))

export const resolveStaffPortalSections = (
  role: StaffRole | null | undefined,
  category: StaffCategory | null | undefined
): StaffPortalSection[] => {
  if (role === "owner") return [...STAFF_PORTAL_SECTIONS]

  if (role === "admin") {
    return STAFF_PORTAL_SECTIONS.filter((section) => section !== "settings")
  }

  if (role === "staff" && category === "front_desk") {
    return ["students", "terminals", "profile"]
  }

  if (role === "staff") {
    return ["profile"]
  }

  return []
}

export const canAccessStaffPortalSection = (
  role: StaffRole | null | undefined,
  category: StaffCategory | null | undefined,
  section: StaffPortalSection
) => resolveStaffPortalSections(role, category).includes(section)

export const getDefaultStaffPortalSection = (
  role: StaffRole | null | undefined,
  category: StaffCategory | null | undefined
): StaffPortalSection | null => {
  const allowed = resolveStaffPortalSections(role, category)
  return allowed.length > 0 ? allowed[0] : null
}

export const mergeStaffPortalSections = (...chunks: StaffPortalSection[][]) => {
  const merged = chunks.flatMap((chunk) => chunk)
  return uniqSections(merged)
}
