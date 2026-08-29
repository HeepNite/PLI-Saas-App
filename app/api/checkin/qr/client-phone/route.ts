import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { upsertUserByIdentifiers } from "@/lib/users"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { parseQrCheckInContext } from "@/lib/checkin/qr"
import { ensureAttendancePackagePurchase } from "@/lib/purchase-attendance"
import { SUCCESSFUL_PURCHASE_STATUSES } from "@/lib/purchase-status"
import { awardPointsFromRule, getAttendanceMilestoneClasses } from "@/lib/points/service"
import { POINTS_RULE_KEYS } from "@/lib/points/constants"
import { asRecord, asText } from "@/lib/shared"
import { ATTENDANCE_POINT_STATUSES, ATTENDANCE_STATUS } from "@/lib/attendance-constants"
import { PAYMENT_CHANNEL, PURCHASE_SOURCE, SETTLEMENT_STATUS } from "@/lib/payment-constants"
import { reservePackageCreditForAttendanceTx } from "@/lib/packages"
import { resolveConsecutiveOffer } from "@/lib/checkin/consecutive-offer"

export const runtime = "nodejs"

const attendanceMilestoneEventKey = (userId: string, courseSlug: string, milestone: number) =>
  `consecutive-attendance:${userId}:${courseSlug}:${milestone}`


/**
 * POST /api/checkin/qr/client-phone
 *
 * Client-phone QR self-check-in: the student scans the studio QR with their
 * phone and checks in using their Clerk account. Supports three paths:
 *
 * 1. Existing Purchase (Stripe paid) → create/confirm Attendance
 * 2. Existing Purchase (Cash pending) → create/confirm Attendance + cashPending flag
 * 3. Active PackagePurchase with credits → consume credit + create Attendance
 * 4. Nothing found → reject
 */
