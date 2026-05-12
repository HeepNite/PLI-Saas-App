import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { reservePackageCreditForAttendance, syncPackagePurchaseFromPaidPurchase } from "@/lib/packages"
import { buildSessionStartsAt } from "@/lib/class-schedule"
import { authorizeStaffPortalSectionRequest } from "@/lib/security/staff-portal-auth"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { asObject, asText, normalizePaymentChannel } from "@/app/api/staff/payments/shared"

export const runtime = "nodejs"

type SettlementAction = "mark_paid" | "mark_pending"

const parseSettlementAction = (value: unknown): SettlementAction | null => {
  if (value === "mark_paid" || value === "mark_pending") return value
  return null
}

const normalizePurchaseIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item): item is string => typeof item === "string" && item.trim().length > 0))]
}

const buildSettlementMetadata = (input: {
  metadata: Prisma.JsonValue | null
  settlementStatus: "paid" | "pending"
  settledAt: string | null
  settlementUpdatedBy: string
}): Prisma.InputJsonObject => ({
  ...asObject(input.metadata),
  settlementStatus: input.settlementStatus,
  settledAt: input.settledAt,
  settlementUpdatedBy: input.settlementUpdatedBy,
})

const isCashPurchase = (input: {
  metadata: Prisma.JsonValue | null
  status: string
  stripePaymentIntentId: string | null
  stripeCheckoutSessionId: string | null
}) => {
  return (
    normalizePaymentChannel({
      metadata: input.metadata,
      status: input.status,
      stripePaymentIntentId: input.stripePaymentIntentId,
      stripeCheckoutSessionId: input.stripeCheckoutSessionId,
    }) === "cash"
  )
}

