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

  it("allows purchase earlier the same NY day (well before startsAt)", () => {
    const context = buildContext()
    // 2026-03-31T19:00:00Z = 15:00 America/New_York on 2026-03-31 (same NY day)
    const now = new Date("2026-03-31T19:00:00.000Z")

    expect(isConsecutiveAddOnPurchaseAllowed(context, now)).toBe(true)
  })

  it("allows purchase late the same NY day, hours after the class ended (previously blocked)", () => {
    const context = buildContext()
    // 2026-04-01T02:30:00Z = 22:30 America/New_York on 2026-03-31 (still the class day,
    // well past endsAt 21:00 and the old +2h grace) — the only window is the day.
    const now = new Date("2026-04-01T02:30:00.000Z")

    expect(isConsecutiveAddOnPurchaseAllowed(context, now)).toBe(true)
  })

  it("rejects purchase once the NY day is over (next day)", () => {
    const context = buildContext()
    // 2026-04-01T05:00:00Z = 01:00 America/New_York on 2026-04-01 (next NY day)
    const now = new Date("2026-04-01T05:00:00.000Z")

    expect(isConsecutiveAddOnPurchaseAllowed(context, now)).toBe(false)
  })

  it("returns true regardless of now when dev bypass is enabled (NODE_ENV !== production)", () => {
    vi.stubEnv("NODE_ENV", "test")
    const context = buildContext()
    const now = new Date(context.endsAt.getTime() + 24 * 60 * 60 * 1000)

    expect(isConsecutiveAddOnPurchaseAllowed(context, now)).toBe(true)
  })
})
