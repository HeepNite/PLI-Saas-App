import { formatDateTime } from "./staffAdminFormatters"

const roomBlockerCodeLabel: Record<string, string> = {
  CLASS_IN_PROGRESS: "A class is currently in progress in this room.",
  SESSION_IN_NEXT_24H: "A class session is scheduled in the next 24 hours.",
  RESERVATION_IN_NEXT_24H: "A private reservation exists in the next 24 hours.",
  INVALID_COURSE_SELECTION: "One or more selected courses are not assigned to the source room.",
}

export const formatRoomActionBlockers = (blockers: unknown): string[] => {
  if (!Array.isArray(blockers)) return []
  return blockers
    .map((item) => {
      if (!item || typeof item !== "object") return null
      const code = typeof (item as { code?: unknown }).code === "string" ? (item as { code: string }).code : null
      const startsAtRaw = typeof (item as { startsAt?: unknown }).startsAt === "string" ? (item as { startsAt: string }).startsAt : null
      const startsAt = startsAtRaw ? formatDateTime(startsAtRaw) : null
      if (code && roomBlockerCodeLabel[code]) {
        return startsAt ? `${roomBlockerCodeLabel[code]} (${startsAt})` : roomBlockerCodeLabel[code]
      }
      return null
    })
    .filter((value): value is string => Boolean(value))
}

export const resolveRoomActionErrorMessage = (payload: unknown, fallback: string) => {
  if (!payload || typeof payload !== "object") return fallback
  const source = payload as { error?: unknown; blockers?: unknown }
  const baseError = typeof source.error === "string" ? source.error : fallback
  const blockerLines = formatRoomActionBlockers(source.blockers)
  if (blockerLines.length === 0) return baseError
  return `${baseError} ${blockerLines.join(" ")}`
}
