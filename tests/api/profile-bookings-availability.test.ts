import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockAuth = vi.fn()
const mockConsumeRateLimit = vi.fn()

const mockPrisma = {
  classSession: {
    findUnique: vi.fn(),
  },
  attendance: {
    count: vi.fn(),
  },
}

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

vi.mock("@clerk/nextjs/server", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}))

vi.mock("@/lib/security/rate-limit", () => ({
  buildRateLimitKey: vi.fn(() => "profile-bookings-availability:test"),
  consumeRateLimit: (...args: unknown[]) => mockConsumeRateLimit(...args),
  getClientIp: vi.fn(() => "127.0.0.1"),
}))

describe("profile bookings availability route", () => {
  beforeEach(() => {
    mockAuth.mockReset()
    mockConsumeRateLimit.mockReset()
    mockPrisma.classSession.findUnique.mockReset()
    mockPrisma.attendance.count.mockReset()

    mockConsumeRateLimit.mockReturnValue({ ok: true, retryAfterSec: 0 })
    mockPrisma.classSession.findUnique.mockResolvedValue(null)
    mockPrisma.attendance.count.mockResolvedValue(0)
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null })
    const { GET } = await import("@/app/api/profile/bookings/availability/route")
    const req = new Request("http://localhost/api/profile/bookings/availability?courseSlug=salsa-femenina-matutina&date=2026-02-18")
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it("marks slots as past when class time already passed in New York", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-02-18T22:05:00.000Z")) // 5:05 PM NY
    mockAuth.mockResolvedValue({ userId: "user_123" })

    const { GET } = await import("@/app/api/profile/bookings/availability/route")
    const req = new Request("http://localhost/api/profile/bookings/availability?courseSlug=salsa-femenina-matutina&date=2026-02-18")
    const res = await GET(req)

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data.slots)).toBe(true)
    expect(data.slots[0]).toMatchObject({
      time: "11:00",
      isPast: true,
      isFull: true,
      spotsLeft: 0,
    })
    expect(mockPrisma.classSession.findUnique).not.toHaveBeenCalled()
  })

  it("keeps future slots open and returns capacity data", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-02-18T22:05:00.000Z")) // 5:05 PM NY
    mockAuth.mockResolvedValue({ userId: "user_123" })

    const { GET } = await import("@/app/api/profile/bookings/availability/route")
    const req = new Request("http://localhost/api/profile/bookings/availability?courseSlug=salsa-femenina-matutina&date=2026-02-19")
    const res = await GET(req)

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.slots[0]).toMatchObject({
      time: "11:00",
      isPast: false,
      isFull: false,
      spotsLeft: 12,
      capacity: 12,
    })
    expect(mockPrisma.classSession.findUnique).toHaveBeenCalled()
  })
})
