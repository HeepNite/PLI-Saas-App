import { NextResponse } from "next/server"
import { clerkClient } from "@clerk/nextjs/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { buildSessionStartsAt, getTodayNewYork } from "@/lib/class-schedule"
import { authorizeStaffPortalSectionRequest } from "@/lib/security/staff-portal-auth"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { isProvisionalStudentPinActive, isStudentPinLifecycleEnabled } from "@/lib/security/student-pin"
import type { ActivePackage, ProfileLatestClassAttended, StudentProfileCard } from "@/components/front/staff/historyCardAggregates"
import { resolveStudentIdentity, type ClerkUserData } from "@/app/api/staff/students/search/shared"
import {
  asObject,
  asText,
  attendanceSlotKey,
  buildLatestOpenPurchaseByUser,
  buildOutstandingBalanceByUser,
  isCompletedPaymentStatus,
  isPendingProcessablePurchase,
  normalizePaymentChannel,
  normalizePurchaseCategory,
  normalizeSettlementStatus,
  selectActivePackagesByUser,
  selectTodayCheckInByUser,
} from "@/app/api/staff/payments/shared"

export const runtime = "nodejs"

type MatchedUser = Awaited<ReturnType<typeof loadMatchedUsers>>[number]
type SearchPurchase = Awaited<ReturnType<typeof loadPurchases>>[number]
type TodayPurchase = Awaited<ReturnType<typeof loadTodayPurchases>>[number]
type LatestAttendanceRow = Awaited<ReturnType<typeof loadLatestAttendedRows>>[number]

const ATTENDED_STATUSES = ["checked_in", "checked_in_no_package", "checked_out"] as const
const TODAY_CHECKIN_STATUSES = ["checked_in", "checked_in_no_package", "checked_out", "scheduled"] as const

const userSelect = {
  id: true,
  clerkId: true,
  name: true,
  email: true,
  phone: true,
  createdAt: true,
  purchases: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: { name: true },
  },
} satisfies Prisma.UserSelect

const loadMatchedUsers = async (query: string, userId: string) => {
  if (query) {
    return prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
          { phone: { contains: query, mode: "insensitive" } },
        ],
      },
      select: userSelect,
      take: 50,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    })
  }

  if (!userId) return []

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: userSelect,
  })

  return user ? [user] : []
}

const buildClerkIdentityMap = async (users: MatchedUser[]) => {
  const clerkPairs = users
    .map((user) => ({
      userId: user.id,
      clerkId: asText(user.clerkId),
    }))
    .filter((user) => user.clerkId.length > 0)

  const clerkDataByUserId = new Map<string, ClerkUserData>()
  if (clerkPairs.length === 0) return clerkDataByUserId

  try {
    const client = await clerkClient()

    for (let start = 0; start < clerkPairs.length; start += 50) {
      const batch = clerkPairs.slice(start, start + 50)
      const clerkIds = batch.map((user) => user.clerkId)
      let clerkUsers = [] as Awaited<ReturnType<typeof client.users.getUserList>>["data"]

      try {
        const page = await client.users.getUserList({
          userId: clerkIds,
          limit: clerkIds.length,
        })
        clerkUsers = page.data
      } catch {
        clerkUsers = []
      }

      const clerkById = new Map(
        clerkUsers.map((user) => [
          user.id,
          {
            firstName: user.firstName,
            lastName: user.lastName,
            primaryEmailAddress: user.primaryEmailAddress
              ? { emailAddress: user.primaryEmailAddress.emailAddress }
              : null,
            primaryPhoneNumber: user.primaryPhoneNumber
              ? { phoneNumber: user.primaryPhoneNumber.phoneNumber }
              : null,
            imageUrl: user.imageUrl,
            hasImage: user.hasImage,
          } satisfies ClerkUserData,
        ])
      )

      for (const pair of batch) {
        const clerkData = clerkById.get(pair.clerkId)
        if (clerkData) {
          clerkDataByUserId.set(pair.userId, clerkData)
        }
      }
    }
  } catch {
    return clerkDataByUserId
  }

  return clerkDataByUserId
}

const buildPointsByUserId = async (userIds: string[]) => {
  if (userIds.length === 0) return new Map<string, number>()

  const rows = await prisma.pointsLedger.groupBy({
    by: ["userId"],
    where: { userId: { in: userIds } },
    _sum: { points: true },
  })

  return new Map(rows.map((row) => [row.userId, Math.round(row._sum.points ?? 0)]))
}

