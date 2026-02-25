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

const toOptionalInt = (value: unknown, min: number, max: number) => {
  if (value === null || value === undefined || value === "") return null
  const out = Number(value)
  if (!Number.isFinite(out)) return null
  return Math.max(min, Math.min(max, Math.round(out)))
}

const prismaRouteError = (error: unknown, fallbackMessage: string) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2021" || error.code === "P2022")) {
    return NextResponse.json(
      { error: "Database schema is out of sync. Run Prisma migrations (npx prisma migrate deploy)." },
      { status: 503 }
    )
  }
  console.error("Staff school packages route failed", error)
  return NextResponse.json({ error: fallbackMessage }, { status: 500 })
}

export async function GET(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:school:packages:get", getClientIp(req)),
    limit: 120,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json({ error: "Too many requests. Please try again in a moment." }, { status: 429 })
  }

  const authResult = await authorizeStaffPortalRequest()
  if (!authResult.ok) return NextResponse.json({ error: authResult.error }, { status: authResult.status })

  try {
    const items = await prisma.packagePlan.findMany({
      orderBy: [{ createdAt: "desc" }],
    })
    return NextResponse.json({ items })
  } catch (error) {
    return prismaRouteError(error, "Failed to load package plans.")
  }
}

export async function POST(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:school:packages:post", getClientIp(req)),
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
  const courseSlug = toSlug(body.courseSlug, 80) || null
  const label = toSafeText(body.label, 120)
  const description = toSafeText(body.description, 300) || null
  const cadence = toSafeText(body.cadence, 80) || null
  const totalCredits = toOptionalInt(body.totalCredits, 0, 9999)
  const makeUps = toOptionalInt(body.makeUps, 0, 9999) ?? 0
  const validDays = toOptionalInt(body.validDays, 1, 3650) ?? 180
  const priceCents = toOptionalInt(body.priceCents, 0, 2_000_000)
  const isUnlimited = Boolean(body.isUnlimited)
  const active = typeof body.active === "boolean" ? body.active : true

  if (!key || key.length < 3) {
    return NextResponse.json({ error: "Package key is required (min 3 chars)." }, { status: 400 })
  }
  if (!label) {
    return NextResponse.json({ error: "Package label is required." }, { status: 400 })
  }

  try {
    const item = await prisma.packagePlan.upsert({
      where: { key },
      create: {
        key,
        courseSlug,
        label,
        description,
        cadence,
        totalCredits: isUnlimited ? null : totalCredits,
        makeUps,
        validDays,
        priceCents,
        isUnlimited,
        active,
      },
      update: {
        courseSlug,
        label,
        description,
        cadence,
        totalCredits: isUnlimited ? null : totalCredits,
        makeUps,
        validDays,
        priceCents,
        isUnlimited,
        active,
      },
    })

    return NextResponse.json({
      ok: true,
      item,
      message: "Package saved.",
    })
  } catch (error) {
    return prismaRouteError(error, "Unable to save package.")
  }
}
