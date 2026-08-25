import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

const toSafeText = (value: unknown, max = 200) => (typeof value === "string" ? value.trim().slice(0, max) : "")
const toSlug = (value: unknown, max = 80) =>
  toSafeText(value, max)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")

const toOptionalFloat = (value: unknown, min: number, max: number) => {
  if (value === null || value === undefined || value === "") return null
  const out = Number(value)
  if (!Number.isFinite(out)) return null
  return Math.max(min, Math.min(max, out))
}

const prismaRouteError = (error: unknown, fallbackMessage: string) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2021" || error.code === "P2022")) {
    return NextResponse.json(
      { error: "Database schema is out of sync. Run Prisma migrations (npx prisma migrate deploy)." },
      { status: 503 }
    )
  }
  console.error("Staff school points-rules route failed", error)
  return NextResponse.json({ error: fallbackMessage }, { status: 500 })
}

export async function GET(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:school:points-rules:get", getClientIp(req)),
    limit: 120,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json({ error: "Too many requests. Please try again in a moment." }, { status: 429 })
  }

  const authResult = await authorizeStaffPortalRequest()
  if (!authResult.ok) return NextResponse.json({ error: authResult.error }, { status: authResult.status })

  try {
    const items = await prisma.pointsRule.findMany({
      orderBy: [{ createdAt: "desc" }],
    })
    return NextResponse.json({ items })
  } catch (error) {
    return prismaRouteError(error, "Failed to load points rules.")
  }
}

export async function POST(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:school:points-rules:post", getClientIp(req)),
    limit: 60,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json({ error: "Too many requests. Please try again in a moment." }, { status: 429 })
  }

  const authResult = await authorizeStaffPortalRequest()
  if (!authResult.ok) return NextResponse.json({ error: authResult.error }, { status: authResult.status })

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const body = payload as Record<string, unknown>
  const key = toSlug(body.key, 80)
  const label = toSafeText(body.label, 120)
  const description = toSafeText(body.description, 300) || null
  const eventType = toSafeText(body.eventType, 80).toUpperCase()
  const points = toOptionalFloat(body.points, -10_000, 10_000)
  const active = typeof body.active === "boolean" ? body.active : true

  if (!key || key.length < 3) {
    return NextResponse.json({ error: "Rule key is required (min 3 chars)." }, { status: 400 })
  }
  if (!label) {
    return NextResponse.json({ error: "Rule label is required." }, { status: 400 })
  }
  if (!eventType) {
    return NextResponse.json({ error: "Event type is required." }, { status: 400 })
  }
  if (points === null) {
    return NextResponse.json({ error: "Points value is required." }, { status: 400 })
  }

  try {
    const item = await prisma.pointsRule.upsert({
      where: { key },
      create: {
        key,
        label,
        description,
        eventType,
        points,
        active,
      },
      update: {
        label,
        description,
        eventType,
        points,
        active,
      },
    })

    return NextResponse.json({
      ok: true,
      item,
      message: "Points rule saved.",
    })
  } catch (error) {
    return prismaRouteError(error, "Unable to save points rule.")
  }
}
