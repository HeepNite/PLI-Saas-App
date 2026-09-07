import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizePortal = vi.fn()
const mockAuthorizeDefinition = vi.fn()
const mockSynchronizeAuthoring = vi.fn()
const mockBuildRateLimitKey = vi.fn()
const mockConsumeRateLimit = vi.fn()
const mockGetClientIp = vi.fn()

const mockPrisma = {
  courseCatalog: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
  },
  specialClass: { findFirst: vi.fn() },
}

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeStaffPortalRequest: (...args: unknown[]) => mockAuthorizePortal(...args),
  authorizeSpecialClassDefinitionRequest: (...args: unknown[]) => mockAuthorizeDefinition(...args),
}))

vi.mock("@/lib/special-classes/authoring-sync", () => ({
  synchronizeSpecialClassAuthoring: (...args: unknown[]) => mockSynchronizeAuthoring(...args),
  SpecialClassAuthoringError: class extends Error {
    constructor(readonly code: string, readonly status = 409) { super(code) }
  },
}))

vi.mock("@/lib/security/rate-limit", () => ({
  buildRateLimitKey: (...args: unknown[]) => mockBuildRateLimitKey(...args),
  consumeRateLimit: (...args: unknown[]) => mockConsumeRateLimit(...args),
  getClientIp: (...args: unknown[]) => mockGetClientIp(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

describe("staff school courses route security", () => {
  const authoringBody = () => ({
    slug: "studio-special", title: "Studio Special", kind: "workshop", category: null,
    description: "Description", coverImageUrl: null, previewVideoUrl: null,
    dropInPriceCents: 4500, firstClassPriceCents: null, level: null, durationMinutes: 60,
    location: "Main studio", defaultRoomId: null, availableWeekdays: [1], availableTimes: ["10:00"],
    scheduleRules: { publication: { mode: "launch_date", launchDate: "2030-01-01" } },
    active: true, specialClassOperationsEnabled: true, specialClassCapacity: 12,
    authoringCommand: { intent: "save_draft", operationId: "5d647c42-387b-48bf-b1a0-19075fd7f57e", concreteSlots: [{ date: "2030-06-01", time: "10:00" }] },
  })

  beforeEach(() => {
    mockAuthorizePortal.mockReset()
    mockAuthorizeDefinition.mockReset()
    mockSynchronizeAuthoring.mockReset()
    mockBuildRateLimitKey.mockReset()
    mockConsumeRateLimit.mockReset()
    mockGetClientIp.mockReset()
    mockPrisma.courseCatalog.findMany.mockReset()
    mockPrisma.courseCatalog.findUnique.mockReset()
    mockPrisma.courseCatalog.updateMany.mockReset()
    mockPrisma.courseCatalog.upsert.mockReset()
    mockPrisma.specialClass.findFirst.mockReset()

    mockAuthorizePortal.mockResolvedValue({ ok: true, userId: "staff_1", role: "admin" })
    mockAuthorizeDefinition.mockResolvedValue({ ok: true, userId: "owner_1", role: "owner" })
    mockSynchronizeAuthoring.mockResolvedValue({ courseCatalogId: "course_1", revision: "2030-01-01T00:00:00.000Z", projections: [] })
    mockBuildRateLimitKey.mockReturnValue("rl-key")
    mockConsumeRateLimit.mockReturnValue({ ok: true, retryAfterSec: 0 })
    mockGetClientIp.mockReturnValue("127.0.0.1")
    mockPrisma.courseCatalog.findMany.mockResolvedValue([])
    mockPrisma.specialClass.findFirst.mockResolvedValue(null)
    mockPrisma.courseCatalog.upsert.mockResolvedValue({ id: "course_1", slug: "safe-course", title: "Safe course" })
  })

  it("omits legacy filesystem course media urls from GET responses", async () => {
    mockPrisma.courseCatalog.findMany.mockResolvedValueOnce([
      {
        id: "course_1",
        slug: "legacy-course",
        title: "Legacy course",
        coverImageUrl: "/uploads/course-media/image-old.jpg",
        previewVideoUrl: "/uploads/course-media/video-old.mp4",
        createdAt: new Date("2026-05-07T00:00:00.000Z"),
      },
      {
        id: "course_2",
        slug: "db-course",
        title: "DB course",
        coverImageUrl: "/api/staff/school/courses/media/media_1",
        previewVideoUrl: null,
        createdAt: new Date("2026-05-07T00:00:00.000Z"),
      },
    ])

    const { GET } = await import("@/app/api/staff/school/courses/route")
    const res = await GET(new Request("http://localhost/api/staff/school/courses"))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.items[0].coverImageUrl).toBeNull()
    expect(data.items[0].previewVideoUrl).toBeNull()
    expect(data.items[1].coverImageUrl).toBe("/api/staff/school/courses/media/media_1")
  })

  it("returns 429 when POST rate limit is exceeded", async () => {
    mockConsumeRateLimit.mockReturnValueOnce({ ok: false, retryAfterSec: 15 })
    const { POST } = await import("@/app/api/staff/school/courses/route")
    const res = await POST(
      new Request("http://localhost/api/staff/school/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "abc", title: "Course" }),
      })
    )
    expect(res.status).toBe(429)
  })

  it("applies set_active by stable ID and revision without a full save", async () => {
    mockPrisma.courseCatalog.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.courseCatalog.findUnique.mockResolvedValue({ id: "course_1", active: false })
    const { POST } = await import("@/app/api/staff/school/courses/route")
    const res = await POST(new Request("http://localhost/api/staff/school/courses", { method: "POST", body: JSON.stringify({ command: "set_active", courseCatalogId: "course_1", expectedUpdatedAt: "2030-01-01T00:00:00.000Z", active: false }) }))
    expect(res.status).toBe(200)
    expect(mockPrisma.courseCatalog.upsert).not.toHaveBeenCalled()
  })

  it("requires owner/admin authorization and a complete explicit authoring command", async () => {
    const { POST } = await import("@/app/api/staff/school/courses/route")
    const request = (body: object) => new Request("http://localhost/api/staff/school/courses", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    })
    mockAuthorizeDefinition.mockResolvedValueOnce({ ok: false, status: 403, error: "Owner or Admin role required" })
    expect((await POST(request({ authoringCommand: { intent: "publish" } }))).status).toBe(403)
    mockAuthorizeDefinition.mockResolvedValueOnce({ ok: true, userId: "owner_1", role: "owner" })
    expect((await POST(request({ authoringCommand: { intent: "publish" } }))).status).toBe(400)
    expect(mockSynchronizeAuthoring).not.toHaveBeenCalled()
  })

  it("rejects authoring fields and linked-course writes without an explicit authorized command", async () => {
    const { POST } = await import("@/app/api/staff/school/courses/route")
    const request = (body: object) => new Request("http://localhost/api/staff/school/courses", { method: "POST", body: JSON.stringify(body) })
    const legacyAuthoringBody = { ...authoringBody(), authoringCommand: undefined }
    mockAuthorizeDefinition.mockResolvedValueOnce({ ok: false, status: 403, error: "Owner or Admin role required" })
    expect((await POST(request(legacyAuthoringBody))).status).toBe(403)
    mockAuthorizeDefinition.mockResolvedValueOnce({ ok: true, userId: "owner_1", role: "owner" })
    expect((await POST(request(legacyAuthoringBody))).status).toBe(400)
    mockPrisma.courseCatalog.findMany.mockResolvedValueOnce([{ id: "linked_course" }])
    expect((await POST(request({ slug: "linked-course", title: "Linked course" }))).status).toBe(400)
    expect(mockPrisma.courseCatalog.upsert).not.toHaveBeenCalled()
  })

  it("forwards an explicit draft command without inferring publication from launch metadata", async () => {
    const { POST } = await import("@/app/api/staff/school/courses/route")
    const res = await POST(new Request("http://localhost/api/staff/school/courses", { method: "POST", body: JSON.stringify(authoringBody()) }))
    expect(res.status).toBe(200)
    expect(mockSynchronizeAuthoring).toHaveBeenCalledWith(mockPrisma, expect.objectContaining({ intent: "save_draft" }))
  })

  it.each([
    ["IDEMPOTENCY_KEY_REUSED", 409], ["AUTHORING_CONFLICT", 409], ["SLOT_ID_MISMATCH", 409],
    ["ROOM_CONFLICT", 409], ["NOT_PUBLISHABLE", 422],
  ])("translates %s authoring failures to HTTP %i", async (code, status) => {
    const { POST } = await import("@/app/api/staff/school/courses/route")
    const { SpecialClassAuthoringError } = await import("@/lib/special-classes/authoring-sync")
    mockSynchronizeAuthoring.mockRejectedValueOnce(new SpecialClassAuthoringError(code, status))
    const res = await POST(new Request("http://localhost/api/staff/school/courses", { method: "POST", body: JSON.stringify(authoringBody()) }))
    expect(res.status).toBe(status)
    await expect(res.json()).resolves.toMatchObject({ code })
  })

  it("redacts unexpected synchronizer failures", async () => {
    const { POST } = await import("@/app/api/staff/school/courses/route")
    mockSynchronizeAuthoring.mockRejectedValueOnce(new Error("database password=internal-secret"))
    const res = await POST(new Request("http://localhost/api/staff/school/courses", { method: "POST", body: JSON.stringify(authoringBody()) }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body).toEqual({ error: "Unable to save course." })
    expect(JSON.stringify(body)).not.toContain("internal-secret")
  })

  it("rejects slug shorter than 3 chars after normalization", async () => {
    const { POST } = await import("@/app/api/staff/school/courses/route")
    const res = await POST(
      new Request("http://localhost/api/staff/school/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "$$", title: "Course" }),
      })
    )
    expect(res.status).toBe(400)
    expect(mockPrisma.courseCatalog.upsert).not.toHaveBeenCalled()
  })

  it("rejects course payload without title", async () => {
    const { POST } = await import("@/app/api/staff/school/courses/route")
    const res = await POST(
      new Request("http://localhost/api/staff/school/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "salsa-morning", title: "" }),
      })
    )
    expect(res.status).toBe(400)
    expect(mockPrisma.courseCatalog.upsert).not.toHaveBeenCalled()
  })

  it("rejects legacy filesystem course media urls on save", async () => {
    const { POST } = await import("@/app/api/staff/school/courses/route")
    const res = await POST(
      new Request("http://localhost/api/staff/school/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: "legacy-course",
          title: "Legacy Course",
          coverImageUrl: "/uploads/course-media/image-old.jpg",
        }),
      })
    )

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/Legacy course image/i)
    expect(mockPrisma.courseCatalog.upsert).not.toHaveBeenCalled()
  })

  it("sanitizes and persists normalized schedule/security fields", async () => {
    const { POST } = await import("@/app/api/staff/school/courses/route")
    const req = new Request("http://localhost/api/staff/school/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: "  Salsa <script>alert(1)</script> Night  ",
        title: " Salsa Night  ",
        kind: "course",
        availableWeekdays: [1, 1, 8, -1, "wed"],
        availableTimes: ["09:00", "09:00", "AA:11", "17:30"],
        scheduleRules: {
          mode: "regular",
          weeklyDaysTarget: 99,
          repeatAllMonth: false,
          recurrenceMode: "until_date",
          recurrenceEndsAt: "2026-12-01",
          rules: [
            { weekday: 1, times: ["09:00", "09:00", "99:99"] },
            { weekday: 9, times: ["10:00"] },
          ],
          specialEvents: [
            { date: "2026-10-10", times: ["17:30", "17:30"], label: "ignored" },
            { date: "not-date", times: ["10:00"] },
          ],
          publication: { mode: "launch_date", launchDate: "2026-11-11" },
          specialDiscount: { type: "custom", label: "  Holiday deal ", priceCents: 1234.9 },
        },
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockPrisma.courseCatalog.upsert).toHaveBeenCalledTimes(1)

    const call = mockPrisma.courseCatalog.upsert.mock.calls[0][0]
    expect(call.where).toEqual({ slug: "salsa-script-alert-1-script-night" })
    expect(call.create.availableWeekdays).toEqual([1])
    expect(call.create.availableTimes).toEqual(["09:00", "17:30"])
    expect(call.create.scheduleRules).toMatchObject({
      mode: "regular",
      weeklyDaysTarget: 7,
      repeatAllMonth: false,
      recurrenceMode: "until_date",
      recurrenceEndsAt: "2026-12-01",
      rules: [{ weekday: 1, times: ["09:00"] }],
      specialEvents: [{ date: "2026-10-10", times: ["17:30"], label: "Special event" }],
      publication: { mode: "launch_date", launchDate: "2026-11-11" },
      specialDiscount: { type: "custom", label: "Holiday deal", priceCents: 1235 },
    })
  })
})
