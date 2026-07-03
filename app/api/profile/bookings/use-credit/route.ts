import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { upsertUserByIdentifiers } from "@/lib/users"
import { buildSessionStartsAt, parseIsoDate, parseTime24 } from "@/lib/class-schedule"
import { reservePackageCreditForAttendanceTx } from "@/lib/packages"
import { ensureAttendancePackagePurchase } from "@/lib/purchase-attendance"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { DEFAULT_CLASS_CAPACITY } from "@/lib/bookings"
import { PURCHASE_SOURCE } from "@/lib/payment-constants"
import { asText } from "@/lib/shared"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const rateLimit = consumeRateLimit({
      key: buildRateLimitKey("profile:bookings:use-credit:post", getClientIp(req)),
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
    const courseSlug = asText(payload?.courseSlug)
    const date = asText(payload?.date)
    const time = asText(payload?.time)

    if (!courseSlug || !parseIsoDate(date) || !parseTime24(time)) {
      return NextResponse.json({ error: "Invalid payload: courseSlug, date (YYYY-MM-DD), and time (HH:MM) are required" }, { status: 400 })
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

    const now = new Date()

    // Find a usable package for this course — mirrors the findUsablePackage logic in fast-class-action
    const packagePurchase = await prisma.packagePurchase.findFirst({
      where: {
        userId: dbUser.id,
        status: "active",
        AND: [
          {
            OR: [
              { courseSlug },
              { packagePlan: { courseSlugs: { has: courseSlug } } },
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
    })

    if (!packagePurchase) {
      return NextResponse.json({ ok: false, reason: "no_package" })
    }

    const startsAt = buildSessionStartsAt(date, time)
    if (!startsAt) {
      return NextResponse.json({ error: "Invalid date/time combination" }, { status: 400 })
    }

    const catalog = await prisma.courseCatalog.findFirst({ where: { slug: courseSlug } })
    const courseTitle = catalog?.title || courseSlug

    const result = await prisma.$transaction(async (tx) => {
      const session = await tx.classSession.upsert({
        where: { courseSlug_startsAt: { courseSlug, startsAt } },
        update: {
          title: courseTitle,
          capacity: DEFAULT_CLASS_CAPACITY,
        },
        create: {
          courseSlug,
          startsAt,
          title: courseTitle,
          durationMinutes: 60,
          capacity: DEFAULT_CLASS_CAPACITY,
        },
      })

      const existingAttendance = await tx.attendance.findUnique({
        where: { userId_sessionId: { userId: dbUser.id, sessionId: session.id } },
      })

      const checkedInAt = new Date()
      const attendance = existingAttendance
        ? await tx.attendance.update({
            where: { id: existingAttendance.id },
            data: { status: "checked_in", checkedInAt },
          })
        : await tx.attendance.create({
            data: {
              userId: dbUser.id,
              sessionId: session.id,
              status: "checked_in",
              checkedInAt,
              metadata: {
                source: "profile_booking",
                date,
                time,
              },
            },
          })

      const reserveResult = await reservePackageCreditForAttendanceTx(tx, {
        packagePurchaseId: packagePurchase.id,
        userId: dbUser.id,
        attendanceId: attendance.id,
        courseSlug,
        at: checkedInAt,
        reason: "PROFILE_BOOKING",
      })

      const resolvedPackage = reserveResult.packagePurchase || packagePurchase

      await ensureAttendancePackagePurchase(tx, {
        attendanceId: attendance.id,
        userId: dbUser.id,
        courseSlug,
        courseTitle,
        email: dbUser.email || null,
        name: dbUser.name || null,
        phone: dbUser.phone || null,
        packageId: resolvedPackage.packageId ?? packagePurchase.packageId,
        packagePurchaseId: resolvedPackage.id,
        source: "profile_booking",
        purchaseSource: PURCHASE_SOURCE.WEB,
        date,
        time,
      })

      return {
        attendanceId: attendance.id,
        packagePurchaseId: resolvedPackage.id,
        remainingCredits: resolvedPackage.remainingCredits,
        isUnlimited: resolvedPackage.isUnlimited,
      }
    })

    return NextResponse.json({
      ok: true,
      attendanceId: result.attendanceId,
      packagePurchaseId: result.packagePurchaseId,
      remainingCredits: result.remainingCredits,
      isUnlimited: result.isUnlimited,
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "PACKAGE_NOT_AVAILABLE" || error.message === "PACKAGE_NO_CREDITS") {
        return NextResponse.json({ ok: false, reason: "no_credits" })
      }
    }

    console.error("Profile bookings use-credit POST failed", error)
    return NextResponse.json({ error: "Unable to consume package credit" }, { status: 500 })
  }
}
