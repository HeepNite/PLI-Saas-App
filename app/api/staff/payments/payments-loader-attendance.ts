import { prisma } from "@/lib/prisma"
import { buildSessionStartsAt, getDateKeyInTimeZone, getStartOfDayNY, getTimeKeyInTimeZone } from "@/lib/class-schedule"
import { TODAY_MODE_TAKE_LIMIT, type StaffPaymentsRequest } from "@/app/api/staff/payments/payments-request"
import { getStaffPaymentsTodaySessionBounds } from "@/app/api/staff/payments/payments-time"
import {
  asObject,
  asText,
  attendanceSlotKey,
  isCompletedPaymentStatus,
  normalizeSettlementStatus,
} from "@/app/api/staff/payments/shared"
import { ATTENDED_CHECKIN_STATUSES, ATTENDANCE_STATUS } from "@/lib/attendance-constants"
import { PAYMENT_CHANNEL, PURCHASE_STATUS, SETTLEMENT_STATUS } from "@/lib/payment-constants"
import {
  type EnrichedPurchase,
  type StaffPaymentsTodayWindow,
  buildPurchaseAllDedupKeys,
  filterPurchasesByClassDateRange,
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

const getNextDateKey = (date: string) => {
  const nextDate = new Date(`${date}T12:00:00.000Z`)
  nextDate.setUTCDate(nextDate.getUTCDate() + 1)
  return nextDate.toISOString().slice(0, 10)
}

/**
 * An attendance may already be paid by a purchase that falls outside this
 * request's own date window — either linked by id (e.g. "Mark all paid" today
 * on a purchase whose metadata.date is an earlier month) or matched by the
 * same user + courseSlug + class date/time slot (e.g. a cash settlement
 * recorded days after the class). Batch both lookups in one query, across all
 * time, before any candidate is synthesized as a debt row.
 */
const findAttendancesPaidOutsideWindow = async (
  attendances: Array<{ userId: string; session: { courseSlug: string }; metadata: unknown }>
): Promise<{ paidSlotKeys: Set<string>; paidPurchaseIds: Set<string> }> => {
  if (attendances.length === 0) return { paidSlotKeys: new Set(), paidPurchaseIds: new Set() }

  const userIds = [...new Set(attendances.map((a) => a.userId))]
  const courseSlugs = [...new Set(attendances.map((a) => a.session.courseSlug))]
  const linkedPurchaseIds = [...new Set(attendances.map((a) => asText(asObject(a.metadata).purchaseId)).filter(Boolean))]

  const purchases = await prisma.purchase.findMany({
    where: {
      OR: [
        { userId: { in: userIds }, courseSlug: { in: courseSlugs } },
        ...(linkedPurchaseIds.length ? [{ id: { in: linkedPurchaseIds } }] : []),
      ],
    },
    select: { id: true, userId: true, courseSlug: true, status: true, metadata: true },
  })

  const paidSlotKeys = new Set<string>()
  const paidPurchaseIds = new Set<string>()
  for (const purchase of purchases) {
    const metadata = asObject(purchase.metadata)
    const isPaid =
      isCompletedPaymentStatus(purchase.status) || normalizeSettlementStatus(metadata.settlementStatus) === SETTLEMENT_STATUS.PAID
    if (!isPaid) continue
    paidPurchaseIds.add(purchase.id)
    if (!purchase.courseSlug) continue
    // Same slot-key shape as buildPurchaseAllDedupKeys: a raw timestamp, not an
    // NY-formatted date/time string, so this never needs its own timezone lookup.
    const startsAt = buildSessionStartsAt(asText(metadata.date), asText(metadata.time))
    if (startsAt) paidSlotKeys.add(attendanceSlotKey(purchase.userId, purchase.courseSlug, startsAt.getTime()))
  }
  return { paidSlotKeys, paidPurchaseIds }
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
  if (paymentsRequest.mode !== "today" && paymentsRequest.mode !== "history") {
    return emptyTodayAttendanceOrchestration()
  }

  const { todayNY, startOfTodayNY, endOfTodayNY } = todayWindow
  const { query } = paymentsRequest
  const attendanceWindow = paymentsRequest.mode === "history"
    ? {
        checkedInAt: {
          gte: getStartOfDayNY(paymentsRequest.historyRange.from),
          lt: getStartOfDayNY(getNextDateKey(paymentsRequest.historyRange.to)),
        },
      }
    : (() => {
        const { minStart, maxStart } = getStaffPaymentsTodaySessionBounds(todayNY)
        return {
          session: { startsAt: { gte: minStart, lte: maxStart } },
          checkedInAt: { gte: startOfTodayNY, lte: endOfTodayNY },
        }
      })()

  const todayAttendances = await prisma.attendance.findMany({
    where: {
      ...attendanceWindow,
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

  const todayScopedPurchases = paymentsRequest.mode === "history"
    ? filterPurchasesByClassDateRange(
        deduplicatedEnrichedPurchases.filter((item) => item.classDate),
        paymentsRequest.historyRange.from,
        paymentsRequest.historyRange.to,
      )
    : deduplicatedEnrichedPurchases.filter((item) =>
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
  const paidOutsideWindow = await findAttendancesPaidOutsideWindow(todayAttendances)

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
      if (linkedPurchaseId && paidOutsideWindow.paidPurchaseIds.has(linkedPurchaseId)) return true
      if (purchaseDedupKeys.has(attendanceSlotKey(att.userId, att.session.courseSlug, attSlotMs))) return true
      if (paidOutsideWindow.paidSlotKeys.has(attendanceSlotKey(att.userId, att.session.courseSlug, attSlotMs))) return true
      return todayScopedPurchases.some(
        (p) => p.userId === att.userId && p.purchase.courseSlug === att.session.courseSlug
      )
    })()

    if (!isAlreadyCoveredByPurchase && !isStandaloneStaffFastActionAttendance(attendanceMetadata)) {
      const packageId = att.packageUsage?.packagePurchase?.packageId || ""
      // A package credit was already consumed for this attendance (PackageUsageLedger row
      // exists) even though no $0 package_credit Purchase row was written for it. Synthesize
      // the row as already paid instead of pending debt — see ensureAttendancePackagePurchase.
      const isCreditCovered = Boolean(att.packageUsage)
      const standaloneMetadata: Record<string, unknown> = {
        attendanceId: att.id,
        packageId,
        packagePurchaseId: att.packageUsage?.packagePurchaseId || null,
        ...(isCreditCovered
          ? { paymentChannel: PAYMENT_CHANNEL.PACKAGE_CREDIT, settlementStatus: SETTLEMENT_STATUS.PAID }
          : {}),
      }
      standaloneItems.push({
        purchase: {
          id: `att-${att.id}`,
          userId: att.userId,
          courseSlug: att.session.courseSlug,
          courseTitle: att.session.title || att.session.courseSlug,
          amount: 0,
          currency: "usd",
          status: isCreditCovered ? PURCHASE_STATUS.PAID : "none",
          name: att.user.name,
          email: att.user.email,
          phone: att.user.phone,
          stripePaymentIntentId: null,
          stripeCheckoutSessionId: null,
          metadata: standaloneMetadata,
          createdAt: att.checkedInAt,
          updatedAt: att.checkedInAt,
        } as unknown as EnrichedPurchase["purchase"],
        id: `att-${att.id}`,
        metadata: standaloneMetadata,
        userId: att.userId,
        settlementStatus: isCreditCovered ? SETTLEMENT_STATUS.PAID : SETTLEMENT_STATUS.PENDING,
        settlementNote: "",
        settledAt: null,
        // The ClassSession's own start, never checkedInAt — which can be days after
        // the class (e.g. a staff cash-settlement action recorded after the fact).
        // "today" mode's own attendance window already bounds the session to todayNY.
        classDate: paymentsRequest.mode === "history" ? getDateKeyInTimeZone(att.session.startsAt) : todayNY,
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
