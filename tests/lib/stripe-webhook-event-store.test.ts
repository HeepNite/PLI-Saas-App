import { beforeEach, describe, expect, it, vi } from "vitest"

const mockCreate = vi.fn()
const mockUpdateMany = vi.fn()
const mockFindUnique = vi.fn()
const mockUpdate = vi.fn()

const mockPrisma = {
  stripeWebhookEvent: {
    create: (...args: unknown[]) => mockCreate(...args),
    updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    findUnique: (...args: unknown[]) => mockFindUnique(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

describe("webhook-event-store", () => {
  beforeEach(() => {
    vi.resetModules()
    mockCreate.mockReset()
    mockUpdateMany.mockReset()
    mockFindUnique.mockReset()
    mockUpdate.mockReset()
  })

  describe("claimStripeWebhookEvent", () => {
    it("claims a brand-new event via create (first delivery, common case)", async () => {
      mockCreate.mockResolvedValueOnce({
        id: "swe_1",
        eventId: "evt_1",
        eventType: "checkout.session.completed",
        status: "processing",
        attempts: 0,
      })

      const { claimStripeWebhookEvent } = await import("@/lib/stripe/webhook-event-store")
      const result = await claimStripeWebhookEvent("evt_1", "checkout.session.completed")

      expect(result).toBe("claimed")
      expect(mockCreate).toHaveBeenCalledWith({
        data: { eventId: "evt_1", eventType: "checkout.session.completed", status: "processing" },
      })
      expect(mockUpdateMany).not.toHaveBeenCalled()
    })

    it("reclaims a row left in a failed state (redelivery after a throw)", async () => {
      const { Prisma } = await import("@prisma/client")
      mockCreate.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "test",
        })
      )
      mockUpdateMany.mockResolvedValueOnce({ count: 1 })

      const { claimStripeWebhookEvent } = await import("@/lib/stripe/webhook-event-store")
      const result = await claimStripeWebhookEvent("evt_2", "checkout.session.completed")

      expect(result).toBe("claimed")
      expect(mockUpdateMany).toHaveBeenCalledTimes(1)
      const call = mockUpdateMany.mock.calls[0]?.[0]
      expect(call.where.eventId).toBe("evt_2")
      expect(call.where.OR).toEqual(
        expect.arrayContaining([
          { status: "failed" },
          expect.objectContaining({ status: "processing", updatedAt: expect.objectContaining({ lt: expect.any(Date) }) }),
        ])
      )
      expect(call.data.status).toBe("processing")
      expect(call.data.attempts).toEqual({ increment: 1 })
      expect(call.data.updatedAt).toBeInstanceOf(Date)
    })

    it("reclaims a row that has gone stale mid-processing (worker presumed dead)", async () => {
      const { Prisma } = await import("@prisma/client")
      mockCreate.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "test",
        })
      )
      mockUpdateMany.mockResolvedValueOnce({ count: 1 })

      const { claimStripeWebhookEvent } = await import("@/lib/stripe/webhook-event-store")
      const result = await claimStripeWebhookEvent("evt_3", "checkout.session.completed")

      expect(result).toBe("claimed")
    })

    it("never auto-reclaims a legacy (pre-fix historical) row — returns duplicate", async () => {
      const { Prisma } = await import("@prisma/client")
      mockCreate.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "test",
        })
      )
      mockUpdateMany.mockResolvedValueOnce({ count: 0 })
      mockFindUnique.mockResolvedValueOnce({ eventId: "evt_4", status: "legacy" })

      const { claimStripeWebhookEvent } = await import("@/lib/stripe/webhook-event-store")
      const result = await claimStripeWebhookEvent("evt_4", "checkout.session.completed")

      expect(result).toBe("duplicate")
    })

    it("returns duplicate for a genuinely completed row", async () => {
      const { Prisma } = await import("@prisma/client")
      mockCreate.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "test",
        })
      )
      mockUpdateMany.mockResolvedValueOnce({ count: 0 })
      mockFindUnique.mockResolvedValueOnce({ eventId: "evt_5", status: "completed" })

      const { claimStripeWebhookEvent } = await import("@/lib/stripe/webhook-event-store")
      const result = await claimStripeWebhookEvent("evt_5", "checkout.session.completed")

      expect(result).toBe("duplicate")
    })

    it("returns in-flight when another worker genuinely holds a fresh claim", async () => {
      const { Prisma } = await import("@prisma/client")
      mockCreate.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "test",
        })
      )
      mockUpdateMany.mockResolvedValueOnce({ count: 0 })
      mockFindUnique.mockResolvedValueOnce({ eventId: "evt_6", status: "processing", updatedAt: new Date() })

      const { claimStripeWebhookEvent } = await import("@/lib/stripe/webhook-event-store")
      const result = await claimStripeWebhookEvent("evt_6", "checkout.session.completed")

      expect(result).toBe("in-flight")
    })

    it("propagates non-P2002 errors from the initial create", async () => {
      mockCreate.mockRejectedValueOnce(new Error("connection reset"))

      const { claimStripeWebhookEvent } = await import("@/lib/stripe/webhook-event-store")

      await expect(claimStripeWebhookEvent("evt_7", "checkout.session.completed")).rejects.toThrow(
        "connection reset"
      )
      expect(mockUpdateMany).not.toHaveBeenCalled()
    })
  })

  describe("completeStripeWebhookEvent", () => {
    it("marks the row completed with a completedAt timestamp", async () => {
      mockUpdate.mockResolvedValueOnce({ eventId: "evt_1", status: "completed" })

      const { completeStripeWebhookEvent } = await import("@/lib/stripe/webhook-event-store")
      await completeStripeWebhookEvent("evt_1")

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { eventId: "evt_1" },
        data: { status: "completed", completedAt: expect.any(Date), updatedAt: expect.any(Date) },
      })
    })
  })

  describe("markStripeWebhookEventFailed", () => {
    it("marks the row failed so it becomes reclaimable on redelivery", async () => {
      mockUpdate.mockResolvedValueOnce({ eventId: "evt_1", status: "failed" })

      const { markStripeWebhookEventFailed } = await import("@/lib/stripe/webhook-event-store")
      await markStripeWebhookEventFailed("evt_1")

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { eventId: "evt_1" },
        data: { status: "failed", updatedAt: expect.any(Date) },
      })
    })
  })

  describe("touchStripeWebhookEventHeartbeat", () => {
    it("bumps updatedAt for the in-flight row", async () => {
      mockUpdateMany.mockResolvedValueOnce({ count: 1 })

      const { touchStripeWebhookEventHeartbeat } = await import("@/lib/stripe/webhook-event-store")
      await touchStripeWebhookEventHeartbeat("evt_1")

      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: { eventId: "evt_1" },
        data: { updatedAt: expect.any(Date) },
      })
    })

    it("swallows and logs a heartbeat write failure without throwing", async () => {
      mockUpdateMany.mockRejectedValueOnce(new Error("connection reset"))
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

      const { touchStripeWebhookEventHeartbeat } = await import("@/lib/stripe/webhook-event-store")
      await expect(touchStripeWebhookEventHeartbeat("evt_1")).resolves.toBeUndefined()

      expect(warnSpy).toHaveBeenCalled()
      warnSpy.mockRestore()
    })
  })
})
