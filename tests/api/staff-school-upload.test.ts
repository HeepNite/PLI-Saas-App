import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizePortal = vi.fn()
const mockBuildRateLimitKey = vi.fn()
const mockConsumeRateLimit = vi.fn()
const mockGetClientIp = vi.fn()
const mockMkdir = vi.fn()
const mockWriteFile = vi.fn()

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeStaffPortalRequest: (...args: unknown[]) => mockAuthorizePortal(...args),
}))

vi.mock("@/lib/security/rate-limit", () => ({
  buildRateLimitKey: (...args: unknown[]) => mockBuildRateLimitKey(...args),
  consumeRateLimit: (...args: unknown[]) => mockConsumeRateLimit(...args),
  getClientIp: (...args: unknown[]) => mockGetClientIp(...args),
}))

vi.mock("fs/promises", () => ({
  mkdir: (...args: unknown[]) => mockMkdir(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}))

vi.mock("crypto", () => ({
  randomUUID: () => "test-uuid",
}))

describe("staff school course upload route security", () => {
  beforeEach(() => {
    mockAuthorizePortal.mockReset()
    mockBuildRateLimitKey.mockReset()
    mockConsumeRateLimit.mockReset()
    mockGetClientIp.mockReset()
    mockMkdir.mockReset()
    mockWriteFile.mockReset()

    mockAuthorizePortal.mockResolvedValue({ ok: true, userId: "staff_1", role: "admin" })
    mockBuildRateLimitKey.mockReturnValue("rl-key")
    mockConsumeRateLimit.mockReturnValue({ ok: true, retryAfterSec: 0 })
    mockGetClientIp.mockReturnValue("127.0.0.1")
    mockMkdir.mockResolvedValue(undefined)
    mockWriteFile.mockResolvedValue(undefined)
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
    expect(data.error).toMatch(/Only video files are allowed/i)
  })

  it("rejects oversized image uploads", async () => {
    const oversized = new Uint8Array(8 * 1024 * 1024 + 1)
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

  it("stores a valid upload and returns public media url", async () => {
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
    expect(mockMkdir).toHaveBeenCalledTimes(1)
    expect(mockWriteFile).toHaveBeenCalledTimes(1)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.kind).toBe("image")
    expect(data.url).toMatch(/^\/uploads\/course-media\/image-/)
  })
})

