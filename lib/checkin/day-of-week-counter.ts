import { prisma } from "@/lib/prisma"
import { getEtDateIso } from "@/lib/checkin/et-time"

/**
 * Returns the day-of-week (0=Sunday, 6=Saturday) for a given date in ET timezone.
 */
function getDayOfWeekInEt(date: Date): number {
  const weekdayStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
  }).format(date)
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const index = labels.indexOf(weekdayStr)
  return index >= 0 ? index : new Date(date).getDay()
}

/**
 * Increments the day-of-week purchase counter for a user.
 *
 * Only increments when the purchase date is a different calendar date than
 * the last counted date (prevents double-counting the same day).
 *
 * Uses ET timezone for day-of-week calculation.
 */
export async function incrementDayOfWeekCounter(userId: string, purchaseDate: Date): Promise<void> {
  const dayOfWeek = getDayOfWeekInEt(purchaseDate)
  const purchaseDateIso = getEtDateIso(purchaseDate)
  const purchaseDateAsDateTime = new Date(`${purchaseDateIso}T00:00:00.000Z`)

  await prisma.$transaction(async (tx) => {
    const existing = await tx.dayOfWeekPurchaseCount.findUnique({
      where: {
        userId_dayOfWeek: { userId, dayOfWeek },
      },
      select: { id: true, lastCountedDate: true },
    })

    if (existing) {
      const lastDate = existing.lastCountedDate
        ? getEtDateIso(existing.lastCountedDate)
        : null

      // Only increment when this is a new calendar day
      if (lastDate === purchaseDateIso) {
        return
      }

      await tx.dayOfWeekPurchaseCount.update({
        where: { userId_dayOfWeek: { userId, dayOfWeek } },
        data: {
          count: { increment: 1 },
          lastCountedDate: purchaseDateAsDateTime,
        },
      })
    } else {
      await tx.dayOfWeekPurchaseCount.create({
        data: {
          userId,
          dayOfWeek,
          count: 1,
          lastCountedDate: purchaseDateAsDateTime,
        },
      })
    }
  })
}

/**
 * Returns the purchase count for a specific day-of-week for a user.
 */
export async function getDayOfWeekCount(userId: string, dayOfWeek: number): Promise<number> {
  const record = await prisma.dayOfWeekPurchaseCount.findUnique({
    where: {
      userId_dayOfWeek: { userId, dayOfWeek },
    },
    select: { count: true },
  })
  return record?.count ?? 0
}

/**
 * Returns true if the user has 3 or more purchases on the given day-of-week.
 */
export async function isQuickRepeatEligible(userId: string, dayOfWeek: number): Promise<boolean> {
  const count = await getDayOfWeekCount(userId, dayOfWeek)
  return count >= 3
}
