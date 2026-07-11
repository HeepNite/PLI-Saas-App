import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizeStudentOperational = vi.fn()

const mockPrisma = {
  packagePlan: {
    findMany: vi.fn(),
  },
}

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeStudentOperationalRequest: (...args: unknown[]) => mockAuthorizeStudentOperational(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

const buildPlanRow = (overrides: Partial<{
  id: string
  key: string
  label: string
  priceCents: number | null
  totalCredits: number | null
  validDays: number
  isUnlimited: boolean
  courseSlug: string | null
  courseSlugs: string[]
}> = {}) => ({
  id: overrides.id ?? "plan_1",
  key: overrides.key ?? "pkg_10class",
  label: overrides.label ?? "10 Class Pack",
  priceCents: overrides.priceCents === undefined ? 15000 : overrides.priceCents,
  totalCredits: overrides.totalCredits === undefined ? 10 : overrides.totalCredits,
  validDays: overrides.validDays ?? 90,
  isUnlimited: overrides.isUnlimited ?? false,
  courseSlug: "courseSlug" in overrides ? overrides.courseSlug ?? null : "yoga-101",
  courseSlugs: overrides.courseSlugs ?? [],
})

describe("GET /api/staff/school/packages/picker", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuthorizeStudentOperational.mockReset()
    mockAuthorizeStudentOperational.mockResolvedValue({
      ok: true,
      userId: "front_desk_1",
      role: "staff",
      category: "front_desk",
      staffName: "Front Desk Staff",
    })

    mockPrisma.packagePlan.findMany.mockReset()
    mockPrisma.packagePlan.findMany.mockResolvedValue([buildPlanRow()])
  })

  it("allows front_desk to read active plans", async () => {
    const { GET } = await import("@/app/api/staff/school/packages/picker/route")
    const res = await GET(new Request("http://localhost/api/staff/school/packages/picker", { method: "GET" }))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.data.items).toHaveLength(1)
    expect(data.data.items[0]).toMatchObject({
      id: "plan_1",
      key: "pkg_10class",
      label: "10 Class Pack",
      priceCents: 15000,
      totalCredits: 10,
      validDays: 90,
      isUnlimited: false,
      courseSlug: "yoga-101",
    })
  })

  it("allows owner and admin to read active plans", async () => {
    mockAuthorizeStudentOperational.mockResolvedValue({ ok: true, userId: "owner_1", role: "owner", category: null })
    const { GET } = await import("@/app/api/staff/school/packages/picker/route")
    const res = await GET(new Request("http://localhost/api/staff/school/packages/picker", { method: "GET" }))
    expect(res.status).toBe(200)
  })

  it("rejects unauthorized roles", async () => {
    mockAuthorizeStudentOperational.mockResolvedValue({ ok: false, status: 403, error: "Insufficient role" })
    const { GET } = await import("@/app/api/staff/school/packages/picker/route")
    const res = await GET(new Request("http://localhost/api/staff/school/packages/picker", { method: "GET" }))
    expect(res.status).toBe(403)
  })

  it("only queries active plans", async () => {
    const { GET } = await import("@/app/api/staff/school/packages/picker/route")
    await GET(new Request("http://localhost/api/staff/school/packages/picker", { method: "GET" }))

    expect(mockPrisma.packagePlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { active: true } })
    )
  })

  it("falls back to the first courseSlugs entry when courseSlug is null", async () => {
    mockPrisma.packagePlan.findMany.mockResolvedValue([
      buildPlanRow({ courseSlug: null, courseSlugs: ["pilates-201", "yoga-101"] }),
    ])

    const { GET } = await import("@/app/api/staff/school/packages/picker/route")
    const res = await GET(new Request("http://localhost/api/staff/school/packages/picker", { method: "GET" }))
    const data = await res.json()

    expect(data.data.items[0].courseSlug).toBe("pilates-201")
  })
})
