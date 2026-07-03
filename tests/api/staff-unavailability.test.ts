import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizePortalBase = vi.fn()
const mockAuthorizePortal = vi.fn()
const mockConsumeRateLimit = vi.fn()
const mockBuildRateLimitKey = vi.fn()
const mockGetClientIp = vi.fn()

const mockPrisma = {
  staffUnavailabilityRequest: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeStaffPortalBaseRequest: (...args: unknown[]) => mockAuthorizePortalBase(...args),
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

const TODAY = new Date()
TODAY.setHours(0, 0, 0, 0)

const futureStart = new Date(TODAY)
futureStart.setDate(futureStart.getDate() + 1)
const futureEnd = new Date(TODAY)
futureEnd.setDate(futureEnd.getDate() + 3)

const FUTURE_START = futureStart.toISOString().split("T")[0]
const FUTURE_END = futureEnd.toISOString().split("T")[0]

const BASE_RECORD = {
  id: "unavail_1",
  staffAccountId: "staff_1",
  startDate: futureStart,
  endDate: futureEnd,
  type: "day_off",
  note: null,
  status: "pending",
  reviewedBy: null,
  reviewedAt: null,
  cancelledAt: null,
  createdAt: new Date("2026-06-01T10:00:00.000Z"),
  updatedAt: new Date("2026-06-01T10:00:00.000Z"),
}

describe("staff unavailability routes", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuthorizePortalBase.mockReset()
    mockAuthorizePortalBase.mockResolvedValue({ ok: true, userId: "staff_1", role: "staff", category: null, staffName: "Staff One" })
    mockAuthorizePortal.mockReset()
    mockAuthorizePortal.mockResolvedValue({ ok: true, userId: "staff_1", role: "staff", category: null, staffName: "Staff One" })
    mockConsumeRateLimit.mockReturnValue({ ok: true })
    mockBuildRateLimitKey.mockReturnValue("rate-limit-key")
    mockGetClientIp.mockReturnValue("127.0.0.1")
    mockPrisma.staffUnavailabilityRequest.create.mockReset()
    mockPrisma.staffUnavailabilityRequest.findUnique.mockReset()
    mockPrisma.staffUnavailabilityRequest.update.mockReset()
  })

  // ─── POST /api/staff/unavailability ─────────────────────────────

  describe("POST /api/staff/unavailability", () => {
    it("returns 401 when auth fails", async () => {
      mockAuthorizePortalBase.mockResolvedValue({ ok: false, status: 401, error: "Unauthorized" })

      const { POST } = await import("@/app/api/staff/unavailability/route")
      const res = await POST(
        new Request("http://localhost/api/staff/unavailability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startDate: FUTURE_START, endDate: FUTURE_END, type: "day_off" }),
        })
      )

      expect(res.status).toBe(401)
      expect(mockPrisma.staffUnavailabilityRequest.create).not.toHaveBeenCalled()
    })

    it("returns 429 when rate limit is exceeded", async () => {
      mockConsumeRateLimit.mockReturnValue({ ok: false, retryAfterSec: 30 })

      const { POST } = await import("@/app/api/staff/unavailability/route")
      const res = await POST(
        new Request("http://localhost/api/staff/unavailability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startDate: FUTURE_START, endDate: FUTURE_END, type: "day_off" }),
        })
      )

      expect(res.status).toBe(429)
      expect(res.headers.get("Retry-After")).toBe("30")
      expect(mockPrisma.staffUnavailabilityRequest.create).not.toHaveBeenCalled()
    })

    it("returns 400 when body is not valid JSON", async () => {
      const { POST } = await import("@/app/api/staff/unavailability/route")
      const res = await POST(
        new Request("http://localhost/api/staff/unavailability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "not-json",
        })
      )

      expect(res.status).toBe(400)
    })

    it("returns 422 when required fields are missing", async () => {
      const { POST } = await import("@/app/api/staff/unavailability/route")
      const res = await POST(
        new Request("http://localhost/api/staff/unavailability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startDate: FUTURE_START }),
        })
      )

      expect(res.status).toBe(422)
      const data = await res.json()
      expect(data.error).toMatch(/missing required fields/i)
    })

    it("returns 422 when type is invalid", async () => {
      const { POST } = await import("@/app/api/staff/unavailability/route")
      const res = await POST(
        new Request("http://localhost/api/staff/unavailability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startDate: FUTURE_START, endDate: FUTURE_END, type: "vacation" }),
        })
      )

      expect(res.status).toBe(422)
      const data = await res.json()
      expect(data.error).toMatch(/invalid type/i)
    })

    it("returns 422 when date format is invalid", async () => {
      const { POST } = await import("@/app/api/staff/unavailability/route")
      const res = await POST(
        new Request("http://localhost/api/staff/unavailability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startDate: "not-a-date", endDate: FUTURE_END, type: "day_off" }),
        })
      )

      expect(res.status).toBe(422)
      const data = await res.json()
      expect(data.error).toMatch(/invalid date/i)
    })

    it("returns 422 when startDate is in the past", async () => {
      const { POST } = await import("@/app/api/staff/unavailability/route")
      const res = await POST(
        new Request("http://localhost/api/staff/unavailability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startDate: "2020-01-01", endDate: FUTURE_END, type: "day_off" }),
        })
      )

      expect(res.status).toBe(422)
      const data = await res.json()
      expect(data.error).toMatch(/today or in the future/i)
    })

    it("returns 422 when startDate is after endDate", async () => {
      const { POST } = await import("@/app/api/staff/unavailability/route")
      const res = await POST(
        new Request("http://localhost/api/staff/unavailability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startDate: FUTURE_END, endDate: FUTURE_START, type: "day_off" }),
        })
      )

      expect(res.status).toBe(422)
      const data = await res.json()
      expect(data.error).toMatch(/before or equal/i)
    })

    it("creates a new unavailability request and returns 201", async () => {
      mockPrisma.staffUnavailabilityRequest.create.mockResolvedValue({ ...BASE_RECORD })

      const { POST } = await import("@/app/api/staff/unavailability/route")
      const res = await POST(
        new Request("http://localhost/api/staff/unavailability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startDate: FUTURE_START, endDate: FUTURE_END, type: "day_off" }),
        })
      )

      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.id).toBe("unavail_1")
      expect(data.status).toBe("pending")
      expect(data.type).toBe("day_off")
      expect(mockPrisma.staffUnavailabilityRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            staffAccountId: "staff_1",
            type: "day_off",
            status: "pending",
          }),
        })
      )
    })

    it("accepts all valid types", async () => {
      const validTypes = ["day_off", "sick_leave", "suspension", "other"]

      for (const type of validTypes) {
        mockPrisma.staffUnavailabilityRequest.create.mockResolvedValue({ ...BASE_RECORD, type })

        const { POST } = await import("@/app/api/staff/unavailability/route")
        const res = await POST(
          new Request("http://localhost/api/staff/unavailability", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ startDate: FUTURE_START, endDate: FUTURE_END, type }),
          })
        )

        expect(res.status).toBe(201)
        vi.resetModules()
      }
    })

    it("stores the optional note when provided", async () => {
      mockPrisma.staffUnavailabilityRequest.create.mockResolvedValue({ ...BASE_RECORD, note: "Medical appointment" })

      const { POST } = await import("@/app/api/staff/unavailability/route")
      const res = await POST(
        new Request("http://localhost/api/staff/unavailability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startDate: FUTURE_START, endDate: FUTURE_END, type: "sick_leave", note: "Medical appointment" }),
        })
      )

      expect(res.status).toBe(201)
      expect(mockPrisma.staffUnavailabilityRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ note: "Medical appointment" }),
        })
      )
    })
  })

  // ─── DELETE /api/staff/unavailability/[id] ───────────────────────

  describe("DELETE /api/staff/unavailability/[id]", () => {
    it("returns 401 when auth fails", async () => {
      mockAuthorizePortal.mockResolvedValue({ ok: false, status: 401, error: "Unauthorized" })

      const { DELETE } = await import("@/app/api/staff/unavailability/[id]/route")
      const res = await DELETE(
        new Request("http://localhost/api/staff/unavailability/unavail_1", { method: "DELETE" }),
        { params: Promise.resolve({ id: "unavail_1" }) }
      )

      expect(res.status).toBe(401)
      expect(mockPrisma.staffUnavailabilityRequest.findUnique).not.toHaveBeenCalled()
    })

    it("returns 429 when rate limit is exceeded", async () => {
      mockConsumeRateLimit.mockReturnValue({ ok: false, retryAfterSec: 30 })

      const { DELETE } = await import("@/app/api/staff/unavailability/[id]/route")
      const res = await DELETE(
        new Request("http://localhost/api/staff/unavailability/unavail_1", { method: "DELETE" }),
        { params: Promise.resolve({ id: "unavail_1" }) }
      )

      expect(res.status).toBe(429)
      expect(res.headers.get("Retry-After")).toBe("30")
    })

    it("returns 404 when request does not exist", async () => {
      mockPrisma.staffUnavailabilityRequest.findUnique.mockResolvedValue(null)

      const { DELETE } = await import("@/app/api/staff/unavailability/[id]/route")
      const res = await DELETE(
        new Request("http://localhost/api/staff/unavailability/missing", { method: "DELETE" }),
        { params: Promise.resolve({ id: "missing" }) }
      )

      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data.error).toMatch(/not found/i)
    })

    it("returns 403 when request belongs to a different staff member", async () => {
      mockPrisma.staffUnavailabilityRequest.findUnique.mockResolvedValue({
        ...BASE_RECORD,
        staffAccountId: "other_staff",
      })

      const { DELETE } = await import("@/app/api/staff/unavailability/[id]/route")
      const res = await DELETE(
        new Request("http://localhost/api/staff/unavailability/unavail_1", { method: "DELETE" }),
        { params: Promise.resolve({ id: "unavail_1" }) }
      )

      expect(res.status).toBe(403)
      const data = await res.json()
      expect(data.error).toMatch(/unauthorized/i)
    })

    it("returns 422 when request is not pending", async () => {
      mockPrisma.staffUnavailabilityRequest.findUnique.mockResolvedValue({
        ...BASE_RECORD,
        status: "approved",
      })

      const { DELETE } = await import("@/app/api/staff/unavailability/[id]/route")
      const res = await DELETE(
        new Request("http://localhost/api/staff/unavailability/unavail_1", { method: "DELETE" }),
        { params: Promise.resolve({ id: "unavail_1" }) }
      )

      expect(res.status).toBe(422)
      const data = await res.json()
      expect(data.error).toMatch(/only pending/i)
    })

    it("cancels a pending request and returns 200", async () => {
      mockPrisma.staffUnavailabilityRequest.findUnique.mockResolvedValue({ ...BASE_RECORD })
      mockPrisma.staffUnavailabilityRequest.update.mockResolvedValue({
        ...BASE_RECORD,
        status: "cancelled",
        cancelledAt: new Date("2026-06-02T10:00:00.000Z"),
      })

      const { DELETE } = await import("@/app/api/staff/unavailability/[id]/route")
      const res = await DELETE(
        new Request("http://localhost/api/staff/unavailability/unavail_1", { method: "DELETE" }),
        { params: Promise.resolve({ id: "unavail_1" }) }
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.status).toBe("cancelled")
      expect(data.cancelledAt).toBeTruthy()
      expect(mockPrisma.staffUnavailabilityRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "unavail_1" },
          data: expect.objectContaining({ status: "cancelled" }),
        })
      )
    })
  })

  // ─── PATCH /api/staff/unavailability/[id] ───────────────────────

  describe("PATCH /api/staff/unavailability/[id]", () => {
    it("returns 401 when auth fails", async () => {
      mockAuthorizePortal.mockResolvedValue({ ok: false, status: 401, error: "Unauthorized" })

      const { PATCH } = await import("@/app/api/staff/unavailability/[id]/route")
      const res = await PATCH(
        new Request("http://localhost/api/staff/unavailability/unavail_1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "approved" }),
        }),
        { params: Promise.resolve({ id: "unavail_1" }) }
      )

      expect(res.status).toBe(401)
      expect(mockPrisma.staffUnavailabilityRequest.findUnique).not.toHaveBeenCalled()
    })

    it("returns 429 when rate limit is exceeded", async () => {
      mockConsumeRateLimit.mockReturnValue({ ok: false, retryAfterSec: 30 })

      const { PATCH } = await import("@/app/api/staff/unavailability/[id]/route")
      const res = await PATCH(
        new Request("http://localhost/api/staff/unavailability/unavail_1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "approved" }),
        }),
        { params: Promise.resolve({ id: "unavail_1" }) }
      )

      expect(res.status).toBe(429)
      expect(res.headers.get("Retry-After")).toBe("30")
    })

    it("returns 400 when body is not valid JSON", async () => {
      const { PATCH } = await import("@/app/api/staff/unavailability/[id]/route")
      const res = await PATCH(
        new Request("http://localhost/api/staff/unavailability/unavail_1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: "not-json",
        }),
        { params: Promise.resolve({ id: "unavail_1" }) }
      )

      expect(res.status).toBe(400)
    })

    it("returns 422 when status is missing or invalid", async () => {
      const { PATCH } = await import("@/app/api/staff/unavailability/[id]/route")
      const res = await PATCH(
        new Request("http://localhost/api/staff/unavailability/unavail_1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "cancelled" }),
        }),
        { params: Promise.resolve({ id: "unavail_1" }) }
      )

      expect(res.status).toBe(422)
      const data = await res.json()
      expect(data.error).toMatch(/approved.*rejected/i)
    })

    it("returns 422 when status is not provided", async () => {
      const { PATCH } = await import("@/app/api/staff/unavailability/[id]/route")
      const res = await PATCH(
        new Request("http://localhost/api/staff/unavailability/unavail_1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }),
        { params: Promise.resolve({ id: "unavail_1" }) }
      )

      expect(res.status).toBe(422)
    })

    it("returns 404 when request does not exist", async () => {
      mockPrisma.staffUnavailabilityRequest.findUnique.mockResolvedValue(null)

      const { PATCH } = await import("@/app/api/staff/unavailability/[id]/route")
      const res = await PATCH(
        new Request("http://localhost/api/staff/unavailability/missing", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "approved" }),
        }),
        { params: Promise.resolve({ id: "missing" }) }
      )

      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data.error).toMatch(/not found/i)
    })

    it("returns 409 when request has already been reviewed", async () => {
      mockPrisma.staffUnavailabilityRequest.findUnique.mockResolvedValue({
        ...BASE_RECORD,
        status: "approved",
        reviewedBy: "admin_1",
        reviewedAt: new Date(),
      })

      const { PATCH } = await import("@/app/api/staff/unavailability/[id]/route")
      const res = await PATCH(
        new Request("http://localhost/api/staff/unavailability/unavail_1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "rejected" }),
        }),
        { params: Promise.resolve({ id: "unavail_1" }) }
      )

      expect(res.status).toBe(409)
      const data = await res.json()
      expect(data.error).toMatch(/already been reviewed/i)
    })

    it("approves a pending request and returns 200", async () => {
      mockPrisma.staffUnavailabilityRequest.findUnique.mockResolvedValue({ ...BASE_RECORD })
      mockPrisma.staffUnavailabilityRequest.update.mockResolvedValue({
        ...BASE_RECORD,
        status: "approved",
        reviewedBy: "staff_1",
        reviewedAt: new Date("2026-06-02T10:00:00.000Z"),
      })

      const { PATCH } = await import("@/app/api/staff/unavailability/[id]/route")
      const res = await PATCH(
        new Request("http://localhost/api/staff/unavailability/unavail_1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "approved" }),
        }),
        { params: Promise.resolve({ id: "unavail_1" }) }
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.status).toBe("approved")
      expect(data.reviewedBy).toBe("staff_1")
      expect(data.reviewedAt).toBeTruthy()
      expect(mockPrisma.staffUnavailabilityRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "unavail_1" },
          data: expect.objectContaining({ status: "approved", reviewedBy: "staff_1" }),
        })
      )
    })

    it("rejects a pending request and returns 200", async () => {
      mockPrisma.staffUnavailabilityRequest.findUnique.mockResolvedValue({ ...BASE_RECORD })
      mockPrisma.staffUnavailabilityRequest.update.mockResolvedValue({
        ...BASE_RECORD,
        status: "rejected",
        reviewedBy: "staff_1",
        reviewedAt: new Date("2026-06-02T10:00:00.000Z"),
      })

      const { PATCH } = await import("@/app/api/staff/unavailability/[id]/route")
      const res = await PATCH(
        new Request("http://localhost/api/staff/unavailability/unavail_1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "rejected" }),
        }),
        { params: Promise.resolve({ id: "unavail_1" }) }
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.status).toBe("rejected")
    })

    it("updates the note when provided alongside status", async () => {
      mockPrisma.staffUnavailabilityRequest.findUnique.mockResolvedValue({ ...BASE_RECORD })
      mockPrisma.staffUnavailabilityRequest.update.mockResolvedValue({
        ...BASE_RECORD,
        status: "approved",
        reviewedBy: "staff_1",
        reviewedAt: new Date(),
        note: "Approved with conditions",
      })

      const { PATCH } = await import("@/app/api/staff/unavailability/[id]/route")
      const res = await PATCH(
        new Request("http://localhost/api/staff/unavailability/unavail_1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "approved", note: "Approved with conditions" }),
        }),
        { params: Promise.resolve({ id: "unavail_1" }) }
      )

      expect(res.status).toBe(200)
      expect(mockPrisma.staffUnavailabilityRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ note: "Approved with conditions" }),
        })
      )
    })
  })
})
