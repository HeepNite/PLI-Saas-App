import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizePortal = vi.fn()
const mockBuildRateLimitKey = vi.fn()
const mockConsumeRateLimit = vi.fn()
const mockGetClientIp = vi.fn()
const mockCourseMediaCreate = vi.fn()

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeStaffPortalRequest: (...args: unknown[]) => mockAuthorizePortal(...args),
}))

vi.mock("@/lib/security/rate-limit", () => ({
  buildRateLimitKey: (...args: unknown[]) => mockBuildRateLimitKey(...args),
  consumeRateLimit: (...args: unknown[]) => mockConsumeRateLimit(...args),
  getClientIp: (...args: unknown[]) => mockGetClientIp(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    courseMedia: {
      create: (...args: unknown[]) => mockCourseMediaCreate(...args),
    },
  },
}))

describe("staff school course upload route security", () => {
  beforeEach(() => {
    mockAuthorizePortal.mockReset()
    mockBuildRateLimitKey.mockReset()
    mockConsumeRateLimit.mockReset()
    mockGetClientIp.mockReset()
    mockCourseMediaCreate.mockReset()

    mockAuthorizePortal.mockResolvedValue({ ok: true, userId: "staff_1", role: "admin" })
    mockBuildRateLimitKey.mockReturnValue("rl-key")
    mockConsumeRateLimit.mockReturnValue({ ok: true, retryAfterSec: 0 })
    mockGetClientIp.mockReturnValue("127.0.0.1")
    mockCourseMediaCreate.mockResolvedValue({ id: "media_123" })
  })

  it("returns 429 when rate limit is exceeded", async () => {
    mockConsumeRateLimit.mockReturnValueOnce({ ok: false, retryAfterSec: 17 })
    const { POST } = await import("@/app/api/staff/school/courses/upload/route")
    const res = await POST(new Request("http://localhost/api/staff/school/courses/upload", { method: "POST" }))
    expect(res.status).toBe(429)
    expect(res.headers.get("Retry-After")).toBe("17")
  })

  it("returns auth status when portal auth fails", async () => {
    mockAuthorizePortal.mockResolvedValue({ ok: false, status: 403, error: "Insufficient role" })
    const { POST } = await import("@/app/api/staff/school/courses/upload/route")
    const res = await POST(new Request("http://localhost/api/staff/school/courses/upload", { method: "POST" }))
    expect(res.status).toBe(403)
  })

  it("rejects request without media file", async () => {
    const body = new FormData()
    body.set("kind", "image")
    const { POST } = await import("@/app/api/staff/school/courses/upload/route")
    const res = await POST(
      new Request("http://localhost/api/staff/school/courses/upload", {
        method: "POST",
        body,
      })
    )
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/Media file is required/i)
  })

  it("rejects mime mismatch between kind and file type", async () => {
    const body = new FormData()
    body.set("kind", "video")
    body.set("file", new File([new Uint8Array([1, 2, 3])], "photo.jpg", { type: "image/jpeg" }))
    const { POST } = await import("@/app/api/staff/school/courses/upload/route")
    const res = await POST(
      new Request("http://localhost/api/staff/school/courses/upload", {
        method: "POST",
        body,
      })
    )
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/Only mp4\/webm videos are allowed/i)
  })

  it("rejects oversized image uploads", async () => {
    const oversized = new Uint8Array(2 * 1024 * 1024 + 1)
    const body = new FormData()
    body.set("kind", "image")
    body.set("file", new File([oversized], "huge.png", { type: "image/png" }))
    const { POST } = await import("@/app/api/staff/school/courses/upload/route")
    const res = await POST(
      new Request("http://localhost/api/staff/school/courses/upload", {
        method: "POST",
        body,
      })
    )
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/File too large/i)
  })

  it("stores a valid upload in DB and returns media api url", async () => {
    const body = new FormData()
    body.set("kind", "image")
    body.set("file", new File([new Uint8Array([1, 2, 3, 4])], "cover.png", { type: "image/png" }))
    const { POST } = await import("@/app/api/staff/school/courses/upload/route")
    const res = await POST(
      new Request("http://localhost/api/staff/school/courses/upload", {
        method: "POST",
        body,
      })
    )
    expect(res.status).toBe(200)
    expect(mockCourseMediaCreate).toHaveBeenCalledTimes(1)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.kind).toBe("image")
    expect(data.mediaId).toBe("media_123")
    expect(data.url).toBe("/api/staff/school/courses/media/media_123")
  })
})
