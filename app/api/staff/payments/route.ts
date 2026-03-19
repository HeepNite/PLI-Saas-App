import { NextResponse } from "next/server"
import { clerkClient } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { authorizeStaffPortalSectionRequest } from "@/lib/security/staff-portal-auth"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { buildSessionStartsAt } from "@/lib/class-schedule"

export const runtime = "nodejs"

type SettlementStatus = "pending" | "paid"
type CheckInStatus = "checked_in" | "checked_in_no_package" | "scheduled" | "none"

const COMPLETED_PAYMENT_STATUSES = new Set(["succeeded", "paid", "completed"])

const asObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

const normalizeSettlementStatus = (value: unknown): SettlementStatus => {
  if (typeof value !== "string") return "pending"
  return value.toLowerCase() === "paid" ? "paid" : "pending"
}

const asText = (value: unknown) => (typeof value === "string" ? value.trim() : "")

const normalizePaymentChannel = (input: {
  metadata: Record<string, unknown>
  status: string
  stripePaymentIntentId: string | null
  stripeCheckoutSessionId: string | null
}) => {
  const paymentChannelRaw = asText(input.metadata.paymentChannel || input.metadata.payment_channel).toLowerCase()
  if (paymentChannelRaw === "cash") return "cash" as const
  if (paymentChannelRaw === "card" || paymentChannelRaw === "stripe") return "card" as const

  if (input.stripePaymentIntentId || input.stripeCheckoutSessionId) return "card" as const

  const methodRaw = asText(input.metadata.paymentMethod || input.metadata.payment_method || input.metadata.paymentMode).toLowerCase()
  const sourceRaw = asText(input.metadata.source).toLowerCase()
  if (
    methodRaw.includes("cash") ||
    methodRaw.includes("onsite") ||
    methodRaw.includes("on_site") ||
    sourceRaw === "cash_checkout" ||
    sourceRaw === "on_site_checkout"
  ) {
    return "cash" as const
  }

  const normalizedStatus = (input.status || "").toLowerCase()
  if (COMPLETED_PAYMENT_STATUSES.has(normalizedStatus)) return "card" as const
  if (normalizedStatus.includes("cash") || normalizedStatus.includes("onsite") || normalizedStatus.includes("on_site")) return "cash" as const
  return "unknown" as const
}

const normalizePurchaseCategory = (input: { packageId: string; serviceId: string }) => {
  if (input.packageId) return "package" as const
  if (input.serviceId) return "dropin" as const
  return "other" as const
}

