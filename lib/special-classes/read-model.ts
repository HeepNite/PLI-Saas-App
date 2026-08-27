import { prisma } from "@/lib/prisma"

const PAID_STATUSES = ["paid", "succeeded", "completed", "capture_pending"]

export async function expireSpecialClassHolds(specialClassId: string, now = new Date()) {
  return prisma.purchase.updateMany({
    where: { specialClassId, status: "pending", holdExpiresAt: { lte: now } },
    data: { status: "expired" },
  })
}

export async function getSpecialClassDetail(id: string, now = new Date()) {
  await expireSpecialClassHolds(id, now)
  const specialClass = await prisma.specialClass.findUnique({ where: { id }, include: { classSession: true } })
  if (!specialClass) return null
  const [held, paid, checkedIn, roster] = await Promise.all([
    prisma.purchase.count({ where: { specialClassId: id, status: "pending", holdExpiresAt: { gt: now } } }),
    prisma.purchase.count({ where: { specialClassId: id, status: { in: PAID_STATUSES } } }),
    prisma.attendance.count({ where: { sessionId: specialClass.classSessionId, status: { in: ["checked_in", "checked_in_no_package"] } } }),
    prisma.purchase.findMany({
      where: { specialClassId: id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, userId: true, name: true, email: true, phone: true, status: true, holdExpiresAt: true, createdAt: true,
        user: { select: { attendances: { where: { sessionId: specialClass.classSessionId }, select: { id: true, status: true, checkedInAt: true, checkedOutAt: true } } } },
      },
    }),
  ])
  return {
    ...specialClass,
    metrics: {
      capacity: specialClass.classSession.capacity,
      available: Math.max(specialClass.classSession.capacity - held - paid, 0),
      held,
      paid,
      checkedIn,
    },
    roster: roster.map((purchase) => ({ ...purchase, attendance: purchase.user.attendances[0] ?? null, user: undefined })),
  }
}
