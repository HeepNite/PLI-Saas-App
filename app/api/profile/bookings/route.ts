import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { upsertUserByIdentifiers } from "@/lib/users"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { syncScheduledAttendanceFromPurchase } from "@/lib/bookings"
import { getCatalogFrontData } from "@/lib/catalog-courses"

export const runtime = "nodejs"

const toIso = (value: Date | null | undefined) => (value ? value.toISOString() : null)

export async function GET(req: Request) {
  try {
    const rateLimit = consumeRateLimit({
      key: buildRateLimitKey("profile:bookings:get", getClientIp(req)),
      limit: 90,
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

    // Backfill scheduled classes from paid purchases that already have date/time metadata.
    const paidPurchases = await prisma.purchase.findMany({
      where: {
        userId: dbUser.id,
        status: { in: ["paid", "succeeded"] },
      },
      include: {
        packagePurchases: {
          select: { id: true },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    })

    for (const purchase of paidPurchases) {
      const metadata = purchase.metadata && typeof purchase.metadata === "object"
        ? (purchase.metadata as Record<string, unknown>)
        : null
      const metaDate = typeof metadata?.date === "string" ? metadata.date : null
      const metaTime = typeof metadata?.time === "string" ? metadata.time : null
      if (!metaDate || !metaTime) continue
      await syncScheduledAttendanceFromPurchase({
        userId: dbUser.id,
        purchaseId: purchase.id,
        courseSlug: purchase.courseSlug,
        courseTitle: purchase.courseTitle,
        date: metaDate,
        time: metaTime,
        packagePurchaseId: purchase.packagePurchases[0]?.id || null,
      })
    }

    const now = new Date()
    const [bookings, packagePurchases] = await Promise.all([
      prisma.attendance.findMany({
        where: {
          userId: dbUser.id,
          status: { in: ["scheduled"] },
          session: { startsAt: { gte: now } },
        },
        include: {
          session: true,
          packageUsage: {
            include: {
              packagePurchase: {
                select: {
                  id: true,
                  packageId: true,
                  packageLabel: true,
                  isUnlimited: true,
                  remainingCredits: true,
                },
              },
            },
          },
        },
        orderBy: {
          session: {
            startsAt: "asc",
          },
        },
        take: 50,
      }),
      prisma.packagePurchase.findMany({
        where: {
          userId: dbUser.id,
          status: "active",
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          AND: [{ OR: [{ isUnlimited: true }, { remainingCredits: { gt: 0 } }] }],
        },
        include: { packagePlan: true },
        orderBy: { purchasedAt: "desc" },
        take: 20,
      }),
    ])

    const catalogData = await getCatalogFrontData()
    const courseTitleBySlug = new Map(
      catalogData.courses.map((course) => [course.slug, course.title])
    )

    const bookingItems = bookings.map((attendance) => {
      const catalogTitle = courseTitleBySlug.get(attendance.session.courseSlug)
      return {
        id: attendance.id,
        status: attendance.status,
        startsAt: attendance.session.startsAt.toISOString(),
        courseSlug: attendance.session.courseSlug,
        courseTitle: attendance.session.title || catalogTitle || attendance.session.courseSlug,
        sessionId: attendance.sessionId,
        packagePurchaseId: attendance.packageUsage?.packagePurchaseId || null,
        packageLabel: attendance.packageUsage?.packagePurchase?.packageLabel || null,
      }
    })

    const packageItems = packagePurchases.map((pkg) => ({
      id: pkg.id,
      packageId: pkg.packageId,
      label: pkg.packageLabel || pkg.packagePlan?.label || pkg.packageId,
      courseSlug: pkg.courseSlug || pkg.packagePlan?.courseSlug || null,
      remainingCredits: pkg.isUnlimited ? null : pkg.remainingCredits,
      totalCredits: pkg.isUnlimited ? null : pkg.totalCredits,
      isUnlimited: pkg.isUnlimited,
      expiresAt: toIso(pkg.expiresAt),
    }))

    return NextResponse.json({
      bookings: bookingItems,
      packages: packageItems,
    })
  } catch (error) {
    console.error("Profile bookings GET failed", error)
    return NextResponse.json({ error: "Unable to load bookings" }, { status: 500 })
  }
}
