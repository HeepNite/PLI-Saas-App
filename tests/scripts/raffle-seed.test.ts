import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({ prisma: {} }))

import { parseSeedArgs, runRaffleSeed, type SeedPrismaClient } from "@/scripts/raffle-seed"

describe("parseSeedArgs", () => {
  it("parses a bare config path", () => {
    expect(parseSeedArgs(["config.json"])).toEqual({ configPath: "config.json", baseUrlArg: undefined, rotateToken: false })
  })

  it("parses --base-url and --rotate-token", () => {
    expect(parseSeedArgs(["config.json", "--base-url", "https://example.com", "--rotate-token"])).toEqual({
      configPath: "config.json",
      baseUrlArg: "https://example.com",
      rotateToken: true,
    })
  })

  it("throws when no config path is provided", () => {
    expect(() => parseSeedArgs(["--rotate-token"])).toThrow()
  })
})

function createMockDb(overrides?: { existingEvent?: { id: string; screenTokenHash: string } | null; existingDraws?: { id: string; order: number; status: string }[] }): SeedPrismaClient & {
  raffleEvent: { findUnique: ReturnType<typeof vi.fn>; upsert: ReturnType<typeof vi.fn> }
  raffleDraw: { findMany: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }
} {
  return {
    raffleEvent: {
      findUnique: vi.fn(async () => overrides?.existingEvent ?? null),
      upsert: vi.fn(async () => ({ id: "event-1", slug: "ple-launch-2026-09-12" })),
    },
    raffleDraw: {
      findMany: vi.fn(async () => overrides?.existingDraws ?? []),
      create: vi.fn(async () => ({})),
      update: vi.fn(async () => ({})),
    },
  }
}

describe("runRaffleSeed", () => {
  const config = {
    slug: "ple-launch-2026-09-12",
    title: "PLE Launch Night",
    brand: "PLE",
    eventDate: "2026-09-12",
    excludePreviousWinners: true,
    videoUrl: "/raffle/draw.mp4",
    draws: [{ order: 1, prizeLabel: "Grand Prize", drawAt: "2026-09-12T23:30:00-04:00" }],
  }

  it("generates a token and prints the tablet URL when the event is new", async () => {
    const db = createMockDb({ existingEvent: null })
    const log = vi.fn()
    const warn = vi.fn()

    await runRaffleSeed(config, { prisma: db, logger: { log, warn, error: vi.fn() }, rotateToken: false, baseUrl: "https://example.com" })

    expect(db.raffleEvent.upsert).toHaveBeenCalledTimes(1)
    const upsertArgs = db.raffleEvent.upsert.mock.calls[0][0]
    expect(upsertArgs.create.screenTokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(log.mock.calls.some((call) => String(call[0]).includes("tablet URL"))).toBe(true)
  })

  it("does not regenerate the token when the event already has one and --rotate-token is not set", async () => {
    const db = createMockDb({ existingEvent: { id: "event-1", screenTokenHash: "existing-hash" } })
    const log = vi.fn()

    await runRaffleSeed(config, { prisma: db, logger: { log, warn: vi.fn(), error: vi.fn() }, rotateToken: false, baseUrl: "https://example.com" })

    const upsertArgs = db.raffleEvent.upsert.mock.calls[0][0]
    expect(upsertArgs.update.screenTokenHash).toBeUndefined()
    expect(log.mock.calls.some((call) => String(call[0]).includes("already set"))).toBe(true)
  })

  it("forces a new token when --rotate-token is set even if one already exists", async () => {
    const db = createMockDb({ existingEvent: { id: "event-1", screenTokenHash: "existing-hash" } })
    const log = vi.fn()

    await runRaffleSeed(config, { prisma: db, logger: { log, warn: vi.fn(), error: vi.fn() }, rotateToken: true, baseUrl: "https://example.com" })

    const upsertArgs = db.raffleEvent.upsert.mock.calls[0][0]
    expect(upsertArgs.update.screenTokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(log.mock.calls.some((call) => String(call[0]).includes("tablet URL"))).toBe(true)
  })

  it("skips and reports a drawn draw while updating an open one on re-seed", async () => {
    const db = createMockDb({
      existingEvent: { id: "event-1", screenTokenHash: "existing-hash" },
      existingDraws: [
        { id: "draw-open", order: 1, status: "open" },
        { id: "draw-drawn", order: 2, status: "drawn" },
      ],
    })
    const warn = vi.fn()

    await runRaffleSeed(
      {
        ...config,
        draws: [
          { order: 1, prizeLabel: "Updated Grand Prize" },
          { order: 2, prizeLabel: "Should stay untouched" },
        ],
      },
      { prisma: db, logger: { log: vi.fn(), warn, error: vi.fn() }, rotateToken: false, baseUrl: "https://example.com" }
    )

    expect(db.raffleDraw.update).toHaveBeenCalledTimes(1)
    expect(db.raffleDraw.update).toHaveBeenCalledWith({
      where: { id: "draw-open" },
      data: { prizeLabel: "Updated Grand Prize", drawAt: null },
    })
    expect(db.raffleDraw.create).not.toHaveBeenCalled()
    expect(warn.mock.calls.some((call) => String(call[0]).includes("order 2"))).toBe(true)
  })

  it("creates a new draw that does not exist yet", async () => {
    const db = createMockDb({ existingEvent: { id: "event-1", screenTokenHash: "existing-hash" }, existingDraws: [] })

    await runRaffleSeed(config, { prisma: db, logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() }, rotateToken: false, baseUrl: "https://example.com" })

    expect(db.raffleDraw.create).toHaveBeenCalledTimes(1)
    expect(db.raffleDraw.update).not.toHaveBeenCalled()
  })

  it("is idempotent: re-running with unchanged config does not duplicate or mutate settled state", async () => {
    const db = createMockDb({
      existingEvent: { id: "event-1", screenTokenHash: "existing-hash" },
      existingDraws: [{ id: "draw-open", order: 1, status: "open" }],
    })

    await runRaffleSeed(config, { prisma: db, logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() }, rotateToken: false, baseUrl: "https://example.com" })

    expect(db.raffleDraw.create).not.toHaveBeenCalled()
    expect(db.raffleEvent.upsert).toHaveBeenCalledTimes(1)
  })
})
