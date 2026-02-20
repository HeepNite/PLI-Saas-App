import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { upsertUserByIdentifiers } from "@/lib/users"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"

export const runtime = "nodejs"

export async function GET(req: Request) {
  try {
    const rateLimit = consumeRateLimit({
      key: buildRateLimitKey("profile:points:get", getClientIp(req)),
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

    const [entries, balance] = await Promise.all([
      prisma.pointsLedger.findMany({
        where: { userId: dbUser.id },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.pointsLedger.aggregate({
        where: { userId: dbUser.id },
        _sum: { points: true },
      }),
    ])

    return NextResponse.json({
      balance: balance._sum.points || 0,
      entries: entries.map((entry) => ({
        id: entry.id,
        type: entry.type,
        points: entry.points,
        createdAt: entry.createdAt.toISOString(),
        meta: entry.meta,
      })),
    })
  } catch (error) {
    console.error("Profile points GET failed", error)
    return NextResponse.json({ error: "Unable to load points" }, { status: 500 })
  }
}
