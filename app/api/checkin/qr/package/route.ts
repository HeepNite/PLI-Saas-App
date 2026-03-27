import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { upsertUserByIdentifiers } from "@/lib/users"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { parseQrCheckInContext, isQrCheckInWindowAllowed } from "@/lib/checkin/qr"
import { resolveTerminalKioskSession } from "@/lib/checkin/kiosk-session"
import { getCatalogCourseBySlug } from "@/lib/catalog-courses"
import { reservePackageCreditForAttendanceTx } from "@/lib/packages"
import { awardPointsFromRule, getAttendanceMilestoneClasses } from "@/lib/points/service"
import { POINTS_RULE_KEYS } from "@/lib/points/constants"

export const runtime = "nodejs"

const ATTENDANCE_POINT_STATUSES = ["checked_in", "checked_in_no_package"] as const

const attendanceMilestoneEventKey = (userId: string, courseSlug: string, milestone: number) =>
  `consecutive-attendance:${userId}:${courseSlug}:${milestone}`

const normalizePhoneDigits = (value: string) => {
  const digits = value.replace(/\D/g, "")
  return digits.length >= 6 ? digits : ""
}

const toRecord = (value: unknown) =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null

const pickPreferredPackage = (input: {
  courseSlug: string
  packages: Array<{
    id: string
    packageId: string
    packageLabel: string | null
    courseSlug: string | null
    isUnlimited: boolean
    remainingCredits: number | null
    expiresAt: Date | null
    status: string
  }>
}) => {
  const ordered = [...input.packages].sort((a, b) => {
    const aPriority = a.courseSlug && a.courseSlug === input.courseSlug ? 0 : 1
    const bPriority = b.courseSlug && b.courseSlug === input.courseSlug ? 0 : 1
    if (aPriority !== bPriority) return aPriority - bPriority
    const aExpires = a.expiresAt ? a.expiresAt.getTime() : Number.MAX_SAFE_INTEGER
    const bExpires = b.expiresAt ? b.expiresAt.getTime() : Number.MAX_SAFE_INTEGER
    return aExpires - bExpires
  })
  return ordered[0] || null
}

