import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizePortal = vi.fn()
const mockConsumeRateLimit = vi.fn()
const mockBuildRateLimitKey = vi.fn()
const mockGetClientIp = vi.fn()

const mockPrisma = {
  courseCatalog: {
    findUnique: vi.fn(),
  },
  courseLink: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findUnique: vi.fn(),
  },
}

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeStaffPortalRequest: (...args: unknown[]) => mockAuthorizePortal(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

vi.mock("@/lib/security/rate-limit", () => ({
  consumeRateLimit: (...args: unknown[]) => mockConsumeRateLimit(...args),
  buildRateLimitKey: (...args: unknown[]) => mockBuildRateLimitKey(...args),
  getClientIp: (...args: unknown[]) => mockGetClientIp(...args),
}))

describe("CourseLink CRUD API", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuthorizePortal.mockReset()
    mockAuthorizePortal.mockResolvedValue({ ok: true, userId: "staff_1", role: "admin" })
    mockConsumeRateLimit.mockReturnValue({ ok: true })
    mockBuildRateLimitKey.mockReturnValue("rate-limit-key")
    mockGetClientIp.mockReturnValue("127.0.0.1")
    mockPrisma.courseCatalog.findUnique.mockReset()
    mockPrisma.courseLink.create.mockReset()
    mockPrisma.courseLink.update.mockReset()
    mockPrisma.courseLink.delete.mockReset()
    mockPrisma.courseLink.findUnique.mockReset()
  })

  // ─── POST: Create ───────────────────────────────────────────────

  describe("POST /api/staff/school/course-links", () => {
    it("creates a link successfully", async () => {
      mockPrisma.courseCatalog.findUnique.mockImplementation(async ({ where }) => {
        return { slug: where.slug, title: where.slug === "salsa" ? "Salsa" : "Bachata" }
      })
      mockPrisma.courseLink.create.mockResolvedValue({
        id: "link_1",
        courseSlugA: "salsa",
        courseSlugB: "bachata",
        dropInConsecutiveCents: 900,
        packageHolderConsecutiveCents: 500,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const { POST } = await import("@/app/api/staff/school/course-links/route")
      const res = await POST(
        new Request("http://localhost", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            courseSlugA: "salsa",
            courseSlugB: "bachata",
            dropInConsecutiveCents: 900,
            packageHolderConsecutiveCents: 500,
            active: true,
          }),
        })
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.item.courseSlugA).toBe("salsa")
      expect(data.item.courseSlugB).toBe("bachata")
    })

    it("rejects self-link (courseSlugA === courseSlugB)", async () => {
      const { POST } = await import("@/app/api/staff/school/course-links/route")
      const res = await POST(
        new Request("http://localhost", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            courseSlugA: "salsa",
            courseSlugB: "salsa",
            dropInConsecutiveCents: 900,
            packageHolderConsecutiveCents: 500,
          }),
        })
      )

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain("cannot be linked to itself")
    })

    it("rejects duplicate pair (409)", async () => {
      const { Prisma } = await import("@prisma/client")
      mockPrisma.courseCatalog.findUnique.mockImplementation(async ({ where }) => {
        return { slug: where.slug, title: where.slug === "salsa" ? "Salsa" : "Bachata" }
      })
      mockPrisma.courseLink.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "5.0.0" })
      )

      const { POST } = await import("@/app/api/staff/school/course-links/route")
      const res = await POST(
        new Request("http://localhost", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            courseSlugA: "salsa",
            courseSlugB: "bachata",
            dropInConsecutiveCents: 900,
            packageHolderConsecutiveCents: 500,
          }),
        })
      )

      expect(res.status).toBe(409)
      const data = await res.json()
      expect(data.error).toContain("already exists")
    })

    it("rejects when courseSlugA or courseSlugB is missing", async () => {
      const { POST } = await import("@/app/api/staff/school/course-links/route")
      const res = await POST(
        new Request("http://localhost", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            courseSlugA: "salsa",
            // missing courseSlugB
          }),
        })
      )

      expect(res.status).toBe(400)
    })

    it("rejects when referenced course does not exist", async () => {
      mockPrisma.courseCatalog.findUnique.mockResolvedValue(null)

      const { POST } = await import("@/app/api/staff/school/course-links/route")
      const res = await POST(
        new Request("http://localhost", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            courseSlugA: "nonexistent",
            courseSlugB: "bachata",
            dropInConsecutiveCents: 900,
            packageHolderConsecutiveCents: 500,
          }),
        })
      )

      expect(res.status).toBe(404)
    })
  })

  // ─── PUT: Update ────────────────────────────────────────────────

  describe("PUT /api/staff/school/course-links", () => {
    it("updates a link successfully", async () => {
      mockPrisma.courseLink.findUnique.mockResolvedValue({
        id: "link_1",
        courseSlugA: "salsa",
        courseSlugB: "bachata",
        dropInConsecutiveCents: 900,
        packageHolderConsecutiveCents: 500,
        active: true,
      })
      mockPrisma.courseLink.update.mockResolvedValue({
        id: "link_1",
        courseSlugA: "salsa",
        courseSlugB: "bachata",
        dropInConsecutiveCents: 1000,
        packageHolderConsecutiveCents: 600,
        active: false,
        updatedAt: new Date(),
      })

      const { PUT } = await import("@/app/api/staff/school/course-links/route")
      const res = await PUT(
        new Request("http://localhost", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: "link_1",
            dropInConsecutiveCents: 1000,
            packageHolderConsecutiveCents: 600,
            active: false,
          }),
        })
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.item.dropInConsecutiveCents).toBe(1000)
      expect(data.item.active).toBe(false)
    })

    it("rejects self-link on update", async () => {
      mockPrisma.courseLink.findUnique.mockResolvedValue({
        id: "link_1",
        courseSlugA: "salsa",
        courseSlugB: "bachata",
        dropInConsecutiveCents: 900,
        packageHolderConsecutiveCents: 500,
        active: true,
      })

      const { PUT } = await import("@/app/api/staff/school/course-links/route")
      const res = await PUT(
        new Request("http://localhost", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: "link_1",
            courseSlugA: "salsa",
            courseSlugB: "salsa", // self-link
          }),
        })
      )

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain("cannot be linked to itself")
    })

    it("rejects when link ID is missing", async () => {
      const { PUT } = await import("@/app/api/staff/school/course-links/route")
      const res = await PUT(
        new Request("http://localhost", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dropInConsecutiveCents: 1000,
          }),
        })
      )

      expect(res.status).toBe(400)
    })

    it("rejects when link not found", async () => {
      mockPrisma.courseLink.findUnique.mockResolvedValue(null)

      const { PUT } = await import("@/app/api/staff/school/course-links/route")
      const res = await PUT(
        new Request("http://localhost", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: "nonexistent",
          }),
        })
      )

      expect(res.status).toBe(404)
    })
  })

  // ─── DELETE: Remove ─────────────────────────────────────────────

  describe("DELETE /api/staff/school/course-links", () => {
    it("removes a link successfully", async () => {
      mockPrisma.courseLink.findUnique.mockResolvedValue({
        id: "link_1",
        courseSlugA: "salsa",
        courseSlugB: "bachata",
      })
      mockPrisma.courseLink.delete.mockResolvedValue({ id: "link_1" })

      const { DELETE } = await import("@/app/api/staff/school/course-links/route")
      const res = await DELETE(
        new Request("http://localhost", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: "link_1" }),
        })
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.message).toContain("salsa")
      expect(data.message).toContain("bachata")
    })

    it("rejects when link ID is missing", async () => {
      const { DELETE } = await import("@/app/api/staff/school/course-links/route")
      const res = await DELETE(
        new Request("http://localhost", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
      )

      expect(res.status).toBe(400)
    })

    it("rejects when link not found", async () => {
      mockPrisma.courseLink.findUnique.mockResolvedValue(null)

      const { DELETE } = await import("@/app/api/staff/school/course-links/route")
      const res = await DELETE(
        new Request("http://localhost", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: "nonexistent" }),
        })
      )

      expect(res.status).toBe(404)
    })
  })
})
