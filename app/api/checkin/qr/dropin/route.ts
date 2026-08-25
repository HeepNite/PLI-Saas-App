import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { upsertUserByIdentifiers } from "@/lib/users"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { authorizeStaffTerminalSession } from "@/lib/security/staff-terminal"
import { isQrActionWindowAllowed, parseQrCheckInContext } from "@/lib/checkin/qr"
import { getCatalogCourseBySlug } from "@/lib/catalog-courses"
import { awardPointsFromRule, getAttendanceMilestoneClasses } from "@/lib/points/service"
import { POINTS_RULE_KEYS } from "@/lib/points/constants"
import { findConsecutiveLinkBetween } from "@/lib/course-links"
import { hasAttendedCourseToday } from "@/lib/checkin/consecutive-class"
import { asObject, asText, normalizePhoneDigits } from "@/lib/shared"
import { ATTENDANCE_POINT_STATUSES, ATTENDANCE_STATUS } from "@/lib/attendance-constants"
import { FLOW_CONTEXT, PAYMENT_CHANNEL } from "@/lib/payment-constants"

export const runtime = "nodejs"

const attendanceMilestoneEventKey = (userId: string, courseSlug: string, milestone: number) =>
  `consecutive-attendance:${userId}:${courseSlug}:${milestone}`


const isPaidPurchaseStatus = (status: string) => ["paid", "succeeded", "completed"].includes(status.toLowerCase())

const isCashPurchaseMetadata = (value: unknown) => {
  const metadata = asObject(value)
  const paymentChannel = asText(metadata.paymentChannel).toLowerCase()
  const paymentMethod = asText(metadata.paymentMethod).toLowerCase()
  const source = asText(metadata.source).toLowerCase()
  return (
    paymentChannel === PAYMENT_CHANNEL.CASH ||
    paymentMethod === "onsite" ||
    paymentMethod === PAYMENT_CHANNEL.CASH ||
    source === "cash_checkout"
  )
}

