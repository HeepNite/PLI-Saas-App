import { NextResponse } from "next/server"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"
import { withStaffGuard } from "@/lib/security/with-staff-guard"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

const toSafeText = (value: unknown, max = 200) => (typeof value === "string" ? value.trim().slice(0, max) : "")

export async function POST(req: Request) {
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:school:points-assign:post", limit: 60, windowMs: 60_000 },
    authorize: () => authorizeStaffPortalRequest(),
  })
  if (!guard.ok) return guard.response
  const authResult = guard.auth

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const body = payload as Record<string, unknown>
  const userEmail = toSafeText(body.userEmail, 160).toLowerCase()
  const userId = toSafeText(body.userId, 80)
  const type = toSafeText(body.type, 80).toUpperCase() || "MANUAL_STAFF_ASSIGNMENT"
  const note = toSafeText(body.note, 300)
  const eventKeyInput = toSafeText(body.eventKey, 120)
  const pointsValue = Number(body.points)

  if (!Number.isFinite(pointsValue) || pointsValue === 0) {
    return NextResponse.json({ error: "Points must be a non-zero number." }, { status: 400 })
  }
  if (!userId && !userEmail) {
    return NextResponse.json({ error: "User email or userId is required." }, { status: 400 })
  }

  const user = await prisma.user.findFirst({
    where: userId ? { id: userId } : { email: userEmail },
    select: { id: true, email: true, name: true },
  })
  if (!user) {
    return NextResponse.json({ error: "User was not found." }, { status: 404 })
  }

  const eventKey = eventKeyInput || null
  if (eventKey) {
    const exists = await prisma.pointsLedger.findFirst({
      where: { eventKey },
      select: { id: true },
    })
    if (exists) {
      return NextResponse.json({ error: "Event key already exists." }, { status: 409 })
    }
  }

  await prisma.pointsLedger.create({
    data: {
      userId: user.id,
      type,
      points: pointsValue,
      eventKey,
      meta: {
        source: "staff-school-admin",
        note: note || null,
        assignedByUserId: authResult.userId,
      },
    },
  })

  const balance = await prisma.pointsLedger.aggregate({
    where: { userId: user.id },
    _sum: { points: true },
  })

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name || "",
    },
    pointsBalance: balance._sum.points || 0,
    message: "Points assigned.",
  })
}

