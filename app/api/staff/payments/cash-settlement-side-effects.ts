import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { reservePackageCreditForAttendance, syncPackagePurchaseFromPaidPurchase } from "@/lib/packages"
import { buildSessionStartsAt } from "@/lib/class-schedule"
import { asObject as asObjectShared, asText } from "@/lib/shared"

// Moved from app/api/staff/payments/[purchaseId]/route.ts (a route file cannot export helpers)
// with asObject cast to Prisma.JsonObject, behavior unchanged, so staff terminal charges settle
// outstanding purchases exactly like mark_paid.

type SettledPurchase = NonNullable<Awaited<ReturnType<typeof prisma.purchase.findUnique>>>

const asObject = (value: Prisma.JsonValue | null): Prisma.JsonObject =>
  asObjectShared(value) as Prisma.JsonObject

/**
 * Side effects of settling a cash purchase as paid: create and link the class attendance
 * when missing, and sync/reserve the package it bought. Shared by "mark_paid" and the
 * verify "Collected" resolution so both settle the same way.
 */
export const applyCashSettlementSideEffects = async ({
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
