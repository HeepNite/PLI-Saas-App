import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { reservePackageCreditForAttendance, syncPackagePurchaseFromPaidPurchase } from "@/lib/packages"
import { buildSessionStartsAt } from "@/lib/class-schedule"
import { authorizeStaffPortalSectionRequest } from "@/lib/security/staff-portal-auth"
import { withStaffGuard } from "@/lib/security/with-staff-guard"
import { asObject, asText, isCompletedPaymentStatus, normalizePaymentChannel } from "@/app/api/staff/payments/shared"

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

const isSettledCashPurchase = (input: { metadata: Prisma.JsonValue | null }) => {
  const settlementStatus = asText(asObject(input.metadata).settlementStatus).toLowerCase()
  return settlementStatus === "paid"
}

// mark_paid also covers unpaid bookings that never started any payment
// (channel "unknown"): staff collected the money in cash, so the purchase
// converts to a settled cash purchase. Rows with Stripe evidence stay on the
// Stripe path (a live intent could still complete and double-charge), and
// mark_pending stays cash-only because only cash settlements can be reverted.
const resolveBulkEligibility = (
  purchase: {
    metadata: Prisma.JsonValue | null
    status: string
    stripePaymentIntentId: string | null
    stripeCheckoutSessionId: string | null
  },
  action: SettlementAction
): "cash" | "convert_to_cash" | null => {
  const channel = normalizePaymentChannel({
    metadata: purchase.metadata,
    status: purchase.status,
    stripePaymentIntentId: purchase.stripePaymentIntentId,
    stripeCheckoutSessionId: purchase.stripeCheckoutSessionId,
  })
  if (channel === "cash") return "cash"
  if (action !== "mark_paid") return null
  if (channel !== "unknown") return null
  return isCompletedPaymentStatus(purchase.status) ? null : "convert_to_cash"
}

const buildPackageSyncMetadata = (input: {
  purchase: { courseSlug: string | null }
  metadata: Record<string, unknown>
}) => ({
  courseSlug: input.purchase.courseSlug || asText(input.metadata.courseSlug),
  packageId: asText(input.metadata.packageId),
  packageLabel: asText(input.metadata.packageLabel),
  packageTotalCredits: asText(input.metadata.packageTotalCredits),
  packageIsUnlimited: asText(input.metadata.packageIsUnlimited),
  packageCadence: asText(input.metadata.packageCadence),
  packageMakeUps: asText(input.metadata.packageMakeUps),
  packageValidDays: asText(input.metadata.packageValidDays),
})

type BulkPurchase = {
  id: string
  userId: string | null
  courseSlug: string | null
  courseTitle: string | null
  metadata: Prisma.JsonValue | null
}