const loadPurchases = async (userIds: string[]) => {
  if (userIds.length === 0) return []

  return prisma.purchase.findMany({
    where: { userId: { in: userIds } },
    select: {
      id: true,
      userId: true,
      amount: true,
      status: true,
      metadata: true,
      createdAt: true,
      courseTitle: true,
      courseSlug: true,
      packageId: true,
      serviceId: true,
      packagePurchases: {
        select: {
          packageId: true,
        },
        take: 1,
      },
      stripePaymentIntentId: true,
      stripeCheckoutSessionId: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  })
}

const loadActivePackages = async (userIds: string[]) => {
  if (userIds.length === 0) return []

  return prisma.packagePurchase.findMany({
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
}

const loadLatestAttendedRows = async (userIds: string[]) => {
  if (userIds.length === 0) return []

  return prisma.attendance.findMany({
    where: {
      userId: { in: userIds },
      status: { in: [...ATTENDED_STATUSES] },
    },
    select: {
      id: true,
      userId: true,
      status: true,
      checkedInAt: true,
      checkedOutAt: true,
      session: {
        select: {
          courseSlug: true,
          title: true,
          startsAt: true,
          location: true,
        },
      },
    },
  })
}

const loadTodayPurchases = async (userIds: string[], todayNY: string) => {
  if (userIds.length === 0) return []

  return prisma.purchase.findMany({
    where: {
      userId: { in: userIds },
      metadata: { path: ["date"], equals: todayNY },
    },
    select: {
      id: true,
      userId: true,
      status: true,
      metadata: true,
      createdAt: true,
      courseSlug: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  })
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
    return [] as Array<{
      userId: string
      kind: string
      status: string
      expiresAt: Date | null
    }>
  }

  try {
    return await prisma.studentPinCredential.findMany({
      where: {
        userId: { in: userIds },
        kind: { in: ["permanent", "provisional"] },
      },
      select: {
        userId: true,
        kind: true,
        status: true,
        expiresAt: true,
      },
    })
  } catch (error) {
    if (isStudentPinSchemaUnavailableError(error)) {
      return []
    }
    throw error
  }
}

const toIso = (value: Date | null | undefined) => (value ? value.toISOString() : null)

const buildSelectedActivePackageByUser = (packages: Awaited<ReturnType<typeof loadActivePackages>>) => {
  return new Map(
    [...selectActivePackagesByUser(packages).entries()].map(([userId, pkg]) => [
      userId,
      {
        label: pkg.packageLabel || pkg.packageId,
        remainingCredits: pkg.isUnlimited ? null : pkg.remainingCredits ?? null,
        isUnlimited: pkg.isUnlimited,
        expiresAt: toIso(pkg.expiresAt),
      } satisfies ActivePackage,
    ])
  )
}

const isPackageCreditConsumptionPurchase = (purchase: SearchPurchase) => {
  const metadata = asObject(purchase.metadata)
  const paymentChannel = asText(metadata.paymentChannel || metadata.payment_channel).toLowerCase()
  return paymentChannel === "package_credit"
}

const resolvePurchaseCategoryInput = (purchase: SearchPurchase) => {
  const metadata = asObject(purchase.metadata)
  const linkedPackageId = purchase.packagePurchases?.[0]?.packageId || ""

  return {
    packageId: purchase.packageId || asText(metadata.packageId) || linkedPackageId,
    serviceId: purchase.serviceId || asText(metadata.serviceId),
  }
}

const isPurchaseNewer = (candidate: SearchPurchase, current: SearchPurchase | undefined) => {
  if (!current) return true
  const diff = candidate.createdAt.getTime() - current.createdAt.getTime()
  if (diff !== 0) return diff > 0
  return candidate.id.localeCompare(current.id) > 0
}

const isSettledCompletedPurchase = (purchase: SearchPurchase) => {
  if (!isCompletedPaymentStatus(purchase.status)) return false

  const paymentChannel = normalizePaymentChannel({
    metadata: purchase.metadata,
    status: purchase.status,
    stripePaymentIntentId: purchase.stripePaymentIntentId,
    stripeCheckoutSessionId: purchase.stripeCheckoutSessionId,
  })

  if (paymentChannel !== "cash") return true

  return normalizeSettlementStatus(asObject(purchase.metadata).settlementStatus) === "paid"
}

const buildLastSuccessfulPaymentByUser = (purchases: SearchPurchase[]) => {
  const lastSuccessfulByUser = new Map<string, SearchPurchase>()

  for (const purchase of purchases) {
    if (!isSettledCompletedPurchase(purchase)) continue
    if (normalizePurchaseCategory(resolvePurchaseCategoryInput(purchase)) === "other") continue
    if (isPackageCreditConsumptionPurchase(purchase)) continue

    const current = lastSuccessfulByUser.get(purchase.userId)
    if (isPurchaseNewer(purchase, current)) {
      lastSuccessfulByUser.set(purchase.userId, purchase)
    }
  }

  return lastSuccessfulByUser
}

const buildLatestPendingProcessablePurchaseByUser = (purchases: SearchPurchase[]) => {
  const latestPendingByUser = new Map<string, SearchPurchase>()

  for (const purchase of purchases) {
    if (!isPendingProcessablePurchase(purchase)) continue

    const current = latestPendingByUser.get(purchase.userId)
    if (isPurchaseNewer(purchase, current)) {
      latestPendingByUser.set(purchase.userId, purchase)
    }
  }

  return latestPendingByUser
}

const buildLatestPurchaseByUser = (purchases: SearchPurchase[]) => {
  const latestByUser = new Map<string, SearchPurchase>()

  for (const purchase of purchases) {
    const current = latestByUser.get(purchase.userId)
    if (isPurchaseNewer(purchase, current)) {
      latestByUser.set(purchase.userId, purchase)
    }
  }

  return latestByUser
}

const hasPermanentStudentPin = (credential: { kind: string; status: string }) => {
  if (credential.kind !== "permanent") return false
  return !["obsolete", "expired", "superseded", "consumed"].includes(credential.status)
}

const buildLatestClassAttendedByUser = (rows: LatestAttendanceRow[]) => {
  const sorted = [...rows].sort((a, b) => {
    const bySession = b.session.startsAt.getTime() - a.session.startsAt.getTime()
    if (bySession !== 0) return bySession

    const aActivity = Math.max(a.checkedOutAt?.getTime() || 0, a.checkedInAt.getTime())
    const bActivity = Math.max(b.checkedOutAt?.getTime() || 0, b.checkedInAt.getTime())
    if (aActivity !== bActivity) return bActivity - aActivity

    return b.id.localeCompare(a.id)
  })

  const latestByUser = new Map<string, ProfileLatestClassAttended>()
  for (const row of sorted) {
    if (latestByUser.has(row.userId)) continue
    latestByUser.set(row.userId, {
      courseTitle: row.session.title || row.session.courseSlug,
      courseSlug: row.session.courseSlug,
      startsAt: row.session.startsAt.toISOString(),
      location: row.session.location || null,
    })
  }

  return latestByUser
}

const buildLatestCheckInAtByUser = (rows: LatestAttendanceRow[]) => {
  const sorted = [...rows].sort((a, b) => {
    const bySession = b.session.startsAt.getTime() - a.session.startsAt.getTime()
    if (bySession !== 0) return bySession

    const aActivity = Math.max(a.checkedOutAt?.getTime() || 0, a.checkedInAt.getTime())
    const bActivity = Math.max(b.checkedOutAt?.getTime() || 0, b.checkedInAt.getTime())
    if (aActivity !== bActivity) return bActivity - aActivity

    return b.id.localeCompare(a.id)
  })

  const latestByUser = new Map<string, string>()
  for (const row of sorted) {
    if (latestByUser.has(row.userId)) continue
    latestByUser.set(row.userId, row.checkedInAt.toISOString())
  }

  return latestByUser
}

const buildTodayCheckInStatusByUser = async (todayPurchases: TodayPurchase[]) => {
  if (todayPurchases.length === 0) return new Map<string, StudentProfileCard["checkInStatus"]>()

  const candidates = todayPurchases
    .map((purchase) => {
      const metadata = asObject(purchase.metadata)
      const classDate = asText(metadata.date)
      const classTime = asText(metadata.time)
      const classStartsAt = classDate && classTime ? buildSessionStartsAt(classDate, classTime) : null

      return {
        purchase,
        metadata,
        classStartsAt,
      }
    })
    .filter((item) => item.classStartsAt && item.purchase.courseSlug)

  const userIds = [...new Set(candidates.map((item) => item.purchase.userId))]
  const courseSlugs = [...new Set(candidates.map((item) => item.purchase.courseSlug).filter(Boolean))]
  if (!candidates.length || !userIds.length || !courseSlugs.length) {
    return new Map<string, StudentProfileCard["checkInStatus"]>()
  }

  const starts = candidates.map((item) => item.classStartsAt!.getTime())
  const minStart = new Date(Math.min(...starts) - 60 * 60 * 1000)
  const maxStart = new Date(Math.max(...starts) + 60 * 60 * 1000)
  const attendances = await prisma.attendance.findMany({
    where: {
      userId: { in: userIds },
      session: {
        courseSlug: { in: courseSlugs },
        startsAt: { gte: minStart, lte: maxStart },
      },
    },
    select: {
      id: true,
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

  const attendanceBySlot = new Map<string, { status: StudentProfileCard["checkInStatus"]; checkedInAt: string }>()
  for (const attendance of attendances) {
    if (!TODAY_CHECKIN_STATUSES.includes(attendance.status as (typeof TODAY_CHECKIN_STATUSES)[number])) continue

    const key = attendanceSlotKey(attendance.userId, attendance.session.courseSlug, attendance.session.startsAt.getTime())
    const current = attendanceBySlot.get(key)
    const checkedInAt = attendance.checkedInAt.toISOString()
    if (!current || current.checkedInAt < checkedInAt) {
      attendanceBySlot.set(key, {
        status: attendance.status as StudentProfileCard["checkInStatus"],
        checkedInAt,
      })
    }
  }

  const preferredByUser = selectTodayCheckInByUser(
    candidates.map((item) => {
      const slotKey = attendanceSlotKey(item.purchase.userId, item.purchase.courseSlug!, item.classStartsAt!.getTime())
      const matchedAttendance = attendanceBySlot.get(slotKey)
      const paymentChannel = normalizePaymentChannel({
        metadata: item.purchase.metadata,
        status: item.purchase.status,
        stripePaymentIntentId: null,
        stripeCheckoutSessionId: null,
      })

      return {
        userId: item.purchase.userId,
        status: matchedAttendance?.status || (paymentChannel === "cash" ? "checked_in_no_package" : "none"),
        startsAt: item.classStartsAt?.toISOString() || null,
        purchaseCreatedAt: item.purchase.createdAt.toISOString(),
      }
    })
  )

  return new Map([...preferredByUser.entries()].map(([userId, candidate]) => [userId, candidate.status]))
}

const buildStudentProfileCards = async (users: MatchedUser[]): Promise<StudentProfileCard[]> => {
  const userIds = users.map((user) => user.id)
  const todayNY = getTodayNewYork()
  const [
    clerkDataByUserId,
    pointsByUserId,
    purchases,
    activePackages,
    latestAttendedRows,
    pinCredentials,
    todayPurchases,
  ] = await Promise.all([
    buildClerkIdentityMap(users),
    buildPointsByUserId(userIds),
    loadPurchases(userIds),
    loadActivePackages(userIds),
    loadLatestAttendedRows(userIds),
    loadStudentPinCredentials(userIds),
    loadTodayPurchases(userIds, todayNY),
  ])

  const [todayCheckInStatusByUser, activePackageByUser] = await Promise.all([
    buildTodayCheckInStatusByUser(todayPurchases),
    Promise.resolve(buildSelectedActivePackageByUser(activePackages)),
  ])

  const lastSuccessfulPaymentByUser = buildLastSuccessfulPaymentByUser(purchases)
  const latestPurchaseByUser = buildLatestPurchaseByUser(purchases)
  const latestPendingProcessablePurchaseByUser = buildLatestPendingProcessablePurchaseByUser(purchases)
  const latestOpenPurchaseByUser = buildLatestOpenPurchaseByUser(purchases)
  const outstandingBalanceByUser = buildOutstandingBalanceByUser(purchases)
  const latestClassAttendedByUser = buildLatestClassAttendedByUser(latestAttendedRows)
  const latestCheckInAtByUser = buildLatestCheckInAtByUser(latestAttendedRows)
  const provisionalPinByUser = new Map<string, string>()
  const permanentPinByUser = new Set<string>()

  for (const credential of pinCredentials) {
    if (isProvisionalStudentPinActive(credential)) {
      if (!credential.expiresAt) continue
      if (!provisionalPinByUser.has(credential.userId)) {
        provisionalPinByUser.set(credential.userId, credential.expiresAt.toISOString())
      }
      continue
    }

    if (hasPermanentStudentPin(credential)) {
      permanentPinByUser.add(credential.userId)
    }
  }

  return users.map((user) => {
    const identity = resolveStudentIdentity(
      {
        name: user.name,
        email: user.email,
        phone: user.phone,
        purchases: user.purchases,
      },
      clerkDataByUserId.get(user.id) || null
    )
    const activePackage = activePackageByUser.get(user.id) || null
    const lastPayment = lastSuccessfulPaymentByUser.get(user.id)
    const lastPaymentPurchaseCategory = lastPayment
      ? normalizePurchaseCategory(resolvePurchaseCategoryInput(lastPayment))
      : null
    const latestPurchase = latestPurchaseByUser.get(user.id)
    const latestPendingProcessablePurchase = latestPendingProcessablePurchaseByUser.get(user.id)
    const latestOpenPurchase = latestOpenPurchaseByUser.get(user.id)
    const outstandingBalance = outstandingBalanceByUser.get(user.id)
    const provisionalPinExpiresAt = provisionalPinByUser.get(user.id)
    const pinStatus = provisionalPinExpiresAt
      ? "provisional"
      : permanentPinByUser.has(user.id)
        ? "enrolled"
        : "none"

    return {
      source: "profile",
      key: user.id,
      userId: user.id,
      displayName: identity.displayName,
      email: identity.email,
      phone: identity.phone,
      avatarUrl: identity.avatarUrl,
      registeredAt: user.createdAt.toISOString(),
      checkInStatus: todayCheckInStatusByUser.get(user.id) || "none",
      latestClassAttended: latestClassAttendedByUser.get(user.id) || null,
      latestCheckInAt: latestCheckInAtByUser.get(user.id) || null,
      lastPayment: lastPayment && lastPaymentPurchaseCategory && lastPaymentPurchaseCategory !== "other"
        ? (() => {
            const channel = normalizePaymentChannel({
              metadata: lastPayment.metadata,
              status: lastPayment.status,
              stripePaymentIntentId: lastPayment.stripePaymentIntentId,
              stripeCheckoutSessionId: lastPayment.stripeCheckoutSessionId,
            })
            return {
              date: lastPayment.createdAt.toISOString(),
              amountCents: lastPayment.amount,
              purchaseCategory: lastPaymentPurchaseCategory,
              courseTitle: lastPayment.courseTitle,
              paymentChannel: channel === "package_credit" ? "unknown" as const : channel,
            }
          })()
        : null,
      lastCourse: latestPurchase
        ? {
            courseTitle: latestPurchase.courseTitle,
            courseSlug: latestPurchase.courseSlug,
          }
        : null,
      paymentStatus: latestPurchase?.status || null,
      activePackage,
      remainingCredits: activePackage?.remainingCredits ?? null,
      outstandingBalance: typeof outstandingBalance === "number" && outstandingBalance > 0 ? outstandingBalance : null,
      pinStatus,
      cashSettlement: latestPendingProcessablePurchase
        ? {
            paymentId: latestPendingProcessablePurchase.id,
            settlementStatus: normalizeSettlementStatus(asObject(latestPendingProcessablePurchase.metadata).settlementStatus),
            settlementNote: asText(asObject(latestPendingProcessablePurchase.metadata).settlementNote),
          }
        : null,
      pendingSettlement: !latestPendingProcessablePurchase && latestOpenPurchase
        ? {
            paymentId: latestOpenPurchase.id,
            settlementStatus: normalizeSettlementStatus(asObject(latestOpenPurchase.metadata).settlementStatus),
            settlementNote: asText(asObject(latestOpenPurchase.metadata).settlementNote),
          }
        : null,
      pointsBalance: pointsByUserId.get(user.id) ?? 0,
      ...(provisionalPinExpiresAt ? { provisionalPinExpiresAt } : {}),
    } satisfies StudentProfileCard
  })
}

export async function GET(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:students:search:get", getClientIp(req)),
    limit: 60,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  const authResult = await authorizeStaffPortalSectionRequest("students")
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const url = new URL(req.url)
  const rawQuery = url.searchParams.get("q")
  const query = asText(rawQuery)
  const userId = asText(url.searchParams.get("userId"))

  if (rawQuery !== null && query.length < 2) {
    return NextResponse.json({ error: "Query too short", minLength: 2 }, { status: 400 })
  }

  if (query.length > 100) {
    return NextResponse.json({ error: "Query too long", maxLength: 100 }, { status: 400 })
  }

  if (!query && !userId) {
    return NextResponse.json({ error: "Missing search parameter" }, { status: 400 })
  }

  try {
    const matchedUsers = await loadMatchedUsers(query, userId)
    if (matchedUsers.length === 0) {
      return NextResponse.json({ results: [] satisfies StudentProfileCard[] })
    }

    const results = await buildStudentProfileCards(matchedUsers)
    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
