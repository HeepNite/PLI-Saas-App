import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { isTerminalCheckInAllowed, type QrCheckInContext } from "@/lib/checkin/qr"

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

describe("isTerminalCheckInAllowed", () => {
  const originalNodeEnv = process.env.NODE_ENV

  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production")
  })

  afterEach(() => {
    vi.stubEnv("NODE_ENV", originalNodeEnv ?? "test")
  })

  it("allows check-in far before startsAt (pre-window, previously blocked by opensAt)", () => {
    const context = buildContext()
    const now = new Date(context.startsAt.getTime() - 7 * 60 * 60 * 1000)

    expect(isTerminalCheckInAllowed(context, now)).toBe(true)
  })

  it("allows check-in at the exact closesAt boundary (inclusive)", () => {
    const context = buildContext()
    const now = new Date(context.closesAt.getTime())

    expect(isTerminalCheckInAllowed(context, now)).toBe(true)
  })

  it("rejects check-in 1ms after closesAt", () => {
    const context = buildContext()
    const now = new Date(context.closesAt.getTime() + 1)

    expect(isTerminalCheckInAllowed(context, now)).toBe(false)
  })

  it("allows check-in during the late-arrival grace window (endsAt < now <= closesAt)", () => {
    const context = buildContext()
    const now = new Date(context.endsAt.getTime() + 30 * 60 * 1000)

    expect(isTerminalCheckInAllowed(context, now)).toBe(true)
  })

  it("returns true regardless of now when dev bypass is enabled (NODE_ENV !== production)", () => {
    vi.stubEnv("NODE_ENV", "test")
    const context = buildContext()
    const now = new Date(context.closesAt.getTime() + 24 * 60 * 60 * 1000)

    expect(isTerminalCheckInAllowed(context, now)).toBe(true)
  })
})