export async function POST(req: Request) {
  try {
    const rateLimit = consumeRateLimit({
      key: buildRateLimitKey("checkin:qr:client-phone:post", getClientIp(req)),
      limit: 30,
      windowMs: 60_000,
    })
    if (!rateLimit.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
      )
    }

    const authResult = await auth()
    if (!authResult.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const payload = asRecord(body)
    const context = parseQrCheckInContext({
      courseSlug: payload?.courseSlug,
      date: payload?.date,
      time: payload?.time,
      durationMinutes: payload?.durationMinutes,
    })
    if ("status" in context) {
      return NextResponse.json({ error: context.error }, { status: context.status })
    }

    const now = new Date()

    // ─── Resolve user ────────────────────────────────────────
    const client = await clerkClient()
    const clerkUser = await client.users.getUser(authResult.userId)
    const email = clerkUser.primaryEmailAddress?.emailAddress || ""
    const phone = clerkUser.primaryPhoneNumber?.phoneNumber || ""
    const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim()

    const dbUser = await upsertUserByIdentifiers({ clerkId: authResult.userId, email, name, phone })
    if (!dbUser) {
      return NextResponse.json({ error: "Unable to resolve user" }, { status: 500 })
    }

    // ─── Find or create ClassSession ─────────────────────────
    const session = await prisma.classSession.upsert({
      where: {
        courseSlug_startsAt: {
          courseSlug: context.courseSlug,
          startsAt: context.startsAt,
        },
      },
      update: {},
      create: {
        courseSlug: context.courseSlug,
        startsAt: context.startsAt,
        durationMinutes: context.durationMinutes,
      },
    })

    // ─── Resolve course title (catalog > session > slug) ─────
    const catalogRow = await prisma.courseCatalog.findUnique({
      where: { slug: context.courseSlug },
      select: { title: true },
    })
    const courseTitle = session.title || catalogRow?.title || context.courseSlug

    // ─── Check existing Attendance ───────────────────────────
    const existingAttendance = await prisma.attendance.findUnique({
      where: { userId_sessionId: { userId: dbUser.id, sessionId: session.id } },
      include: {
        packageUsage: {
          include: {
            packagePurchase: {
              select: { id: true, packageId: true, packageLabel: true, isUnlimited: true, remainingCredits: true, status: true },
            },
          },
        },
      },
    })

    if (existingAttendance && ATTENDANCE_POINT_STATUSES.includes(existingAttendance.status)) {
      return NextResponse.json({
        status: "already_checked_in",
        attendance: {
          id: existingAttendance.id,
          status: existingAttendance.status,
          checkedInAt: existingAttendance.checkedInAt.toISOString(),
          courseSlug: context.courseSlug,
          courseTitle: courseTitle,
          startsAt: session.startsAt.toISOString(),
        },
        package: existingAttendance.packageUsage?.packagePurchase || null,
      })
    }

    // ─── Find Purchase for this class ────────────────────────
    const purchases = await prisma.purchase.findMany({
      where: {
        userId: dbUser.id,
        courseSlug: context.courseSlug,
      },
      orderBy: { createdAt: "desc" },
    })

    const purchaseMatchingDate = purchases.find((p) => {
      const meta = asRecord(p.metadata)
      const purchaseDate = asText(meta?.date)
      return purchaseDate === context.date
    })
    const matchingPurchase = purchaseMatchingDate ?? purchases.find((purchase) =>
      Boolean(purchase.specialClassId) && purchase.classSessionId === session.id
    )

    if (matchingPurchase) {
      const hasSpecialClassLink = Boolean(matchingPurchase.specialClassId)
      const isSpecialClassPurchase = hasSpecialClassLink && matchingPurchase.classSessionId === session.id
      if (hasSpecialClassLink) {
        const specialClass = await prisma.specialClass.findUnique({
          where: { id: matchingPurchase.specialClassId! },
          select: { status: true, classSessionId: true },
        })
        if (!isSpecialClassPurchase || !specialClass || specialClass.status !== "published" || specialClass.classSessionId !== session.id) {
          return NextResponse.json({
            status: "rejected",
            message: "This special class is not available for check-in. Please contact the front desk.",
          })
        }
      }

      const meta = asRecord(matchingPurchase.metadata)
      const paymentChannel = asText(meta?.paymentChannel)
      const settlementStatus = asText(meta?.settlementStatus)
      const isPaid = SUCCESSFUL_PURCHASE_STATUSES.includes(matchingPurchase.status)
        || (isSpecialClassPurchase && matchingPurchase.status === "capture_pending")
      const isCashPending = (paymentChannel === PAYMENT_CHANNEL.CASH && (matchingPurchase.status === SETTLEMENT_STATUS.PENDING || settlementStatus === SETTLEMENT_STATUS.PENDING))
        || (isSpecialClassPurchase && matchingPurchase.status === "cash_pending")

      if (!isPaid && !isCashPending) {
        return NextResponse.json({
          status: "rejected",
          message: "Your purchase could not be verified. Please contact the front desk.",
        })
      }

      // Upsert Attendance + consume package credit if linked
      const linkedPackage = await prisma.packagePurchase.findFirst({
        where: { purchaseId: matchingPurchase.id, status: "active" },
      })

      const { attendance, refreshedPackage } = await prisma.$transaction(async (tx) => {
        const att = existingAttendance
          ? await tx.attendance.update({
              where: { id: existingAttendance.id },
              data: {
                status: ATTENDANCE_STATUS.CHECKED_IN,
                checkedInAt: now,
                metadata: {
                  ...(asRecord(existingAttendance.metadata) || {}),
                  checkinSource: "qr_client_phone",
                  purchaseId: matchingPurchase.id,
                },
              },
            })
          : await tx.attendance.create({
              data: {
                userId: dbUser.id,
                sessionId: session.id,
                status: ATTENDANCE_STATUS.CHECKED_IN,
                checkedInAt: now,
                metadata: {
                  checkinSource: "qr_client_phone",
                  purchaseId: matchingPurchase.id,
                },
              },
            })

        let pkg = null
        if (linkedPackage) {
          const { packagePurchase } = await reservePackageCreditForAttendanceTx(tx, {
            packagePurchaseId: linkedPackage.id,
            userId: dbUser.id,
            attendanceId: att.id,
            courseSlug: context.courseSlug,
            reason: "qr_client_phone_checkin",
          })
          pkg = packagePurchase
            ? await tx.packagePurchase.findUnique({
                where: { id: packagePurchase.id },
                select: { id: true, packageId: true, packageLabel: true, isUnlimited: true, remainingCredits: true, status: true },
              })
            : null
        }

        return { attendance: att, refreshedPackage: pkg }
      })

      const points = await awardCheckInPoints(dbUser.id, context.courseSlug)
      const consecutiveOffer = await resolveConsecutiveOffer({
        userId: dbUser.id,
        linkedFromCourseSlug: context.courseSlug,
        todayJsWeekday: now.getDay(),
        courseTimeMinutes: context.startsAt.getHours() * 60 + context.startsAt.getMinutes(),
        now,
      })


      return NextResponse.json({
        status: ATTENDANCE_STATUS.CHECKED_IN,
        attendance: {
          id: attendance.id,
          status: attendance.status,
          checkedInAt: attendance.checkedInAt.toISOString(),
          courseSlug: context.courseSlug,
          courseTitle,
          startsAt: session.startsAt.toISOString(),
        },
        package: refreshedPackage || undefined,
        cashPending: isCashPending || undefined,
        cashAmount: isCashPending ? matchingPurchase.amount / 100 : undefined,
        points,
        courseTitle,
        consecutiveOffer: consecutiveOffer
          ? {
              linkedCourseSlug: consecutiveOffer.linkedCourseSlug,
              linkedCourseTitle: consecutiveOffer.linkedCourseTitle,
              linkedCourseTime: consecutiveOffer.linkedCourseTime,
              dropInConsecutiveCents: consecutiveOffer.dropInConsecutiveCents,
              packageHolderConsecutiveCents: consecutiveOffer.packageHolderConsecutiveCents,
              discountPercent: consecutiveOffer.discountPercent,
            }
          : null,
      })
    }

    // ─── No Purchase — check PackagePurchase ─────────────────
    const activePackages = await prisma.packagePurchase.findMany({
      where: {
        userId: dbUser.id,
        status: "active",
        OR: [
          { courseSlug: context.courseSlug },
          { packagePlan: { courseSlugs: { has: context.courseSlug } } },
          { courseSlug: null, packagePlanId: null },
        ],
      },
      include: { packagePlan: { select: { courseSlugs: true } } },
      orderBy: { expiresAt: "asc" },
    })

    const usablePackage = activePackages.find((pkg) => {
      if (pkg.expiresAt && pkg.expiresAt < now) return false
      return pkg.isUnlimited || (pkg.remainingCredits ?? 0) > 0
    })

    if (usablePackage) {
      // Consume credit atomically + create Attendance in transaction
      let packageAttendance: { id: string; status: string; checkedInAt: Date } | null = null
      try {
        packageAttendance = await prisma.$transaction(async (tx) => {
          const attendance = await tx.attendance.create({
            data: {
              userId: dbUser.id,
              sessionId: session.id,
              status: ATTENDANCE_STATUS.CHECKED_IN,
              checkedInAt: now,
              metadata: {
                checkinSource: "qr_client_phone",
                packagePurchaseId: usablePackage.id,
              },
            },
          })

          await reservePackageCreditForAttendanceTx(tx, {
            packagePurchaseId: usablePackage.id,
            userId: dbUser.id,
            attendanceId: attendance.id,
            courseSlug: context.courseSlug,
            reason: "qr_client_phone_checkin",
          })

          await ensureAttendancePackagePurchase(tx, {
            attendanceId: attendance.id,
            userId: dbUser.id,
            courseSlug: context.courseSlug,
            courseTitle: courseTitle,
            email: email || null,
            name: name || null,
            phone: phone || null,
            packageId: usablePackage.packageId,
            packagePurchaseId: usablePackage.id,
            source: "qr_client_phone_checkin",
            purchaseSource: PURCHASE_SOURCE.KIOSK,
            date: context.date,
            time: context.time,
          })

          return attendance
        })
      } catch (err) {
        if (err instanceof Error && err.message === "PACKAGE_NO_CREDITS") {
          return NextResponse.json({ error: "PACKAGE_NO_CREDITS" }, { status: 409 })
        }
        throw err
      }

      const refreshedPackage = await prisma.packagePurchase.findUnique({
        where: { id: usablePackage.id },
        select: { id: true, packageId: true, packageLabel: true, isUnlimited: true, remainingCredits: true, status: true },
      })

      const points = await awardCheckInPoints(dbUser.id, context.courseSlug)
      const consecutiveOffer = await resolveConsecutiveOffer({
        userId: dbUser.id,
        linkedFromCourseSlug: context.courseSlug,
        todayJsWeekday: now.getDay(),
        courseTimeMinutes: context.startsAt.getHours() * 60 + context.startsAt.getMinutes(),
        now,
      })


      return NextResponse.json({
        status: ATTENDANCE_STATUS.CHECKED_IN,
        attendance: {
          id: packageAttendance.id,
          status: packageAttendance.status,
          checkedInAt: packageAttendance.checkedInAt.toISOString(),
          courseSlug: context.courseSlug,
          courseTitle,
          startsAt: session.startsAt.toISOString(),
        },
        package: refreshedPackage,
        points,
        courseTitle,
        consecutiveOffer: consecutiveOffer
          ? {
              linkedCourseSlug: consecutiveOffer.linkedCourseSlug,
              linkedCourseTitle: consecutiveOffer.linkedCourseTitle,
              linkedCourseTime: consecutiveOffer.linkedCourseTime,
              dropInConsecutiveCents: consecutiveOffer.dropInConsecutiveCents,
              packageHolderConsecutiveCents: consecutiveOffer.packageHolderConsecutiveCents,
              discountPercent: consecutiveOffer.discountPercent,
            }
          : null,
      })
    }

    // ─── Nothing found ───────────────────────────────────────
    return NextResponse.json({
      status: "rejected",
      message: "No booking or package found for this class. Would you like to book now?",
    })
  } catch (error) {
    console.error("Client-phone QR check-in failed", error)
    return NextResponse.json({ error: "Unable to check in" }, { status: 500 })
  }
}

