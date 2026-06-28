import { prisma } from "@/lib/prisma"
import { getTimeKeyInTimeZone } from "@/lib/class-schedule"
import { TODAY_MODE_TAKE_LIMIT, type StaffPaymentsRequest } from "@/app/api/staff/payments/payments-request"
import { getStaffPaymentsTodaySessionBounds } from "@/app/api/staff/payments/payments-time"
import { asObject, asText, attendanceSlotKey } from "@/app/api/staff/payments/shared"
import { ATTENDED_CHECKIN_STATUSES, ATTENDANCE_STATUS } from "@/lib/attendance-constants"
import { SETTLEMENT_STATUS } from "@/lib/payment-constants"
import {
  type EnrichedPurchase,
  type StaffPaymentsTodayWindow,
  buildPurchaseAllDedupKeys,
  isTodayScopedPurchase,
} from "@/app/api/staff/payments/payments-loader-purchase"

export type StandaloneAttendanceItem = EnrichedPurchase

export type TodayAttendanceRow = {
  id: string
  status: string
  checkedInAt: string
  checkedOutAt: string | null
  packagePurchaseId: string | null
}

export type TodayAttendanceOrchestrationResult = {
  standaloneItems: StandaloneAttendanceItem[]
  todayAttendanceByPurchaseId: Map<string, TodayAttendanceRow>
  dedupedCompletedTodayByUser: Map<string, Set<string>>
  attendedRowsTodayByUser: Map<string, number>
}

const ATTENDED_CHECKIN_STATUS_SET = new Set<string>(ATTENDED_CHECKIN_STATUSES)

export const getAttendanceStatusRank = (status: string) => {
  if (status === ATTENDANCE_STATUS.CHECKED_OUT) return 4
  if (status === ATTENDANCE_STATUS.CHECKED_IN) return 3
  if (status === ATTENDANCE_STATUS.CHECKED_IN_NO_PACKAGE) return 2
  if (status === ATTENDANCE_STATUS.SCHEDULED) return 1
  return 0
}

export const isStandaloneStaffFastActionAttendance = (metadata: Record<string, unknown>) => {
  const source = asText(metadata.source)
  return source === "staff_fast_action" || source === "staff_fast_action_promo"
}

export const emptyTodayAttendanceOrchestration = (): TodayAttendanceOrchestrationResult => ({
  standaloneItems: [],
  todayAttendanceByPurchaseId: new Map(),
  dedupedCompletedTodayByUser: new Map(),
  attendedRowsTodayByUser: new Map(),
})

/**
 * Load today-scoped attendances and split them between (1) attendances already
 * covered by an existing purchase row (folded into the per-purchase map) and
 * (2) standalone attendance rows that need their own synthetic purchase item.
 */
