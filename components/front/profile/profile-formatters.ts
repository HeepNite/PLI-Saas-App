import type { ActionRequestItem, ActionRequestType, ProfileStatus } from "./profile-types"
import { actionRequestLabels, NY_TIMEZONE } from "./profile-constants"

export const toProfileStatus = (value: unknown): ProfileStatus => {
  if (value === "NEW" || value === "ACTIVE" || value === "ALUMNI") return value
  return "NEW"
}

export const actionRequestStatusLabel = (status: string) => {
  if (status === "PENDING") return "Pending"
  if (status === "PROCESSING") return "In progress"
  if (status === "RESOLVED") return "Resolved"
  if (status === "REJECTED") return "Rejected"
  return status
}

export const formatRequestDate = (value: unknown) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parsed = new Date(`${value}T12:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleDateString("en-US", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export const actionRequestMetaLabel = (request: ActionRequestItem) => {
  if (request.type === "SUSPEND") {
    const start = formatRequestDate(request.meta?.startDate)
    const end = formatRequestDate(request.meta?.endDate)
    const packageLabel = typeof request.meta?.packageLabel === "string" ? request.meta.packageLabel : ""
    if (start && end && packageLabel) return `${packageLabel} · from ${start} to ${end}`
    if (start && end) return `From ${start} to ${end}`
  }
  if (request.type === "CANCEL") {
    const effective = formatRequestDate(request.meta?.effectiveDate)
    const courseTitle = typeof request.meta?.courseTitle === "string" ? request.meta.courseTitle : ""
    if (effective && courseTitle) return `${courseTitle} · effective from ${effective}`
    if (effective) return `Effective from ${effective}`
  }
  return null
}

export const getPendingProcessLabel = (request: ActionRequestItem | undefined) => {
  if (!request) return "Process"
  const type = actionRequestLabels[request.type] || request.type
  const status = actionRequestStatusLabel(request.status).toLowerCase()
  return `${type} (${status})`
}

export const getProcessTypeTone = (type?: ActionRequestType | null) => {
  if (type === "CANCEL") {
    return {
      border: "rgba(239,68,68,0.45)",
      bg: "rgba(239,68,68,0.16)",
      text: "#fecaca",
      dot: "#f87171",
    }
  }
  if (type === "CLASS_CHANGE") {
    return {
      border: "rgba(59,130,246,0.45)",
      bg: "rgba(59,130,246,0.16)",
      text: "#bfdbfe",
      dot: "#60a5fa",
    }
  }
  if (type === "SUSPEND") {
    return {
      border: "rgba(245,158,11,0.45)",
      bg: "rgba(245,158,11,0.16)",
      text: "#fde68a",
      dot: "#fbbf24",
    }
  }
  return {
    border: "rgba(255,255,255,0.22)",
    bg: "rgba(255,255,255,0.08)",
    text: "rgba(255,255,255,0.82)",
    dot: "rgba(255,255,255,0.7)",
  }
}

export const isPendingRequestStatus = (status: string) => status === "PENDING" || status === "PROCESSING"

export const addDaysToIsoDate = (isoDate: string, days: number) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate
  const parsed = new Date(`${isoDate}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return isoDate
  parsed.setUTCDate(parsed.getUTCDate() + days)
  return parsed.toISOString().slice(0, 10)
}

export const pointsTypeLabel = (type: string) => {
  if (type === "PROFILE_COMPLETED") return "Profile completed"
  if (type === "PACKAGE_PURCHASE") return "Package purchase"
  if (type === "PACKAGE_ASSIGNMENT") return "Class assignment"
  if (type === "CONSECUTIVE_ATTENDANCE") return "Consecutive attendance"
  if (type === "REFERRAL_BONUS") return "Referral"
  if (type === "CLASS_MILESTONE") return "Class milestone"
  return type
}

export const formatDateKeyInTimeZone = (value: string | Date, timeZone = NY_TIMEZONE) => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const year = parts.find((item) => item.type === "year")?.value ?? ""
  const month = parts.find((item) => item.type === "month")?.value ?? ""
  const day = parts.find((item) => item.type === "day")?.value ?? ""
  if (!year || !month || !day) return ""
  return `${year}-${month}-${day}`
}

export const formatTimeKeyInTimeZone = (value: string | Date, timeZone = NY_TIMEZONE) => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date)
  const hour = parts.find((item) => item.type === "hour")?.value ?? ""
  const minute = parts.find((item) => item.type === "minute")?.value ?? ""
  if (!hour || !minute) return ""
  return `${hour}:${minute}`
}

export const formatDateTimeInTimeZone = (
  value: string | Date,
  options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  },
  locale = "en-US",
  timeZone = NY_TIMEZONE
) => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone,
  }).format(date)
}
