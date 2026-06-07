import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  findOverlappingRoomSession,
  formatReadableDate,
  getTodayNewYork,
  isSlotInPastForTimeZone,
} from "@/lib/class-schedule"

describe("class schedule time-zone helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("marks slots as past in New York time", () => {
    const reference = new Date("2026-02-18T22:05:00.000Z") // 5:05 PM in New York (EST)
    expect(isSlotInPastForTimeZone("2026-02-18", "11:00", "America/New_York", reference)).toBe(true)
    expect(isSlotInPastForTimeZone("2026-02-18", "17:05", "America/New_York", reference)).toBe(true)
  })

  it("keeps future slots available in New York time", () => {
    const reference = new Date("2026-02-18T22:05:00.000Z")
    expect(isSlotInPastForTimeZone("2026-02-18", "17:10", "America/New_York", reference)).toBe(false)
    expect(isSlotInPastForTimeZone("2026-02-19", "10:00", "America/New_York", reference)).toBe(false)
  })

  it("returns false for invalid slot input", () => {
    const reference = new Date("2026-02-18T22:05:00.000Z")
    expect(isSlotInPastForTimeZone("bad-date", "11:00", "America/New_York", reference)).toBe(false)
    expect(isSlotInPastForTimeZone("2026-02-18", "99:00", "America/New_York", reference)).toBe(false)
  })

  it("returns today's New York date in YYYY-MM-DD format", () => {
    vi.setSystemTime(new Date("2026-02-18T22:05:00.000Z"))

    expect(getTodayNewYork()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(getTodayNewYork()).toBe("2026-02-18")
  })

  it("formats ISO dates as a readable weekday label", () => {
    expect(formatReadableDate("2026-03-24")).toBe("Tuesday 24 Mar 2026")
  })

  it("returns the original value for invalid readable dates", () => {
    expect(formatReadableDate("bad-date")).toBe("bad-date")
  })

  it("uses the America/New_York date when UTC is already tomorrow", () => {
    vi.setSystemTime(new Date("2026-02-19T04:30:00.000Z")) // 11:30 PM on Feb 18 in New York (EST)

    expect(getTodayNewYork()).toBe("2026-02-18")
  })

  it("uses the America/New_York date when UTC is still today but New York is yesterday", () => {
    vi.setSystemTime(new Date("2026-03-09T03:30:00.000Z")) // 11:30 PM on Mar 8 in New York (EDT)

    expect(getTodayNewYork()).toBe("2026-03-08")
  })
})

describe("findOverlappingRoomSession", () => {
  const roomId = "123e4567-e89b-42d3-a456-426614174000"
  const sessions = [
    {
      id: "session_1",
      roomId,
      startsAt: new Date("2026-02-14T10:00:00.000Z"),
      durationMinutes: 60,
    },
  ]

  it("returns the overlapping session when time ranges intersect", () => {
    expect(
      findOverlappingRoomSession(sessions, {
        roomId,
        startsAt: new Date("2026-02-14T10:30:00.000Z"),
        durationMinutes: 60,
      })
    ).toMatchObject({ id: "session_1" })
  })

  it("allows sessions that only touch at the edge", () => {
    expect(
      findOverlappingRoomSession(sessions, {
        roomId,
        startsAt: new Date("2026-02-14T11:00:00.000Z"),
        durationMinutes: 60,
      })
    ).toBeNull()
  })

  it("ignores the excluded session id during updates", () => {
    expect(
      findOverlappingRoomSession(sessions, {
        roomId,
        startsAt: new Date("2026-02-14T10:15:00.000Z"),
        durationMinutes: 30,
        excludeSessionId: "session_1",
      })
    ).toBeNull()
  })

  it("gracefully skips conflict detection for null room ids", () => {
    expect(
      findOverlappingRoomSession(sessions, {
        roomId: null,
        startsAt: new Date("2026-02-14T10:30:00.000Z"),
        durationMinutes: 60,
      })
    ).toBeNull()
  })
})
