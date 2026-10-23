import { buildSessionStartsAt, getStartOfDayNY, getTodayNewYork } from "@/lib/class-schedule"

const getRequiredStaffPaymentsSessionBoundary = (todayNY: string, time: "00:00" | "23:59", label: string) => {
  const startsAt = buildSessionStartsAt(todayNY, time)

  if (!startsAt) {
    throw new Error(`Unable to build staff payments ${label} session boundary for ${todayNY}`)
  }

  return startsAt
}

/** A card attempt that did not charge stays on the daily board for 24 h after it last changed (D3). */
export const VERIFY_WINDOW_MS = 24 * 60 * 60 * 1000

// Statuses a verify attempt can have; the loader keeps only rows isVerifyCardAttempt accepts.
const VERIFY_WINDOW_CANDIDATE_STATUSES = ["pending", "failed", "expired", "canceled", "cancelled"]

/** Purchases touched within the rolling verify window — fetched in addition to today's rows. */
export const buildVerifyWindowPurchaseWhere = (verifyWindowStart: Date) => ({
  updatedAt: { gte: verifyWindowStart },
  status: { in: VERIFY_WINDOW_CANDIDATE_STATUSES },
})

export const getStaffPaymentsTodayWindow = () => {
  const todayNY = getTodayNewYork()
  const startOfTodayNY = getStartOfDayNY(todayNY)
  const endOfTodayNY = new Date(startOfTodayNY.getTime() + 24 * 60 * 60 * 1000 - 1)

  return {
    todayNY,
    startOfTodayNY,
    endOfTodayNY,
    verifyWindowStart: new Date(Date.now() - VERIFY_WINDOW_MS),
  }
}

export const getStaffPaymentsTodaySessionBounds = (todayNY: string) => ({
  minStart: getRequiredStaffPaymentsSessionBoundary(todayNY, "00:00", "minimum"),
  maxStart: getRequiredStaffPaymentsSessionBoundary(todayNY, "23:59", "maximum"),
})