export async function POST(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:payments:bulk-post", getClientIp(req)),
    limit: 40,
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

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const payload = body as Record<string, unknown>
  const action = parseSettlementAction(payload.action)
  if (!action) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }

  const ids = normalizePurchaseIds(payload.ids)
  if (ids.length === 0) {
    return NextResponse.json({ error: "No purchases selected" }, { status: 400 })
  }
  if (ids.length > 500) {
    return NextResponse.json({ error: "Too many purchases in one bulk request" }, { status: 400 })
  }

  const purchases = await prisma.purchase.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      userId: true,
      courseSlug: true,
      courseTitle: true,
      packageId: true,
      amount: true,
      status: true,
      createdAt: true,
      metadata: true,
      stripePaymentIntentId: true,
      stripeCheckoutSessionId: true,
    },
  })

  if (purchases.length === 0) {
    return NextResponse.json({ ok: true, updatedCount: 0 })
  }

  const settlementStatus = action === "mark_paid" ? "paid" : "pending"
  const settledAt = settlementStatus === "paid" ? new Date().toISOString() : null
  const nextCashPurchaseStatus = settlementStatus === "paid" ? "paid" : "pending"

  // When marking as paid, fetch drop-in prices for purchases with amount = 0
  let courseDropInPrices = new Map<string, number>()
  if (action === "mark_paid") {
    const zeroAmountPurchases = purchases.filter((p) => p.amount === 0 && p.courseSlug)
    const courseSlugs = [...new Set(zeroAmountPurchases.map((p) => p.courseSlug).filter(Boolean))] as string[]
    if (courseSlugs.length > 0) {
      const courses = await prisma.courseCatalog.findMany({
        where: { slug: { in: courseSlugs } },
        select: { slug: true, dropInPriceCents: true },
      })
      courseDropInPrices = new Map(
        courses.filter((c) => c.dropInPriceCents !== null).map((c) => [c.slug, c.dropInPriceCents!])
      )
    }
  }

  await prisma.$transaction(
    purchases.map((purchase) => {
      const nextMetadata = buildSettlementMetadata({
        metadata: purchase.metadata,
        settlementStatus,
        settledAt,
        settlementUpdatedBy: authResult.userId,
      })
      const data: Prisma.PurchaseUpdateInput = { metadata: nextMetadata }
      if (isCashPurchase(purchase)) {
        data.status = nextCashPurchaseStatus
      }
      // Fix zero-amount purchases when marking as paid
      if (action === "mark_paid" && purchase.amount === 0 && purchase.courseSlug) {
        const dropInPrice = courseDropInPrices.get(purchase.courseSlug)
        if (dropInPrice && dropInPrice > 0) {
          data.amount = dropInPrice
        }
      }
      return prisma.purchase.update({
        where: { id: purchase.id },
        data,
      })
    })
  )

  let syncedPackageCount = 0
  let packageCreditReservedCount = 0
  if (action === "mark_paid") {
    for (const purchase of purchases) {
      if (!purchase.userId || !isCashPurchase(purchase)) continue
      const metadata = asObject(purchase.metadata)
      let resolvedAttendanceId = asText(metadata.attendanceId) || ""

      // Create Attendance record for cash drop-in when marked as paid
      const existingAttendanceId = asText(metadata.attendanceId)
      if (!existingAttendanceId) {
        const classDate = asText(metadata.date)
        const classTime = asText(metadata.time)
        const courseSlug = purchase.courseSlug || asText(metadata.courseSlug)

        if (classDate && classTime && courseSlug) {
          const startsAt = buildSessionStartsAt(classDate, classTime)
          if (startsAt) {
            try {
              const now = new Date()
              const session = await prisma.classSession.upsert({
                where: {
                  courseSlug_startsAt: { courseSlug, startsAt },
                },
                update: {},
                create: {
                  courseSlug,
                  title: purchase.courseTitle || courseSlug,
                  startsAt,
                },
              })

              const attendance = await prisma.attendance.upsert({
                where: {
                  userId_sessionId: { userId: purchase.userId, sessionId: session.id },
                },
                update: {},
                create: {
                  userId: purchase.userId,
                  sessionId: session.id,
                  status: "checked_in_no_package",
                  checkedInAt: now,
                  metadata: {
                    source: "cash_settlement",
                    date: classDate,
                    time: classTime,
                  },
                },
              })

              // Link attendance ID to purchase metadata
              await prisma.purchase.update({
                where: { id: purchase.id },
                data: {
                  metadata: {
                    ...buildSettlementMetadata({
                      metadata: purchase.metadata,
                      settlementStatus,
                      settledAt,
                      settlementUpdatedBy: authResult.userId,
                    }),
                    attendanceId: attendance.id,
                  },
                },
              })
              resolvedAttendanceId = attendance.id
            } catch (error) {
              console.warn("Unable to create attendance for cash settlement", {
                purchaseId: purchase.id,
                error: error instanceof Error ? error.message : String(error),
              })
            }
          }
        }
      }

      const packageId = purchase.packageId || asText(metadata.packageId)
      if (!packageId) continue
      try {
        const synced = await syncPackagePurchaseFromPaidPurchase({
          userId: purchase.userId,
          purchaseId: purchase.id,
          purchasedAt: purchase.createdAt,
          source: "cash",
          metadata: {
            courseSlug: purchase.courseSlug || asText(metadata.courseSlug),
            packageId,
            packageLabel: asText(metadata.packageLabel),
            packageTotalCredits: asText(metadata.packageTotalCredits),
            packageIsUnlimited: asText(metadata.packageIsUnlimited),
            packageCadence: asText(metadata.packageCadence),
            packageMakeUps: asText(metadata.packageMakeUps),
            packageValidDays: asText(metadata.packageValidDays),
          },
        })
        if (synced) syncedPackageCount += 1
        if (synced?.id && resolvedAttendanceId) {
          try {
            const reserved = await reservePackageCreditForAttendance({
              packagePurchaseId: synced.id,
              userId: purchase.userId,
              attendanceId: resolvedAttendanceId,
              courseSlug: purchase.courseSlug || asText(metadata.courseSlug),
              at: purchase.createdAt,
              reason: "PACKAGE_INITIAL_BOOKING",
            })
            if (reserved) packageCreditReservedCount += 1
          } catch (error) {
            console.warn("Unable to reserve package credit after bulk cash settlement", {
              purchaseId: purchase.id,
              packagePurchaseId: synced.id,
              attendanceId: resolvedAttendanceId,
              error: error instanceof Error ? error.message : String(error),
            })
          }
        }
      } catch (error) {
        console.warn("Unable to sync package purchase after cash settlement", {
          purchaseId: purchase.id,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  return NextResponse.json({
    ok: true,
    updatedCount: purchases.length,
    settlementStatus,
    syncedPackageCount,
    packageCreditReservedCount,
  })
}
