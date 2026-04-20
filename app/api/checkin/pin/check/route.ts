import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createStudentPinLookupDigest, isStudentPinFormatValid } from "@/lib/security/student-pin"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"

export const runtime = "nodejs"

const ACTIVE_PIN_STATUSES = ["active", "rotation_required"] as const

export async function POST(req: Request) {
  try {
    const rateLimit = consumeRateLimit({
      key: buildRateLimitKey("checkin:pin:check", getClientIp(req)),
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

    const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : null
    const pin = typeof payload?.pin === "string" ? payload.pin : ""

    if (!pin) {
      return NextResponse.json({ error: "Missing PIN" }, { status: 400 })
    }

    if (!isStudentPinFormatValid(pin)) {
      return NextResponse.json({ error: "PIN must be exactly 4 digits." }, { status: 400 })
    }

    const pinLookupDigest = createStudentPinLookupDigest(pin)

    const existing = await prisma.studentPinCredential.findFirst({
      where: {
        pinLookupDigest,
        status: { in: [...ACTIVE_PIN_STATUSES] },
      },
      select: { id: true },
    })

    if (existing) {
      return NextResponse.json({
        available: false,
        message: "This PIN is already in use. Please choose a different one.",
      })
    }

    return NextResponse.json({ available: true })
  } catch (error) {
    console.error("PIN check failed", error)
    return NextResponse.json({ error: "Unable to check PIN availability" }, { status: 500 })
  }
}
