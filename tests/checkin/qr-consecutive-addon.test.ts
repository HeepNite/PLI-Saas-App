import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { isConsecutiveAddOnPurchaseAllowed, type QrCheckInContext } from "@/lib/checkin/qr"

const buildContext = (overrides: Partial<QrCheckInContext> = {}): QrCheckInContext => ({
  courseSlug: "bachata",
  date: "2026-03-31",
  time: "20:00",
  durationMinutes: 60,
  startsAt: new Date("2026-04-01T00:00:00.000Z"),
  endsAt: new Date("2026-04-01T01:00:00.000Z"),
  opensAt: new Date("2026-03-31T22:00:00.000Z"),
  closesAt: new Date("2026-04-01T03:00:00.000Z"),
  ...overrides,
})

describe("isConsecutiveAddOnPurchaseAllowed", () => {
  const originalNodeEnv = process.env.NODE_ENV

  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production")
  })

  afterEach(() => {
    vi.stubEnv("NODE_ENV", originalNodeEnv ?? "test")
  })

  it("allows purchase far before startsAt (pre-window, previously blocked)", () => {
    const context = buildContext()
    const now = new Date(context.startsAt.getTime() - 5 * 60 * 60 * 1000)

    expect(isConsecutiveAddOnPurchaseAllowed(context, now)).toBe(true)
  })

  it("allows purchase at the exact endsAt boundary (inclusive)", () => {
    const context = buildContext()
    const now = new Date(context.endsAt.getTime())

    expect(isConsecutiveAddOnPurchaseAllowed(context, now)).toBe(true)
  })

  it("rejects purchase 1ms after endsAt", () => {
    const context = buildContext()
    const now = new Date(context.endsAt.getTime() + 1)

    expect(isConsecutiveAddOnPurchaseAllowed(context, now)).toBe(false)
  })

  it("returns true regardless of now when dev bypass is enabled (NODE_ENV !== production)", () => {
    vi.stubEnv("NODE_ENV", "test")
    const context = buildContext()
    const now = new Date(context.endsAt.getTime() + 24 * 60 * 60 * 1000)

    expect(isConsecutiveAddOnPurchaseAllowed(context, now)).toBe(true)
  })
})