const toDateIso = (value: unknown) => {
  if (typeof value !== "string" && typeof value !== "number") return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

const attendanceSlotKey = (userId: string, courseSlug: string, startsAtMs: number) => `${userId}|${courseSlug}|${startsAtMs}`

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

  const where = query
    ? {
        OR: [
          { email: { contains: query, mode: "insensitive" as const } },
          { name: { contains: query, mode: "insensitive" as const } },
          { courseTitle: { contains: query, mode: "insensitive" as const } },
          { courseSlug: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : undefined

  const purchases = await prisma.purchase.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  })

  const enrichedPurchases = purchases.map((purchase) => {
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

  const userIds = [...new Set(enrichedPurchases.map((item) => item.userId).filter(Boolean))]
  const courseSlugs = [...new Set(enrichedPurchases.map((item) => item.purchase.courseSlug).filter(Boolean))]

  const [pointsGrouped, pointsEntries, activePackages, locations, slotAttendances, purchaseUsers] = await Promise.all([
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
            userId: true,
            packageId: true,
            packageLabel: true,
            remainingCredits: true,
            isUnlimited: true,
            expiresAt: true,
            lastUsedAt: true,
            purchasedAt: true,
            status: true,
          },
        })
      : Promise.resolve([]),
    courseSlugs.length
      ? prisma.courseCatalog.findMany({
          where: { slug: { in: courseSlugs } },
          select: { slug: true, location: true },
        })
      : Promise.resolve([]),
    (() => {
      const withSlot = enrichedPurchases.filter((item) => item.classStartsAt)
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
        select: {
          userId: true,
          status: true,
          checkedInAt: true,
          session: {
            select: {
              courseSlug: true,
              startsAt: true,
            },
          },
        },
      })
    })(),
    userIds.length
      ? prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, clerkId: true },
        })
      : Promise.resolve([]),
  ])

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

  const activePackageByUser = new Map<
    string,
    {
      packageId: string
      packageLabel: string | null
      remainingCredits: number | null
      isUnlimited: boolean
      expiresAt: string | null
      status: string
    }
  >()
  for (const pkg of [...activePackages].sort((a, b) => {
    const aUsed = a.lastUsedAt ? a.lastUsedAt.getTime() : 0
    const bUsed = b.lastUsedAt ? b.lastUsedAt.getTime() : 0
    if (aUsed !== bUsed) return bUsed - aUsed
    return b.purchasedAt.getTime() - a.purchasedAt.getTime()
  })) {
    if (activePackageByUser.has(pkg.userId)) continue
    activePackageByUser.set(pkg.userId, {
      packageId: pkg.packageId,
      packageLabel: pkg.packageLabel,
      remainingCredits: pkg.remainingCredits,
      isUnlimited: pkg.isUnlimited,
      expiresAt: pkg.expiresAt ? pkg.expiresAt.toISOString() : null,
      status: pkg.status,
    })
  }

  const courseLocationBySlug = new Map<string, string | null>()
  for (const row of locations) {
    courseLocationBySlug.set(row.slug, row.location || null)
  }

  const attendanceBySlot = new Map<
    string,
    {
      status: string
      checkedInAt: string
    }
  >()
  for (const row of slotAttendances) {
    const key = attendanceSlotKey(row.userId, row.session.courseSlug, row.session.startsAt.getTime())
    const current = attendanceBySlot.get(key)
    const nextCheckedInAt = row.checkedInAt.toISOString()
    if (!current || current.checkedInAt < nextCheckedInAt) {
      attendanceBySlot.set(key, {
        status: row.status,
        checkedInAt: nextCheckedInAt,
      })
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

  const mapped = enrichedPurchases.map((item) => {
    const purchase = item.purchase
    const courseSlug = purchase.courseSlug
    const slotKey =
      item.classStartsAt && courseSlug
        ? attendanceSlotKey(item.userId, courseSlug, item.classStartsAt.getTime())
        : null
    const slotAttendance = slotKey ? attendanceBySlot.get(slotKey) : null
    const activePackage = activePackageByUser.get(item.userId)
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
    const isPaid = COMPLETED_PAYMENT_STATUSES.has(paymentStatus.toLowerCase())
    const inferredCashCheckIn = !slotAttendance && paymentChannel === "cash"
    const checkInStatus: CheckInStatus =
      slotAttendance?.status === "checked_in" ||
      slotAttendance?.status === "checked_in_no_package" ||
      slotAttendance?.status === "scheduled"
        ? (slotAttendance.status as CheckInStatus)
        : inferredCashCheckIn
          ? "checked_in_no_package"
        : "none"

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
      checkInStatus,
      checkInAt: slotAttendance?.checkedInAt || (inferredCashCheckIn ? purchase.createdAt.toISOString() : null),
      activePackage: activePackage
        ? {
            id: activePackage.packageId,
            label: activePackage.packageLabel || activePackage.packageId,
            remainingCredits: activePackage.remainingCredits,
            isUnlimited: activePackage.isUnlimited,
            expiresAt: activePackage.expiresAt,
            status: activePackage.status,
          }
        : null,
    }
  })

  const filtered = settlementFilter === "all" ? mapped : mapped.filter((item) => item.settlementStatus === settlementFilter)

  const summary = {
    totalItems: filtered.length,
    totalCollected: filtered
      .filter((item) => COMPLETED_PAYMENT_STATUSES.has(item.paymentStatus.toLowerCase()))
      .reduce((sum, item) => sum + item.amount, 0),
    pendingSettlement: filtered.filter((item) => item.paymentChannel === "cash" && item.settlementStatus === "pending").length,
    paidSettlement: filtered.filter((item) => item.paymentChannel === "cash" && item.settlementStatus === "paid").length,
    pendingStripe: filtered.filter((item) => !item.classPaid).length,
    paidStripe: filtered.filter((item) => item.classPaid).length,
  }

  return NextResponse.json({ items: filtered, summary })
}
