import { clerkClient } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { getCurrentMonthBoundariesNY } from "@/lib/monthly-boundary"
import { type StaffPaymentsRequest } from "@/app/api/staff/payments/payments-request"
import { asObject, asText, buildClerkDisplayName } from "@/app/api/staff/payments/shared"
import {
  isLockedCredential,
  isProvisionalStudentPinActive,
  isStudentPinLifecycleEnabled,
  isStudentPinSchemaUnavailableError,
  loadStudentPinCredentials,
  type StudentPinStatusValue,
} from "@/lib/security/student-pin"
import { ATTENDED_CHECKIN_STATUSES } from "@/lib/attendance-constants"
import { type EnrichedPurchase, type StaffPaymentsTodayWindow } from "@/app/api/staff/payments/payments-loader-purchase"
import { type TodayAttendanceRow } from "@/app/api/staff/payments/payments-loader-attendance"

export type StudentPinSummary = {
  enabled: boolean
  enrolled: boolean
  locked: boolean
  needsEnrollment: boolean
  permanentStatus: StudentPinStatusValue | null
  provisionalActive: boolean
  provisionalExpiresAt: string | null
}

type AuxiliaryDataInput = {
  paymentsRequest: StaffPaymentsRequest
  todayWindow: StaffPaymentsTodayWindow
  scopedPurchases: EnrichedPurchase[]
}

/**
 * Run all auxiliary queries (points, packages, attendances, users, pins) in
 * parallel for the user/course set derived from the scoped purchases.
 */
