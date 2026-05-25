import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { clerkClient } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { authorizeStaffPortalSectionRequest } from "@/lib/security/staff-portal-auth"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { buildSessionStartsAt, getTimeKeyInTimeZone } from "@/lib/class-schedule"
import { getCurrentMonthBoundariesNY } from "@/lib/monthly-boundary"
import {
  HISTORY_MODE_TAKE_LIMIT,
  parseStaffPaymentsRequest,
  TODAY_MODE_TAKE_LIMIT,
} from "@/app/api/staff/payments/payments-request"
import { buildStaffPaymentsFindManyArgs } from "@/app/api/staff/payments/payments-query"
import { getStaffPaymentsTodayWindow } from "@/app/api/staff/payments/payments-time"
import {
  asObject,
  asText,
  attendanceSlotKey,
  buildClerkDisplayName,
  buildOutstandingBalanceByUser,
  isCompletedPaymentStatus,
  normalizePaymentChannel,
  normalizePurchaseCategory,
  normalizeSettlementStatus,
  resolveCanonicalName,
  selectActivePackagesByUser,
} from "@/app/api/staff/payments/shared"
import {
  isLockedCredential,
  isProvisionalStudentPinActive,
  isStudentPinLifecycleEnabled,
  type StudentPinStatusValue,
} from "@/lib/security/student-pin"
import { isStripeFailureInfo, type StripeFailureInfo } from "@/lib/stripe-failure"

export const runtime = "nodejs"

type CheckInStatus = "checked_in" | "checked_in_no_package" | "checked_out" | "scheduled" | "none"

const ATTENDED_CHECKIN_STATUSES = ["checked_in", "checked_in_no_package", "checked_out"] as const
const ATTENDED_CHECKIN_STATUS_SET = new Set<string>(ATTENDED_CHECKIN_STATUSES)

const getAttendanceStatusRank = (status: string) => {
  if (status === "checked_out") return 4
  if (status === "checked_in") return 3
  if (status === "checked_in_no_package") return 2
  if (status === "scheduled") return 1
  return 0
}

