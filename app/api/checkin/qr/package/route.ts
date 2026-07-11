import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { upsertUserByIdentifiers } from "@/lib/users"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { parseQrCheckInContext, isTerminalCheckInAllowed, isConsecutiveAddOnPurchaseAllowed } from "@/lib/checkin/qr"
import { resolveTerminalKioskSession } from "@/lib/checkin/kiosk-session"
import { getCatalogCourseBySlug } from "@/lib/catalog-courses"
import { reservePackageCreditForAttendanceTx } from "@/lib/packages"
import { ensureAttendancePackagePurchase } from "@/lib/purchase-attendance"
import { awardPointsFromRule, getAttendanceMilestoneClasses } from "@/lib/points/service"
import { POINTS_RULE_KEYS } from "@/lib/points/constants"
import { resolveKioskCustomerClerkAuth } from "@/lib/security/kiosk-customer-auth"
import { findConsecutiveLinkBetween } from "@/lib/course-links"
import { hasAttendedCourseToday } from "@/lib/checkin/consecutive-class"
import { asRecord, asText, normalizePhoneDigits } from "@/lib/shared"
import { ATTENDANCE_POINT_STATUSES, ATTENDANCE_STATUS } from "@/lib/attendance-constants"
import { FLOW_CONTEXT, PAYMENT_CHANNEL, PURCHASE_SOURCE, SETTLEMENT_STATUS, resolveKioskPurchaseSource } from "@/lib/payment-constants"

export const runtime = "nodejs"

const attendanceMilestoneEventKey = (userId: string, courseSlug: string, milestone: number) =>
  `consecutive-attendance:${userId}:${courseSlug}:${milestone}`


