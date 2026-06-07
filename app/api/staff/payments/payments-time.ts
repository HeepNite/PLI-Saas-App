import { buildSessionStartsAt, getStartOfDayNY, getTodayNewYork } from "@/lib/class-schedule"

const getRequiredStaffPaymentsSessionBoundary = (todayNY: string, time: "00:00" | "23:59", label: string) => {
  const startsAt = buildSessionStartsAt(todayNY, time)

  if (!startsAt) {
    throw new Error(`Unable to build staff payments ${label} session boundary for ${todayNY}`)
  }

  return startsAt
}

export const getStaffPaymentsTodayWindow = () => {
  const todayNY = getTodayNewYork()
  const startOfTodayNY = getStartOfDayNY(todayNY)
  const endOfTodayNY = new Date(startOfTodayNY.getTime() + 24 * 60 * 60 * 1000 - 1)

  return {
    todayNY,
    startOfTodayNY,
    endOfTodayNY,
  }
}

export const getStaffPaymentsTodaySessionBounds = (todayNY: string) => ({
  minStart: getRequiredStaffPaymentsSessionBoundary(todayNY, "00:00", "minimum"),
  maxStart: getRequiredStaffPaymentsSessionBoundary(todayNY, "23:59", "maximum"),
})
