import { describe, expect, it } from "vitest"
import { isRaffleEventClosed, RAFFLE_EVENT_GRACE_MS } from "@/lib/raffle/event-window"

describe("isRaffleEventClosed", () => {
  const eventDate = new Date("2026-09-12T04:00:00.000Z")

  it("is open well before the event date", () => {
    expect(isRaffleEventClosed(eventDate, new Date(eventDate.getTime() - 1_000))).toBe(false)
  })

  it("is open just before the grace window ends", () => {
    const now = new Date(eventDate.getTime() + RAFFLE_EVENT_GRACE_MS - 1)
    expect(isRaffleEventClosed(eventDate, now)).toBe(false)
  })

  it("is open exactly at the grace boundary", () => {
    const now = new Date(eventDate.getTime() + RAFFLE_EVENT_GRACE_MS)
    expect(isRaffleEventClosed(eventDate, now)).toBe(false)
  })

  it("is closed just after the grace boundary", () => {
    const now = new Date(eventDate.getTime() + RAFFLE_EVENT_GRACE_MS + 1)
    expect(isRaffleEventClosed(eventDate, now)).toBe(true)
  })
})