const isHostedKioskCardPurchase = (value: unknown) => {
  const metadata = asObject(value)
  const flowContext = asText(metadata.flowContext).toLowerCase()
  const paymentSurface = asText(metadata.paymentSurface).toLowerCase()
  return flowContext === FLOW_CONTEXT.KIOSK_TERMINAL && paymentSurface === "hosted_checkout"
}

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

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const payload = asObject(body)
    const paymentIntentId = asText(payload?.paymentIntentId)
    const purchaseId = asText(payload?.purchaseId)
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
    const flowContext = asText(payload?.flowContext)
    const windowAllowed = isQrActionWindowAllowed(
      flowContext === FLOW_CONTEXT.KIOSK_TERMINAL ? "terminal" : "standard",
      context,
      now
    )
    if (!windowAllowed) {
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

    // ─── Consecutive discount validation ─────────────────────
    const consecutiveDiscountApplied = payload?.consecutiveDiscountApplied === true
    const linkedFromCourseSlug = asText(payload?.linkedFromCourseSlug)
    const consecutivePriceCents = payload?.consecutivePriceCents != null
      ? Number(payload.consecutivePriceCents)
      : null

    if (consecutiveDiscountApplied) {
      if (!linkedFromCourseSlug) {
        return NextResponse.json(
          { error: "linkedFromCourseSlug is required when consecutiveDiscountApplied is true" },
          { status: 400 }
        )
      }

      const link = await findConsecutiveLinkBetween(linkedFromCourseSlug, context.courseSlug)
      if (!link) {
        return NextResponse.json(
          { error: "No active consecutive link found for this course pair" },
          { status: 400 }
        )
      }

      if (consecutivePriceCents !== null && consecutivePriceCents !== link.dropInConsecutiveCents) {
        return NextResponse.json(
          { error: "Price mismatch: consecutive price does not match configured price" },
          { status: 400 }
        )
      }
    }

    let dbUser: { id: string } | null = null
    let durableKioskPurchase:
      | {
          id: string
          userId: string
          status: string
          stripePaymentIntentId: string | null
          metadata: unknown
        }
      | null = null

    if (purchaseId && !paymentIntentId) {
      const terminalAuth = await authorizeStaffTerminalSession()
      if (terminalAuth.ok) {
        const purchase = await prisma.purchase.findUnique({
          where: { id: purchaseId },
          select: {
            id: true,
            userId: true,
            status: true,
            courseSlug: true,
            stripePaymentIntentId: true,
            metadata: true,
          },
        })

        const metadata = asObject(purchase?.metadata)
        const purchaseCourseSlug = asText(metadata?.courseSlug) || asText(purchase?.courseSlug)
        const purchaseDate = asText(metadata?.date)
        const purchaseTime = asText(metadata?.time)

        if (
          purchase &&
          purchase.userId &&
          isPaidPurchaseStatus(purchase.status) &&
          !isCashPurchaseMetadata(purchase.metadata) &&
          isHostedKioskCardPurchase(purchase.metadata) &&
          purchaseCourseSlug === context.courseSlug &&
          purchaseDate === context.date &&
          purchaseTime === context.time
        ) {
          dbUser = { id: purchase.userId }
          durableKioskPurchase = purchase
        } else if (!authResult.userId) {
          return NextResponse.json(
            { error: "No successful kiosk card payment was found for this class slot." },
            { status: 409 }
          )
        }
      }
    }

    if (!dbUser) {
      if (!authResult.userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      const client = await clerkClient()
      const clerkUser = await client.users.getUser(authResult.userId)
      const email = clerkUser.primaryEmailAddress?.emailAddress || ""
      const phoneRaw = clerkUser.primaryPhoneNumber?.phoneNumber || ""
      const phone = normalizePhoneDigits(phoneRaw)
      const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim()

      dbUser = await upsertUserByIdentifiers({
        clerkId: authResult.userId,
        email,
        phone,
        name,
        nameIsCanonical: true,
      })
      if (!dbUser) {
        return NextResponse.json({ error: "Unable to resolve user" }, { status: 500 })
      }
    }

    // ─── Verify attendance for Class A when using consecutive discount ──
    if (consecutiveDiscountApplied && linkedFromCourseSlug) {
      const hasAttendedA = await hasAttendedCourseToday(dbUser.id, linkedFromCourseSlug, context.startsAt)
      if (!hasAttendedA) {
        return NextResponse.json(
          { error: "You must attend the first class before purchasing the consecutive class at a discount" },
          { status: 403 }
        )
      }
    }

    const recentPurchases = durableKioskPurchase
      ? [durableKioskPurchase]
      : await prisma.purchase.findMany({
          where: {
            userId: dbUser.id,
            courseSlug: context.courseSlug,
            ...(purchaseId ? { id: purchaseId } : {}),
            ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
            createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
          },
          orderBy: { createdAt: "desc" },
          take: paymentIntentId ? 1 : 30,
        })

    const dropInPurchase =
      recentPurchases.find((purchase) => {
        const metadata = asObject(purchase.metadata)
        const metaDate = asText(metadata?.date)
        const metaTime = asText(metadata?.time)
        const metaPackageId = asText(metadata?.packageId)
        if (metaPackageId) return false
        if (!(metaDate === context.date && metaTime === context.time)) return false
        if (paymentIntentId && purchase.stripePaymentIntentId !== paymentIntentId) return false
        if (purchaseId && purchase.id !== purchaseId) return false

        if (isPaidPurchaseStatus(purchase.status)) return true
        return isCashPurchaseMetadata(purchase.metadata)
      }) || null

    if (!dropInPurchase) {
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
              status: ATTENDANCE_STATUS.CHECKED_IN_NO_PACKAGE,
              checkedInAt: now,
              metadata: {
                ...previousMetadata,
                source: "qr_dropin_checkin",
                purchaseId: dropInPurchase.id,
                qrDate: context.date,
                qrTime: context.time,
              },
            },
          })
        : await tx.attendance.create({
            data: {
              userId: dbUser.id,
              sessionId: session.id,
              status: ATTENDANCE_STATUS.CHECKED_IN_NO_PACKAGE,
              checkedInAt: now,
              metadata: {
                source: "qr_dropin_checkin",
                purchaseId: dropInPurchase.id,
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
            source: "qr_dropin_checkin",
            purchaseId: dropInPurchase.id,
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
      payment: {
        purchaseId: dropInPurchase.id,
        paymentIntentId: dropInPurchase.stripePaymentIntentId,
        paymentStatus: dropInPurchase.status,
        paymentMode: isCashPurchaseMetadata(dropInPurchase.metadata) ? PAYMENT_CHANNEL.CASH : PAYMENT_CHANNEL.CARD,
      },
      points: {
        awarded: result.pointsAwarded,
        milestone: result.attendanceMilestone > 0 ? result.attendanceMilestone : null,
        attendanceCount: result.checkedInCount,
        milestoneEvery: result.attendanceMilestoneEvery,
      },
    })
  } catch (error) {
    console.error("QR check-in drop-in POST failed", error)
    return NextResponse.json({ error: "Unable to complete drop-in check-in" }, { status: 500 })
  }
}
