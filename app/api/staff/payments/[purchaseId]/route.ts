import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { reservePackageCreditForAttendance, reservePackageCreditForAttendanceTx, syncPackagePurchaseFromPaidPurchase } from "@/lib/packages"
import { writeStudentDataAudit } from "@/lib/audit/student-data-audit"
import { buildSessionStartsAt } from "@/lib/class-schedule"
import { ensureAttendancePackagePurchase } from "@/lib/purchase-attendance"
import { authorizeStaffPortalSectionRequest } from "@/lib/security/staff-portal-auth"
import { getClientIp } from "@/lib/security/rate-limit"
import { withStaffGuard } from "@/lib/security/with-staff-guard"
import { asObject as asObjectShared, asText } from "@/lib/shared"
import {
  isVerifyCardAttempt,
  normalizePaymentChannel,
  readVerifyResolution,
  type VerifyResolutionAction,
} from "@/app/api/staff/payments/shared"

export const runtime = "nodejs"

type SettlementAction = "mark_paid" | "mark_pending"
type VerifyAction = "verify_collected" | "verify_dismissed"

type SettledPurchase = NonNullable<Awaited<ReturnType<typeof prisma.purchase.findUnique>>>
type StaffAuth = { userId: string; staffName?: string | null }

const VERIFY_ACTIONS: Record<VerifyAction, VerifyResolutionAction> = {
  verify_collected: "collected",
  verify_dismissed: "dismissed",
}
const VERIFY_REASON_MAX_LENGTH = 300

class VerifyResolutionConflict extends Error {}

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

/**
 * Side effects of settling a cash purchase as paid: create and link the class attendance
 * when missing, and sync/reserve the package it bought. Shared by "mark_paid" and the
 * verify "Collected" resolution so both settle the same way.
 */
