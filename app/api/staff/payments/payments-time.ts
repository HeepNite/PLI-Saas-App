import { getStartOfDayNY, getTodayNewYork } from "@/lib/class-schedule"

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
