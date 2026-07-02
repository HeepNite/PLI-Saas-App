import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"
import { withStaffGuard } from "@/lib/security/with-staff-guard"
import { hashStaffTerminalPin, toTerminalSlug, verifyStaffTerminalPin } from "@/lib/security/staff-terminal"
import { safeText } from "@/lib/api-helpers"

export const runtime = "nodejs"

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

export async function PATCH(req: Request, context: { params: Promise<{ terminalId: string }> }) {
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:terminals:patch", limit: 60, windowMs: 60_000 },
    authorize: () => authorizeStaffPortalRequest(),
  })
  if (!guard.ok) return guard.response
  const authResult = guard.auth

  const { terminalId } = await context.params
  if (!terminalId) {
    return NextResponse.json({ error: "Missing terminalId." }, { status: 400 })
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
  const active = typeof payload.active === "boolean" ? payload.active : true

  if (!name) {
    return NextResponse.json({ error: "Terminal name is required." }, { status: 400 })
  }
  if (!slug || slug.length < 3) {
    return NextResponse.json({ error: "Terminal slug is required." }, { status: 400 })
  }
  if (pin && !/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: "PIN must be exactly 4 digits." }, { status: 400 })
  }

  if (pin) {
    const duplicatePinTerminalId = await ensureUniqueTerminalPin(pin, terminalId)
    if (duplicatePinTerminalId) {
      return NextResponse.json({ error: "PIN already in use by another terminal." }, { status: 409 })
    }
  }

  const current = await prisma.staffTerminal.findUnique({
    where: { id: terminalId },
  })
  if (!current) {
    return NextResponse.json({ error: "Terminal not found." }, { status: 404 })
  }

  try {
    const item = await prisma.staffTerminal.update({
      where: { id: terminalId },
      data: {
        name,
        slug,
        location,
        defaultCourseSlug,
        active,
        ...(pin ? { pinHash: hashStaffTerminalPin(pin) } : {}),
      },
    })

    if (!active || pin) {
      await prisma.staffTerminalSession.deleteMany({
        where: { terminalId },
      })
    }

    return NextResponse.json({
      ok: true,
      item: serializeTerminal(item),
      message: "Terminal updated.",
    })
  } catch {
    return NextResponse.json({ error: "Unable to update terminal. Check slug uniqueness." }, { status: 409 })
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ terminalId: string }> }) {
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:terminals:delete", limit: 30, windowMs: 60_000 },
    authorize: () => authorizeStaffPortalRequest(),
  })
  if (!guard.ok) return guard.response
  const authResult = guard.auth

  const { terminalId } = await context.params
  if (!terminalId) {
    return NextResponse.json({ error: "Missing terminalId." }, { status: 400 })
  }

  const current = await prisma.staffTerminal.findUnique({
    where: { id: terminalId },
    select: { id: true, name: true },
  })
  if (!current) {
    return NextResponse.json({ error: "Terminal not found." }, { status: 404 })
  }

  await prisma.staffTerminal.delete({
    where: { id: terminalId },
  })

  return NextResponse.json({
    ok: true,
    message: `Terminal "${current.name}" deleted.`,
  })
}
