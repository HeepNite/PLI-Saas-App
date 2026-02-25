export const STAFF_ROLES = ["owner", "admin", "staff"] as const
export type StaffRole = (typeof STAFF_ROLES)[number]
const STAFF_ROLE_SET = new Set<StaffRole>(STAFF_ROLES)

const toStringArray = (value: unknown): string[] => {
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string")
  }
  return []
}

const normalizeRole = (value: string): StaffRole | null => {
  const normalized = value.trim().toLowerCase()
  return STAFF_ROLE_SET.has(normalized as StaffRole) ? (normalized as StaffRole) : null
}

const pickHighestRole = (roles: string[]): StaffRole | null => {
  const normalized = roles
    .map((role) => normalizeRole(role))
    .filter((role): role is StaffRole => Boolean(role))
  if (!normalized.length) return null
  for (const candidate of STAFF_ROLES) {
    if (normalized.includes(candidate)) return candidate
  }
  return null
}

export const extractStaffRoleFromMetadata = (metadata: unknown): StaffRole | null => {
  if (!metadata || typeof metadata !== "object") return null
  const record = metadata as Record<string, unknown>
  const candidates = [...toStringArray(record.role), ...toStringArray(record.roles)]
  return pickHighestRole(candidates)
}

export const hasStaffRoleInMetadata = (metadata: unknown) => Boolean(extractStaffRoleFromMetadata(metadata))

export const extractStaffRoleFromClaims = (claims: unknown): StaffRole | null => {
  if (!claims || typeof claims !== "object") return null
  const record = claims as Record<string, unknown>
  return extractStaffRoleFromMetadata(record.metadata) || extractStaffRoleFromMetadata(record.public_metadata)
}

export const hasStaffRoleInClaims = (claims: unknown) => Boolean(extractStaffRoleFromClaims(claims))

export const extractStaffRoleFromUserMetadata = (user: {
  publicMetadata?: unknown
  privateMetadata?: unknown
  unsafeMetadata?: unknown
}) =>
  extractStaffRoleFromMetadata(user.publicMetadata) ||
  extractStaffRoleFromMetadata(user.privateMetadata) ||
  extractStaffRoleFromMetadata(user.unsafeMetadata)

export const hasStaffRoleInUserMetadata = (user: {
  publicMetadata?: unknown
  privateMetadata?: unknown
  unsafeMetadata?: unknown
}) => Boolean(extractStaffRoleFromUserMetadata(user))

export const isStaffAdminRole = (role: StaffRole | null | undefined) =>
  role === "owner" || role === "admin"

export const applyStaffRoleToMetadata = (existing: unknown, role: StaffRole) => {
  const safe = existing && typeof existing === "object" ? (existing as Record<string, unknown>) : {}
  return {
    ...safe,
    role,
    roles: [role],
  }
}

export const removeStaffRolesFromMetadata = (existing: unknown) => {
  if (!existing || typeof existing !== "object") return {}
  const safe = { ...(existing as Record<string, unknown>) }
  delete safe.role
  if (Array.isArray(safe.roles)) {
    const cleaned = safe.roles.filter(
      (item) => typeof item === "string" && !STAFF_ROLES.includes(item.toLowerCase() as StaffRole)
    )
    safe.roles = cleaned
  } else {
    delete safe.roles
  }
  return safe
}
