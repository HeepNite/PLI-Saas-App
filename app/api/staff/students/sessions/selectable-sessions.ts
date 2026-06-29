import type { Prisma } from "@prisma/client"

const DAY_MS = 24 * 60 * 60 * 1000

export const getSelectableSessionWindow = (now: Date) => ({
  startsAt: {
    gte: new Date(now.getTime() - 14 * DAY_MS),
    lte: new Date(now.getTime() + DAY_MS),
  },
})

export const findSelectableClassSessions = (
  client: Pick<Prisma.TransactionClient, "classSession">,
  now: Date
) => client.classSession.findMany({
  where: getSelectableSessionWindow(now),
  select: {
    id: true,
    courseSlug: true,
    title: true,
    startsAt: true,
    durationMinutes: true,
  },
  orderBy: { startsAt: "desc" },
  take: 50,
})

export type SelectableClassSession = Awaited<ReturnType<typeof findSelectableClassSessions>>[number]