// ─── Helper: award check-in points ──────────────────────────
async function awardCheckInPoints(userId: string, courseSlug: string) {
  const checkedInCount = await prisma.attendance.count({
    where: {
      userId,
      status: { in: [...ATTENDANCE_POINT_STATUSES] },
      session: { courseSlug },
    },
  })

  const milestoneEvery = await getAttendanceMilestoneClasses()
  let awarded = 0
  let milestone: number | null = null

  if (checkedInCount > 0 && checkedInCount % milestoneEvery === 0) {
    const milestoneNumber = Math.floor(checkedInCount / milestoneEvery)
    const result = await awardPointsFromRule({
      userId,
      ruleKey: POINTS_RULE_KEYS.CONSECUTIVE_ATTENDANCE,
      eventKey: attendanceMilestoneEventKey(userId, courseSlug, milestoneNumber),
      fallbackType: "CONSECUTIVE_ATTENDANCE",
      meta: {
        source: "qr_client_phone",
        courseSlug,
        milestoneEvery,
        milestone: milestoneNumber,
        attendanceCount: checkedInCount,
      },
    })
    if (result.awarded) {
      awarded = result.points
      milestone = milestoneNumber
    }
  }

  return { awarded, milestone, attendanceCount: checkedInCount, milestoneEvery }
}
