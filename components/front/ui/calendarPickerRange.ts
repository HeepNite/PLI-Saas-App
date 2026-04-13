export type CalendarRangeSelection = {
  rangeStart?: string
  rangeEnd?: string
}

export type CalendarRangePosition = "single" | "start" | "middle" | "end" | null

export function resolveCalendarRangeSelection(
  currentStart: string | undefined,
  currentEnd: string | undefined,
  clickedDate: string
): CalendarRangeSelection {
  if (!currentStart || currentEnd) {
    return { rangeStart: clickedDate, rangeEnd: undefined }
  }

  if (clickedDate < currentStart) {
    return { rangeStart: clickedDate, rangeEnd: currentStart }
  }

  return { rangeStart: currentStart, rangeEnd: clickedDate }
}

export function isCalendarDateWithinRange(
  isoDate: string,
  rangeStart?: string,
  rangeEnd?: string
): boolean {
  if (!rangeStart) return false
  if (!rangeEnd) return isoDate === rangeStart
  return isoDate >= rangeStart && isoDate <= rangeEnd
}

export function getCalendarRangePosition(
  isoDate: string,
  rangeStart?: string,
  rangeEnd?: string
): CalendarRangePosition {
  if (!rangeStart || !isCalendarDateWithinRange(isoDate, rangeStart, rangeEnd)) {
    return null
  }

  if (!rangeEnd || rangeStart === rangeEnd) {
    return isoDate === rangeStart ? "single" : null
  }

  if (isoDate === rangeStart) return "start"
  if (isoDate === rangeEnd) return "end"
  return "middle"
}