const applyCashSettlementSideEffects = async ({
  purchase,
  metadata,
  updated,
  purchaseId,
}: {
  purchase: SettledPurchase
  metadata: Prisma.JsonObject
  updated: { metadata: Prisma.JsonValue | null }
  purchaseId: string
}) => {
  let resolvedAttendanceId = asText(metadata.attendanceId) || ""

  // Create Attendance record for cash drop-in when marked as paid
  if (purchase.userId) {
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
  if (purchase.userId) {
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

  return { packageSynced, packageCreditReserved }
}

/**
 * Manual resolution of a verify item (D4). Only staff take an attempt out of Verify:
 * "collected" settles it at the desk through the cash-settlement path; "dismissed" closes
 * it as not owed (reason required) and keeps its status. Idempotent and audited.
 */
const resolveVerifyAttempt = async ({
  req,
  auth,
  purchaseId,
  verifyAction,
  payload,
}: {
  req: Request
  auth: StaffAuth
  purchaseId: string
  verifyAction: VerifyAction
  payload: Record<string, unknown>
}) => {
  const resolutionAction = VERIFY_ACTIONS[verifyAction]
  const reason = typeof payload.reason === "string" ? payload.reason.trim().slice(0, VERIFY_REASON_MAX_LENGTH) : ""
  if (resolutionAction === "dismissed" && !reason) {
    return NextResponse.json({ error: "A reason is required to dismiss a verify item" }, { status: 400 })
  }

  const purchase = await prisma.purchase.findUnique({ where: { id: purchaseId } })
  if (!purchase) {
    return NextResponse.json({ error: "Purchase not found" }, { status: 404 })
  }

  const recorded = readVerifyResolution(purchase.metadata)
  if (recorded) {
    if (recorded.action !== resolutionAction) {
      return NextResponse.json({ error: "This verify item was already resolved differently" }, { status: 409 })
    }
    const recordedMetadata = asObject(purchase.metadata)
    return NextResponse.json({
      ok: true,
      idempotent: true,
      purchase: {
        id: purchase.id,
        settlementStatus: asText(recordedMetadata.settlementStatus) || "pending",
        paymentStatus: purchase.status,
        verifyResolution: recorded,
      },
    })
  }
  if (!isVerifyCardAttempt(purchase)) {
    return NextResponse.json({ error: "Purchase is not in Verify" }, { status: 409 })
  }

  const metadata = asObject(purchase.metadata)
  const at = new Date().toISOString()
  const resolution = {
    action: resolutionAction,
    by: auth.userId,
    byName: auth.staffName || null,
    at,
    reason: reason || null,
  }
  const isCollected = resolutionAction === "collected"
  const nextMetadata: Prisma.InputJsonObject = isCollected
    ? {
        ...metadata,
        // Collected at the desk: money moved as cash, so it settles like a cash purchase.
        paymentChannel: "cash",
        settlementStatus: "paid",
        settledAt: at,
        settlementUpdatedBy: auth.userId,
        settlementNote: reason || asText(metadata.settlementNote),
        verifyResolution: { ...resolution, previousPaymentChannel: normalizePaymentChannel(purchase) },
      }
    : { ...metadata, verifyResolution: resolution }

  try {
    await prisma.$transaction(async (tx) => {
      // Optimistic claim: a concurrent change (webhook, another staff action) wins and we stop.
      const claim = await tx.purchase.updateMany({
        where: { id: purchaseId, updatedAt: purchase.updatedAt },
        data: isCollected ? { metadata: nextMetadata, status: "paid" } : { metadata: nextMetadata },
      })
      if (claim.count !== 1) throw new VerifyResolutionConflict()
      await writeStudentDataAudit({
        targetUserId: purchase.userId,
        staffClerkId: auth.userId,
        staffName: auth.staffName,
        entity: "payment",
        entityId: purchase.id,
        field: "verify_resolution",
        valueBefore: { status: purchase.status, settlementStatus: asText(metadata.settlementStatus) || null },
        valueAfter: { ...resolution, status: isCollected ? "paid" : purchase.status },
        reason: reason || "Verify item collected at the desk",
        ipAddress: getClientIp(req),
      }, tx)
    })
  } catch (error) {
    if (error instanceof VerifyResolutionConflict) {
      return NextResponse.json({ error: "Purchase changed, refresh and try again" }, { status: 409 })
    }
    throw error
  }

  let packageSynced = false
  let packageCreditReserved = false
  if (isCollected) {
    const settled = await prisma.purchase.findUnique({ where: { id: purchaseId } })
    if (settled) {
      ;({ packageSynced, packageCreditReserved } = await applyCashSettlementSideEffects({
        purchase: settled,
        metadata: asObject(settled.metadata),
        updated: settled,
        purchaseId,
      }))
    }
  }

  return NextResponse.json({
    ok: true,
    purchase: {
      id: purchase.id,
      settlementStatus: isCollected ? "paid" : asText(metadata.settlementStatus) || "pending",
      paymentStatus: isCollected ? "paid" : purchase.status,
      verifyResolution: resolution,
      packageSynced,
      packageCreditReserved,
    },
  })
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
  if (typeof payload.action === "string" && Object.hasOwn(VERIFY_ACTIONS, payload.action)) {
    return resolveVerifyAttempt({ req, auth: authResult, purchaseId, verifyAction: payload.action as VerifyAction, payload })
  }
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

  const isCreationCashPackage = action === "mark_paid"
    && purchase.userId
    && isCashPurchase(purchase)
    && asText(metadata.source) === "staff_created_student_cash_package"
  if (isCreationCashPackage) {
    const packagePlanId = asText(metadata.packagePlanId)
    const attendanceId = asText(metadata.attendanceId)
    const result = await prisma.$transaction(async (tx) => {
      const updatedPurchase = await tx.purchase.update({ where: { id: purchaseId }, data })
      const plan = await tx.packagePlan.findUnique({ where: { id: packagePlanId } })
      if (!plan) throw new Error("PACKAGE_PLAN_NOT_FOUND")

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

      if (attendanceId && synced) {
        const attendance = await tx.attendance.findUnique({
          where: { id: attendanceId },
          include: { session: true },
        })
        if (!attendance) throw new Error("ATTENDANCE_NOT_FOUND")

        const student = await tx.user.findUnique({ where: { id: purchase.userId } })
        if (!student) throw new Error("STUDENT_NOT_FOUND")

        await reservePackageCreditForAttendanceTx(tx, {
          packagePurchaseId: synced.id,
          userId: purchase.userId,
          attendanceId,
          courseSlug: attendance.session.courseSlug,
          at: purchase.createdAt,
          reason: "PACKAGE_INITIAL_BOOKING",
        })
        await ensureAttendancePackagePurchase(tx, {
          attendanceId,
          userId: purchase.userId,
          courseSlug: attendance.session.courseSlug,
          courseTitle: attendance.session.title || attendance.session.courseSlug,
          email: student.email,
          name: student.name,
          phone: student.phone,
          packageId: synced.packageId,
          packagePurchaseId: synced.id,
          source: "staff_created_student_cash_package",
          date: attendance.session.startsAt.toISOString().slice(0, 10),
          time: attendance.session.startsAt.toISOString().slice(11, 16),
        })
      }

      await writeStudentDataAudit({
        targetUserId: purchase.userId,
        staffClerkId: authResult.userId,
        staffName: authResult.staffName,
        entity: "package",
        entityId: purchase.id,
        field: "cash_package_creation_settlement",
        valueAfter: { outcome: "SETTLED", packagePlanId: plan.id, purchaseId: purchase.id, attendanceId: attendanceId || null },
        reason: note || "Cash package creation settled",
        ipAddress: getClientIp(req),
      }, tx)
      return { updatedPurchase, synced, packageCreditReserved: Boolean(attendanceId && synced) }
    })

    return NextResponse.json({
      ok: true,
      purchase: {
        id: result.updatedPurchase.id,
        settlementStatus,
        paymentStatus: result.updatedPurchase.status,
        packageSynced: Boolean(result.synced),
        packageCreditReserved: result.packageCreditReserved,
      },
    })
  }

  const updated = await prisma.purchase.update({
    where: { id: purchaseId },
    data,
  })

  const { packageSynced, packageCreditReserved } = action === "mark_paid" && isCashPurchase(purchase)
    ? await applyCashSettlementSideEffects({ purchase, metadata, updated, purchaseId })
    : { packageSynced: false, packageCreditReserved: false }

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
