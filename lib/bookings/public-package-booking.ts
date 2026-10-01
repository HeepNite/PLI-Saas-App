import { Prisma, type PrismaClient } from "@prisma/client"
import { ACTIVE_BOOKING_STATUSES } from "@/lib/attendance-constants"
import { DEFAULT_CLASS_CAPACITY } from "@/lib/bookings"
import { buildSessionStartsAt, getCourseBySlug, isTimeAllowedForCourseDate } from "@/lib/class-schedule"
import { holdPackageCreditForAttendanceTx } from "@/lib/packages"

type PublicPackageBookingInput = {
  userId: string
  courseSlug: string
  date: string
  time: string
  now?: Date
}

type PackageCandidate = {
  id: string
  packageId: string
  packageLabel: string | null
  courseSlug: string | null
  packagePlanId: string | null
  packagePlan: { courseSlugs: string[] } | null
  status: string
  isUnlimited: boolean
  remainingCredits: number | null
  expiresAt: Date | null
}

const appliesToCourse = (pkg: PackageCandidate, courseSlug: string) =>
  pkg.courseSlug === courseSlug ||
  pkg.packagePlan?.courseSlugs.includes(courseSlug) === true ||
  (pkg.courseSlug === null && pkg.packagePlanId === null)

export async function reservePublicPackageBooking(
  db: PrismaClient,
  input: PublicPackageBookingInput
) {
  const now = input.now ?? new Date()
  const startsAt = buildSessionStartsAt(input.date, input.time)
  if (!startsAt || startsAt.getTime() <= now.getTime() || !isTimeAllowedForCourseDate(input.courseSlug, input.date, input.time)) {
    return { kind: "invalid_slot" as const }
  }

  return db.$transaction(async (tx) => {
    const sessionWhere = { courseSlug_startsAt: { courseSlug: input.courseSlug, startsAt } }
    const existingSession = await tx.classSession.findUnique({ where: sessionWhere })
    if (existingSession) {
      const existingAttendance = await tx.attendance.findUnique({
        where: { userId_sessionId: { userId: input.userId, sessionId: existingSession.id } },
        include: { packageUsage: true },
      })
      if (existingAttendance) {
        if (existingAttendance.status === "scheduled" && existingAttendance.packageUsage) {
          return {
            kind: "reserved" as const,
            attendanceId: existingAttendance.id,
            packagePurchaseId: existingAttendance.packageUsage.packagePurchaseId,
            remainingCredits: null,
            replayed: true,
          }
        }
        return { kind: "booking_exists" as const }
      }
    }

    const candidates = await tx.packagePurchase.findMany({
      where: {
        userId: input.userId,
        status: "active",
        purchasedAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: startsAt } }],
      },
      include: { packagePlan: { select: { courseSlugs: true } } },
      orderBy: [{ expiresAt: "asc" }, { purchasedAt: "desc" }],
    }) as PackageCandidate[]

    const applicable = candidates.filter((pkg) => appliesToCourse(pkg, input.courseSlug))
    if (applicable.length === 0) return { kind: "no_package" as const }

    let selectedPackage: PackageCandidate | null = null
    let activeHolds = 0
    for (const candidate of applicable) {
      const candidateHolds = await tx.packageUsageLedger.count({
        where: {
          packagePurchaseId: candidate.id,
          delta: 0,
          attendance: { is: { status: "scheduled" } },
        },
      })
      if (candidate.isUnlimited || (candidate.remainingCredits ?? 0) - candidateHolds > 0) {
        selectedPackage = candidate
        activeHolds = candidateHolds
        break
      }
    }
    if (!selectedPackage) return { kind: "no_credits" as const }

    const course = getCourseBySlug(input.courseSlug)
    const session = existingSession ?? await tx.classSession.upsert({
      where: sessionWhere,
      update: { title: course?.title || input.courseSlug },
      create: {
        courseSlug: input.courseSlug,
        startsAt,
        title: course?.title || input.courseSlug,
        durationMinutes: 60,
        capacity: DEFAULT_CLASS_CAPACITY,
      },
    })

    const occupancy = await tx.attendance.count({
      where: { sessionId: session.id, status: { in: ACTIVE_BOOKING_STATUSES } },
    })
    if (occupancy >= (session.capacity || DEFAULT_CLASS_CAPACITY)) return { kind: "class_full" as const }

    const attendance = await tx.attendance.create({
      data: {
        userId: input.userId,
        sessionId: session.id,
        status: "scheduled",
        checkedInAt: startsAt,
        metadata: {
          source: "public_booking_package",
          packagePurchaseId: selectedPackage.id,
          date: input.date,
          time: input.time,
        },
      },
    })

    await holdPackageCreditForAttendanceTx(tx, {
      packagePurchaseId: selectedPackage.id,
      userId: input.userId,
      attendanceId: attendance.id,
      courseSlug: input.courseSlug,
      at: startsAt,
      reason: "PUBLIC_BOOKING_HOLD",
    })

    return {
      kind: "reserved" as const,
      attendanceId: attendance.id,
      packagePurchaseId: selectedPackage.id,
      remainingCredits: selectedPackage.isUnlimited
        ? null
        : Math.max(0, (selectedPackage.remainingCredits ?? 0) - activeHolds),
      replayed: false,
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}
