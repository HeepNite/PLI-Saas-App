import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { upsertUserByIdentifiers } from "@/lib/users"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { parseQrCheckInContext, isQrCheckInWindowOpen } from "@/lib/checkin/qr"
import { courseRepository } from "@/lib/courses-repository"
import { awardPointsFromRule } from "@/lib/points/service"
import { ATTENDANCE_STREAK_MILESTONE, POINTS_RULE_KEYS } from "@/lib/points/constants"

export const runtime = "nodejs"

const ATTENDANCE_POINT_STATUSES = ["checked_in", "checked_in_no_package"] as const

const attendanceMilestoneEventKey = (userId: string, courseSlug: string, milestone: number) =>
  `consecutive-attendance:${userId}:${courseSlug}:${milestone}`

const normalizePhoneDigits = (value: string) => {
  const digits = value.replace(/\D/g, "")
  return digits.length >= 6 ? digits : ""
}

const normalizeString = (value: unknown) => {
  if (typeof value !== "string") return ""
  return value.trim()
}

const toRecord = (value: unknown) =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null

export async function POST(req: Request) {
  try {
    const rateLimit = consumeRateLimit({
      key: buildRateLimitKey("checkin:qr:dropin:post", getClientIp(req)),
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
    const paymentIntentId = normalizeString(payload?.paymentIntentId)
    const context = parseQrCheckInContext(
      {
        courseSlug: payload?.courseSlug,
        date: payload?.date,
        time: payload?.time,
        durationMinutes: payload?.durationMinutes,
      },
      { requireKnownCourse: true }
    )
    if ("status" in context) {
      return NextResponse.json({ error: context.error }, { status: context.status })
    }

    const now = new Date()
    if (!isQrCheckInWindowOpen(context, now)) {
      return NextResponse.json(
        {
          error: "Check-in is closed for this class.",
          opensAt: context.opensAt.toISOString(),
          closesAt: context.closesAt.toISOString(),
        },
        { status: 409 }
      )
    }

    const course = courseRepository.getCourseBySlug(context.courseSlug)
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }

    const client = await clerkClient()
    const clerkUser = await client.users.getUser(authResult.userId)
    const email = clerkUser.primaryEmailAddress?.emailAddress || ""
    const phoneRaw = clerkUser.primaryPhoneNumber?.phoneNumber || ""
    const phone = normalizePhoneDigits(phoneRaw)
    const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim()

    const dbUser = await upsertUserByIdentifiers({
      clerkId: authResult.userId,
      email,
      phone,
      name,
    })
    if (!dbUser) {
      return NextResponse.json({ error: "Unable to resolve user" }, { status: 500 })
    }

    const recentPurchases = await prisma.purchase.findMany({
      where: {
        userId: dbUser.id,
        courseSlug: context.courseSlug,
        status: { in: ["paid", "succeeded"] },
        ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
        createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
      take: paymentIntentId ? 1 : 30,
    })

    const paidDropInPurchase =
      recentPurchases.find((purchase) => {
        const metadata = toRecord(purchase.metadata)
        const metaDate = normalizeString(metadata?.date)
        const metaTime = normalizeString(metadata?.time)
        const metaPackageId = normalizeString(metadata?.packageId)
        if (metaPackageId) return false
        return metaDate === context.date && metaTime === context.time
      }) || null

    if (!paidDropInPurchase) {
      return NextResponse.json(
        { error: "No successful drop-in payment was found for this class slot." },
        { status: 409 }
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      const session = await tx.classSession.upsert({
        where: {
          courseSlug_startsAt: {
            courseSlug: context.courseSlug,
            startsAt: context.startsAt,
          },
        },
        update: {
          title: course.title,
          durationMinutes: context.durationMinutes,
        },
        create: {
          courseSlug: context.courseSlug,
          title: course.title,
          startsAt: context.startsAt,
          durationMinutes: context.durationMinutes,
        },
      })

      const existingAttendance = await tx.attendance.findUnique({
        where: {
          userId_sessionId: {
            userId: dbUser.id,
            sessionId: session.id,
          },
        },
      })

      const previousMetadata =
        existingAttendance?.metadata && typeof existingAttendance.metadata === "object"
          ? (existingAttendance.metadata as Record<string, unknown>)
          : {}

      const attendance = existingAttendance
        ? await tx.attendance.update({
            where: { id: existingAttendance.id },
            data: {
              status: "checked_in_no_package",
              checkedInAt: now,
              metadata: {
                ...previousMetadata,
                source: "qr_dropin_checkin",
                purchaseId: paidDropInPurchase.id,
                qrDate: context.date,
                qrTime: context.time,
              },
            },
          })
        : await tx.attendance.create({
            data: {
              userId: dbUser.id,
              sessionId: session.id,
              status: "checked_in_no_package",
              checkedInAt: now,
              metadata: {
                source: "qr_dropin_checkin",
                purchaseId: paidDropInPurchase.id,
                qrDate: context.date,
                qrTime: context.time,
              },
            },
          })

      const checkedInCount = await tx.attendance.count({
        where: {
          userId: dbUser.id,
          status: { in: [...ATTENDANCE_POINT_STATUSES] },
          session: { courseSlug: context.courseSlug },
        },
      })

      let pointsAwarded = 0
      let attendanceMilestone = 0
      if (checkedInCount > 0 && checkedInCount % ATTENDANCE_STREAK_MILESTONE === 0) {
        attendanceMilestone = Math.floor(checkedInCount / ATTENDANCE_STREAK_MILESTONE)
        const pointsResult = await awardPointsFromRule({
          db: tx,
          userId: dbUser.id,
          ruleKey: POINTS_RULE_KEYS.CONSECUTIVE_ATTENDANCE,
          eventKey: attendanceMilestoneEventKey(dbUser.id, context.courseSlug, attendanceMilestone),
          fallbackType: "CONSECUTIVE_ATTENDANCE",
          meta: {
            source: "qr_dropin_checkin",
            purchaseId: paidDropInPurchase.id,
            courseSlug: context.courseSlug,
            milestoneEvery: ATTENDANCE_STREAK_MILESTONE,
            milestone: attendanceMilestone,
            attendanceCount: checkedInCount,
          },
        })
        if (pointsResult.awarded) {
          pointsAwarded = pointsResult.points
        }
      }

      return {
        attendance,
        checkedInCount,
        pointsAwarded,
        attendanceMilestone,
      }
    })

    return NextResponse.json({
      attendance: {
        id: result.attendance.id,
        status: result.attendance.status,
        checkedInAt: result.attendance.checkedInAt.toISOString(),
        courseSlug: context.courseSlug,
        courseTitle: course.title,
        startsAt: context.startsAt.toISOString(),
      },
      payment: {
        purchaseId: paidDropInPurchase.id,
        paymentIntentId: paidDropInPurchase.stripePaymentIntentId,
      },
      points: {
        awarded: result.pointsAwarded,
        milestone: result.attendanceMilestone > 0 ? result.attendanceMilestone : null,
        attendanceCount: result.checkedInCount,
        milestoneEvery: ATTENDANCE_STREAK_MILESTONE,
      },
    })
  } catch (error) {
    console.error("QR check-in drop-in POST failed", error)
    return NextResponse.json({ error: "Unable to complete drop-in check-in" }, { status: 500 })
  }
}
