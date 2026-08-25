import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { upsertUserByIdentifiers } from "@/lib/users"
import {
  ACTIVE_BOOKING_STATUSES,
  DEFAULT_CLASS_CAPACITY,
} from "@/lib/bookings"
import {
  buildSessionStartsAt,
  getCourseBySlug,
  isTimeAllowedForCourseDate,
  parseIsoDate,
  parseTime24,
} from "@/lib/class-schedule"
import { reservePackageCreditForAttendanceTx } from "@/lib/packages"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { awardPointsFromRule } from "@/lib/points/service"
import { POINTS_RULE_KEYS } from "@/lib/points/constants"
import { asText } from "@/lib/shared"

export const runtime = "nodejs"

const isUniqueError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"

const toSlotKey = (date: string, time: string) => `${date}|${time}`

const assignmentEventKey = (packagePurchaseId: string) => `package-assignment:${packagePurchaseId}`

export async function POST(req: Request) {
  try {
    const rateLimit = consumeRateLimit({
      key: buildRateLimitKey("profile:bookings:assign:post", getClientIp(req)),
      limit: 20,
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

    const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : null
    const packagePurchaseId = asText(payload?.packagePurchaseId)
    const rawAssignments = Array.isArray(payload?.assignments) ? payload?.assignments : []

    if (!packagePurchaseId || !rawAssignments.length) {
      return NextResponse.json({ error: "Invalid assignment payload" }, { status: 400 })
    }

    const assignments = rawAssignments
      .map((item) => {
        const record = item && typeof item === "object" ? (item as Record<string, unknown>) : null
        return {
          date: asText(record?.date),
          time: asText(record?.time),
        }
      })
      .filter((item) => parseIsoDate(item.date) && parseTime24(item.time))

    if (!assignments.length) {
      return NextResponse.json({ error: "No valid date/time assignments provided" }, { status: 400 })
    }
    if (assignments.length > 20) {
      return NextResponse.json({ error: "You can assign up to 20 classes per request." }, { status: 400 })
    }

    const uniqueSlotKeys = new Set(assignments.map((item) => toSlotKey(item.date, item.time)))
    if (uniqueSlotKeys.size !== assignments.length) {
      return NextResponse.json({ error: "Duplicated slots are not allowed" }, { status: 400 })
    }

    const client = await clerkClient()
    const clerkUser = await client.users.getUser(authResult.userId)
    const email = clerkUser.primaryEmailAddress?.emailAddress || ""
    const phone = clerkUser.primaryPhoneNumber?.phoneNumber || ""
    const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim()

    const dbUser = await upsertUserByIdentifiers({
      clerkId: authResult.userId,
      email,
      name,
      phone,
    })

    if (!dbUser) {
      return NextResponse.json({ error: "Unable to resolve user" }, { status: 500 })
    }

    const packagePurchase = await prisma.packagePurchase.findFirst({
      where: {
        id: packagePurchaseId,
        userId: dbUser.id,
        status: "active",
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: { packagePlan: true },
    })

    if (!packagePurchase) {
      return NextResponse.json({ error: "Package not available" }, { status: 404 })
    }

    const courseSlug = packagePurchase.courseSlug || (packagePurchase.packagePlan?.courseSlugs as string[] | undefined)?.[0] || ""
    if (!courseSlug) {
      return NextResponse.json({ error: "This package is not linked to a specific class" }, { status: 400 })
    }

    for (const slot of assignments) {
      if (!isTimeAllowedForCourseDate(courseSlug, slot.date, slot.time)) {
        return NextResponse.json(
          { error: `The time ${slot.time} is not available for this class.` },
          { status: 400 }
        )
      }
      const startsAt = buildSessionStartsAt(slot.date, slot.time)
      if (!startsAt || startsAt.getTime() <= Date.now()) {
        return NextResponse.json({ error: "All assigned classes must be in the future" }, { status: 400 })
      }
    }

    if (!packagePurchase.isUnlimited) {
      const remaining = packagePurchase.remainingCredits ?? 0
      if (assignments.length > remaining) {
        return NextResponse.json(
          { error: `You only have ${remaining} credits available in this package.` },
          { status: 400 }
        )
      }
    }

    const course = getCourseBySlug(courseSlug)
    const scheduled = await prisma.$transaction(async (tx) => {
      const createdAttendances: Array<{ id: string; startsAt: string; sessionId: string }> = []
      let pointsAwarded = 0

      for (const slot of assignments) {
        const startsAt = buildSessionStartsAt(slot.date, slot.time)
        if (!startsAt) {
          throw new Error("INVALID_SLOT")
        }

        const session = await tx.classSession.upsert({
          where: {
            courseSlug_startsAt: {
              courseSlug,
              startsAt,
            },
          },
          update: {
            title: course?.title || packagePurchase.packageLabel || courseSlug,
            capacity: DEFAULT_CLASS_CAPACITY,
          },
          create: {
            courseSlug,
            startsAt,
            title: course?.title || packagePurchase.packageLabel || courseSlug,
            durationMinutes: 60,
            capacity: DEFAULT_CLASS_CAPACITY,
          },
        })

        const occupancy = await tx.attendance.count({
          where: {
            sessionId: session.id,
            status: { in: ACTIVE_BOOKING_STATUSES },
          },
        })
        const capacity = session.capacity || DEFAULT_CLASS_CAPACITY
        if (occupancy >= capacity) {
          throw new Error(`CLASS_FULL:${slot.date}:${slot.time}`)
        }

        let attendance
        try {
          attendance = await tx.attendance.create({
            data: {
              userId: dbUser.id,
              sessionId: session.id,
              status: "scheduled",
              checkedInAt: startsAt,
              metadata: {
                source: "package_assignment",
                packagePurchaseId,
              },
            },
          })
        } catch (error) {
          if (isUniqueError(error)) {
            throw new Error(`BOOKING_EXISTS:${slot.date}:${slot.time}`)
          }
          throw error
        }

        await reservePackageCreditForAttendanceTx(tx, {
          packagePurchaseId,
          userId: dbUser.id,
          attendanceId: attendance.id,
          courseSlug,
          at: startsAt,
          reason: "PACKAGE_ASSIGNMENT",
        })

        createdAttendances.push({
          id: attendance.id,
          startsAt: startsAt.toISOString(),
          sessionId: session.id,
        })
      }

      const pointsResult = await awardPointsFromRule({
        db: tx,
        userId: dbUser.id,
        ruleKey: POINTS_RULE_KEYS.PACKAGE_ASSIGNMENT,
        eventKey: assignmentEventKey(packagePurchaseId),
        fallbackType: "PACKAGE_ASSIGNMENT",
        meta: {
          packagePurchaseId,
          assignedCount: assignments.length,
        },
      })
      if (pointsResult.awarded) {
        pointsAwarded = pointsResult.points
      }

      const updatedPackage = await tx.packagePurchase.findUnique({
        where: { id: packagePurchaseId },
        select: {
          id: true,
          isUnlimited: true,
          remainingCredits: true,
          totalCredits: true,
          status: true,
        },
      })

      return { createdAttendances, updatedPackage, pointsAwarded }
    })

    return NextResponse.json({
      created: scheduled.createdAttendances,
      package: scheduled.updatedPackage,
      pointsAwarded: scheduled.pointsAwarded,
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith("CLASS_FULL:")) {
        return NextResponse.json({ error: "One of the selected classes is full" }, { status: 409 })
      }
      if (error.message.startsWith("BOOKING_EXISTS:")) {
        return NextResponse.json({ error: "You already have a class booked in one selected slot" }, { status: 409 })
      }
      if (error.message === "PACKAGE_NO_CREDITS") {
        return NextResponse.json({ error: "This package has no credits left" }, { status: 409 })
      }
    }

    console.error("Profile bookings assign POST failed", error)
    return NextResponse.json({ error: "Unable to assign classes" }, { status: 500 })
  }
}
