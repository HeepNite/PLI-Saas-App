import { beforeEach, describe, expect, it } from "vitest"
import { vi } from "vitest"

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    raffleEvent: { findUnique: vi.fn() },
  },
}))

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))

import { loadScreenState } from "@/lib/raffle/screen-state"

const NOW = new Date("2026-09-12T20:00:00.000Z")

const eventRow = (
  draws: Array<{ id: string; order: number; status: string; winnerEntry?: unknown }>,
  overrides: Record<string, unknown> = {}
) => ({
  slug: "s1",
  title: "PLE Launch Night",
  videoUrl: null,
  _count: { entries: 42 },
  draws: draws.map((draw) => ({
    prizeLabel: "Grand Prize",
    drawAt: new Date("2026-09-12T23:30:00.000Z"),
    winnerEntry: null,
    ...draw,
  })),
  ...overrides,
})

describe("loadScreenState", () => {
  beforeEach(() => {
    mockPrisma.raffleEvent.findUnique.mockReset()
    delete process.env.NEXT_PUBLIC_SITE_URL
    delete process.env.VERCEL_URL
  })

  it("returns null when the event does not exist", async () => {
    mockPrisma.raffleEvent.findUnique.mockResolvedValue(null)

    const state = await loadScreenState(mockPrisma as never, "missing", NOW)

    expect(state).toBeNull()
  })

  it("picks the lowest order among open/drawing draws as currentDrawId", async () => {
    mockPrisma.raffleEvent.findUnique.mockResolvedValue(
      eventRow([
        { id: "draw_1", order: 1, status: "drawn" },
        { id: "draw_2", order: 2, status: "drawing" },
        { id: "draw_3", order: 3, status: "open" },
      ])
    )

    const state = await loadScreenState(mockPrisma as never, "s1", NOW)

    expect(state?.currentDrawId).toBe("draw_2")
  })

  it("returns null currentDrawId when no draw is open or drawing", async () => {
    mockPrisma.raffleEvent.findUnique.mockResolvedValue(
      eventRow([{ id: "draw_1", order: 1, status: "drawn" }])
    )

    const state = await loadScreenState(mockPrisma as never, "s1", NOW)

    expect(state?.currentDrawId).toBeNull()
  })

  it("attaches a winner view for drawn draws and omits it otherwise", async () => {
    mockPrisma.raffleEvent.findUnique.mockResolvedValue(
      eventRow([
        {
          id: "draw_1",
          order: 1,
          status: "drawn",
          winnerEntry: { name: "Ana Lopez", phoneE164: "+12125551234" },
        },
        { id: "draw_2", order: 2, status: "open" },
      ])
    )

    const state = await loadScreenState(mockPrisma as never, "s1", NOW)

    expect(state?.draws[0]).toEqual(
      expect.objectContaining({ id: "draw_1", winner: { name: "Ana Lopez", phoneLast4: "1234" } })
    )
    expect(state?.draws[1]).not.toHaveProperty("winner")
  })

  it("reports entryCount and the request now, and builds entryUrl from the slug", async () => {
    mockPrisma.raffleEvent.findUnique.mockResolvedValue(eventRow([{ id: "draw_1", order: 1, status: "open" }]))

    const state = await loadScreenState(mockPrisma as never, "s1", NOW)

    expect(state?.entryCount).toBe(42)
    expect(state?.now).toBe(NOW)
    expect(state?.event.entryUrl).toBe("http://localhost:3000/raffle/s1")
  })

  it("falls back to the shared draw video when the event has not set its own", async () => {
    mockPrisma.raffleEvent.findUnique.mockResolvedValue(
      eventRow([{ id: "draw_1", order: 1, status: "open" }], { videoUrl: null })
    )

    const state = await loadScreenState(mockPrisma as never, "s1", NOW)

    expect(state?.event.videoUrl).toBe("/raffle/draw.mp4")
  })

  it("uses the event's own draw video when it has set one", async () => {
    mockPrisma.raffleEvent.findUnique.mockResolvedValue(
      eventRow([{ id: "draw_1", order: 1, status: "open" }], { videoUrl: "/raffle/ple-launch.mp4" })
    )

    const state = await loadScreenState(mockPrisma as never, "s1", NOW)

    expect(state?.event.videoUrl).toBe("/raffle/ple-launch.mp4")
  })
})
