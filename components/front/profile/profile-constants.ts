import type { ActionRequestType, MetricKey, ProfileStatus } from "./profile-types"

export const statusLabel: Record<ProfileStatus, string> = {
  NEW: "New",
  ACTIVE: "Active",
  ALUMNI: "Alumni",
}

export const NY_TIMEZONE = "America/New_York"
export const AVAILABILITY_CACHE_TTL_MS = 45_000
export const CHECK_IN_OPEN_WINDOW_HOURS = 2
export const CHECK_IN_OPEN_WINDOW_MS = CHECK_IN_OPEN_WINDOW_HOURS * 60 * 60 * 1000

export const analyticsMonths = ["Oct", "Nov", "Dec", "Jan"] as const
export const analyticsMetricConfig: Record<MetricKey, { label: string; color: string; values: number[] }> = {
  attendance: {
    label: "Attendance",
    color: "var(--brand,#b61616)",
    values: [5, 4, 6, 3],
  },
  progress: {
    label: "Progress",
    color: "#ef6b6b",
    values: [2, 3, 4, 5],
  },
  rhythm: {
    label: "Rhythm",
    color: "#f59e0b",
    values: [1, 2, 3, 4],
  },
}

export const actionRequestLabels: Record<ActionRequestType, string> = {
  CLASS_CHANGE: "Class change",
  SUSPEND: "Suspension",
  CANCEL: "Cancellation",
}
