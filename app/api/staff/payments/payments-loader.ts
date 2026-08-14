import { type StaffPaymentsRequest } from "@/app/api/staff/payments/payments-request"
import { asObject, asText, attendanceSlotKey, buildOutstandingBalanceByUser, selectActivePackagesByUser } from "@/app/api/staff/payments/shared"
import {
  type EnrichedPurchase,
  type StaffPaymentsTodayWindow,
  loadStaffPaymentsPurchases,
  scopePurchasesForResponse,
} from "@/app/api/staff/payments/payments-loader-purchase"
import {
  type TodayAttendanceRow,
  getAttendanceStatusRank,
  loadTodayStaffPaymentsAttendances,
} from "@/app/api/staff/payments/payments-loader-attendance"
import {
  type AuxiliaryData,
  type StudentPinSummary,
  buildStudentPinMap,
  loadAttendanceDerivedExtras,
  loadActivePackageClassesUsed,
  loadAuxiliaryData,
  loadClerkUserData,
} from "@/app/api/staff/payments/payments-loader-auxiliary"

export type { StaffPaymentsTodayWindow } from "@/app/api/staff/payments/payments-loader-purchase"
export { loadStaffPaymentsPurchases } from "@/app/api/staff/payments/payments-loader-purchase"

export type StaffPaymentsLoadResult = {
  scopedPurchases: EnrichedPurchase[]
  historyTruncated: boolean
  classOptions: Array<{ slug: string | null; title: string | null }>
  rowContext: {
    clerkNameByUserId: Map<string, string>
    dbNameByUserId: Map<string, string | null>
    dbEmailByUserId: Map<string, string>
    dbPhoneByUserId: Map<string, string>
    avatarByUserId: Map<string, string>
    courseLocationBySlug: Map<string | null, string | null>
    pointsByUser: Map<string, number>
    pointsHistoryByUser: Map<string, Array<{
      id: string
      type: string
      points: number
      createdAt: string
      source: string | null
      courseSlug: string | null
      milestone: number | null
    }>>
    attendanceById: Map<string, TodayAttendanceRow>
    todayAttendanceByPurchaseId: Map<string, TodayAttendanceRow>
    attendanceBySlot: Map<string, TodayAttendanceRow>
    activePackageByUser: Map<string, {
      packagePurchaseId: string
      packageId: string
      packageLabel: string | null
      totalCredits: number | null
      remainingCredits: number | null
      isUnlimited: boolean
      expiresAt: string | null
      status: string
    }>
    activePackageClassesUsedById: Map<string, number>
    completedClassesByUser: Map<string, number>
    completedOverrideByUser: Map<string, number | null>
    packageUsedOverrideByUser: Map<string, number | null>
    outstandingBalanceByUser: Map<string, number>
    packagePurchaseIdByPurchaseId: Map<string, string>
    packageClassNumberByUsageKey: Map<string, number>
    fundingPurchaseByPackagePurchaseId: Map<string, {
      id: string
      amount: number
      currency: string
      createdAt: string
      courseTitle: string | null
    }>
    studentPinByUserId: Map<string, StudentPinSummary>
  }
}

/**
 * Top-level loader: runs all data loading and produces the inputs the route
 * needs to build the response (scoped purchases + row-mapping context +
 * history meta).
 */
