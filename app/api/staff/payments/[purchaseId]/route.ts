import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { reservePackageCreditForAttendance, syncPackagePurchaseFromPaidPurchase } from "@/lib/packages"
import { writeStudentDataAudit } from "@/lib/audit/student-data-audit"
import { buildSessionStartsAt } from "@/lib/class-schedule"
import { authorizeStaffPortalSectionRequest } from "@/lib/security/staff-portal-auth"
import { getClientIp } from "@/lib/security/rate-limit"
import { withStaffGuard } from "@/lib/security/with-staff-guard"
import { asObject as asObjectShared, asText } from "@/lib/shared"

export const runtime = "nodejs"

type SettlementAction = "mark_paid" | "mark_pending"

const asObject = (value: Prisma.JsonValue | null): Prisma.JsonObject =>
  asObjectShared(value) as Prisma.JsonObject

const isCashPurchase = (input: {
  metadata: Prisma.JsonValue | null
  status: string
  stripePaymentIntentId: string | null
  stripeCheckoutSessionId: string | null
}) => {
  const metadata = asObject(input.metadata)
  const paymentChannel = asText(metadata.paymentChannel || metadata.payment_channel).toLowerCase()
  if (paymentChannel === "cash") return true

  const methodRaw = asText(metadata.paymentMethod || metadata.payment_method || metadata.paymentMode).toLowerCase()
  if (methodRaw.includes("cash") || methodRaw.includes("onsite") || methodRaw.includes("on_site")) return true

  if (input.stripePaymentIntentId || input.stripeCheckoutSessionId) return false
  const statusRaw = (input.status || "").toLowerCase()
  return statusRaw.includes("cash") || statusRaw.includes("onsite") || statusRaw.includes("on_site")
}