export const loadTodayStaffPaymentsAttendances = async (input: {
  paymentsRequest: StaffPaymentsRequest
  todayWindow: StaffPaymentsTodayWindow
  deduplicatedEnrichedPurchases: EnrichedPurchase[]
}): Promise<TodayAttendanceOrchestrationResult> => {
  const { paymentsRequest, todayWindow, deduplicatedEnrichedPurchases } = input
  if (paymentsRequest.mode !== "today") return emptyTodayAttendanceOrchestration()

  const { todayNY, startOfTodayNY, endOfTodayNY } = todayWindow
  const { query } = paymentsRequest
  const { minStart, maxStart } = getStaffPaymentsTodaySessionBounds(todayNY)

  const todayAttendances = await prisma.attendance.findMany({
    where: {
      session: {
        startsAt: { gte: minStart, lte: maxStart },
      },
      checkedInAt: { gte: startOfTodayNY, lte: endOfTodayNY },
      ...(query
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

  const todayScopedPurchases = deduplicatedEnrichedPurchases.filter((item) =>
    isTodayScopedPurchase({
      classDate: item.classDate,
      createdAt: item.purchase.createdAt,
      todayNY,
      startOfTodayNY,
      endOfTodayNY,
    })
  )
  const purchaseDedupKeys = new Set(
    todayScopedPurchases.flatMap((item) =>
      buildPurchaseAllDedupKeys({
        purchaseId: item.purchase.id,
        userId: item.userId,
        courseSlug: item.purchase.courseSlug,
        classStartsAt: item.classStartsAt,
        classDate: item.classDate,
        classTime: item.classTime,
      })
    )
  )

  const standaloneItems: StandaloneAttendanceItem[] = []
  const todayAttendanceByPurchaseId = new Map<string, TodayAttendanceRow>()
  const dedupedCompletedTodayByUser = new Map<string, Set<string>>()
  const attendedRowsTodayByUser = new Map<string, number>()

  for (const att of todayAttendances) {
    const attendanceMetadata = asObject(att.metadata)
    const linkedPurchaseId = asText(attendanceMetadata.purchaseId)
    const attendanceRow = att as typeof att & {
      checkedOutAt?: Date | null
      packageUsage?: { packagePurchaseId: string | null } | null
    }
    const normalizedAttendance: TodayAttendanceRow = {
      id: att.id,
      status: att.status,
      checkedInAt: att.checkedInAt.toISOString(),
      checkedOutAt: attendanceRow.checkedOutAt ? attendanceRow.checkedOutAt.toISOString() : null,
      packagePurchaseId: attendanceRow.packageUsage?.packagePurchaseId || null,
    }
    if (linkedPurchaseId) {
      const existing = todayAttendanceByPurchaseId.get(linkedPurchaseId)
      if (!existing || getAttendanceStatusRank(normalizedAttendance.status) >= getAttendanceStatusRank(existing.status)) {
        todayAttendanceByPurchaseId.set(linkedPurchaseId, normalizedAttendance)
      }
    }

    const attSlotMs = att.session.startsAt.getTime()

    if (ATTENDED_CHECKIN_STATUS_SET.has(normalizedAttendance.status)) {
      attendedRowsTodayByUser.set(att.userId, (attendedRowsTodayByUser.get(att.userId) || 0) + 1)
      const dedupeKey = linkedPurchaseId || attendanceSlotKey(att.userId, att.session.courseSlug, attSlotMs)
      const existingKeys = dedupedCompletedTodayByUser.get(att.userId) || new Set<string>()
      existingKeys.add(dedupeKey)
      dedupedCompletedTodayByUser.set(att.userId, existingKeys)
    }

    // Check if this attendance is already covered by a purchase row.
    // Try purchase:ID match first (most reliable), then slot key, then
    // fallback to a simple userId+courseSlug match for same-day dedup.
    const isAlreadyCoveredByPurchase = (() => {
      if (linkedPurchaseId && purchaseDedupKeys.has(`purchase:${linkedPurchaseId}`)) return true
      if (purchaseDedupKeys.has(attendanceSlotKey(att.userId, att.session.courseSlug, attSlotMs))) return true
      return todayScopedPurchases.some(
        (p) => p.userId === att.userId && p.purchase.courseSlug === att.session.courseSlug
      )
    })()

    if (!isAlreadyCoveredByPurchase && !isStandaloneStaffFastActionAttendance(attendanceMetadata)) {
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
        } as unknown as EnrichedPurchase["purchase"],
        id: `att-${att.id}`,
        metadata: {
          attendanceId: att.id,
          packageId,
          packagePurchaseId: att.packageUsage?.packagePurchaseId || null,
        },
        userId: att.userId,
        settlementStatus: SETTLEMENT_STATUS.PENDING,
        settlementNote: "",
        settledAt: null,
        classDate: todayNY,
        classTime: getTimeKeyInTimeZone(att.session.startsAt),
        classStartsAt: att.session.startsAt,
      })
    }
  }

  return {
    standaloneItems,
    todayAttendanceByPurchaseId,
    dedupedCompletedTodayByUser,
    attendedRowsTodayByUser,
  }
}
