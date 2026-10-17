import { describe, expect, it } from "vitest"
import october30Config from "@/scripts/examples/raffle-october-30-2026.dev.json"
import october31Config from "@/scripts/examples/raffle-october-31-2026.dev.json"
import { getOctober2026RaffleEvent } from "@/lib/raffle/october-2026-events"
import { nyMidnightUtc, parseRaffleSeedConfig } from "@/lib/raffle/seed-plan"

const temporaryPrize = "Temporary test prize — replace before event"

describe("October 2026 raffle events", () => {
  it.each([
    ["30", "october-30-raffle-2026", "October 30 Raffle", "2026-10-31T04:00:00.000Z"],
    ["31", "october-31-raffle-2026", "October 31 Raffle", "2026-11-01T04:00:00.000Z"],
  ])("maps day %s to an isolated event with the exact midnight boundary", (day, slug, title, drawAt) => {
    const event = getOctober2026RaffleEvent(day)

    expect(event).toEqual({ day, slug, title, tabletPath: `/rifa/${day}`, drawAt })
  })

  it.each(["", "29", "32", "030", "october-30"])("rejects unsupported day %s", (day) => {
    expect(getOctober2026RaffleEvent(day)).toBeNull()
  })

  it.each([
    [october30Config, "2026-10-30", "2026-10-31T04:00:00.000Z"],
    [october31Config, "2026-10-31", "2026-11-01T04:00:00.000Z"],
  ])("keeps %s temporary and aligned with New York midnight", (config, eventDate, drawAt) => {
    const parsed = parseRaffleSeedConfig(config)

    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.eventDate).toBe(eventDate)
    expect(nyMidnightUtc(eventDate).toISOString()).toBe(`${eventDate}T04:00:00.000Z`)
    expect(parsed.value.draws).toEqual([{ order: 1, prizeLabel: temporaryPrize, drawAt }])
    expect(parsed.value.excludePreviousWinners).toBe(true)
    expect(parsed.value.videoUrl).toBe("")
  })

  it("keeps an omitted video URL undefined for existing seed configs", () => {
    const { videoUrl: _videoUrl, ...configWithoutVideo } = october30Config
    const parsed = parseRaffleSeedConfig(configWithoutVideo)

    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.videoUrl).toBeUndefined()
  })

  it("uses different slugs so entries, draws, cookies, and screen tokens stay isolated", () => {
    const october30 = getOctober2026RaffleEvent("30")
    const october31 = getOctober2026RaffleEvent("31")

    expect(october30?.slug).not.toBe(october31?.slug)
  })
})