export async function PATCH(req: Request, context: { params: Promise<{ purchaseId: string }> }) {
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:payments:patch", limit: 90, windowMs: 60_000 },
    authorize: () => authorizeStaffPortalSectionRequest("students"),
  })
  if (!guard.ok) return guard.response
  const authResult = guard.auth

  const { purchaseId } = await context.params
  if (!purchaseId) {
    return NextResponse.json({ error: "Missing purchaseId" }, { status: 400 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const payload = body as Record<string, unknown>
  const action = typeof payload.action === "string" ? (payload.action as SettlementAction) : ""
  if (!["mark_paid", "mark_pending"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }

  const note = typeof payload.note === "string" ? payload.note.trim().slice(0, 300) : ""
  const purchase = await prisma.purchase.findUnique({ where: { id: purchaseId } })
  if (!purchase) {
    return NextResponse.json({ error: "Purchase not found" }, { status: 404 })
  }

  const metadata = asObject(purchase.metadata)
  const settlementStatus = action === "mark_paid" ? "paid" : "pending"
  const previousSettlementNote = typeof metadata.settlementNote === "string" ? metadata.settlementNote : ""
  const nextMetadata: Prisma.InputJsonObject = {
    ...metadata,
    settlementStatus,
    settledAt: settlementStatus === "paid" ? new Date().toISOString() : null,
    settlementUpdatedBy: authResult.userId,
    settlementNote: note || previousSettlementNote,
  }
  const data: Prisma.PurchaseUpdateInput = { metadata: nextMetadata }
  if (isCashPurchase(purchase)) {
    data.status = settlementStatus === "paid" ? "paid" : "pending"
  }

  const isCashPackageGrant = action === "mark_paid"
    && purchase.userId
    && isCashPurchase(purchase)
    && asText(metadata.source) === "staff_package_grant"
  if (isCashPackageGrant) {
    const packagePlanId = asText(metadata.packagePlanId)
    const result = await prisma.$transaction(async (tx) => {
      const plan = await tx.packagePlan.findUnique({ where: { id: packagePlanId } })
      if (!plan) throw new Error("PACKAGE_PLAN_NOT_FOUND")

      const updatedPurchase = await tx.purchase.update({ where: { id: purchaseId }, data })
      const synced = await syncPackagePurchaseFromPaidPurchase({
        tx,
        packagePlanId: plan.id,
        userId: purchase.userId,
        purchaseId: purchase.id,
        purchasedAt: purchase.createdAt,
        source: "cash",
        metadata: {
          courseSlug: plan.courseSlug || undefined,
          packageId: plan.key,
          packageLabel: plan.label,
          packageTotalCredits: plan.totalCredits === null ? "" : String(plan.totalCredits),
          packageIsUnlimited: String(plan.isUnlimited),
          packageCadence: plan.cadence || undefined,
          packageMakeUps: String(plan.makeUps),
          packageValidDays: String(plan.validDays),
        },
      })
      await writeStudentDataAudit({
        targetUserId: purchase.userId,
        staffClerkId: authResult.userId,
        staffName: authResult.staffName,
        entity: "package",
        entityId: purchase.id,
        field: "cash_package_grant_settlement",
        valueAfter: { outcome: "SETTLED", packagePlanId: plan.id, purchaseId: purchase.id },
        reason: note || "Cash package grant settled",
        ipAddress: getClientIp(req),
      }, tx)
      return { updatedPurchase, synced }
    })

    return NextResponse.json({
      ok: true,
      purchase: {
        id: result.updatedPurchase.id,
        settlementStatus,
        paymentStatus: result.updatedPurchase.status,
        packageSynced: Boolean(result.synced),
        packageCreditReserved: false,
      },
    })
  }

  const updated = await prisma.purchase.update({
    where: { id: purchaseId },
    data,
  })

  let resolvedAttendanceId = asText(metadata.attendanceId) || ""

  // Create Attendance record for cash drop-in when marked as paid
  if (action === "mark_paid" && purchase.userId && isCashPurchase(purchase)) {
    const existingAttendanceId = asText(metadata.attendanceId)
    if (!existingAttendanceId) {
      const classDate = asText(metadata.date)
      const classTime = asText(metadata.time)
      const courseSlug = purchase.courseSlug || asText(metadata.courseSlug)

      if (courseSlug && !courseSlug.startsWith("_")) {
        // Use date/time if available, otherwise fall back to purchase creation time
        // Skip sentinel slugs like _staff_registration (registration deposits, not class enrollments)
        const startsAt = (classDate && classTime)
          ? buildSessionStartsAt(classDate, classTime)
          : purchase.createdAt
        if (startsAt) {
          try {
            const now = new Date()
            const session = await prisma.classSession.upsert({
              where: {
                courseSlug_startsAt: {
                  courseSlug,
                  startsAt,
                },
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
                userId_sessionId: {
                  userId: purchase.userId,
                  sessionId: session.id,
                },
              },
              update: {},
              create: {
                userId: purchase.userId,
                sessionId: session.id,
                status: "checked_in_no_package",
                checkedInAt: now,
                metadata: {
                  source: "cash_settlement",
                  purchaseId,
                  date: classDate || "",
                  time: classTime || "",
                },
              },
            })

            // Link attendance ID to purchase metadata
            await prisma.purchase.update({
              where: { id: purchaseId },
              data: {
                metadata: {
                  ...asObject(updated.metadata),
                  attendanceId: attendance.id,
                },
              },
            })
            resolvedAttendanceId = attendance.id
          } catch (error) {
            console.warn("Unable to create attendance for cash settlement", {
              purchaseId,
              classDate,
              classTime,
              courseSlug,
              usedFallback: !classDate || !classTime,
              error: error instanceof Error ? error.message : String(error),
            })
          }
        }
      }
    }
  }

  let packageSynced = false
  let packageCreditReserved = false
  if (action === "mark_paid" && purchase.userId && isCashPurchase(purchase)) {
    const packageId = purchase.packageId || asText(metadata.packageId)
    if (packageId) {
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
        packageSynced = Boolean(synced)
        if (synced?.id && resolvedAttendanceId) {
          try {
            await reservePackageCreditForAttendance({
              packagePurchaseId: synced.id,
              userId: purchase.userId,
              attendanceId: resolvedAttendanceId,
              courseSlug: purchase.courseSlug || asText(metadata.courseSlug),
              at: purchase.createdAt,
              reason: "PACKAGE_INITIAL_BOOKING",
            })
            packageCreditReserved = true
          } catch (error) {
            console.warn("Unable to reserve package credit after cash settlement", {
              purchaseId,
              packagePurchaseId: synced.id,
              attendanceId: resolvedAttendanceId,
              error: error instanceof Error ? error.message : String(error),
            })
          }
        }
      } catch (error) {
        console.warn("Unable to sync package purchase after single cash settlement", {
          purchaseId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  return NextResponse.json({
    ok: true,
    purchase: {
      id: updated.id,
      settlementStatus,
      paymentStatus: updated.status,
      packageSynced,
      packageCreditReserved,
    },
  })
}
