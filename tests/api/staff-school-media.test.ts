import { beforeEach, describe, expect, it, vi } from "vitest"

const mockCourseMediaFindUnique = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    courseMedia: {
      findUnique: (...args: unknown[]) => mockCourseMediaFindUnique(...args),
    },
  },
}))

describe("staff school course media route", () => {
  beforeEach(() => {
    mockCourseMediaFindUnique.mockReset()
  })

  it("returns 404 when media is missing", async () => {
    mockCourseMediaFindUnique.mockResolvedValue(null)
    const { GET } = await import("@/app/api/staff/school/courses/media/[id]/route")
    const res = await GET(new Request("http://localhost/api/staff/school/courses/media/missing"), {
      params: Promise.resolve({ id: "missing" }),
    })
    expect(res.status).toBe(404)
  })

  it("returns binary content with headers", async () => {
    const payload = Buffer.from([1, 2, 3, 4])
    mockCourseMediaFindUnique.mockResolvedValue({
      data: payload,
      mimeType: "image/png",
      sizeBytes: payload.length,
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    })
    const { GET } = await import("@/app/api/staff/school/courses/media/[id]/route")
    const res = await GET(new Request("http://localhost/api/staff/school/courses/media/media_1"), {
      params: Promise.resolve({ id: "media_1" }),
    })

    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toBe("image/png")
    expect(res.headers.get("Content-Length")).toBe(String(payload.length))
    expect(res.headers.get("Cache-Control")).toContain("public")
    const body = new Uint8Array(await res.arrayBuffer())
    expect(Array.from(body)).toEqual([1, 2, 3, 4])
  })
})
