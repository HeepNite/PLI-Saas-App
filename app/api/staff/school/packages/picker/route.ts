import { NextResponse } from "next/server"
import { authorizeStudentOperationalRequest } from "@/lib/security/staff-portal-auth"
import { withStaffGuard } from "@/lib/security/with-staff-guard"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

/**
 * Narrow, front-desk-readable read path for the "add package" plan picker.
 *
 * Unlike `GET /api/staff/school/packages` (owner/admin-manager only catalog
 * management endpoint), this route is gated by `authorizeStudentOperationalRequest`
 * (owner, admin, or front-desk) and returns only the minimal fields the picker
 * UI needs for active plans. It does NOT loosen the existing admin-catalog GET.
 */
export async function GET(req: Request) {
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:school:packages:picker:get", limit: 120, windowMs: 60_000 },
    authorize: () => authorizeStudentOperationalRequest(),
  })
  if (!guard.ok) return guard.response

  try {
    const items = await prisma.packagePlan.findMany({
      // Only purchasable plans: a null priceCents plan can't be granted as
      // a cash purchase and would guarantee a 400 from the grant endpoint.
      where: { active: true, priceCents: { not: null } },
      orderBy: [{ label: "asc" }],
      select: {
        id: true,
        key: true,
        label: true,
        priceCents: true,
        totalCredits: true,
        validDays: true,
        isUnlimited: true,
        courseSlug: true,
        courseSlugs: true,
      },
    })

    return NextResponse.json({
      ok: true,
      data: {
        items: items.map((plan) => ({
          id: plan.id,
          key: plan.key,
          label: plan.label,
          priceCents: plan.priceCents,
          totalCredits: plan.totalCredits,
          validDays: plan.validDays,
          isUnlimited: plan.isUnlimited,
          courseSlug: plan.courseSlug ?? plan.courseSlugs[0] ?? null,
          courseSlugs: plan.courseSlugs,
        })),
      },
    })
  } catch (error) {
    console.error("Staff school packages picker route failed", error)
    return NextResponse.json({ error: "Failed to load package plans." }, { status: 500 })
  }
}