const pickPreferredPackage = (input: {
  courseSlug: string
  packages: Array<{
    id: string
    packageId: string
    packageLabel: string | null
    courseSlug: string | null
    packagePlan?: { courseSlugs: string[] } | null
    isUnlimited: boolean
    remainingCredits: number | null
    expiresAt: Date | null
    status: string
  }>
}) => {
  const ordered = [...input.packages].sort((a, b) => {
    const aPriority = a.courseSlug === input.courseSlug
      ? 0
      : a.packagePlan?.courseSlugs?.includes(input.courseSlug)
        ? 1
        : 2
    const bPriority = b.courseSlug === input.courseSlug
      ? 0
      : b.packagePlan?.courseSlugs?.includes(input.courseSlug)
        ? 1
        : 2
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

    const payload = asRecord(body)
    const authResult = await auth()
    const kioskSessionToken = typeof payload?.kioskSessionToken === "string" ? payload.kioskSessionToken.trim() : ""
    const flowContext = typeof payload?.flowContext === "string" ? payload.flowContext.trim() : ""
    const kioskCustomerAuth =
      flowContext === FLOW_CONTEXT.KIOSK_TERMINAL
        ? await resolveKioskCustomerClerkAuth(authResult.userId)
        : { userId: authResult.userId, clerkUser: null, blocked: false, blockedRole: null }
    const shouldPreferKioskSession = flowContext === FLOW_CONTEXT.KIOSK_TERMINAL && Boolean(kioskSessionToken)
    const customerClerkUserId = shouldPreferKioskSession ? null : kioskCustomerAuth.userId
    const shouldResolveKioskSession = shouldPreferKioskSession || (!customerClerkUserId && Boolean(kioskSessionToken))
    const kioskSessionResult = shouldResolveKioskSession
      ? await resolveTerminalKioskSession(kioskSessionToken)
      : null

    if (!customerClerkUserId && !kioskSessionResult?.ok) {
      return NextResponse.json(
        {
          error:
            kioskCustomerAuth.blocked && flowContext === FLOW_CONTEXT.KIOSK_TERMINAL
              ? "Kiosk customer identification is required before continuing."
              : kioskSessionResult?.error || "Unauthorized",
        },
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
    const consecutiveAddOn = payload?.consecutiveAddOn === true
    const windowAllowed = consecutiveAddOn
      ? isConsecutiveAddOnPurchaseAllowed(context, now)
      : isTerminalCheckInAllowed(context, now)
    if (!windowAllowed) {
      return NextResponse.json(
        consecutiveAddOn
          ? {
              error: "This class has already ended. Consecutive add-on purchase is no longer available.",
              endsAt: context.endsAt.toISOString(),
            }
          : {
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

    // ─── Resolve user (needed for both consecutive add-on and normal flow) ──
    let email = kioskSessionResult?.ok ? kioskSessionResult.session.user.email : ""
    let phone = kioskSessionResult?.ok ? normalizePhoneDigits(kioskSessionResult.session.user.phone || "") : ""
    let name = kioskSessionResult?.ok ? kioskSessionResult.session.user.name || "" : ""

    const dbUser = kioskSessionResult?.ok
      ? { id: kioskSessionResult.session.user.id }
      : customerClerkUserId
      ? await (async () => {
          const clerkUser = kioskCustomerAuth.clerkUser || await (async () => {
            const client = await clerkClient()
            return client.users.getUser(customerClerkUserId)
          })()
          email = clerkUser.primaryEmailAddress?.emailAddress || ""
          const phoneRaw = clerkUser.primaryPhoneNumber?.phoneNumber || ""
          phone = normalizePhoneDigits(phoneRaw)
          name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim()
          return upsertUserByIdentifiers({
            clerkId: customerClerkUserId,
            email,
            phone,
            name,
            nameIsCanonical: true,
          })
        })()
      : null
    if (!dbUser) {
      return NextResponse.json({ error: "Unable to resolve user" }, { status: 500 })
    }

    // ─── Consecutive package-holder add-on ───────────────────
    // `consecutiveAddOn` is derived earlier (above the window guard) so the
    // correct time predicate can be selected before this block runs.
    const consecutiveCashPayment = payload?.consecutiveCashPayment === true
    const linkedFromCourseSlug = asText(payload?.linkedFromCourseSlug)
    const linkedFromAttendanceId = asText(payload?.linkedFromAttendanceId)
    const consecutivePriceCents = payload?.consecutivePriceCents != null
      ? Number(payload.consecutivePriceCents)
      : null

    if (consecutiveAddOn) {
      if (!linkedFromCourseSlug) {
        return NextResponse.json(
          { error: "linkedFromCourseSlug is required for consecutive add-on" },
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

      if (consecutivePriceCents !== null && consecutivePriceCents !== link.packageHolderConsecutiveCents) {
        return NextResponse.json(
          { error: "Price mismatch: consecutive price does not match configured price" },
          { status: 400 }
        )
      }

      // Hardening: a MONETARY consecutive add-on must NEVER reach this
      // endpoint without explicit cash evidence. The card path goes through
      // /api/checkout/session (Stripe), not here. Without this guard, the
      // route would mark the purchase as `paid` with
      // `paymentChannel: consecutive_addon` and no Stripe IDs — money never
      // collected. See Jhon Doe purchase cmpbkyowj001ow3gpqxwdpexa.
      const effectivePriceCents =
        consecutivePriceCents !== null
          ? consecutivePriceCents
          : link.packageHolderConsecutiveCents
      if (
        typeof effectivePriceCents === "number" &&
        effectivePriceCents > 0 &&
        !consecutiveCashPayment
      ) {
        return NextResponse.json(
          {
            error:
              "Monetary consecutive add-on requires payment selection. Use cash flow (consecutiveCashPayment) or card flow via /api/checkout/session.",
          },
          { status: 400 }
        )
      }

      // Verify student attended Class A. Prefer the exact attendance created
      // by the package check-in flow, but keep it anchored to the class-B
      // session date so stale attendance IDs from another day cannot unlock
      // the consecutive add-on.
      const linkedAttendance = linkedFromAttendanceId
        ? await prisma.attendance.findFirst({
            where: {
              id: linkedFromAttendanceId,
              userId: dbUser.id,
              status: { in: [...ATTENDANCE_POINT_STATUSES] },
              session: { courseSlug: linkedFromCourseSlug, startsAt: context.startsAt },
            },
            select: { id: true },
          })
        : null
      const hasAttendedA = Boolean(linkedAttendance) || await hasAttendedCourseToday(dbUser.id, linkedFromCourseSlug, context.startsAt)
      if (!hasAttendedA) {
        return NextResponse.json(
          { error: "You must attend the first class before adding the consecutive class" },
          { status: 403 }
        )
      }

      // Verify student has an active, non-expired package (any package — the
      // consecutive charge is separate). Do NOT require remaining credits here:
      // the normal class-A package check-in may have just consumed the last
      // credit before the student pays for class B's monetary add-on.
      const activePackages = await prisma.packagePurchase.findMany({
        where: {
          userId: dbUser.id,
          status: "active",
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
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
        take: 10,
      })

      if (activePackages.length === 0) {
        return NextResponse.json(
          { error: "No active package found. Consecutive add-on requires an active package." },
          { status: 409 }
        )
      }

      // Create attendance for Class B WITHOUT deducting package credits
      // This is a SEPARATE monetary charge (consecutivePriceCents)
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

        if (existingAttendance) {
          return {
            attendance: existingAttendance,
            consecutive: true,
            packagePurchase: null,
          }
        }

        const attendance = await tx.attendance.create({
          data: {
            userId: dbUser.id,
            sessionId: session.id,
            status: ATTENDANCE_STATUS.CHECKED_IN_NO_PACKAGE,
            checkedInAt: now,
            metadata: {
              source: "qr_package_consecutive_addon",
              linkedFromCourseSlug,
              consecutivePriceCents,
              qrDate: context.date,
              qrTime: context.time,
            },
          },
        })

        // Create a purchase record for the consecutive monetary charge
        // This is NOT a package credit deduction — it's a separate charge
        const recordedConsecutivePriceCents = effectivePriceCents ?? 0
        await tx.purchase.create({
          data: {
            userId: dbUser.id,
            courseSlug: context.courseSlug,
            courseTitle: course.title,
            amount: recordedConsecutivePriceCents,
            currency: "usd",
            status: consecutiveCashPayment ? SETTLEMENT_STATUS.PENDING : SETTLEMENT_STATUS.PAID,
            participants: 1,
            metadata: {
              paymentChannel: consecutiveCashPayment ? PAYMENT_CHANNEL.CASH : "consecutive_addon",
              settlementStatus: consecutiveCashPayment ? SETTLEMENT_STATUS.PENDING : SETTLEMENT_STATUS.PAID,
              settledAt: consecutiveCashPayment ? null : undefined,
              date: context.date,
              time: context.time,
              source: "qr_package_consecutive_addon",
              purchaseSource: resolveKioskPurchaseSource(flowContext),
              attendanceId: attendance.id,
              linkedFromCourseSlug,
              consecutivePriceCents: recordedConsecutivePriceCents,
              packagePurchaseId: activePackages[0].id,
            },
          },
        })

        return {
          attendance,
          consecutive: true,
          packagePurchase: null,
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
        consecutive: {
          isConsecutiveAddOn: true,
          linkedFromCourseSlug,
          priceCents: consecutivePriceCents,
        },
        package: null,
        points: {
          awarded: 0,
          milestone: null,
          attendanceCount: 0,
          milestoneEvery: 0,
        },
      })
    }

    const activePackages = await prisma.packagePurchase.findMany({
      where: {
        userId: dbUser.id,
        status: "active",
        AND: [
          {
            OR: [
              { courseSlug: context.courseSlug },
              { packagePlan: { courseSlugs: { has: context.courseSlug } } },
              { courseSlug: null, packagePlanId: null },
            ],
          },
          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          { OR: [{ isUnlimited: true, remainingCredits: null }, { remainingCredits: { gt: 0 } }] },
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
        packagePlan: { select: { courseSlugs: true } },
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

    const selectedPackageHasCredit =
      (selectedPackage.isUnlimited && selectedPackage.remainingCredits == null) ||
      (selectedPackage.remainingCredits ?? 0) > 0
    if (!selectedPackageHasCredit) {
      return NextResponse.json({ error: "This package has no credits left." }, { status: 409 })
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
              status: ATTENDANCE_STATUS.CHECKED_IN,
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
              status: ATTENDANCE_STATUS.CHECKED_IN,
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

      await ensureAttendancePackagePurchase(tx, {
        attendanceId: attendance.id,
        userId: dbUser.id,
        courseSlug: context.courseSlug,
        courseTitle: course.title,
        email: email || null,
        name: name || null,
        phone: phone || null,
        packageId: reserveResult.packagePurchase?.packageId || selectedPackage.packageId,
        packagePurchaseId: reserveResult.packagePurchase?.id || selectedPackage.id,
        source: "qr_package_checkin",
        purchaseSource: resolveKioskPurchaseSource(flowContext),
        date: context.date,
        time: context.time,
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
