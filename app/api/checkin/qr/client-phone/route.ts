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

export const runtime = "nodejs"

const ATTENDANCE_POINT_STATUSES = ["checked_in", "checked_in_no_package"] as const

const attendanceMilestoneEventKey = (userId: string, courseSlug: string, milestone: number) =>
  `consecutive-attendance:${userId}:${courseSlug}:${milestone}`

const normalizeString = (value: unknown) => {
  if (typeof value !== "string") return ""
  return value.trim()
}

const toRecord = (value: unknown) =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null

const asText = (value: unknown): string =>
  typeof value === "string" ? value.trim() : ""

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

    const payload = toRecord(body)
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

    if (existingAttendance && ATTENDANCE_POINT_STATUSES.includes(existingAttendance.status as (typeof ATTENDANCE_POINT_STATUSES)[number])) {
      return NextResponse.json({
        status: "already_checked_in",
        attendance: {
          id: existingAttendance.id,
          status: existingAttendance.status,
          checkedInAt: existingAttendance.checkedInAt.toISOString(),
          courseSlug: context.courseSlug,
          courseTitle: session.title || context.courseSlug,
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

    const matchingPurchase = purchases.find((p) => {
      const meta = toRecord(p.metadata)
      const purchaseDate = asText(meta?.date)
      return purchaseDate === context.date
    })

    if (matchingPurchase) {
      const meta = toRecord(matchingPurchase.metadata)
      const paymentChannel = asText(meta?.paymentChannel)
      const settlementStatus = asText(meta?.settlementStatus)
      const isPaid = SUCCESSFUL_PURCHASE_STATUSES.includes(matchingPurchase.status)
      const isCashPending = paymentChannel === "cash" && (matchingPurchase.status === "pending" || settlementStatus === "pending")

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
                status: "checked_in",
                checkedInAt: now,
                metadata: {
                  ...(toRecord(existingAttendance.metadata) || {}),
                  checkinSource: "qr_client_phone",
                  purchaseId: matchingPurchase.id,
                },
              },
            })
          : await tx.attendance.create({
              data: {
                userId: dbUser.id,
                sessionId: session.id,
                status: "checked_in",
                checkedInAt: now,
                metadata: {
                  checkinSource: "qr_client_phone",
                  purchaseId: matchingPurchase.id,
                },
              },
            })

        let pkg = null
        if (linkedPackage && !linkedPackage.isUnlimited && (linkedPackage.remainingCredits ?? 0) > 0) {
          await tx.packagePurchase.update({
            where: { id: linkedPackage.id },
            data: { remainingCredits: { decrement: 1 } },
          })
          await tx.packageUsageLedger.create({
            data: {
              packagePurchaseId: linkedPackage.id,
              userId: dbUser.id,
              attendanceId: att.id,
              delta: -1,
              reason: "qr_client_phone_checkin",
              meta: { courseSlug: context.courseSlug, date: context.date, time: context.time },
            },
          })
          pkg = await tx.packagePurchase.findUnique({
            where: { id: linkedPackage.id },
            select: { id: true, packageId: true, packageLabel: true, isUnlimited: true, remainingCredits: true, status: true },
          })
        }

        return { attendance: att, refreshedPackage: pkg }
      })

      const points = await awardCheckInPoints(dbUser.id, context.courseSlug)

      return NextResponse.json({
        status: "checked_in",
        attendance: {
          id: attendance.id,
          status: attendance.status,
          checkedInAt: attendance.checkedInAt.toISOString(),
          courseSlug: context.courseSlug,
          courseTitle: session.title || context.courseSlug,
          startsAt: session.startsAt.toISOString(),
        },
        package: refreshedPackage || undefined,
        cashPending: isCashPending || undefined,
        cashAmount: isCashPending ? matchingPurchase.amount / 100 : undefined,
        points,
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
      // Consume credit + create Attendance in transaction
      const result = await prisma.$transaction(async (tx) => {
        if (!usablePackage.isUnlimited) {
          await tx.packagePurchase.update({
            where: { id: usablePackage.id },
            data: { remainingCredits: { decrement: 1 } },
          })
        }

        const attendance = await tx.attendance.create({
          data: {
            userId: dbUser.id,
            sessionId: session.id,
            status: "checked_in",
            checkedInAt: now,
            metadata: {
              checkinSource: "qr_client_phone",
              packagePurchaseId: usablePackage.id,
            },
          },
        })

        await tx.packageUsageLedger.create({
          data: {
            packagePurchaseId: usablePackage.id,
            userId: dbUser.id,
            attendanceId: attendance.id,
            delta: -1,
            reason: "qr_client_phone_checkin",
            meta: { courseSlug: context.courseSlug, date: context.date, time: context.time },
          },
        })

        await ensureAttendancePackagePurchase(tx, {
          attendanceId: attendance.id,
          userId: dbUser.id,
          courseSlug: context.courseSlug,
          courseTitle: session.title || context.courseSlug,
          email: email || null,
          name: name || null,
          phone: phone || null,
          packageId: usablePackage.packageId,
          packagePurchaseId: usablePackage.id,
          source: "qr_client_phone_checkin",
          purchaseSource: "web",
          date: context.date,
          time: context.time,
        })

        return attendance
      })

      const refreshedPackage = await prisma.packagePurchase.findUnique({
        where: { id: usablePackage.id },
        select: { id: true, packageId: true, packageLabel: true, isUnlimited: true, remainingCredits: true, status: true },
      })

      const points = await awardCheckInPoints(dbUser.id, context.courseSlug)

      return NextResponse.json({
        status: "checked_in",
        attendance: {
          id: result.id,
          status: result.status,
          checkedInAt: result.checkedInAt.toISOString(),
          courseSlug: context.courseSlug,
          courseTitle: session.title || context.courseSlug,
          startsAt: session.startsAt.toISOString(),
        },
        package: refreshedPackage,
        points,
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
