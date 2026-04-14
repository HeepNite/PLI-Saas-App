import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { clerkClient } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { authorizeStaffPortalSectionRequest } from "@/lib/security/staff-portal-auth"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { buildSessionStartsAt, getTodayNewYork, getTimeKeyInTimeZone, getDateKeyInTimeZone } from "@/lib/class-schedule"
import {
  COMPLETED_PAYMENT_STATUSES,
  asObject,
  asText,
  attendanceSlotKey,
  buildOutstandingBalanceByUser,
  isCompletedPaymentStatus,
  normalizePaymentChannel,
  normalizeSettlementStatus,
  selectActivePackagesByUser,
  type SettlementStatus,
} from "@/app/api/staff/payments/shared"
import {
  isLockedCredential,
  isProvisionalStudentPinActive,
  isStudentPinLifecycleEnabled,
  type StudentPinStatusValue,
} from "@/lib/security/student-pin"

export const runtime = "nodejs"

type CheckInStatus = "checked_in" | "checked_in_no_package" | "checked_out" | "scheduled" | "none"
type PaymentsMode = "today" | "history"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const TODAY_MODE_TAKE_LIMIT = 200
const HISTORY_MODE_TAKE_LIMIT = 2000
const ATTENDED_CHECKIN_STATUSES = ["checked_in", "checked_in_no_package", "checked_out"] as const

const normalizePurchaseCategory = (input: { packageId: string; serviceId: string }) => {
  if (input.packageId) return "package" as const
  if (input.serviceId) return "dropin" as const
  return "other" as const
}

const buildPurchaseAttendanceDedupKey = (input: {
  purchaseId: string
  userId: string
  courseSlug: string | null | undefined
  classStartsAt: Date | null
}) => {
  if (input.courseSlug && input.classStartsAt) {
    return attendanceSlotKey(input.userId, input.courseSlug, input.classStartsAt.getTime())
  }
  return `purchase:${input.purchaseId}`
}

const toDateIso = (value: unknown) => {
  if (typeof value !== "string" && typeof value !== "number") return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

const isStudentPinSchemaUnavailableError = (error: unknown) => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    const fallbackCode =
      typeof error === "object" && error && "code" in error && typeof error.code === "string" ? error.code : null
    const fallbackName =
      typeof error === "object" && error && "name" in error && typeof error.name === "string" ? error.name : null
    return fallbackName === "PrismaClientKnownRequestError" && ["P2021", "P2022"].includes(fallbackCode || "")
  }
  return ["P2021", "P2022"].includes(error.code)
}

const loadStudentPinCredentials = async (userIds: string[]) => {
  if (!userIds.length || !isStudentPinLifecycleEnabled()) {
    return { available: false, credentials: [] as Array<{
      userId: string
      kind: string
      status: string
      failedAttempts: number
      lockedAt: Date | null
      expiresAt: Date | null
    }> }
  }

  try {
    const credentials = await prisma.studentPinCredential.findMany({
      where: {
        userId: { in: userIds },
        kind: { in: ["permanent", "provisional"] },
      },
      select: {
        userId: true,
        kind: true,
        status: true,
        failedAttempts: true,
        lockedAt: true,
        expiresAt: true,
      },
    })
    return { available: true, credentials }
  } catch (error) {
    if (isStudentPinSchemaUnavailableError(error)) {
      return { available: false, credentials: [] as Array<{
        userId: string
        kind: string
        status: string
        failedAttempts: number
        lockedAt: Date | null
        expiresAt: Date | null
      }> }
    }
    throw error
  }
}

const normalizeHistoryRangeInputs = (input: { from: string; to: string; date: string }) => {
  const normalizedFrom = input.from || input.date
  const normalizedTo = input.to || input.date

  if (!normalizedFrom || !normalizedTo) {
    return {
      ok: false as const,
      error: "History mode requires both from and to dates.",
    }
  }

  if (!DATE_REGEX.test(normalizedFrom) || !DATE_REGEX.test(normalizedTo)) {
    return {
      ok: false as const,
      error: "History mode requires valid YYYY-MM-DD from/to dates.",
    }
  }

  if (normalizedFrom > normalizedTo) {
    return {
      ok: false as const,
      error: "History mode requires from to be on or before to.",
    }
  }

  return {
    ok: true as const,
    from: normalizedFrom,
    to: normalizedTo,
  }
}