export async function POST(req: Request) {
  try {
    const rateLimit = consumeRateLimit({
      key: buildRateLimitKey("checkin:qr:package:post", getClientIp(req)),
      limit: 30,
      windowMs: 60_000,
    })
    if (!rateLimit.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
      )
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const payload = toRecord(body)
    const authResult = await auth()
    const kioskSessionToken = typeof payload?.kioskSessionToken === "string" ? payload.kioskSessionToken.trim() : ""
    const kioskSessionResult = !authResult.userId && kioskSessionToken
      ? await resolveTerminalKioskSession(kioskSessionToken)
      : null

    if (!authResult.userId && !kioskSessionResult?.ok) {
      return NextResponse.json(
        { error: kioskSessionResult?.error || "Unauthorized" },
        { status: kioskSessionResult?.status || 401 }
      )
    }

    const context = parseQrCheckInContext(
      {
        courseSlug: payload?.courseSlug,
        date: payload?.date,
        time: payload?.time,
        durationMinutes: payload?.durationMinutes,
      }
    )
    if ("status" in context) {
      return NextResponse.json({ error: context.error }, { status: context.status })
    }

    const now = new Date()
    if (!isQrCheckInWindowAllowed(context, now)) {
      return NextResponse.json(
        {
          error: "Check-in is closed for this class.",
          opensAt: context.opensAt.toISOString(),
          closesAt: context.closesAt.toISOString(),
        },
        { status: 409 }
      )
    }

    const course = await getCatalogCourseBySlug(context.courseSlug)
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }

    let email = kioskSessionResult?.ok ? kioskSessionResult.session.user.email : ""
    let phone = kioskSessionResult?.ok ? normalizePhoneDigits(kioskSessionResult.session.user.phone || "") : ""
    let name = kioskSessionResult?.ok ? kioskSessionResult.session.user.name || "" : ""

    const dbUser = authResult.userId
      ? await (async () => {
          const client = await clerkClient()
          const clerkUser = await client.users.getUser(authResult.userId as string)
          email = clerkUser.primaryEmailAddress?.emailAddress || ""
          const phoneRaw = clerkUser.primaryPhoneNumber?.phoneNumber || ""
          phone = normalizePhoneDigits(phoneRaw)
          name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim()
          return upsertUserByIdentifiers({
            clerkId: authResult.userId as string,
            email,
            phone,
            name,
          })
        })()
      : kioskSessionResult?.ok
        ? { id: kioskSessionResult.session.user.id }
        : null
    if (!dbUser) {
      return NextResponse.json({ error: "Unable to resolve user" }, { status: 500 })
    }

    const activePackages = await prisma.packagePurchase.findMany({
      where: {
        userId: dbUser.id,
        status: "active",
        AND: [
          { OR: [{ courseSlug: null }, { courseSlug: context.courseSlug }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          { OR: [{ isUnlimited: true }, { remainingCredits: { gt: 0 } }] },
        ],
      },
      select: {
        id: true,
        packageId: true,
        packageLabel: true,
        courseSlug: true,
        isUnlimited: true,
        remainingCredits: true,
        expiresAt: true,
        status: true,
      },
      orderBy: [{ expiresAt: "asc" }, { purchasedAt: "desc" }],
      take: 10,
    })

    const selectedPackage = pickPreferredPackage({
      courseSlug: context.courseSlug,
      packages: activePackages,
    })
    if (!selectedPackage) {
      return NextResponse.json({ error: "No active package available for this class." }, { status: 409 })
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
              status: "checked_in",
              checkedInAt: now,
              metadata: {
                ...previousMetadata,
                source: "qr_package_checkin",
                qrDate: context.date,
                qrTime: context.time,
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
                source: "qr_package_checkin",
                qrDate: context.date,
                qrTime: context.time,
              },
            },
          })

      const reserveResult = await reservePackageCreditForAttendanceTx(tx, {
        packagePurchaseId: selectedPackage.id,
        userId: dbUser.id,
        attendanceId: attendance.id,
        courseSlug: context.courseSlug,
        at: now,
        reason: "QR_CHECKIN_PACKAGE",
      })

      const checkedInCount = await tx.attendance.count({
        where: {
          userId: dbUser.id,
          status: { in: [...ATTENDANCE_POINT_STATUSES] },
          session: { courseSlug: context.courseSlug },
        },
      })

      const attendanceMilestoneEvery = await getAttendanceMilestoneClasses(tx)
      let pointsAwarded = 0
      let attendanceMilestone = 0
      if (checkedInCount > 0 && checkedInCount % attendanceMilestoneEvery === 0) {
        attendanceMilestone = Math.floor(checkedInCount / attendanceMilestoneEvery)
        const pointsResult = await awardPointsFromRule({
          db: tx,
          userId: dbUser.id,
          ruleKey: POINTS_RULE_KEYS.CONSECUTIVE_ATTENDANCE,
          eventKey: attendanceMilestoneEventKey(dbUser.id, context.courseSlug, attendanceMilestone),
          fallbackType: "CONSECUTIVE_ATTENDANCE",
          meta: {
            source: "qr_package_checkin",
            courseSlug: context.courseSlug,
            milestoneEvery: attendanceMilestoneEvery,
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
        packagePurchase: reserveResult.packagePurchase,
        checkedInCount,
        attendanceMilestoneEvery,
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
      package: result.packagePurchase
        ? {
            id: result.packagePurchase.id,
            packageId: result.packagePurchase.packageId,
            packageLabel: result.packagePurchase.packageLabel,
            isUnlimited: result.packagePurchase.isUnlimited,
            remainingCredits: result.packagePurchase.remainingCredits,
            status: result.packagePurchase.status,
            expiresAt: result.packagePurchase.expiresAt ? result.packagePurchase.expiresAt.toISOString() : null,
          }
        : null,
      points: {
        awarded: result.pointsAwarded,
        milestone: result.attendanceMilestone > 0 ? result.attendanceMilestone : null,
        attendanceCount: result.checkedInCount,
        milestoneEvery: result.attendanceMilestoneEvery,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === "PACKAGE_NO_CREDITS") {
      return NextResponse.json({ error: "This package has no credits left." }, { status: 409 })
    }
    console.error("QR check-in package POST failed", error)
    return NextResponse.json({ error: "Unable to check in with package" }, { status: 500 })
  }
}
