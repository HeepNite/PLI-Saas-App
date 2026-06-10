import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizeOwnerRequest = vi.fn()
const mockAuthorizeStaffPortalRequest = vi.fn()
const mockConsumeRateLimit = vi.fn()

const mockPrisma = {
  currency: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  staffAccount: {
    findUnique: vi.fn(),
  },
  staffPaymentSchedule: {
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
}

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeOwnerRequest: (...args: unknown[]) => mockAuthorizeOwnerRequest(...args),
  authorizeStaffPortalRequest: (...args: unknown[]) => mockAuthorizeStaffPortalRequest(...args),
}))

vi.mock("@/lib/security/rate-limit", () => ({
  buildRateLimitKey: vi.fn((scope: string, ip: string) => `${scope}:${ip}`),
  consumeRateLimit: (...args: unknown[]) => mockConsumeRateLimit(...args),
  getClientIp: vi.fn(() => "127.0.0.1"),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

const jsonRequest = (url: string, body: unknown) =>
  new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

const postScheduleBody = {
  staffAccountId: "staff_1",
  paydayWeekday: 5,
  time: "16:30",
  timezone: "America/Argentina/Buenos_Aires",
  active: true,
}

describe("staff payroll config routes", () => {
  beforeEach(() => {
    mockAuthorizeOwnerRequest.mockReset()
    mockAuthorizeStaffPortalRequest.mockReset()
    mockConsumeRateLimit.mockReset()
    mockPrisma.currency.findMany.mockReset()
    mockPrisma.currency.findUnique.mockReset()
    mockPrisma.currency.create.mockReset()
    mockPrisma.staffAccount.findUnique.mockReset()
    mockPrisma.staffPaymentSchedule.findMany.mockReset()
    mockPrisma.staffPaymentSchedule.upsert.mockReset()

    mockAuthorizeOwnerRequest.mockResolvedValue({ ok: true, userId: "owner_1", role: "owner", category: "manager" })
    mockAuthorizeStaffPortalRequest.mockResolvedValue({ ok: true, userId: "staff_user_1", role: "staff", category: "teacher" })
    mockConsumeRateLimit.mockReturnValue({ ok: true })
    mockPrisma.currency.findMany.mockResolvedValue([{ code: "ARS", symbol: "$", decimals: 2, active: true }])
    mockPrisma.currency.findUnique.mockResolvedValue(null)
    mockPrisma.currency.create.mockResolvedValue({ code: "USD", symbol: "US$", decimals: 2, active: true })
    mockPrisma.staffAccount.findUnique.mockResolvedValue({ id: "staff_1" })
    mockPrisma.staffPaymentSchedule.findMany.mockResolvedValue([
      {
        id: "schedule_1",
        staffAccountId: "staff_1",
        paydayWeekday: 5,
        time: "16:30",
        timezone: "America/Argentina/Buenos_Aires",
        active: true,
      },
    ])
    const createdAt = new Date("2026-06-01T10:00:00.000Z")
    mockPrisma.staffPaymentSchedule.upsert.mockResolvedValue({
      id: "schedule_1",
      ...postScheduleBody,
      nextRunAt: null,
      lastRunAt: null,
      createdAt,
      updatedAt: createdAt,
    })
  })

  it("rate-limits payroll currency reads before auth", async () => {
    mockConsumeRateLimit.mockReturnValue({ ok: false, retryAfterSec: 42 })
    const { GET } = await import("@/app/api/staff/payroll/currencies/route")

    const res = await GET(new Request("http://localhost/api/staff/payroll/currencies"))

    expect(res.status).toBe(429)
    expect(res.headers.get("Retry-After")).toBe("42")
    expect(await res.json()).toEqual({ error: "Too many requests. Please try again in a moment." })
    expect(mockAuthorizeOwnerRequest).not.toHaveBeenCalled()
  })

  it("returns currencies for authorized owners", async () => {
    const { GET } = await import("@/app/api/staff/payroll/currencies/route")

    const res = await GET(new Request("http://localhost/api/staff/payroll/currencies"))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ items: [{ code: "ARS", symbol: "$", decimals: 2, active: true }] })
    expect(mockPrisma.currency.findMany).toHaveBeenCalledWith({ orderBy: { code: "asc" } })
  })

  it("normalizes and creates owner-only payroll currencies", async () => {
    const { POST } = await import("@/app/api/staff/payroll/currencies/route")

    const res = await POST(jsonRequest("http://localhost/api/staff/payroll/currencies", { code: " usd ", symbol: " US$ " }))

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ item: { code: "USD", symbol: "US$", decimals: 2, active: true } })
    expect(mockPrisma.currency.findUnique).toHaveBeenCalledWith({ where: { code: "USD" } })
    expect(mockPrisma.currency.create).toHaveBeenCalledWith({
      data: { code: "USD", symbol: "US$", decimals: 2, active: true },
    })
  })

  it("rejects duplicate payroll currency codes", async () => {
    mockPrisma.currency.findUnique.mockResolvedValue({ code: "USD" })
    const { POST } = await import("@/app/api/staff/payroll/currencies/route")

    const res = await POST(jsonRequest("http://localhost/api/staff/payroll/currencies", { code: "usd" }))

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: "Currency already exists." })
    expect(mockPrisma.currency.create).not.toHaveBeenCalled()
  })

  it("allows staff portal fallback to read payment schedules when owner auth fails", async () => {
    mockAuthorizeOwnerRequest.mockResolvedValue({ ok: false, status: 401, error: "Unauthorized" })
    const { GET } = await import("@/app/api/staff/payroll/schedules/route")

    const res = await GET()

    expect(res.status).toBe(200)
    expect(mockAuthorizeStaffPortalRequest).toHaveBeenCalled()
    expect(await res.json()).toEqual([
      expect.objectContaining({ id: "schedule_1", staffAccountId: "staff_1", active: true }),
    ])
  })

  it("validates schedule weekday, time, timezone, and active fields before writing", async () => {
    const { POST } = await import("@/app/api/staff/payroll/schedules/route")

    const res = await POST(
      jsonRequest("http://localhost/api/staff/payroll/schedules", {
        ...postScheduleBody,
        paydayWeekday: 7,
      })
    )

    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: "paydayWeekday must be an integer between 0 and 6" })
    expect(mockPrisma.staffAccount.findUnique).not.toHaveBeenCalled()
    expect(mockPrisma.staffPaymentSchedule.upsert).not.toHaveBeenCalled()
  })

  it("returns 404 when creating a schedule for a missing staff account", async () => {
    mockPrisma.staffAccount.findUnique.mockResolvedValue(null)
    const { POST } = await import("@/app/api/staff/payroll/schedules/route")

    const res = await POST(jsonRequest("http://localhost/api/staff/payroll/schedules", postScheduleBody))

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: "Staff account not found" })
    expect(mockPrisma.staffPaymentSchedule.upsert).not.toHaveBeenCalled()
  })

  it("upserts a valid owner-only payment schedule", async () => {
    const { POST } = await import("@/app/api/staff/payroll/schedules/route")

    const res = await POST(jsonRequest("http://localhost/api/staff/payroll/schedules", postScheduleBody))

    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body).toMatchObject({ id: "schedule_1", staffAccountId: "staff_1", paydayWeekday: 5, active: true })
    expect(mockPrisma.staffPaymentSchedule.upsert).toHaveBeenCalledWith({
      where: { staffAccountId: "staff_1" },
      update: expect.objectContaining({ paydayWeekday: 5, time: "16:30", timezone: "America/Argentina/Buenos_Aires", active: true }),
      create: postScheduleBody,
      select: expect.objectContaining({ id: true, staffAccountId: true, paydayWeekday: true }),
    })
  })
})