export async function GET(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:payments:get", getClientIp(req)),
    limit: 90,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  const authResult = await authorizeStaffPortalSectionRequest("students")
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const url = new URL(req.url)
  const query = url.searchParams.get("q")?.trim() || ""
  const settlementFilter = url.searchParams.get("settlement")?.trim().toLowerCase() || "all"
  const requestedMode = url.searchParams.get("mode")?.trim().toLowerCase()
  const mode: PaymentsMode = requestedMode === "history" ? "history" : "today"
  const selectedDate = url.searchParams.get("date")?.trim() || ""
  const selectedFrom = url.searchParams.get("from")?.trim() || ""
  const selectedTo = url.searchParams.get("to")?.trim() || ""
  const selectedClass = url.searchParams.get("class")?.trim() || ""

  const historyRange =
    mode === "history"
      ? normalizeHistoryRangeInputs({ from: selectedFrom, to: selectedTo, date: selectedDate })
      : null

  if (historyRange && !historyRange.ok) {
    return NextResponse.json(
      { error: historyRange.error },
      { status: 400 }
    )
  }

  const where = query
    ? {
        OR: [
          { email: { contains: query, mode: "insensitive" as const } },
          { name: { contains: query, mode: "insensitive" as const } },
          { phone: { contains: query, mode: "insensitive" as const } },
          { courseTitle: { contains: query, mode: "insensitive" as const } },
          { courseSlug: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : undefined

  const todayNY = getTodayNewYork()
  // Create date range in UTC that corresponds to NY timezone day boundaries
  // todayNY is in format YYYY-MM-DD in NY timezone
  // Convert to UTC: NY is UTC-4 (EDT) or UTC-5 (EST)
  // So 00:00 NY = 04:00 or 05:00 UTC, and 23:59:59 NY = 03:59:59 or 04:59:59 UTC next day
  const startOfTodayNY = new Date(`${todayNY}T04:00:00Z`) // conservative: assume EDT (UTC-4)
  const endOfTodayNY = new Date(`${todayNY}T04:00:00Z`)
  endOfTodayNY.setDate(endOfTodayNY.getDate() + 1)
  endOfTodayNY.setMilliseconds(-1)

  const purchases = await prisma.purchase.findMany({
    where:
      mode === "history"
        ? {
            AND: [
              ...(where ? [where] : []),
              { metadata: { path: ["date"], gte: historyRange!.from } },
              { metadata: { path: ["date"], lte: historyRange!.to } },
            ],
          }
        : mode === "today"
          ? {
              AND: [
                ...(where ? [where] : []),
                { createdAt: { gte: startOfTodayNY, lte: endOfTodayNY } },
              ],
            }
          : where,
    orderBy: { createdAt: "desc" },
    take: mode === "history" ? HISTORY_MODE_TAKE_LIMIT + 1 : TODAY_MODE_TAKE_LIMIT,
  })

  const historyTruncated = mode === "history" && purchases.length > HISTORY_MODE_TAKE_LIMIT
  const scopedBasePurchases = historyTruncated ? purchases.slice(0, HISTORY_MODE_TAKE_LIMIT) : purchases

  const enrichedPurchases = scopedBasePurchases.map((purchase) => {
    const metadata = asObject(purchase.metadata)
    const settlementStatus = normalizeSettlementStatus(metadata.settlementStatus)
    const classDate = asText(metadata.date)
    const classTime = asText(metadata.time)
    const classStartsAt = classDate && classTime ? buildSessionStartsAt(classDate, classTime) : null
    return {
      purchase,
      id: purchase.id,
      metadata,
      userId: purchase.userId,
      settlementStatus,
      settlementNote: asText(metadata.settlementNote),
      settledAt: toDateIso(metadata.settledAt),
      classDate: classDate || null,
      classTime: classTime || null,
      classStartsAt,
    }
  })

  const standaloneItems: typeof enrichedPurchases = []
  const todayAttendanceByPurchaseId = new Map<
    string,
    {
      id: string
      status: string
      checkedInAt: string
      checkedOutAt: string | null
      packagePurchaseId: string | null
    }
  >()
  if (mode === "today") {
    const minStart = buildSessionStartsAt(todayNY, "00:00")!
    const maxStart = buildSessionStartsAt(todayNY, "23:59")!

    const todayAttendances = await prisma.attendance.findMany({
      where: {
        session: {
          startsAt: { gte: minStart, lte: maxStart },
        },
        ...(where
          ? {
              user: {
                OR: [
                  { email: { contains: query, mode: "insensitive" as const } },
                  { name: { contains: query, mode: "insensitive" as const } },
                  { phone: { contains: query, mode: "insensitive" as const } },
                ],
              },
            }
          : {}),
      },
      include: {
        session: {
          select: {
            courseSlug: true,
            startsAt: true,
            title: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            clerkId: true,
          },
        },
        packageUsage: {
          select: {
            packagePurchaseId: true,
            packagePurchase: {
              select: {
                packageId: true,
              },
            },
          },
        },
      },
      orderBy: { checkedInAt: "desc" },
      take: TODAY_MODE_TAKE_LIMIT,
    })

    const purchaseDedupKeys = new Set(
      enrichedPurchases
        .filter((item) => item.classDate === todayNY)
        .map((item) =>
          buildPurchaseAttendanceDedupKey({
            purchaseId: item.purchase.id,
            userId: item.userId,
            courseSlug: item.purchase.courseSlug,
            classStartsAt: item.classStartsAt,
          })
        )
    )

    for (const att of todayAttendances) {
      const attendanceMetadata = asObject(att.metadata)
      const linkedPurchaseId = asText(attendanceMetadata.purchaseId)
      const attendanceRow = att as typeof att & {
        checkedOutAt?: Date | null
        packageUsage?: { packagePurchaseId: string | null } | null
      }
      const normalizedAttendance = {
        id: att.id,
        status: att.status,
        checkedInAt: att.checkedInAt.toISOString(),
        checkedOutAt: attendanceRow.checkedOutAt ? attendanceRow.checkedOutAt.toISOString() : null,
        packagePurchaseId: attendanceRow.packageUsage?.packagePurchaseId || null,
      }
      if (linkedPurchaseId) {
        todayAttendanceByPurchaseId.set(linkedPurchaseId, normalizedAttendance)
      }
      const dedupKey = linkedPurchaseId
        ? `purchase:${linkedPurchaseId}`
        : attendanceSlotKey(att.userId, att.session.courseSlug, att.session.startsAt.getTime())

      if (!purchaseDedupKeys.has(dedupKey)) {
        const packageId = att.packageUsage?.packagePurchase?.packageId || ""
        standaloneItems.push({
          purchase: {
            id: `att-${att.id}`,
            userId: att.userId,
            courseSlug: att.session.courseSlug,
            courseTitle: att.session.title || att.session.courseSlug,
            amount: 0,
            currency: "usd",
            status: "none",
            name: att.user.name,
            email: att.user.email,
            phone: att.user.phone,
            stripePaymentIntentId: null,
            stripeCheckoutSessionId: null,
            metadata: {
              attendanceId: att.id,
              packageId,
              packagePurchaseId: att.packageUsage?.packagePurchaseId || null,
            },
            createdAt: att.checkedInAt,
            updatedAt: att.checkedInAt,
          } as unknown as typeof enrichedPurchases[number]["purchase"],
           id: `att-${att.id}`,
          metadata: {
            attendanceId: att.id,
            packageId,
            packagePurchaseId: att.packageUsage?.packagePurchaseId || null,
          },
          userId: att.userId,
          settlementStatus: "pending",
          settlementNote: "",
          settledAt: null,
          classDate: todayNY,
          classTime: getTimeKeyInTimeZone(att.session.startsAt),
          classStartsAt: att.session.startsAt,
        })
      }
    }
  }

  const historyEligiblePurchases = enrichedPurchases.filter((item) => item.classDate && item.classTime)
  const historyDatePurchases = mode === "history"
    ? historyEligiblePurchases.filter((item) => item.classDate! >= historyRange!.from && item.classDate! <= historyRange!.to)
    : []
  const classOptions = mode === "history"
    ? Array.from(
        new Map(
          historyDatePurchases
            .filter((item) => item.purchase.courseSlug)
            .map((item) => [
              item.purchase.courseSlug,
              {
                slug: item.purchase.courseSlug,
                title: item.purchase.courseTitle || item.purchase.courseSlug,
              },
            ])
        ).values()
      )
    : []
  const scopedPurchases =
    mode === "history"
      ? historyDatePurchases.filter((item) => !selectedClass || item.purchase.courseSlug === selectedClass)
      : [...enrichedPurchases.filter((item) => item.classDate === todayNY), ...standaloneItems].sort((a, b) => {
          const aTime = a.classStartsAt?.getTime() || a.purchase.createdAt.getTime()
          const bTime = b.classStartsAt?.getTime() || b.purchase.createdAt.getTime()
          return bTime - aTime
        })

  const userIds = [...new Set(scopedPurchases.map((item) => item.userId).filter(Boolean))]
  const courseSlugs = [...new Set(scopedPurchases.map((item) => item.purchase.courseSlug).filter(Boolean))]
  const purchaseIds = scopedPurchases.map((item) => item.purchase.id)
  const scopedPackagePurchaseIds = [...new Set(scopedPurchases.map((item) => asText(item.metadata.packagePurchaseId)).filter(Boolean))]

  const [pointsGrouped, pointsEntries, activePackages, historyPackageData, locations, slotAttendances, completedAttendances, globalPurchases, purchaseUsers, studentPinState] = await Promise.all([
    userIds.length
      ? prisma.pointsLedger.groupBy({
          by: ["userId"],
          where: { userId: { in: userIds } },
          _sum: { points: true },
        })
      : Promise.resolve([]),
    userIds.length
      ? prisma.pointsLedger.findMany({
          where: { userId: { in: userIds } },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            userId: true,
            type: true,
            points: true,
            createdAt: true,
            meta: true,
          },
          take: 800,
        })
      : Promise.resolve([]),
    userIds.length
      ? prisma.packagePurchase.findMany({
          where: {
            userId: { in: userIds },
            status: "active",
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          select: {
            id: true,
            userId: true,
            packageId: true,
            packageLabel: true,
            totalCredits: true,
            remainingCredits: true,
            isUnlimited: true,
            expiresAt: true,
            lastUsedAt: true,
            purchasedAt: true,
            status: true,
          },
        })
      : Promise.resolve([]),
    (purchaseIds.length || scopedPackagePurchaseIds.length)
      ? (async () => {
          const packagePurchases = await prisma.packagePurchase.findMany({
            where: {
              OR: [
                ...(purchaseIds.length ? [{ purchaseId: { in: purchaseIds } }] : []),
                ...(scopedPackagePurchaseIds.length ? [{ id: { in: scopedPackagePurchaseIds } }] : []),
              ],
            },
            select: {
              id: true,
              purchaseId: true,
            },
          })

          const packagePurchaseIds = packagePurchases.map((item) => item.id)
          const usageEntries = mode === "history" && packagePurchaseIds.length
            ? await prisma.packageUsageLedger.findMany({
                where: {
                  packagePurchaseId: { in: packagePurchaseIds },
                  attendanceId: { not: null },
                },
                orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                select: {
                  id: true,
                  packagePurchaseId: true,
                  attendanceId: true,
                  createdAt: true,
                },
              })
            : []

          const fundingPurchaseIds = [...new Set(packagePurchases.map((item) => item.purchaseId).filter((item): item is string => Boolean(item)))]
          const fundingPurchases = fundingPurchaseIds.length
            ? await prisma.purchase.findMany({
                where: { id: { in: fundingPurchaseIds } },
                select: {
                  id: true,
                  amount: true,
                  currency: true,
                  createdAt: true,
                  courseTitle: true,
                },
              })
            : []

          return {
            packagePurchases,
            usageEntries,
            fundingPurchases,
          }
        })()
      : Promise.resolve({ packagePurchases: [], usageEntries: [], fundingPurchases: [] }),
    courseSlugs.length
      ? prisma.courseCatalog.findMany({
          where: { slug: { in: courseSlugs } },
          select: { slug: true, location: true },
        })
      : Promise.resolve([]),
    (() => {
      const withSlot = scopedPurchases.filter((item) => item.classStartsAt)
      if (!withSlot.length || !userIds.length || !courseSlugs.length) return Promise.resolve([])

      const starts = withSlot
        .map((item) => item.classStartsAt)
        .filter((value): value is Date => Boolean(value))
        .map((value) => value.getTime())
      const minStart = new Date(Math.min(...starts) - 60 * 60 * 1000)
      const maxStart = new Date(Math.max(...starts) + 60 * 60 * 1000)

      return prisma.attendance.findMany({
        where: {
          userId: { in: userIds },
          session: {
            courseSlug: { in: courseSlugs },
            startsAt: { gte: minStart, lte: maxStart },
          },
        },
        include: {
          session: {
            select: {
              courseSlug: true,
              startsAt: true,
            },
          },
          packageUsage: {
            select: {
              packagePurchaseId: true,
            },
          },
        },
      })
    })(),
    userIds.length
      ? prisma.attendance.groupBy({
          by: ["userId"],
          where: {
            userId: { in: userIds },
            status: { in: [...ATTENDED_CHECKIN_STATUSES] },
          },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    userIds.length
      ? prisma.purchase.findMany({
          where: { userId: { in: userIds } },
          select: {
            userId: true,
            amount: true,
            metadata: true,
            status: true,
            stripePaymentIntentId: true,
            stripeCheckoutSessionId: true,
          },
        })
      : Promise.resolve([]),
    userIds.length
      ? prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, clerkId: true },
        })
      : Promise.resolve([]),
    loadStudentPinCredentials(userIds),
  ])

  const knownPackagePurchaseIds = new Set(historyPackageData.packagePurchases.map((item) => item.id))
  const attendanceDerivedPackagePurchaseIds = new Set<string>()

  for (const attendance of todayAttendanceByPurchaseId.values()) {
    if (attendance.packagePurchaseId && !knownPackagePurchaseIds.has(attendance.packagePurchaseId)) {
      attendanceDerivedPackagePurchaseIds.add(attendance.packagePurchaseId)
    }
  }

  for (const attendance of slotAttendances) {
    const packagePurchaseId = attendance.packageUsage?.packagePurchaseId || null
    if (packagePurchaseId && !knownPackagePurchaseIds.has(packagePurchaseId)) {
      attendanceDerivedPackagePurchaseIds.add(packagePurchaseId)
    }
  }

  const extraPackagePurchases = attendanceDerivedPackagePurchaseIds.size
    ? await prisma.packagePurchase.findMany({
        where: { id: { in: [...attendanceDerivedPackagePurchaseIds] } },
        select: {
          id: true,
          purchaseId: true,
        },
      })
    : []

  const knownFundingPurchaseIds = new Set(historyPackageData.fundingPurchases.map((item) => item.id))
  const extraFundingPurchaseIds = [...new Set(
    extraPackagePurchases.map((item) => item.purchaseId).filter((item): item is string => Boolean(item))
  )].filter((item) => !knownFundingPurchaseIds.has(item))

  const extraFundingPurchases = extraFundingPurchaseIds.length
    ? await prisma.purchase.findMany({
        where: { id: { in: extraFundingPurchaseIds } },
        select: {
          id: true,
          amount: true,
          currency: true,
          createdAt: true,
          courseTitle: true,
        },
      })
    : []

  const packagePurchases = [...historyPackageData.packagePurchases, ...extraPackagePurchases]
  const fundingPurchases = [...historyPackageData.fundingPurchases, ...extraFundingPurchases]

  const pointsByUser = new Map<string, number>()
  for (const row of pointsGrouped) {
    pointsByUser.set(row.userId, row._sum.points || 0)
  }

  const pointsHistoryByUser = new Map<
    string,
    Array<{
      id: string
      type: string
      points: number
      createdAt: string
      source: string | null
      courseSlug: string | null
      milestone: number | null
    }>
  >()
  for (const entry of pointsEntries) {
    if (!pointsHistoryByUser.has(entry.userId)) {
      pointsHistoryByUser.set(entry.userId, [])
    }
    const list = pointsHistoryByUser.get(entry.userId)!
    if (list.length >= 12) continue
    const meta = asObject(entry.meta)
    const milestoneRaw = Number(meta.milestone)
    list.push({
      id: entry.id,
      type: entry.type,
      points: entry.points,
      createdAt: entry.createdAt.toISOString(),
      source: asText(meta.source) || null,
      courseSlug: asText(meta.courseSlug) || null,
      milestone: Number.isFinite(milestoneRaw) ? milestoneRaw : null,
    })
  }

  const completedClassesByUser = new Map<string, number>()
  for (const row of completedAttendances) {
    completedClassesByUser.set(row.userId, row._count._all)
  }

  const selectedActivePackages = selectActivePackagesByUser(activePackages)
  const selectedActivePackageIds = [...new Set([...selectedActivePackages.values()].map((pkg) => pkg.id).filter((id): id is string => Boolean(id)))]
  const activePackageUsageRows = selectedActivePackageIds.length
    ? await prisma.packageUsageLedger.groupBy({
        by: ["packagePurchaseId"],
        where: {
          packagePurchaseId: { in: selectedActivePackageIds },
          attendance: {
            is: {
              status: { in: [...ATTENDED_CHECKIN_STATUSES] },
            },
          },
        },
        _count: { _all: true },
      })
    : []
  const activePackageClassesUsedById = new Map<string, number>()
  for (const row of activePackageUsageRows) {
    activePackageClassesUsedById.set(row.packagePurchaseId, row._count._all)
  }
  const outstandingBalanceByUser = buildOutstandingBalanceByUser(globalPurchases)

  const activePackageByUser = new Map(
    [...selectedActivePackages.entries()].map(([userId, pkg]) => [
      userId,
      {
        packagePurchaseId: pkg.id || "",
        packageId: pkg.packageId,
        packageLabel: pkg.packageLabel,
        totalCredits: pkg.totalCredits,
        remainingCredits: pkg.remainingCredits,
        isUnlimited: pkg.isUnlimited,
        expiresAt: pkg.expiresAt ? pkg.expiresAt.toISOString() : null,
        status: pkg.status,
      },
    ])
  )

  const courseLocationBySlug = new Map<string, string | null>()
  for (const row of locations) {
    courseLocationBySlug.set(row.slug, row.location || null)
  }

  const packagePurchaseIdByPurchaseId = new Map<string, string>()
  for (const row of packagePurchases) {
    if (row.purchaseId) {
      packagePurchaseIdByPurchaseId.set(row.purchaseId, row.id)
    }
  }

  const packageClassNumberByUsageKey = new Map<string, number>()
  const usageCountByPackagePurchaseId = new Map<string, number>()
  for (const row of historyPackageData.usageEntries) {
    if (!row.attendanceId) continue
    const nextCount = (usageCountByPackagePurchaseId.get(row.packagePurchaseId) || 0) + 1
    usageCountByPackagePurchaseId.set(row.packagePurchaseId, nextCount)
    packageClassNumberByUsageKey.set(`${row.packagePurchaseId}|${row.attendanceId}`, nextCount)
  }

  const attendanceBySlot = new Map<
    string,
    {
      id: string
      status: string
      checkedInAt: string
      checkedOutAt: string | null
      packagePurchaseId: string | null
    }
  >()
  for (const row of slotAttendances) {
    const attendanceRow = row as typeof row & {
      checkedOutAt?: Date | null
      packageUsage?: { packagePurchaseId: string | null } | null
    }
    const key = attendanceSlotKey(row.userId, row.session.courseSlug, row.session.startsAt.getTime())
    const current = attendanceBySlot.get(key)
    const nextCheckedInAt = row.checkedInAt.toISOString()
    if (!current || current.checkedInAt < nextCheckedInAt) {
      attendanceBySlot.set(key, {
        id: row.id,
        status: row.status,
        checkedInAt: nextCheckedInAt,
        checkedOutAt: attendanceRow.checkedOutAt ? attendanceRow.checkedOutAt.toISOString() : null,
        packagePurchaseId: attendanceRow.packageUsage?.packagePurchaseId || null,
      })
    }
  }

  const fundingPurchaseByPackagePurchaseId = new Map<
    string,
    {
      id: string
      amount: number
      currency: string
      createdAt: string
      courseTitle: string | null
    }
  >()
  const fundingPurchaseById = new Map(
    fundingPurchases.map((purchase) => [
      purchase.id,
      {
        id: purchase.id,
        amount: purchase.amount,
        currency: purchase.currency,
        createdAt: purchase.createdAt.toISOString(),
        courseTitle: purchase.courseTitle || null,
      },
    ])
  )
  for (const row of packagePurchases) {
    if (!row.purchaseId) continue
    const fundingPayment = fundingPurchaseById.get(row.purchaseId)
    if (fundingPayment) {
      fundingPurchaseByPackagePurchaseId.set(row.id, fundingPayment)
    }
  }

  const avatarByUserId = new Map<string, string>()
  if (purchaseUsers.length) {
    try {
      const client = await clerkClient()
      const clerkPairs = purchaseUsers
        .map((row) => ({
          userId: row.id,
          clerkId: typeof row.clerkId === "string" ? row.clerkId.trim() : "",
        }))
        .filter((row) => row.clerkId.length > 0)

      for (let start = 0; start < clerkPairs.length; start += 50) {
        const batch = clerkPairs.slice(start, start + 50)
        const clerkIds = batch.map((row) => row.clerkId)
        let users = [] as Awaited<ReturnType<typeof client.users.getUserList>>["data"]
        try {
          const page = await client.users.getUserList({
            userId: clerkIds,
            limit: clerkIds.length,
          })
          users = page.data
        } catch {
          users = []
        }
        const imageByClerkId = new Map<string, string>()
        for (const user of users) {
          if (user.imageUrl) {
            imageByClerkId.set(user.id, user.imageUrl)
          }
        }
        for (const row of batch) {
          const imageUrl = imageByClerkId.get(row.clerkId)
          if (imageUrl) {
            avatarByUserId.set(row.userId, imageUrl)
          }
        }
      }
    } catch {
      // if Clerk fetch fails we still return payments list without avatars
    }
  }

  const studentPinByUserId = new Map<
    string,
    {
      enabled: boolean
      enrolled: boolean
      locked: boolean
      needsEnrollment: boolean
      permanentStatus: StudentPinStatusValue | null
      provisionalActive: boolean
      provisionalExpiresAt: string | null
    }
  >()

  if (studentPinState.available) {
    for (const userId of userIds) {
      const credentials = studentPinState.credentials.filter((credential) => credential.userId === userId)
      const permanent = credentials.find((credential) => credential.kind === "permanent") || null
      const provisional = credentials.find((credential) => credential.kind === "provisional") || null
      const provisionalActive = isProvisionalStudentPinActive(provisional)

      studentPinByUserId.set(userId, {
        enabled: true,
        enrolled: Boolean(permanent && permanent.status !== "expired"),
        locked: Boolean(permanent && isLockedCredential(permanent)),
        needsEnrollment: !permanent || permanent.status === "expired",
        permanentStatus: (permanent?.status as StudentPinStatusValue | null) || null,
        provisionalActive,
        provisionalExpiresAt: provisional?.expiresAt?.toISOString() || null,
      })
    }
  }

  const mapped = scopedPurchases.map((item) => {
    const purchase = item.purchase
    const courseSlug = purchase.courseSlug
    const slotKey =
      item.classStartsAt && courseSlug
        ? attendanceSlotKey(item.userId, courseSlug, item.classStartsAt.getTime())
        : null
    const slotAttendance = slotKey ? attendanceBySlot.get(slotKey) : null
    const linkedAttendance = mode === "today" ? todayAttendanceByPurchaseId.get(purchase.id) || null : null
    const resolvedAttendance = slotAttendance || linkedAttendance
    const activePackage = activePackageByUser.get(item.userId)
    const metadataPackagePurchaseId = asText(item.metadata.packagePurchaseId) || null
    const linkedPackagePurchaseId =
      packagePurchaseIdByPurchaseId.get(purchase.id) || metadataPackagePurchaseId || resolvedAttendance?.packagePurchaseId || null
    const paymentStatus = purchase.status
    const packageId = purchase.packageId || asText(item.metadata.packageId)
    const serviceId = purchase.serviceId || asText(item.metadata.serviceId)
    const paymentChannel = normalizePaymentChannel({
      metadata: item.metadata,
      status: paymentStatus,
      stripePaymentIntentId: purchase.stripePaymentIntentId,
      stripeCheckoutSessionId: purchase.stripeCheckoutSessionId,
    })
    const purchaseCategory = normalizePurchaseCategory({ packageId, serviceId })
    const isPaid = isCompletedPaymentStatus(paymentStatus)
    const inferredCashCheckIn = !resolvedAttendance && paymentChannel === "cash"
    const checkInStatus: CheckInStatus =
      resolvedAttendance?.status === "checked_in" ||
      resolvedAttendance?.status === "checked_in_no_package" ||
      resolvedAttendance?.status === "checked_out" ||
      resolvedAttendance?.status === "scheduled"
        ? (resolvedAttendance.status as CheckInStatus)
        : inferredCashCheckIn
          ? "checked_in_no_package"
          : "none"
    const packageClassesUsedTotal = activePackage
      ? activePackage.isUnlimited
        ? activePackageClassesUsedById.get(activePackage.packagePurchaseId) || 0
        : Math.max(0, (activePackage.totalCredits || 0) - (activePackage.remainingCredits || 0))
      : 0
    const completedClassesTotal = Math.max(completedClassesByUser.get(item.userId) || 0, packageClassesUsedTotal)

    return {
      id: purchase.id,
      userId: item.userId,
      courseSlug,
      courseTitle: purchase.courseTitle || courseSlug,
      customerName: purchase.name || "—",
      customerEmail: purchase.email || "—",
      customerPhone: purchase.phone || "—",
      customerAvatarUrl: avatarByUserId.get(item.userId) || null,
      packageId: packageId || null,
      serviceId: serviceId || null,
      paymentChannel,
      purchaseCategory,
      amount: purchase.amount,
      currency: purchase.currency,
      paymentStatus,
      settlementStatus: item.settlementStatus,
      settlementNote: item.settlementNote,
      settledAt: item.settledAt,
      createdAt: purchase.createdAt.toISOString(),
      updatedAt: purchase.updatedAt.toISOString(),
      classDate: item.classDate,
      classTime: item.classTime,
      classStartsAt: item.classStartsAt ? item.classStartsAt.toISOString() : null,
      location: courseLocationBySlug.get(courseSlug) || null,
      pointsBalance: pointsByUser.get(item.userId) || 0,
      pointsHistory: pointsHistoryByUser.get(item.userId) || [],
      classPaid: isPaid,
      attendanceId: resolvedAttendance?.id ?? null,
      checkInStatus,
      checkInAt: resolvedAttendance?.checkedInAt || (inferredCashCheckIn ? purchase.createdAt.toISOString() : null),
      checkedOutAt: resolvedAttendance?.checkedOutAt ?? null,
      activePackage: activePackage
        ? {
            id: activePackage.packageId,
            label: activePackage.packageLabel || activePackage.packageId,
            totalCredits: activePackage.totalCredits,
            remainingCredits: activePackage.remainingCredits,
            isUnlimited: activePackage.isUnlimited,
            expiresAt: activePackage.expiresAt,
            status: activePackage.status,
          }
        : null,
      completedClassesTotal,
      packageClassesUsedTotal,
      outstandingBalance: (() => {
        const value = outstandingBalanceByUser.get(item.userId)
        return typeof value === "number" && value > 0 ? value : null
      })(),
      studentPin: studentPinByUserId.get(item.userId) || {
        enabled: false,
        enrolled: false,
        locked: false,
        needsEnrollment: false,
        permanentStatus: null,
        provisionalActive: false,
        provisionalExpiresAt: null,
      },
      packageClassNumber:
        mode === "history" && linkedPackagePurchaseId && slotAttendance?.id
          ? packageClassNumberByUsageKey.get(`${linkedPackagePurchaseId}|${slotAttendance.id}`) ?? null
          : null,
      fundingPayment: linkedPackagePurchaseId ? fundingPurchaseByPackagePurchaseId.get(linkedPackagePurchaseId) || null : null,
    }
  })

  const filtered = settlementFilter === "all" ? mapped : mapped.filter((item) => item.settlementStatus === settlementFilter)

  const summary = {
    totalItems: filtered.length,
    totalCollected: filtered
      .filter((item) => isCompletedPaymentStatus(item.paymentStatus))
      .reduce((sum, item) => sum + item.amount, 0),
    pendingSettlement: filtered.filter((item) => item.paymentChannel === "cash" && item.settlementStatus === "pending").length,
    paidSettlement: filtered.filter((item) => item.paymentChannel === "cash" && item.settlementStatus === "paid").length,
    pendingStripe: filtered.filter((item) => !item.classPaid).length,
    paidStripe: filtered.filter((item) => item.classPaid).length,
  }

  if (mode === "history") {
      return NextResponse.json({
        items: filtered,
        summary,
        classOptions,
        meta: {
          mode,
          from: historyRange!.from,
          to: historyRange!.to,
          truncated: historyTruncated,
        },
      })
  }

  return NextResponse.json({ items: filtered, summary })
}