const resolveAttendanceIdForCashSettlement = async (input: {
  purchase: BulkPurchase
  metadata: Record<string, unknown>
  settlementStatus: "paid" | "pending"
  settledAt: string | null
  settlementUpdatedBy: string
}) => {
  const existingAttendanceId = asText(input.metadata.attendanceId)
  if (existingAttendanceId) return existingAttendanceId
  if (!input.purchase.userId) return ""

  const classDate = asText(input.metadata.date)
  const classTime = asText(input.metadata.time)
  const courseSlug = input.purchase.courseSlug || asText(input.metadata.courseSlug)

  // Skip sentinel slugs like _staff_registration (registration deposits, not class enrollments)
  if (!classDate || !classTime || !courseSlug || courseSlug.startsWith("_")) return ""

  const startsAt = buildSessionStartsAt(classDate, classTime)
  if (!startsAt) return ""

  try {
    const now = new Date()
    const session = await prisma.classSession.upsert({
      where: {
        courseSlug_startsAt: { courseSlug, startsAt },
      },
      update: {},
      create: {
        courseSlug,
        title: input.purchase.courseTitle || courseSlug,
        startsAt,
      },
    })

    const attendance = await prisma.attendance.upsert({
      where: {
        userId_sessionId: { userId: input.purchase.userId, sessionId: session.id },
      },
      update: {},
      create: {
        userId: input.purchase.userId,
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

    await prisma.purchase.update({
      where: { id: input.purchase.id },
      data: {
        metadata: {
          ...buildSettlementMetadata({
            metadata: input.purchase.metadata,
            settlementStatus: input.settlementStatus,
            settledAt: input.settledAt,
            settlementUpdatedBy: input.settlementUpdatedBy,
          }),
          attendanceId: attendance.id,
        },
      },
    })
    return attendance.id
  } catch (error) {
    console.warn("Unable to create attendance for cash settlement", {
      purchaseId: input.purchase.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return ""
  }
}

export async function POST(req: Request) {
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:payments:bulk-post", limit: 40, windowMs: 60_000 },
    authorize: () => authorizeStaffPortalSectionRequest("students"),
  })
  if (!guard.ok) return guard.response
  const authResult = guard.auth

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

  const settlementStatus = action === "mark_paid" ? "paid" : "pending"
  const settledAt = settlementStatus === "paid" ? new Date().toISOString() : null
  const nextCashPurchaseStatus = settlementStatus === "paid" ? "paid" : "pending"
  const purchasesById = new Map(purchases.map((purchase) => [purchase.id, purchase]))
  const skipped: Array<{ id: string; reason: "not_found" | "not_cash" | "already_settled" }> = []
  const convertToCashIds = new Set<string>()
  const eligiblePurchases = ids.flatMap((id) => {
    const purchase = purchasesById.get(id)
    if (!purchase) {
      skipped.push({ id, reason: "not_found" })
      return []
    }
    const eligibility = resolveBulkEligibility(purchase, action)
    if (!eligibility) {
      skipped.push({ id, reason: "not_cash" })
      return []
    }
    if (action === "mark_paid" && isSettledCashPurchase(purchase)) {
      skipped.push({ id, reason: "already_settled" })
      return []
    }
    if (eligibility === "convert_to_cash") convertToCashIds.add(purchase.id)
    return [purchase]
  })

  // When marking as paid, fetch drop-in prices for purchases with amount = 0
  let courseDropInPrices = new Map<string, number>()
  if (action === "mark_paid") {
    const zeroAmountPurchases = eligiblePurchases.filter((p) => p.amount === 0 && p.courseSlug)
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
    eligiblePurchases.map((purchase) => {
      const isConversion = convertToCashIds.has(purchase.id)
      const nextMetadata: Prisma.InputJsonObject = {
        ...buildSettlementMetadata({
          metadata: purchase.metadata,
          settlementStatus,
          settledAt,
          settlementUpdatedBy: authResult.userId,
        }),
        ...(isConversion ? { paymentChannel: "cash" } : {}),
      }
      const data: Prisma.PurchaseUpdateInput = { metadata: nextMetadata }
      if (isConversion || isCashPurchase(purchase)) {
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
    for (const purchase of eligiblePurchases) {
      if (!purchase.userId) continue
      const metadata = asObject(purchase.metadata)
      const resolvedAttendanceId = await resolveAttendanceIdForCashSettlement({
        purchase,
        metadata,
        settlementStatus,
        settledAt,
        settlementUpdatedBy: authResult.userId,
      })

      const packageSyncMetadata = buildPackageSyncMetadata({ purchase, metadata })
      const packageId = purchase.packageId || packageSyncMetadata.packageId
      if (!packageId) continue
      try {
        const synced = await syncPackagePurchaseFromPaidPurchase({
          userId: purchase.userId,
          purchaseId: purchase.id,
          purchasedAt: purchase.createdAt,
          source: "cash",
          metadata: {
            ...packageSyncMetadata,
            packageId,
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
    updatedCount: eligiblePurchases.length,
    skipped,
    settlementStatus,
    syncedPackageCount,
    packageCreditReservedCount,
  })
}
