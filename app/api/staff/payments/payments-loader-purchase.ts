import { prisma } from "@/lib/prisma"
import { buildSessionStartsAt } from "@/lib/class-schedule"
import {
  HISTORY_MODE_TAKE_LIMIT,
  type StaffPaymentsRequest,
} from "@/app/api/staff/payments/payments-request"
import { buildStaffPaymentsFindManyArgs } from "@/app/api/staff/payments/payments-query"
import {
  asObject,
  asText,
  isCompletedPaymentStatus,
  normalizeSettlementStatus,
  attendanceSlotKey,
} from "@/app/api/staff/payments/shared"
import { PAYMENT_CHANNEL } from "@/lib/payment-constants"

export type StaffPaymentsTodayWindow = {
  todayNY: string
  startOfTodayNY: Date
  endOfTodayNY: Date
}

export type EnrichedPurchase = {
  purchase: Awaited<ReturnType<typeof prisma.purchase.findMany>>[number]
  id: string
  metadata: Record<string, unknown>
  userId: string
  settlementStatus: ReturnType<typeof normalizeSettlementStatus>
  settlementNote: string
  settledAt: string | null
  classDate: string | null
  classTime: string | null
  classStartsAt: Date | null
}

export const buildPurchaseAttendanceDedupKey = (input: {
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

/** Build ALL possible dedup keys for a purchase so attendance matching works regardless of timezone */
export const buildPurchaseAllDedupKeys = (input: {
  purchaseId: string
  userId: string
  courseSlug: string | null | undefined
  classStartsAt: Date | null
  classDate: string | null
  classTime: string | null
}): string[] => {
  const keys: string[] = [`purchase:${input.purchaseId}`]
  if (input.courseSlug && input.classStartsAt) {
    keys.push(attendanceSlotKey(input.userId, input.courseSlug, input.classStartsAt.getTime()))
  }
  if (input.courseSlug && input.classDate && input.classTime) {
    keys.push(`${input.userId}|${input.courseSlug}|${input.classDate}|${input.classTime}`)
  }
  return keys
}

export const toDateIso = (value: unknown) => {
  if (typeof value !== "string" && typeof value !== "number") return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

export const normalizeConsecutivePurchases = <TPurchase extends {
  id: string
  userId: string
  amount: number
  courseSlug: string | null
  courseTitle: string | null
  serviceId: string | null
  packageId: string | null
  metadata: unknown
}>(purchases: TPurchase[]) => {
  const childParentIds = new Set(
    purchases
      .map((purchase) => asText(asObject(purchase.metadata).parentPurchaseId))
      .filter((value): value is string => Boolean(value))
  )

  const expanded: TPurchase[] = []

  for (const purchase of purchases) {
    const metadata = asObject(purchase.metadata)
    const consecutiveSlug = asText(metadata.consecutiveLinkedCourseSlug)
    const consecutiveTitle = asText(metadata.consecutiveCourseTitle)
    const consecutiveTime = asText(metadata.consecutiveLinkedCourseTime)
    const consecutivePriceCents = Number.parseInt(asText(metadata.consecutivePriceCents) || "", 10)
    const hasConsecutive =
      Boolean(consecutiveSlug) && Number.isFinite(consecutivePriceCents) && consecutivePriceCents > 0

    // Do not split already-normalized flows that already wrote child purchases.
    if (!hasConsecutive || childParentIds.has(purchase.id) || purchase.amount <= consecutivePriceCents) {
      expanded.push(purchase)
      continue
    }

    const primaryAmount = purchase.amount - consecutivePriceCents
    const baseMeta = asObject(purchase.metadata)

    expanded.push({
      ...purchase,
      amount: primaryAmount,
      metadata: {
        ...baseMeta,
        hasConsecutiveLinkedPurchase: true,
      },
    })

    expanded.push({
      ...purchase,
      id: `${purchase.id}::consecutive`,
      amount: consecutivePriceCents,
      courseSlug: consecutiveSlug || purchase.courseSlug,
      courseTitle: consecutiveTitle || consecutiveSlug || purchase.courseTitle,
      packageId: null,
      serviceId: purchase.serviceId,
      metadata: {
        ...baseMeta,
        parentPurchaseId: purchase.id,
        consecutiveLinkedFrom: purchase.courseSlug,
        courseSlug: consecutiveSlug,
        courseTitle: consecutiveTitle || "",
        time: consecutiveTime || asText(baseMeta.time) || "",
      },
    })
  }

  return expanded
}

export const isTodayScopedPurchase = (input: {
  classDate: string | null
  createdAt: Date
  todayNY: string
  startOfTodayNY: Date
  endOfTodayNY: Date
}) => {
  if (input.classDate) {
    return input.classDate === input.todayNY
  }
  return input.createdAt >= input.startOfTodayNY && input.createdAt <= input.endOfTodayNY
}

export const filterPurchasesByClassDateRange = <TItem extends { classDate: string | null }>(
  items: TItem[],
  from: string,
  to: string
) => items.filter((item) => item.classDate && item.classDate >= from && item.classDate <= to)

export const buildHistoryClassOptions = <TItem extends { purchase: { courseSlug: string | null; courseTitle: string | null } }>(
  items: TItem[]
) =>
  Array.from(
    new Map(
      items
        // Skip sentinel slugs like _staff_registration / _staff_package_grant (non-class
        // purchases) so they never surface as bogus classes in the payments-board filter.
        .filter((item) => item.purchase.courseSlug && !item.purchase.courseSlug.startsWith("_"))
        .map((item) => [
          item.purchase.courseSlug,
          {
            slug: item.purchase.courseSlug,
            title: item.purchase.courseTitle || item.purchase.courseSlug,
          },
        ])
    ).values()
  )

export const enrichPurchases = <TPurchase extends {
  id: string
  userId: string
  metadata: unknown
  createdAt: Date
}>(purchases: TPurchase[]) =>
  purchases.map((purchase) => {
    const metadata = asObject(purchase.metadata)
    const settlementStatus = normalizeSettlementStatus(metadata.settlementStatus)
    const classDate = asText(metadata.date)
    const classTime = asText(metadata.time)
    const classStartsAt = classDate && classTime ? buildSessionStartsAt(classDate, classTime) : purchase.createdAt
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

/**
 * Dedup enrichedPurchases by slot key — when two purchases exist for the same
 * (userId, courseSlug, classStartsAt), keep the real payment (Stripe/cash) so
 * Payment History can surface it, and merge attendanceId from package_credit.
 */
export const dedupEnrichedPurchasesBySlot = <TItem extends {
  metadata: Record<string, unknown>
  userId: string
  classStartsAt: Date | null
  purchase: { id: string; courseSlug: string | null; status: string }
}>(items: TItem[]): TItem[] => {
  const bySlot = new Map<string, TItem>()
  for (const item of items) {
    const key = buildPurchaseAttendanceDedupKey({
      purchaseId: item.purchase.id,
      userId: item.userId,
      courseSlug: item.purchase.courseSlug,
      classStartsAt: item.classStartsAt,
    })
    const existing = bySlot.get(key)
    if (!existing) {
      bySlot.set(key, item)
      continue
    }
    const existingIsCredit = asText(existing.metadata.paymentChannel) === PAYMENT_CHANNEL.PACKAGE_CREDIT
    const newIsCredit = asText(item.metadata.paymentChannel) === PAYMENT_CHANNEL.PACKAGE_CREDIT

    if (existingIsCredit && !newIsCredit) {
      const creditMeta = existing.metadata as Record<string, unknown> | null
      const inheritedAttendanceId = creditMeta?.attendanceId ?? null
      const mergedMetadata = inheritedAttendanceId
        ? { ...(item.metadata as Record<string, unknown>), attendanceId: inheritedAttendanceId }
        : item.metadata
      bySlot.set(key, { ...item, metadata: mergedMetadata as typeof item.metadata })
    } else if (!existingIsCredit && newIsCredit) {
      const creditMeta = item.metadata as Record<string, unknown> | null
      const inheritedAttendanceId = creditMeta?.attendanceId ?? null
      const mergedMetadata = inheritedAttendanceId
        ? { ...(existing.metadata as Record<string, unknown>), attendanceId: inheritedAttendanceId }
        : existing.metadata
      bySlot.set(key, { ...existing, metadata: mergedMetadata as typeof existing.metadata })
    } else if (!existingIsCredit && !newIsCredit) {
      const existingCompleted = isCompletedPaymentStatus(existing.purchase.status)
      const incomingCompleted = isCompletedPaymentStatus(item.purchase.status)
      if (!existingCompleted && incomingCompleted) {
        bySlot.set(key, item)
      }
    }
    // Otherwise keep existing (first-seen wins for equivalent rows).
  }
  return [...bySlot.values()]
}

export const scopePurchasesForResponse = (input: {
  paymentsRequest: StaffPaymentsRequest
  deduplicatedEnrichedPurchases: EnrichedPurchase[]
  standaloneItems: EnrichedPurchase[]
  todayWindow: StaffPaymentsTodayWindow
}) => {
  const { paymentsRequest, deduplicatedEnrichedPurchases, standaloneItems, todayWindow } = input
  const historyEligiblePurchases = [...deduplicatedEnrichedPurchases, ...standaloneItems]
    .filter((item) => item.classDate)
  const historyDatePurchases = paymentsRequest.mode === "history"
    ? filterPurchasesByClassDateRange(historyEligiblePurchases, paymentsRequest.historyRange.from, paymentsRequest.historyRange.to)
    : []
  const classOptions = paymentsRequest.mode === "history"
    ? buildHistoryClassOptions(historyDatePurchases)
    : []
  const { selectedFrom, selectedTo, selectedClass } = paymentsRequest

  const scopedPurchases: EnrichedPurchase[] =
    paymentsRequest.mode === "history"
      ? historyDatePurchases.filter((item) => !selectedClass || item.purchase.courseSlug === selectedClass)
      : paymentsRequest.mode === "userHistory"
        ? (selectedFrom && selectedTo
          ? filterPurchasesByClassDateRange(deduplicatedEnrichedPurchases, selectedFrom, selectedTo)
          : deduplicatedEnrichedPurchases)
        : [
            ...deduplicatedEnrichedPurchases.filter((item) =>
              isTodayScopedPurchase({
                classDate: item.classDate,
                createdAt: item.purchase.createdAt,
                todayNY: todayWindow.todayNY,
                startOfTodayNY: todayWindow.startOfTodayNY,
                endOfTodayNY: todayWindow.endOfTodayNY,
              })
            ),
            ...standaloneItems,
          ].sort((a, b) => {
            const aTime = a.classStartsAt?.getTime() || a.purchase.createdAt.getTime()
            const bTime = b.classStartsAt?.getTime() || b.purchase.createdAt.getTime()
            return bTime - aTime
          })

  return { scopedPurchases, classOptions }
}

/**
 * Run prisma.purchase.findMany for the request, apply history truncation, and
 * return both the raw purchases and the enriched/deduplicated view.
 */
export const loadStaffPaymentsPurchases = async (
  paymentsRequest: StaffPaymentsRequest,
  todayWindow: StaffPaymentsTodayWindow,
) => {
  const purchases = await prisma.purchase.findMany(buildStaffPaymentsFindManyArgs(paymentsRequest, {
    todayNY: todayWindow.todayNY,
    startOfTodayNY: todayWindow.startOfTodayNY,
    endOfTodayNY: todayWindow.endOfTodayNY,
  }))

  const historyTruncated = paymentsRequest.mode === "history" && purchases.length > HISTORY_MODE_TAKE_LIMIT
  const scopedBasePurchases = historyTruncated ? purchases.slice(0, HISTORY_MODE_TAKE_LIMIT) : purchases
  const normalizedPurchases = normalizeConsecutivePurchases(scopedBasePurchases)
  const enrichedPurchases = enrichPurchases(normalizedPurchases) as EnrichedPurchase[]
  const deduplicatedEnrichedPurchases = dedupEnrichedPurchasesBySlot(enrichedPurchases)

  return {
    purchases,
    historyTruncated,
    deduplicatedEnrichedPurchases,
  }
}
