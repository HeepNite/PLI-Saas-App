import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"
import { withStaffGuard } from "@/lib/security/with-staff-guard"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

/** Get the earliest available time from a course's availableTimes array */
function getEarliestTime(times: string[]): string {
  return [...times].sort()[0] ?? "99:99"
}

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
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:school:course-links:get", limit: 120, windowMs: 60_000 },
    authorize: () => authorizeStaffPortalRequest(),
  })
  if (!guard.ok) return guard.response

  const { searchParams } = new URL(req.url)
  const courseSlug = (searchParams.get("courseSlug") || "").trim().toLowerCase()

  // When no courseSlug, return total count of all CourseLinks
  if (!courseSlug) {
    try {
      const count = await prisma.courseLink.count()
      return NextResponse.json({ count })
    } catch (error) {
      return prismaRouteError(error, "Unable to count course links.")
    }
  }

  try {
    const [asA, asB] = await Promise.all([
      prisma.courseLink.findMany({
        where: { courseSlugA: courseSlug },
        orderBy: [{ createdAt: "asc" }],
      }),
      prisma.courseLink.findMany({
        where: { courseSlugB: courseSlug },
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
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:school:course-links:post", limit: 60, windowMs: 60_000 },
    authorize: () => authorizeStaffPortalRequest(),
  })
  if (!guard.ok) return guard.response

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
    prisma.courseCatalog.findUnique({ where: { slug: courseSlugA }, select: { slug: true, title: true, availableTimes: true } }),
    prisma.courseCatalog.findUnique({ where: { slug: courseSlugB }, select: { slug: true, title: true, availableTimes: true } }),
  ])

  if (!courseA) {
    return NextResponse.json({ error: `Course "${courseSlugA}" not found.` }, { status: 404 })
  }
  if (!courseB) {
    return NextResponse.json({ error: `Course "${courseSlugB}" not found.` }, { status: 404 })
  }

  // Auto-order: ensure courseSlugA is the earlier class
  let finalSlugA = courseSlugA
  let finalSlugB = courseSlugB
  let swapped = false

  const timeA = getEarliestTime(courseA.availableTimes)
  const timeB = getEarliestTime(courseB.availableTimes)

  if (timeB < timeA) {
    finalSlugA = courseSlugB
    finalSlugB = courseSlugA
    swapped = true
  }

  try {
    const link = await prisma.courseLink.create({
      data: {
        courseSlugA: finalSlugA,
        courseSlugB: finalSlugB,
        dropInConsecutiveCents: dropInConsecutiveCents ?? 0,
        packageHolderConsecutiveCents: packageHolderConsecutiveCents ?? 0,
        active,
      },
    })

    return NextResponse.json({
      ok: true,
      item: link,
      message: swapped
        ? `Course link created (auto-ordered by class time: ${finalSlugA} → ${finalSlugB})`
        : "Course link created",
      swapped,
    })
  } catch (error) {
    return prismaRouteError(error, "Unable to create course link.")
  }
}

// ─── PUT: Update an existing CourseLink ────────────────────────

export async function PUT(req: Request) {
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:school:course-links:put", limit: 60, windowMs: 60_000 },
    authorize: () => authorizeStaffPortalRequest(),
  })
  if (!guard.ok) return guard.response

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

  const bodyCourseSlugA = typeof body.courseSlugA === "string" ? body.courseSlugA.trim().toLowerCase() : undefined
  const bodyCourseSlugB = typeof body.courseSlugB === "string" ? body.courseSlugB.trim().toLowerCase() : undefined
  const courseSlugA = bodyCourseSlugA ?? existing.courseSlugA
  const courseSlugB = bodyCourseSlugB ?? existing.courseSlugB
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

  // Auto-order: when both slugs are being updated, ensure courseSlugA is the earlier class
  let finalSlugA = courseSlugA
  let finalSlugB = courseSlugB
  let swapped = false

  if (bodyCourseSlugA !== undefined && bodyCourseSlugB !== undefined) {
    const [courseA, courseB] = await Promise.all([
      prisma.courseCatalog.findUnique({ where: { slug: courseSlugA }, select: { availableTimes: true } }),
      prisma.courseCatalog.findUnique({ where: { slug: courseSlugB }, select: { availableTimes: true } }),
    ])

    if (courseA && courseB) {
      const timeA = getEarliestTime(courseA.availableTimes)
      const timeB = getEarliestTime(courseB.availableTimes)

      if (timeB < timeA) {
        finalSlugA = courseSlugB
        finalSlugB = courseSlugA
        swapped = true
      }
    }
  }

  try {
    const link = await prisma.courseLink.update({
      where: { id },
      data: {
        courseSlugA: finalSlugA,
        courseSlugB: finalSlugB,
        dropInConsecutiveCents,
        packageHolderConsecutiveCents,
        active,
      },
    })

    return NextResponse.json({
      ok: true,
      item: link,
      message: swapped
        ? `Course link updated (auto-ordered by class time: ${finalSlugA} → ${finalSlugB})`
        : "Course link updated.",
      swapped,
    })
  } catch (error) {
    return prismaRouteError(error, "Unable to update course link.")
  }
}

// ─── DELETE: Remove a CourseLink ───────────────────────────────

export async function DELETE(req: Request) {
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:school:course-links:delete", limit: 30, windowMs: 60_000 },
    authorize: () => authorizeStaffPortalRequest(),
  })
  if (!guard.ok) return guard.response

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
