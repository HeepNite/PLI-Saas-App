import { beforeEach, describe, expect, it, vi } from "vitest"

const mockPrismaPackagePurchaseFindFirst = vi.fn()
const mockAuth = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    packagePurchase: {
      findFirst: (...args: unknown[]) => mockPrismaPackagePurchaseFindFirst(...args),
    },
  },
}))

vi.mock("@clerk/nextjs/server", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}))

describe("POST /api/checkin/previous-package", () => {
  beforeEach(() => {
    vi.resetModules()
    mockPrismaPackagePurchaseFindFirst.mockReset()
    mockAuth.mockReset()
    // Default: authenticated Clerk user (STAFF)
    mockAuth.mockResolvedValue({ userId: "clerk_staff_123" })
  })

  it("uses customerUserId from body for the PackagePurchase query", async () => {
    mockPrismaPackagePurchaseFindFirst.mockResolvedValue({
      packageId: "pkg_starter_expired",
    })

    const { POST } = await import("@/app/api/checkin/previous-package/route")
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerUserId: "customer_db_id_456",
        courseSlug: "salsa-femenina-matutina",
      }),
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ previousPackageId: "pkg_starter_expired" })
    // Must use customerUserId from body, NOT auth().userId
    expect(mockPrismaPackagePurchaseFindFirst).toHaveBeenCalledWith({
      where: {
        userId: "customer_db_id_456",
        courseSlug: "salsa-femenina-matutina",
        status: { in: ["expired", "exhausted"] },
      },
      select: { packageId: true },
      orderBy: { purchasedAt: "desc" },
    })
  })

  it("returns 400 when customerUserId is not provided", async () => {
    const { POST } = await import("@/app/api/checkin/previous-package/route")
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseSlug: "salsa-femenina-matutina" }),
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toHaveProperty("error")
  })

  it("returns 401 when Clerk auth returns no userId", async () => {
    mockAuth.mockResolvedValue({ userId: null })

    const { POST } = await import("@/app/api/checkin/previous-package/route")
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerUserId: "customer_db_id_456",
        courseSlug: "salsa-femenina-matutina",
      }),
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data).toHaveProperty("error")
  })

  it("returns previousPackageId as null when no purchase history exists", async () => {
    mockPrismaPackagePurchaseFindFirst.mockResolvedValue(null)

    const { POST } = await import("@/app/api/checkin/previous-package/route")
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerUserId: "customer_db_id_456",
        courseSlug: "yoga-basico",
      }),
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ previousPackageId: null })
  })

  it("returns 400 when courseSlug is missing", async () => {
    const { POST } = await import("@/app/api/checkin/previous-package/route")
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerUserId: "customer_db_id_456" }),
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toHaveProperty("error")
  })

  it("returns 400 when body is not valid JSON", async () => {
    const { POST } = await import("@/app/api/checkin/previous-package/route")
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toHaveProperty("error")
  })
})