export const loadStaffPaymentsData = async (
  paymentsRequest: StaffPaymentsRequest,
  todayWindow: StaffPaymentsTodayWindow,
): Promise<StaffPaymentsLoadResult> => {
  const { historyTruncated, deduplicatedEnrichedPurchases } = await loadStaffPaymentsPurchases(
    paymentsRequest,
    todayWindow,
  )

  const todayAttendanceOrchestration = await loadTodayStaffPaymentsAttendances({
    paymentsRequest,
    todayWindow,
    deduplicatedEnrichedPurchases,
  })

  const { scopedPurchases, classOptions } = scopePurchasesForResponse({
    paymentsRequest,
    deduplicatedEnrichedPurchases,
    standaloneItems: todayAttendanceOrchestration.standaloneItems,
    todayWindow,
  })

  const auxiliary = await loadAuxiliaryData({ paymentsRequest, todayWindow, scopedPurchases })

  const {
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
  } = auxiliary

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
    const list = pointsHistoryByUser.get(entry.userId) ?? []
    pointsHistoryByUser.set(entry.userId, list)
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
  if (paymentsRequest.mode === "today") {
    for (const [userId, keys] of todayAttendanceOrchestration.dedupedCompletedTodayByUser.entries()) {
      const rawAttended = todayAttendanceOrchestration.attendedRowsTodayByUser.get(userId) || 0
      const duplicateCount = Math.max(0, rawAttended - keys.size)
      if (duplicateCount > 0) {
        const current = completedClassesByUser.get(userId) || 0
        completedClassesByUser.set(userId, Math.max(0, current - duplicateCount))
      }
    }
  }

  const completedOverrideByUser = new Map<string, number | null>()
  const packageUsedOverrideByUser = new Map<string, number | null>()
  for (const u of purchaseUsers) {
    completedOverrideByUser.set(u.id, u.completedClassesOverride ?? null)
    packageUsedOverrideByUser.set(u.id, u.packageClassesUsedOverride ?? null)
  }

  const selectedActivePackages = selectActivePackagesByUser(activePackages)
  const selectedActivePackageIds = [...new Set([...selectedActivePackages.values()].map((pkg) => pkg.id).filter((id): id is string => Boolean(id)))]

  // ── Parallel: three independent async operations ──
  const [
    { packagePurchases, fundingPurchases },
    activePackageUsageRows,
    { avatarByUserId, clerkNameByUserId },
  ] = await Promise.all([
    loadAttendanceDerivedExtras({
      auxiliary,
      todayAttendanceByPurchaseId: todayAttendanceOrchestration.todayAttendanceByPurchaseId,
    }),
    loadActivePackageClassesUsed(selectedActivePackageIds),
    loadClerkUserData(purchaseUsers),
  ])
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

  const courseLocationBySlug = new Map<string | null, string | null>()
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

  const attendanceBySlot = new Map<string, TodayAttendanceRow>()
  for (const row of slotAttendances) {
    const attendanceRow = row as typeof row & {
      checkedOutAt?: Date | null
      packageUsage?: { packagePurchaseId: string | null } | null
    }
    const key = attendanceSlotKey(row.userId, row.session.courseSlug, row.session.startsAt.getTime())
    const current = attendanceBySlot.get(key)
    const nextCheckedInAt = row.checkedInAt.toISOString()
    if (
      !current ||
      getAttendanceStatusRank(row.status) > getAttendanceStatusRank(current.status) ||
      (getAttendanceStatusRank(row.status) === getAttendanceStatusRank(current.status) && current.checkedInAt < nextCheckedInAt)
    ) {
      attendanceBySlot.set(key, {
        id: row.id,
        status: row.status,
        checkedInAt: nextCheckedInAt,
        checkedOutAt: attendanceRow.checkedOutAt ? attendanceRow.checkedOutAt.toISOString() : null,
        packagePurchaseId: attendanceRow.packageUsage?.packagePurchaseId || null,
      })
    }
  }

  const attendanceById = new Map<string, TodayAttendanceRow>(
    slotAttendances.map((row) => {
      const attendanceRow = row as typeof row & {
        checkedOutAt?: Date | null
        packageUsage?: { packagePurchaseId: string | null } | null
      }
      return [
        row.id,
        {
          id: row.id,
          status: row.status,
          checkedInAt: row.checkedInAt.toISOString(),
          checkedOutAt: attendanceRow.checkedOutAt ? attendanceRow.checkedOutAt.toISOString() : null,
          packagePurchaseId: attendanceRow.packageUsage?.packagePurchaseId || null,
        },
      ]
    })
  )

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

  const dbNameByUserId = new Map<string, string | null>()
  const dbEmailByUserId = new Map<string, string>()
  const dbPhoneByUserId = new Map<string, string>()
  for (const row of purchaseUsers) {
    dbNameByUserId.set(row.id, row.name)
    if (row.email) dbEmailByUserId.set(row.id, row.email)
    if (row.phone) dbPhoneByUserId.set(row.id, row.phone)
  }

  const studentPinByUserId = buildStudentPinMap(studentPinState, userIds)

  return {
    scopedPurchases,
    historyTruncated,
    classOptions,
    rowContext: {
      clerkNameByUserId,
      dbNameByUserId,
      dbEmailByUserId,
      dbPhoneByUserId,
      avatarByUserId,
      courseLocationBySlug,
      pointsByUser,
      pointsHistoryByUser,
      attendanceById,
      todayAttendanceByPurchaseId: todayAttendanceOrchestration.todayAttendanceByPurchaseId,
      attendanceBySlot,
      activePackageByUser,
      activePackageClassesUsedById,
      completedClassesByUser,
      completedOverrideByUser,
      packageUsedOverrideByUser,
      outstandingBalanceByUser,
      packagePurchaseIdByPurchaseId,
      packageClassNumberByUsageKey,
      fundingPurchaseByPackagePurchaseId,
      studentPinByUserId,
    },
  }
}
