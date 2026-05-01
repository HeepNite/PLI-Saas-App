import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

const prismaRouteError = (error: unknown, fallbackMessage: string) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2021" || error.code === "P2022")) {
    return NextResponse.json(
      { error: "Database schema is out of sync. Run Prisma migrations (npx prisma migrate deploy)." },
      { status: 503 }
    )
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return NextResponse.json(
      { error: "This course link already exists." },
      { status: 409 }
    )
  }
  console.error("Staff course links route failed", error)
  return NextResponse.json({ error: fallbackMessage }, { status: 500 })
}

// ─── GET: Load CourseLinks for a course ─────────────────────────

export async function GET(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:school:course-links:get", getClientIp(req)),
    limit: 120,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json({ error: "Too many requests. Please try again in a moment." }, { status: 429 })
  }

  const authResult = await authorizeStaffPortalRequest()
  if (!authResult.ok) return NextResponse.json({ error: authResult.error }, { status: authResult.status })

  const { searchParams } = new URL(req.url)
  const courseSlug = (searchParams.get("courseSlug") || "").trim().toLowerCase()
  if (!courseSlug) {
    return NextResponse.json({ error: "courseSlug is required." }, { status: 400 })
  }

  try {
    const [asA, asB] = await Promise.all([
      prisma.courseLink.findMany({
        where: { courseSlugA: courseSlug, active: true },
        orderBy: [{ createdAt: "asc" }],
      }),
      prisma.courseLink.findMany({
        where: { courseSlugB: courseSlug, active: true },
        orderBy: [{ createdAt: "asc" }],
      }),
    ])

    return NextResponse.json({ asA, asB })
  } catch (error) {
    return prismaRouteError(error, "Unable to load course links.")
  }
}

// ─── POST: Create a new CourseLink ─────────────────────────────

export async function POST(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:school:course-links:post", getClientIp(req)),
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
  const courseSlugA = typeof body.courseSlugA === "string" ? body.courseSlugA.trim().toLowerCase() : ""
  const courseSlugB = typeof body.courseSlugB === "string" ? body.courseSlugB.trim().toLowerCase() : ""
  const dropInConsecutiveCents =
    typeof body.dropInConsecutiveCents === "number" && Number.isFinite(body.dropInConsecutiveCents) && body.dropInConsecutiveCents >= 0
      ? Math.round(body.dropInConsecutiveCents)
      : null
  const packageHolderConsecutiveCents =
    typeof body.packageHolderConsecutiveCents === "number" && Number.isFinite(body.packageHolderConsecutiveCents) && body.packageHolderConsecutiveCents >= 0
      ? Math.round(body.packageHolderConsecutiveCents)
      : null
  const active = typeof body.active === "boolean" ? body.active : true

  if (!courseSlugA || !courseSlugB) {
    return NextResponse.json({ error: "Both courseSlugA and courseSlugB are required." }, { status: 400 })
  }

  // Prevent self-linking
  if (courseSlugA === courseSlugB) {
    return NextResponse.json({ error: "A course cannot be linked to itself." }, { status: 400 })
  }

  // Validate both courses exist
  const [courseA, courseB] = await Promise.all([
    prisma.courseCatalog.findUnique({ where: { slug: courseSlugA }, select: { slug: true, title: true } }),
    prisma.courseCatalog.findUnique({ where: { slug: courseSlugB }, select: { slug: true, title: true } }),
  ])

  if (!courseA) {
    return NextResponse.json({ error: `Course "${courseSlugA}" not found.` }, { status: 404 })
  }
  if (!courseB) {
    return NextResponse.json({ error: `Course "${courseSlugB}" not found.` }, { status: 404 })
  }

  try {
    const link = await prisma.courseLink.create({
      data: {
        courseSlugA,
        courseSlugB,
        dropInConsecutiveCents: dropInConsecutiveCents ?? 0,
        packageHolderConsecutiveCents: packageHolderConsecutiveCents ?? 0,
        active,
      },
    })

    return NextResponse.json({
      ok: true,
      item: link,
      message: `Link created: ${courseA.title} → ${courseB.title}`,
    })
  } catch (error) {
    return prismaRouteError(error, "Unable to create course link.")
  }
}

// ─── PUT: Update an existing CourseLink ────────────────────────

export async function PUT(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:school:course-links:put", getClientIp(req)),
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
  const id = typeof body.id === "string" ? body.id.trim() : ""

  if (!id) {
    return NextResponse.json({ error: "Link ID is required." }, { status: 400 })
  }

  const existing = await prisma.courseLink.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Course link not found." }, { status: 404 })
  }

  const courseSlugA = typeof body.courseSlugA === "string" ? body.courseSlugA.trim().toLowerCase() : existing.courseSlugA
  const courseSlugB = typeof body.courseSlugB === "string" ? body.courseSlugB.trim().toLowerCase() : existing.courseSlugB
  const dropInConsecutiveCents =
    typeof body.dropInConsecutiveCents === "number" && Number.isFinite(body.dropInConsecutiveCents) && body.dropInConsecutiveCents >= 0
      ? Math.round(body.dropInConsecutiveCents)
      : existing.dropInConsecutiveCents
  const packageHolderConsecutiveCents =
    typeof body.packageHolderConsecutiveCents === "number" && Number.isFinite(body.packageHolderConsecutiveCents) && body.packageHolderConsecutiveCents >= 0
      ? Math.round(body.packageHolderConsecutiveCents)
      : existing.packageHolderConsecutiveCents
  const active = typeof body.active === "boolean" ? body.active : existing.active

  // Prevent self-linking on update
  if (courseSlugA === courseSlugB) {
    return NextResponse.json({ error: "A course cannot be linked to itself." }, { status: 400 })
  }

  try {
    const link = await prisma.courseLink.update({
      where: { id },
      data: {
        courseSlugA,
        courseSlugB,
        dropInConsecutiveCents,
        packageHolderConsecutiveCents,
        active,
      },
    })

    return NextResponse.json({
      ok: true,
      item: link,
      message: "Course link updated.",
    })
  } catch (error) {
    return prismaRouteError(error, "Unable to update course link.")
  }
}

// ─── DELETE: Remove a CourseLink ───────────────────────────────

export async function DELETE(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:school:course-links:delete", getClientIp(req)),
    limit: 30,
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
  const id = typeof body.id === "string" ? body.id.trim() : ""

  if (!id) {
    return NextResponse.json({ error: "Link ID is required." }, { status: 400 })
  }

  const existing = await prisma.courseLink.findUnique({ where: { id }, select: { id: true, courseSlugA: true, courseSlugB: true } })
  if (!existing) {
    return NextResponse.json({ error: "Course link not found." }, { status: 404 })
  }

  try {
    await prisma.courseLink.delete({ where: { id } })

    return NextResponse.json({
      ok: true,
      message: `Link removed: ${existing.courseSlugA} → ${existing.courseSlugB}`,
    })
  } catch (error) {
    return prismaRouteError(error, "Unable to delete course link.")
  }
}
