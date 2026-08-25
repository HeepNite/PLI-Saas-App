import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { buildTerminalPinAlert } from "@/lib/security/kiosk-pin-throttle"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { hashStaffTerminalPin, toTerminalSlug, verifyStaffTerminalPin } from "@/lib/security/staff-terminal"

export const runtime = "nodejs"

const safeText = (value: unknown, max = 120) => (typeof value === "string" ? value.trim().slice(0, max) : "")

const serializeTerminal = (terminal: {
  id: string
  slug: string
  name: string
  location: string | null
  defaultCourseSlug: string | null
  active: boolean
  createdByUserId: string | null
  lastSeenAt: Date | null
  lastUsedAt: Date | null
  createdAt: Date
  updatedAt: Date
  kioskMissCounter?: {
    missCount: number
    windowStart: Date
    blockedUntil: Date | null
  } | null
}) => ({
  id: terminal.id,
  slug: terminal.slug,
  name: terminal.name,
  location: terminal.location,
  defaultCourseSlug: terminal.defaultCourseSlug,
  active: terminal.active,
  createdByUserId: terminal.createdByUserId,
  lastSeenAt: terminal.lastSeenAt?.toISOString() || null,
  lastUsedAt: terminal.lastUsedAt?.toISOString() || null,
  createdAt: terminal.createdAt.toISOString(),
  updatedAt: terminal.updatedAt.toISOString(),
  pinAlert: terminal.kioskMissCounter
    ? buildTerminalPinAlert({
        missCount: terminal.kioskMissCounter.missCount,
        windowStart: terminal.kioskMissCounter.windowStart,
        blockedUntil: terminal.kioskMissCounter.blockedUntil,
      })
    : null,
})

const ensureUniqueTerminalPin = async (pin: string, excludedTerminalId = "") => {
  const terminals = await prisma.staffTerminal.findMany({
    select: { id: true, pinHash: true },
  })

  const duplicate = terminals.find((terminal) => {
    if (terminal.id === excludedTerminalId) return false
    return verifyStaffTerminalPin(pin, terminal.pinHash)
  })

  return duplicate ? duplicate.id : null
}

export async function GET(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:terminals:get", getClientIp(req)),
    limit: 90,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  const authResult = await authorizeStaffPortalRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const items = await prisma.staffTerminal.findMany({
    include: {
      kioskMissCounter: {
        select: {
          missCount: true,
          windowStart: true,
          blockedUntil: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  })

  return NextResponse.json({ items: items.map(serializeTerminal) })
}

export async function POST(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:terminals:post", getClientIp(req)),
    limit: 40,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  const authResult = await authorizeStaffPortalRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const payload = body as Record<string, unknown>
  const name = safeText(payload.name, 120)
  const slug = toTerminalSlug(payload.slug || payload.name)
  const location = safeText(payload.location, 120) || null
  const defaultCourseSlug = safeText(payload.defaultCourseSlug, 80).toLowerCase() || null
  const pin = typeof payload.pin === "string" ? payload.pin.trim() : ""

  if (!name) {
    return NextResponse.json({ error: "Terminal name is required." }, { status: 400 })
  }
  if (!slug || slug.length < 3) {
    return NextResponse.json({ error: "Terminal slug is required." }, { status: 400 })
  }
  if (!/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: "PIN must be exactly 4 digits." }, { status: 400 })
  }

  const duplicatePinTerminalId = await ensureUniqueTerminalPin(pin)
  if (duplicatePinTerminalId) {
    return NextResponse.json({ error: "PIN already in use by another terminal." }, { status: 409 })
  }

  try {
    const item = await prisma.staffTerminal.create({
      data: {
        slug,
        name,
        location,
        defaultCourseSlug,
        pinHash: hashStaffTerminalPin(pin),
        createdByUserId: authResult.userId,
      },
    })

    return NextResponse.json({
      ok: true,
      item: serializeTerminal(item),
      message: "Terminal created.",
    })
  } catch {
    return NextResponse.json({ error: "Unable to create terminal. Check slug uniqueness." }, { status: 409 })
  }
}
