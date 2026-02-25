export const STAFF_REQUEST_TYPES = [
  "STAFF_DAY_OFF",
  "STAFF_SHIFT_SWAP",
  "STAFF_SCHEDULE_CHANGE",
  "STAFF_PAY_ADVANCE",
  "STAFF_SHIFT_COVER",
] as const

export type StaffRequestType = (typeof STAFF_REQUEST_TYPES)[number]

export const STAFF_REQUEST_STATUSES = ["PENDING", "IN_REVIEW", "APPROVED", "REJECTED"] as const

export type StaffRequestStatus = (typeof STAFF_REQUEST_STATUSES)[number]

const requestTypeSet = new Set<string>(STAFF_REQUEST_TYPES)
const requestStatusSet = new Set<string>(STAFF_REQUEST_STATUSES)

export const parseStaffRequestType = (value: unknown): StaffRequestType | null => {
  if (typeof value !== "string") return null
  const normalized = value.trim().toUpperCase()
  return requestTypeSet.has(normalized) ? (normalized as StaffRequestType) : null
}

export const parseStaffRequestStatus = (value: unknown): StaffRequestStatus | null => {
  if (typeof value !== "string") return null
  const normalized = value.trim().toUpperCase()
  return requestStatusSet.has(normalized) ? (normalized as StaffRequestStatus) : null
}

