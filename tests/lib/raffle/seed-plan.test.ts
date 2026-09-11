import { describe, expect, it } from "vitest"

import {
  generateRaffleScreenToken,
  hashRaffleScreenToken,
  nyMidnightUtc,
  parseRaffleSeedConfig,
  planDrawUpserts,
  resolveRaffleBaseUrl,
  type ExistingDrawRow,
} from "@/lib/raffle/seed-plan"

const validConfigJson = {
  slug: "ple-launch-2026-09-12",
  title: "PLE Launch Night",
  brand: "PLE",
  eventDate: "2026-09-12",
  excludePreviousWinners: true,
  videoUrl: "/raffle/draw.mp4",
  draws: [{ order: 1, prizeLabel: "Grand Prize", drawAt: "2026-09-12T23:30:00-04:00" }],
}

describe("parseRaffleSeedConfig", () => {
  it("accepts a valid config and applies defaults", () => {
    const result = parseRaffleSeedConfig(validConfigJson)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.slug).toBe("ple-launch-2026-09-12")
      expect(result.value.draws).toHaveLength(1)
    }
  })

  it("defaults brand to PLE and excludePreviousWinners to true when absent", () => {
    const rest = {
      slug: validConfigJson.slug,
      title: validConfigJson.title,
      eventDate: validConfigJson.eventDate,
      videoUrl: validConfigJson.videoUrl,
      draws: validConfigJson.draws,
    }
    const result = parseRaffleSeedConfig(rest)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.brand).toBe("PLE")
      expect(result.value.excludePreviousWinners).toBe(true)
    }
  })

  it("rejects a non-object input", () => {
    const result = parseRaffleSeedConfig("not-an-object")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors).toContain("config must be a JSON object")
  })

  it("rejects an invalid slug", () => {
    const result = parseRaffleSeedConfig({ ...validConfigJson, slug: "Invalid Slug!" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.some((error) => error.includes("slug"))).toBe(true)
  })

  it("rejects a malformed eventDate", () => {
    const result = parseRaffleSeedConfig({ ...validConfigJson, eventDate: "09/12/2026" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.some((error) => error.includes("eventDate"))).toBe(true)
  })

  it("rejects an empty draws array", () => {
    const result = parseRaffleSeedConfig({ ...validConfigJson, draws: [] })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.some((error) => error.includes("draws"))).toBe(true)
  })

  it("rejects duplicated draw order values", () => {
    const result = parseRaffleSeedConfig({
      ...validConfigJson,
      draws: [
        { order: 1, prizeLabel: "First" },
        { order: 1, prizeLabel: "Second" },
      ],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.some((error) => error.includes("duplicated"))).toBe(true)
  })

  it("rejects a draw missing prizeLabel", () => {
    const result = parseRaffleSeedConfig({ ...validConfigJson, draws: [{ order: 1, prizeLabel: "" }] })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.some((error) => error.includes("prizeLabel"))).toBe(true)
  })

  it("rejects an invalid drawAt", () => {
    const result = parseRaffleSeedConfig({
      ...validConfigJson,
      draws: [{ order: 1, prizeLabel: "Grand Prize", drawAt: "not-a-date" }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.some((error) => error.includes("drawAt"))).toBe(true)
  })
})

describe("nyMidnightUtc", () => {
  it("normalizes an EDT-season date to America/New_York midnight (UTC-04:00)", () => {
    const result = nyMidnightUtc("2026-09-12")
    expect(result.toISOString()).toBe("2026-09-12T04:00:00.000Z")
  })

  it("normalizes an EST-season date to America/New_York midnight (UTC-05:00)", () => {
    const result = nyMidnightUtc("2026-01-12")
    expect(result.toISOString()).toBe("2026-01-12T05:00:00.000Z")
  })
})

describe("planDrawUpserts", () => {
  const existing: ExistingDrawRow[] = [
    { id: "draw-open", order: 1, status: "open" },
    { id: "draw-drawn", order: 2, status: "drawn" },
  ]

  it("creates draws that do not exist yet", () => {
    const plan = planDrawUpserts([{ order: 3, prizeLabel: "New draw" }], existing)
    expect(plan.toCreate).toEqual([{ order: 3, prizeLabel: "New draw" }])
    expect(plan.toUpdate).toHaveLength(0)
    expect(plan.toSkip).toHaveLength(0)
  })

  it("updates an existing draw whose status is open", () => {
    const plan = planDrawUpserts([{ order: 1, prizeLabel: "Updated prize", drawAt: "2026-09-12T23:30:00-04:00" }], existing)
    expect(plan.toUpdate).toEqual([
      { id: "draw-open", order: 1, prizeLabel: "Updated prize", drawAt: new Date("2026-09-12T23:30:00-04:00") },
    ])
    expect(plan.toCreate).toHaveLength(0)
    expect(plan.toSkip).toHaveLength(0)
  })

  it("skips and reports a draw whose status is not open, never mutating it", () => {
    const plan = planDrawUpserts([{ order: 2, prizeLabel: "Should not apply" }], existing)
    expect(plan.toSkip).toEqual([{ order: 2, status: "drawn", prizeLabel: "Should not apply" }])
    expect(plan.toUpdate).toHaveLength(0)
    expect(plan.toCreate).toHaveLength(0)
  })
})

describe("screen token generation", () => {
  it("generates a 32-byte base64url token and its SHA-256 hash", () => {
    const { raw, hash } = generateRaffleScreenToken()
    expect(raw).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(hash).toBe(hashRaffleScreenToken(raw))
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it("produces different tokens on each call", () => {
    const first = generateRaffleScreenToken()
    const second = generateRaffleScreenToken()
    expect(first.raw).not.toBe(second.raw)
  })
})

describe("resolveRaffleBaseUrl", () => {
  it("prefers --base-url over env vars", () => {
    expect(
      resolveRaffleBaseUrl({ baseUrlArg: "https://cli.example.com/", siteUrlEnv: "https://site.example.com", vercelUrlEnv: "vercel.example.com" })
    ).toBe("https://cli.example.com")
  })

  it("falls back to NEXT_PUBLIC_SITE_URL when --base-url is absent", () => {
    expect(resolveRaffleBaseUrl({ siteUrlEnv: "https://site.example.com", vercelUrlEnv: "vercel.example.com" })).toBe(
      "https://site.example.com"
    )
  })

  it("falls back to VERCEL_URL when neither --base-url nor NEXT_PUBLIC_SITE_URL is set", () => {
    expect(resolveRaffleBaseUrl({ vercelUrlEnv: "vercel.example.com" })).toBe("https://vercel.example.com")
  })

  it("falls back to localhost when nothing is set", () => {
    expect(resolveRaffleBaseUrl({})).toBe("http://localhost:3000")
  })
})
