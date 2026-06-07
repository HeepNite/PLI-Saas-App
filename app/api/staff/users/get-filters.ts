import { parseStaffCategory, type StaffCategory } from "@/lib/security/staff-category"

export const buildStaffUsersCacheKey = (query: string | undefined, category: string | undefined): string =>
  `${query ?? ""}|${category ?? ""}`

export const parseStaffUsersGetFilters = (requestUrl: URL): { query: string | undefined; categoryFilter: StaffCategory | null } => {
  const query = requestUrl.searchParams.get("q")?.trim() || undefined
  const categoryFilter = parseStaffCategory(requestUrl.searchParams.get("category") || undefined)
  return { query, categoryFilter }
}

export const buildStaffUsersCacheKeyFromRequestUrl = (requestUrl: URL): string => {
  const { query, categoryFilter } = parseStaffUsersGetFilters(requestUrl)
  return buildStaffUsersCacheKey(query, categoryFilter ?? undefined)
}
