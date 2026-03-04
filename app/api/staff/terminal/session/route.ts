import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import {
  clearStaffTerminalSessionCookie,
  createStaffTerminalSessionToken,
  deleteStaffTerminalSessionByToken,
  hashStaffTerminalSessionToken,
  readStaffTerminalCookie,
  setStaffTerminalSessionCookie,
  toTerminalSlug,
  verifyStaffTerminalPin,
} from "@/lib/security/staff-terminal"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:terminal:session:post", getClientIp(req)),
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
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const payload = body as Record<string, unknown>
  const slug = toTerminalSlug(payload.slug)
  const pin = typeof payload.pin === "string" ? payload.pin.trim() : ""

  if (!slug) {
    return NextResponse.json({ error: "Terminal is required." }, { status: 400 })
  }
  if (!/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: "PIN must be exactly 4 digits." }, { status: 400 })
  }

  const terminal = await prisma.staffTerminal.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      location: true,
      defaultCourseSlug: true,
      active: true,
      pinHash: true,
    },
  })

  if (!terminal || !terminal.active) {
    return NextResponse.json({ error: "Terminal not found or inactive." }, { status: 404 })
  }

  if (!verifyStaffTerminalPin(pin, terminal.pinHash)) {
    return NextResponse.json({ error: "Invalid terminal PIN." }, { status: 401 })
  }

  const token = createStaffTerminalSessionToken()
  const tokenHash = hashStaffTerminalSessionToken(token)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30)

  await prisma.staffTerminalSession.deleteMany({
    where: {
      OR: [
        { terminalId: terminal.id },
        { expiresAt: { lte: now } },
      ],
    },
  })

  await prisma.staffTerminalSession.create({
    data: {
      terminalId: terminal.id,
      tokenHash,
      expiresAt,
      lastSeenAt: now,
    },
  })

  await prisma.staffTerminal.update({
    where: { id: terminal.id },
    data: {
      lastSeenAt: now,
      lastUsedAt: now,
    },
  })

  const response = NextResponse.json({
    ok: true,
    terminal: {
      id: terminal.id,
      slug: terminal.slug,
      name: terminal.name,
      location: terminal.location,
      defaultCourseSlug: terminal.defaultCourseSlug,
    },
  })
  setStaffTerminalSessionCookie(response, token)
  return response
}

export async function DELETE() {
  const token = await readStaffTerminalCookie()
  if (token) {
    await deleteStaffTerminalSessionByToken(token)
  }

  const response = NextResponse.json({ ok: true })
  clearStaffTerminalSessionCookie(response)
  return response
}
