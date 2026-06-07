import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { upsertUserByIdentifiers } from "@/lib/users"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"

export const runtime = "nodejs"

const toIso = (value: Date | null | undefined) => (value ? value.toISOString() : null)

export async function GET(req: Request) {
  try {
    const rateLimit = consumeRateLimit({
      key: buildRateLimitKey("profile:packages:get", getClientIp(req)),
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

    const now = new Date()
    const packages = await prisma.packagePurchase.findMany({
      where: {
        userId: dbUser.id,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: {
        packagePlan: true,
      },
      orderBy: [{ status: "asc" }, { purchasedAt: "desc" }],
    })

    const normalized = packages.map((pkg) => ({
      id: pkg.id,
      packageId: pkg.packageId,
      label: pkg.packageLabel || pkg.packagePlan?.label || pkg.packageId,
      courseSlug: pkg.courseSlug || (pkg.packagePlan?.courseSlugs as string[] | undefined)?.[0] || null,
      status: pkg.status,
      isUnlimited: pkg.isUnlimited,
      totalCredits: pkg.totalCredits,
      remainingCredits: pkg.remainingCredits,
      purchasedAt: toIso(pkg.purchasedAt),
      expiresAt: toIso(pkg.expiresAt),
      lastUsedAt: toIso(pkg.lastUsedAt),
      cadence: pkg.packagePlan?.cadence || null,
      source: pkg.source,
    }))

    const activePackages = normalized.filter((pkg) => pkg.status === "active")
    const summary = {
      activePackages: activePackages.length,
      unlimitedPackages: activePackages.filter((pkg) => pkg.isUnlimited).length,
      totalRemainingCredits: activePackages.reduce((sum, pkg) => sum + (pkg.remainingCredits ?? 0), 0),
      nextExpiration:
        activePackages
          .map((pkg) => pkg.expiresAt)
          .filter(Boolean)
          .sort()[0] || null,
    }

    return NextResponse.json({ packages: normalized, summary })
  } catch (error) {
    console.error("Profile packages GET failed", error)
    return NextResponse.json({ error: "Unable to load packages" }, { status: 500 })
  }
}
