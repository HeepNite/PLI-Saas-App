import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { upsertUserByIdentifiers } from "@/lib/users"
import { reservePublicPackageBooking } from "@/lib/bookings/public-package-booking"
import { parseIsoDate, parseTime24 } from "@/lib/class-schedule"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { asText } from "@/lib/shared"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("profile:bookings:reserve-package:post", getClientIp(req)),
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
  if (!authResult.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const payload = body && typeof body === "object" ? body as Record<string, unknown> : null
  const courseSlug = asText(payload?.courseSlug)
  const date = asText(payload?.date)
  const time = asText(payload?.time)
  if (!courseSlug || !parseIsoDate(date) || !parseTime24(time)) {
    return NextResponse.json(
      { error: "courseSlug, date (YYYY-MM-DD), and time (HH:MM) are required" },
      { status: 400 }
    )
  }

  const client = await clerkClient()
  const clerkUser = await client.users.getUser(authResult.userId)
  const dbUser = await upsertUserByIdentifiers({
    clerkId: authResult.userId,
    email: clerkUser.primaryEmailAddress?.emailAddress || "",
    name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim(),
    phone: clerkUser.primaryPhoneNumber?.phoneNumber || "",
  })
  if (!dbUser) return NextResponse.json({ error: "Unable to resolve user" }, { status: 500 })

  try {
    const result = await reservePublicPackageBooking(prisma, {
      userId: dbUser.id,
      courseSlug,
      date,
      time,
    })
    if (result.kind === "reserved") return NextResponse.json({ ok: true, ...result })
    if (result.kind === "no_package" || result.kind === "no_credits") {
      return NextResponse.json({ ok: false, reason: result.kind })
    }
    if (result.kind === "invalid_slot") {
      return NextResponse.json({ error: "The selected class is not available." }, { status: 400 })
    }
    if (result.kind === "class_full") {
      return NextResponse.json({ error: "This class is full." }, { status: 409 })
    }
    return NextResponse.json({ error: "This class is already booked." }, { status: 409 })
  } catch (error) {
    if (error instanceof Error && error.message === "PACKAGE_NO_CREDITS") {
      return NextResponse.json({ ok: false, reason: "no_credits" })
    }
    console.error("Public package reservation failed", error)
    return NextResponse.json({ error: "Unable to reserve this class with your package." }, { status: 500 })
  }
}