const resolveChildDropInCategory = (input: {
  purchasePackageId: string | null
  metadataPackageId: string
  isConsecutiveChild: boolean
  serviceId: string
}) => {
  if (input.isConsecutiveChild && !input.purchasePackageId) {
    return {
      packageId: "",
      purchaseCategory: normalizePurchaseCategory({ packageId: "", serviceId: input.serviceId }),
    }
  }

  const packageId = input.purchasePackageId || input.metadataPackageId
  return {
    packageId,
    purchaseCategory: normalizePurchaseCategory({ packageId, serviceId: input.serviceId }),
  }
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

/** Build ALL possible dedup keys for a purchase so attendance matching works regardless of timezone */
const buildPurchaseAllDedupKeys = (input: {
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

const toDateIso = (value: unknown) => {
  if (typeof value !== "string" && typeof value !== "number") return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

const normalizeConsecutivePurchases = <TPurchase extends {
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

const isTodayScopedPurchase = (input: {
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

const filterPurchasesByClassDateRange = <TItem extends { classDate: string | null }>(
  items: TItem[],
  from: string,
  to: string
) => items.filter((item) => item.classDate && item.classDate >= from && item.classDate <= to)

const buildHistoryClassOptions = <TItem extends { purchase: { courseSlug: string | null; courseTitle: string | null } }>(
  items: TItem[]
) =>
  Array.from(
    new Map(
      items
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

const buildPaymentsSummary = <TItem extends {
  amount: number
  paymentStatus: string
  paymentChannel: string
  settlementStatus: string
  classPaid: boolean
}>(items: TItem[]) => ({
  totalItems: items.length,
  totalCollected: items
    .filter((item) => isCompletedPaymentStatus(item.paymentStatus))
    .reduce((sum, item) => sum + item.amount, 0),
  pendingSettlement: items.filter((item) => item.paymentChannel === "cash" && item.settlementStatus === "pending").length,
  paidSettlement: items.filter((item) => item.paymentChannel === "cash" && item.settlementStatus === "paid").length,
  pendingStripe: items.filter((item) => item.paymentChannel === "card" && !item.classPaid).length,
  paidStripe: items.filter((item) => item.paymentChannel === "card" && item.classPaid).length,
})

const resolveSettlementStatus = (input: {
  paymentChannel: string
  currentSettlementStatus: string
  isPaid: boolean
  hasOutstandingBalance: boolean
}) => {
  if (input.paymentChannel === "cash") {
    return input.hasOutstandingBalance ? "pending" : input.currentSettlementStatus
  }

  return input.isPaid ? "paid" : input.currentSettlementStatus
}

const resolveCheckInStatus = (attendanceStatus: string | null | undefined): CheckInStatus => {
  if (
    attendanceStatus === "checked_in" ||
    attendanceStatus === "checked_in_no_package" ||
    attendanceStatus === "checked_out" ||
    attendanceStatus === "scheduled"
  ) {
    return attendanceStatus
  }

  return "none"
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

  const paymentsRequest = parseStaffPaymentsRequest(req)
  if (!paymentsRequest.ok) {
    return NextResponse.json(
      { error: paymentsRequest.error },
      { status: paymentsRequest.status }
    )
  }

  const {
    query,
    settlementFilter,
    selectedFrom,
    selectedTo,
    selectedClass,
  } = paymentsRequest
  const { todayNY, startOfTodayNY, endOfTodayNY } = getStaffPaymentsTodayWindow()

  const purchases = await prisma.purchase.findMany(buildStaffPaymentsFindManyArgs(paymentsRequest, {
    startOfTodayNY,
    endOfTodayNY,
  }))

  const historyTruncated = paymentsRequest.mode === "history" && purchases.length > HISTORY_MODE_TAKE_LIMIT
  const scopedBasePurchases = historyTruncated ? purchases.slice(0, HISTORY_MODE_TAKE_LIMIT) : purchases
  const normalizedPurchases = normalizeConsecutivePurchases(scopedBasePurchases)

  const enrichedPurchases = normalizedPurchases.map((purchase) => {
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

  // Dedup enrichedPurchases by slot key — when two purchases exist for the same
  // (userId, courseSlug, classStartsAt), keep the real payment (Stripe/cash) so
  // Payment History can surface it, and merge attendanceId from package_credit.
  const enrichedPurchasesBySlot = new Map<string, (typeof enrichedPurchases)[number]>()
  for (const item of enrichedPurchases) {
    const key = buildPurchaseAttendanceDedupKey({
      purchaseId: item.purchase.id,
      userId: item.userId,
      courseSlug: item.purchase.courseSlug,
      classStartsAt: item.classStartsAt,
    })
    const existing = enrichedPurchasesBySlot.get(key)
    if (!existing) {
      enrichedPurchasesBySlot.set(key, item)
    } else {
      // When both a Stripe/cash purchase (has amount + paymentChannel) and a
      // package_credit purchase (has attendanceId) exist for the same slot,
      // keep the real payment so Payment History can surface it, and merge
      // the attendanceId from the credit record into its metadata.
      const existingIsCredit = asText(existing.metadata.paymentChannel) === "package_credit"
      const newIsCredit = asText(item.metadata.paymentChannel) === "package_credit"

      if (existingIsCredit && !newIsCredit) {
        // Existing is credit, new is real payment. Keep new, inherit attendanceId.
        const creditMeta = existing.metadata as Record<string, unknown> | null
        const inheritedAttendanceId = creditMeta?.attendanceId ?? null
        const mergedMetadata = inheritedAttendanceId
          ? { ...(item.metadata as Record<string, unknown>), attendanceId: inheritedAttendanceId }
          : item.metadata
        enrichedPurchasesBySlot.set(key, { ...item, metadata: mergedMetadata as typeof item.metadata })
      } else if (!existingIsCredit && newIsCredit) {
        // Existing is real payment, new is credit. Keep existing, inherit attendanceId.
        const creditMeta = item.metadata as Record<string, unknown> | null
        const inheritedAttendanceId = creditMeta?.attendanceId ?? null
        const mergedMetadata = inheritedAttendanceId
          ? { ...(existing.metadata as Record<string, unknown>), attendanceId: inheritedAttendanceId }
          : existing.metadata
        enrichedPurchasesBySlot.set(key, { ...existing, metadata: mergedMetadata as typeof existing.metadata })
      } else if (!existingIsCredit && !newIsCredit) {
        // Both are real payment rows for the same slot.
        // Prefer a completed payment over a pending/failed duplicate regardless of recency.
        const existingCompleted = isCompletedPaymentStatus(existing.purchase.status)
        const incomingCompleted = isCompletedPaymentStatus(item.purchase.status)
        if (!existingCompleted && incomingCompleted) {
          enrichedPurchasesBySlot.set(key, item)
        }
      }
      // Otherwise keep existing (first-seen wins for equivalent rows).
    }
  }
  const deduplicatedEnrichedPurchases = [...enrichedPurchasesBySlot.values()]

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
  const dedupedCompletedTodayByUser = new Map<string, Set<string>>()
  const attendedRowsTodayByUser = new Map<string, number>()
  if (paymentsRequest.mode === "today") {
    const minStart = buildSessionStartsAt(todayNY, "00:00")!
    const maxStart = buildSessionStartsAt(todayNY, "23:59")!

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

    const todayScopedPurchases = deduplicatedEnrichedPurchases
      .filter((item) =>
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
        // Fallback: check if ANY today-scoped purchase matches by userId + courseSlug
        return todayScopedPurchases.some(
          (p) => p.userId === att.userId && p.purchase.courseSlug === att.session.courseSlug
        )
      })()

      if (!isAlreadyCoveredByPurchase) {
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

  const historyEligiblePurchases = deduplicatedEnrichedPurchases.filter((item) => item.classDate)
  const historyDatePurchases = paymentsRequest.mode === "history"
    ? filterPurchasesByClassDateRange(historyEligiblePurchases, paymentsRequest.historyRange.from, paymentsRequest.historyRange.to)
    : []
  const classOptions = paymentsRequest.mode === "history"
    ? buildHistoryClassOptions(historyDatePurchases)
    : []
  const scopedPurchases =
    paymentsRequest.mode === "history"
      ? historyDatePurchases.filter((item) => !selectedClass || item.purchase.courseSlug === selectedClass)
      : paymentsRequest.mode === "userHistory"
        ? (selectedFrom && selectedTo
          ? filterPurchasesByClassDateRange(deduplicatedEnrichedPurchases, selectedFrom, selectedTo)
          : deduplicatedEnrichedPurchases)
        : [
            ...deduplicatedEnrichedPurchases.filter(
              (item) =>
                isTodayScopedPurchase({
                  classDate: item.classDate,
                  createdAt: item.purchase.createdAt,
                  todayNY,
                  startOfTodayNY,
                  endOfTodayNY,
                })
            ),
            ...standaloneItems,
          ].sort((a, b) => {
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
          const usageEntries = paymentsRequest.mode === "history" && packagePurchaseIds.length
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
      if (!userIds.length) return Promise.resolve([])
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
      if (!userIds.length) return Promise.resolve([])
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
  if (paymentsRequest.mode === "today") {
    for (const [userId, keys] of dedupedCompletedTodayByUser.entries()) {
      const rawAttended = attendedRowsTodayByUser.get(userId) || 0
      const duplicateCount = Math.max(0, rawAttended - keys.size)
      if (duplicateCount > 0) {
        const current = completedClassesByUser.get(userId) || 0
        completedClassesByUser.set(userId, Math.max(0, current - duplicateCount))
      }
    }
  }

  // Build override maps from user data
  const completedOverrideByUser = new Map<string, number | null>()
  const packageUsedOverrideByUser = new Map<string, number | null>()
  for (const u of purchaseUsers) {
    completedOverrideByUser.set(u.id, u.completedClassesOverride ?? null)
    packageUsedOverrideByUser.set(u.id, u.packageClassesUsedOverride ?? null)
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

  const attendanceById = new Map(
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

  const avatarByUserId = new Map<string, string>()
  const clerkNameByUserId = new Map<string, string>()
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
        for (const clerkId of missingClerkIds) {
          try {
            const user = await client.users.getUser(clerkId)
            if (user.imageUrl) {
              imageByClerkId.set(user.id, user.imageUrl)
            }
            const displayName = buildClerkDisplayName(user.firstName, user.lastName)
            if (displayName) {
              nameByClerkId.set(user.id, displayName)
            }
          } catch {
            // Keep this payment row usable even if an individual Clerk lookup fails.
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
  }

  // Build DB name lookup from purchaseUsers
  const dbNameByUserId = new Map<string, string | null>()
  const dbEmailByUserId = new Map<string, string>()
  const dbPhoneByUserId = new Map<string, string>()
  for (const row of purchaseUsers) {
    dbNameByUserId.set(row.id, row.name)
    if (row.email) dbEmailByUserId.set(row.id, row.email)
    if (row.phone) dbPhoneByUserId.set(row.id, row.phone)
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
    const metadataParentPurchaseId = asText(item.metadata.parentPurchaseId)
    const metadataConsecutiveLinkedFrom = asText(item.metadata.consecutiveLinkedFrom)
    const isConsecutiveChild = Boolean(metadataParentPurchaseId || metadataConsecutiveLinkedFrom)
    const courseSlug = purchase.courseSlug
    const paymentStatus = purchase.status
    const metadataPackageId = asText(item.metadata.packageId)
    const serviceId = purchase.serviceId || asText(item.metadata.serviceId)
    const { packageId, purchaseCategory } = resolveChildDropInCategory({
      purchasePackageId: purchase.packageId,
      metadataPackageId,
      isConsecutiveChild,
      serviceId,
    })
    const paymentChannel = normalizePaymentChannel({
      metadata: item.metadata,
      status: paymentStatus,
      stripePaymentIntentId: purchase.stripePaymentIntentId,
      stripeCheckoutSessionId: purchase.stripeCheckoutSessionId,
    })
    const isPackageCredit = paymentChannel === "package_credit"

    const metadataAttendanceId = asText(item.metadata.attendanceId) || null
    const explicitAttendance = metadataAttendanceId ? attendanceById.get(metadataAttendanceId) || null : null
    const purchaseLinkedAttendance = todayAttendanceByPurchaseId.get(purchase.id) || null
    const slotKey =
      item.classStartsAt && courseSlug
        ? attendanceSlotKey(item.userId, courseSlug, item.classStartsAt.getTime())
        : null
    const slotAttendance = slotKey ? attendanceBySlot.get(slotKey) : null
    const resolvedAttendance = isPackageCredit
      ? explicitAttendance || purchaseLinkedAttendance
      : explicitAttendance || purchaseLinkedAttendance || slotAttendance
    const activePackage = activePackageByUser.get(item.userId)
    const metadataPackagePurchaseId = asText(item.metadata.packagePurchaseId) || null
    const linkedPackagePurchaseId =
      packagePurchaseIdByPurchaseId.get(purchase.id) || metadataPackagePurchaseId || resolvedAttendance?.packagePurchaseId || null
    const isPaid = isCompletedPaymentStatus(paymentStatus)
    const normalizedSettlementStatus = resolveSettlementStatus({
      paymentChannel,
      currentSettlementStatus: item.settlementStatus,
      isPaid,
      hasOutstandingBalance: (outstandingBalanceByUser.get(item.userId) ?? 0) > 0,
    })
    // Don't infer check-in without an actual attendance record
    // Cash payments without attendance linkage should show as "none", not assumed attended
    const checkInStatus = resolveCheckInStatus(resolvedAttendance?.status)
    const packageClassesUsedTotal = packageUsedOverrideByUser.get(item.userId)
      ?? (activePackage
        ? (activePackageClassesUsedById.get(activePackage.packagePurchaseId) || 0)
        : 0)
    const completedClassesTotal = completedOverrideByUser.get(item.userId)
      ?? (paymentsRequest.mode === "today"
        ? (completedClassesByUser.get(item.userId) || 0)
        : Math.max(completedClassesByUser.get(item.userId) || 0, packageClassesUsedTotal))

    return {
      id: purchase.id,
      userId: item.userId,
      courseSlug,
      courseTitle: purchase.courseTitle || courseSlug,
      customerName: resolveCanonicalName(
        clerkNameByUserId.get(item.userId),
        dbNameByUserId.get(item.userId),
        purchase.name,
      ),
      customerEmail: purchase.email || dbEmailByUserId.get(item.userId) || "—",
      customerPhone: purchase.phone || dbPhoneByUserId.get(item.userId) || "—",
      customerAvatarUrl: avatarByUserId.get(item.userId) || null,
      packageId: packageId || null,
      serviceId: serviceId || null,
       paymentChannel,
       purchaseCategory,
       amount: purchase.amount,
       currency: purchase.currency,
       paymentStatus,
       settlementStatus: normalizedSettlementStatus,
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
      checkInAt: resolvedAttendance?.checkedInAt ?? null,
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
        paymentsRequest.mode === "history" && linkedPackagePurchaseId && slotAttendance?.id
          ? packageClassNumberByUsageKey.get(`${linkedPackagePurchaseId}|${slotAttendance.id}`) ?? null
          : null,
      fundingPayment: linkedPackagePurchaseId ? fundingPurchaseByPackagePurchaseId.get(linkedPackagePurchaseId) || null : null,
      stripeFailure: isStripeFailureInfo((purchase.metadata as Record<string, unknown> | null)?.stripeFailure)
        ? ((purchase.metadata as Record<string, unknown>).stripeFailure as StripeFailureInfo)
        : null,
    }
  })

  const filtered = settlementFilter === "all" ? mapped : mapped.filter((item) => item.settlementStatus === settlementFilter)

  const summary = buildPaymentsSummary(filtered)

  if (paymentsRequest.mode === "history") {
      return NextResponse.json({
        items: filtered,
        summary,
        classOptions,
        meta: {
          mode: paymentsRequest.mode,
          from: paymentsRequest.historyRange.from,
          to: paymentsRequest.historyRange.to,
          truncated: historyTruncated,
        },
      })
  }

  return NextResponse.json({ items: filtered, summary })
}
