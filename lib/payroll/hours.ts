import type { PrismaClient, StaffClockEntry } from "@prisma/client"

const HOURS_DECIMAL_PLACES = 100
const MILLISECONDS_PER_HOUR = 3_600_000

export type HoursDerivationResult = {
  hoursWorked: number
  entryCount: number
}

export function calculateHoursForPeriod(entries: StaffClockEntry[], periodStart: Date, periodEnd: Date): number {
  const totalHours = entries.reduce((sum, entry) => {
    if (!entry.actualClockOutAt) return sum
    if (entry.clockInAt < periodStart || entry.actualClockOutAt > periodEnd) return sum

    const workedHours = (entry.actualClockOutAt.getTime() - entry.clockInAt.getTime()) / MILLISECONDS_PER_HOUR
    return sum + workedHours
  }, 0)

  return Math.round(totalHours * HOURS_DECIMAL_PLACES) / HOURS_DECIMAL_PLACES
}

export async function deriveHoursWorked(
  prisma: PrismaClient,
  staffAccountId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<HoursDerivationResult> {
  const entries = await prisma.staffClockEntry.findMany({
    where: {
      staffAccountId,
      clockInAt: { gte: periodStart },
      actualClockOutAt: { lte: periodEnd, not: null },
    },
    select: { clockInAt: true, actualClockOutAt: true },
  })

  if (entries.length === 0) {
    return { hoursWorked: 0, entryCount: 0 }
  }

  let totalHours = 0
  for (const entry of entries) {
    totalHours += (entry.actualClockOutAt!.getTime() - entry.clockInAt.getTime()) / MILLISECONDS_PER_HOUR
  }

  const hoursWorked = Math.round(totalHours * HOURS_DECIMAL_PLACES) / HOURS_DECIMAL_PLACES

  return { hoursWorked, entryCount: entries.length }
}