export const loadAuxiliaryData = async (input: AuxiliaryDataInput) => {
  const { paymentsRequest, todayWindow, scopedPurchases } = input
  const { todayNY, startOfTodayNY, endOfTodayNY } = todayWindow

  const userIds = [...new Set(scopedPurchases.map((item) => item.userId).filter(Boolean))]
  const courseSlugs = [...new Set(scopedPurchases.map((item) => item.purchase.courseSlug).filter((slug): slug is string => Boolean(slug)))]
  const purchaseIds = scopedPurchases.map((item) => item.purchase.id)
  const scopedPackagePurchaseIds = [...new Set(scopedPurchases.map((item) => asText(item.metadata.packagePurchaseId)).filter(Boolean))]

  const [pointsGrouped, pointsEntries, activePackages, historyPackageData, locations, slotAttendances, completedAttendances, globalPurchases, purchaseUsers, studentPinState] = await Promise.all([
    userIds.length
      ? prisma.pointsLedger.groupBy({
          by: ["userId"],
          where: { userId: { in: userIds } },
          _sum: { points: true },
        })
      : Promise.resolve([] as Array<{ userId: string; _sum: { points: number | null } }>),
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
      : Promise.resolve([] as Array<{
          id: string
          userId: string
          type: string
          points: number
          createdAt: Date
          meta: unknown
        }>),
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
      : Promise.resolve([] as Array<{
          id: string
          userId: string
          packageId: string
          packageLabel: string | null
          totalCredits: number | null
          remainingCredits: number | null
          isUnlimited: boolean
          expiresAt: Date | null
          lastUsedAt: Date | null
          purchasedAt: Date
          status: string
        }>),
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
          const fundingPurchaseIds = [...new Set(packagePurchases.map((item) => item.purchaseId).filter((item): item is string => Boolean(item)))]

          const [usageEntries, fundingPurchases] = await Promise.all([
            paymentsRequest.mode === "history" && packagePurchaseIds.length
              ? prisma.packageUsageLedger.findMany({
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
              : [],
            fundingPurchaseIds.length
              ? prisma.purchase.findMany({
                  where: { id: { in: fundingPurchaseIds } },
                  select: {
                    id: true,
                    amount: true,
                    currency: true,
                    createdAt: true,
                    courseTitle: true,
                  },
                })
              : [],
          ])

          return {
            packagePurchases,
            usageEntries,
            fundingPurchases,
          }
        })()
      : Promise.resolve({
          packagePurchases: [] as Array<{ id: string; purchaseId: string | null }>,
          usageEntries: [] as Array<{ id: string; packagePurchaseId: string; attendanceId: string | null; createdAt: Date }>,
          fundingPurchases: [] as Array<{ id: string; amount: number; currency: string; createdAt: Date; courseTitle: string | null }>,
        }),
    courseSlugs.length
      ? prisma.courseCatalog.findMany({
          where: { slug: { in: courseSlugs } },
          select: { slug: true, location: true, dropInPriceCents: true },
        })
      : Promise.resolve([] as Array<{ slug: string; location: string | null; dropInPriceCents: number | null }>),
    (() => {
      const withSlot = scopedPurchases.filter((item) => item.classStartsAt)
      if (!withSlot.length || !userIds.length || !courseSlugs.length) {
        return Promise.resolve([] as Array<{
          id: string
          userId: string
          status: string
          checkedInAt: Date
          metadata: unknown
          session: { courseSlug: string; startsAt: Date }
          packageUsage?: { packagePurchaseId: string | null } | null
        }>)
      }

      const starts = withSlot
        .map((item) => item.classStartsAt)
        .filter((value): value is Date => Boolean(value))
        .map((value) => value.getTime())
      let minStart = new Date(Math.min(...starts) - 60 * 60 * 1000)
      let maxStart = new Date(Math.max(...starts) + 60 * 60 * 1000)

      // In today mode, also clamp to current month boundaries to avoid
      // fetching attendances from previous months.
      if (paymentsRequest.mode === "today") {
        const { start: monthStart, end: monthEnd } = getCurrentMonthBoundariesNY()
        if (minStart < monthStart) minStart = monthStart
        if (maxStart > monthEnd) maxStart = monthEnd
      }

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
    (() => {
      // In today mode, scope completed attendances to NY today only.
      // In userHistory/history mode, count all attendances (no date filter).
      if (!userIds.length) return Promise.resolve([] as Array<{ userId: string; _count: { _all: number } }>)
      if (paymentsRequest.mode === "today") {
        return prisma.attendance.groupBy({
          by: ["userId"],
          where: {
            userId: { in: userIds },
            status: { in: [...ATTENDED_CHECKIN_STATUSES] },
            checkedInAt: { gte: startOfTodayNY, lte: endOfTodayNY },
          },
          _count: { _all: true },
        })
      }
      return prisma.attendance.groupBy({
        by: ["userId"],
        where: {
          userId: { in: userIds },
          status: { in: [...ATTENDED_CHECKIN_STATUSES] },
        },
        _count: { _all: true },
      })
    })(),
    (() => {
      // In today mode, scope purchases to NY today only.
      // In userHistory/history mode, fetch all purchases (no date filter).
      if (!userIds.length) {
        return Promise.resolve([] as Array<{
          userId: string
          amount: number
          metadata: unknown
          status: string
          stripePaymentIntentId: string | null
          stripeCheckoutSessionId: string | null
        }>)
      }
      if (paymentsRequest.mode === "today") {
        return prisma.purchase.findMany({
          where: {
            userId: { in: userIds },
            OR: [
              { metadata: { path: ["date"], equals: todayNY } },
              { createdAt: { gte: startOfTodayNY, lte: endOfTodayNY } },
            ],
          },
          select: {
            userId: true,
            amount: true,
            metadata: true,
            status: true,
            stripePaymentIntentId: true,
            stripeCheckoutSessionId: true,
          },
        })
      }
      return prisma.purchase.findMany({
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
    })(),
    userIds.length
      ? prisma.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            clerkId: true,
            name: true,
            email: true,
            phone: true,
            completedClassesOverride: true,
            packageClassesUsedOverride: true,
          },
        })
      : Promise.resolve([] as Array<{
          id: string
          clerkId: string | null
          name: string | null
          email: string | null
          phone: string | null
          completedClassesOverride: number | null
          packageClassesUsedOverride: number | null
        }>),
    loadStudentPinCredentials(userIds),
  ])

  return {
    userIds,
    pointsGrouped,
    pointsEntries,
    activePackages,
    historyPackageData,
    locations,
    slotAttendances,
    completedAttendances,
    globalPurchases,
    purchaseUsers,
    studentPinState,
  }
}

export type AuxiliaryData = Awaited<ReturnType<typeof loadAuxiliaryData>>

/**
 * Attendance + slot maps + extra package/funding lookups derived from
 * the data already loaded.
 */
export const loadAttendanceDerivedExtras = async (input: {
  auxiliary: AuxiliaryData
  todayAttendanceByPurchaseId: Map<string, TodayAttendanceRow>
}) => {
  const { auxiliary, todayAttendanceByPurchaseId } = input
  const { historyPackageData, slotAttendances } = auxiliary

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

  return {
    packagePurchases: [...historyPackageData.packagePurchases, ...extraPackagePurchases],
    fundingPurchases: [...historyPackageData.fundingPurchases, ...extraFundingPurchases],
  }
}

export const loadActivePackageClassesUsed = async (
  selectedActivePackageIds: string[],
) =>
  selectedActivePackageIds.length
    ? prisma.packageUsageLedger.groupBy({
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

export const loadClerkUserData = async (purchaseUsers: AuxiliaryData["purchaseUsers"]) => {
  const avatarByUserId = new Map<string, string>()
  const clerkNameByUserId = new Map<string, string>()
  if (!purchaseUsers.length) return { avatarByUserId, clerkNameByUserId }

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
      const nameByClerkId = new Map<string, string>()
      for (const user of users) {
        if (user.imageUrl) {
          imageByClerkId.set(user.id, user.imageUrl)
        }
        const displayName = buildClerkDisplayName(user.firstName, user.lastName)
        if (displayName) {
          nameByClerkId.set(user.id, displayName)
        }
      }
      const missingClerkIds = clerkIds.filter((clerkId) => !imageByClerkId.has(clerkId) && !nameByClerkId.has(clerkId))
      const missingResults = await Promise.allSettled(
        missingClerkIds.map((clerkId) => client.users.getUser(clerkId))
      )
      for (const result of missingResults) {
        if (result.status !== "fulfilled") continue
        const user = result.value
        if (user.imageUrl) {
          imageByClerkId.set(user.id, user.imageUrl)
        }
        const displayName = buildClerkDisplayName(user.firstName, user.lastName)
        if (displayName) {
          nameByClerkId.set(user.id, displayName)
        }
      }
      for (const row of batch) {
        const imageUrl = imageByClerkId.get(row.clerkId)
        if (imageUrl) {
          avatarByUserId.set(row.userId, imageUrl)
        }
        const clerkName = nameByClerkId.get(row.clerkId)
        if (clerkName) {
          clerkNameByUserId.set(row.userId, clerkName)
        }
      }
    }
  } catch {
    // if Clerk fetch fails we still return payments list without avatars or canonical names
  }

  return { avatarByUserId, clerkNameByUserId }
}

export const buildStudentPinMap = (
  studentPinState: AuxiliaryData["studentPinState"],
  userIds: string[],
): Map<string, StudentPinSummary> => {
  const studentPinByUserId = new Map<string, StudentPinSummary>()
  if (!studentPinState.available) return studentPinByUserId

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
  return studentPinByUserId
}
