import { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { hashScreenToken, screenCookieName } from "@/lib/raffle/screen-token"

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    raffleEvent: { findUnique: vi.fn() },
    raffleDraw: {
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    raffleEntry: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))

import { POST } from "@/app/api/raffle/[slug]/draws/[drawId]/draw/route"

const RAW_TOKEN = "tablet-raw-token"
const EVENT = { id: "event_1", screenTokenHash: hashScreenToken(RAW_TOKEN) }

const routeParams = (slug: string, drawId: string) => ({ params: Promise.resolve({ slug, drawId }) })

const postDraw = (slug: string, drawId: string, rawToken: string | null = RAW_TOKEN) =>
  POST(
    new NextRequest(`http://localhost/api/raffle/${slug}/draws/${drawId}/draw`, {
      method: "POST",
      headers: rawToken ? { cookie: `${screenCookieName(slug)}=${rawToken}` } : {},
    }),
    routeParams(slug, drawId)
  )

describe("POST /api/raffle/[slug]/draws/[drawId]/draw", () => {
  beforeEach(() => {
    mockPrisma.raffleEvent.findUnique.mockReset()
    mockPrisma.raffleEvent.findUnique.mockResolvedValue(EVENT)
    mockPrisma.raffleDraw.updateMany.mockReset()
    mockPrisma.raffleDraw.findUnique.mockReset()
    mockPrisma.raffleDraw.findMany.mockReset()
    mockPrisma.raffleDraw.update.mockReset()
    mockPrisma.raffleEntry.findMany.mockReset()
    // Runs the callback against the same mock client so raffleDraw/raffleEntry
    // stubs drive the real `runDraw` implementation under test.
    mockPrisma.$transaction.mockReset()
    mockPrisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(mockPrisma))
  })

  it("maps a successful draw to 200 with the masked winner", async () => {
    mockPrisma.raffleDraw.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.raffleDraw.findUnique.mockResolvedValue({
      id: "draw_1",
      eventId: "event_1",
      event: { excludePreviousWinners: false },
    })
    mockPrisma.raffleEntry.findMany.mockResolvedValue([
      { id: "entry_1", name: "Ana Lopez", phoneE164: "+12125551234" },
    ])

    const res = await postDraw("s1", "draw_1")

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      status: "drawn",
      drawId: "draw_1",
      winner: { name: "Ana Lopez", phoneLast4: "1234" },
    })
  })

  it("returns the same winner on a replayed call against an already-drawn draw", async () => {
    mockPrisma.raffleDraw.updateMany.mockResolvedValue({ count: 0 })
    mockPrisma.raffleDraw.findUnique.mockResolvedValue({
      id: "draw_1",
      eventId: "event_1",
      status: "drawn",
      winnerEntry: { id: "entry_1", name: "Ana Lopez", phoneE164: "+12125551234" },
    })

    const res = await postDraw("s1", "draw_1")

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      status: "drawn",
      drawId: "draw_1",
      winner: { name: "Ana Lopez", phoneLast4: "1234" },
    })
  })

  it("maps a lost claim to 409 draw_in_progress", async () => {
    mockPrisma.raffleDraw.updateMany.mockResolvedValue({ count: 0 })
    mockPrisma.raffleDraw.findUnique.mockResolvedValue({ id: "draw_1", eventId: "event_1", status: "drawing", winnerEntry: null })

    const res = await postDraw("s1", "draw_1")

    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toEqual({ status: "draw_in_progress" })
  })

  it("maps zero eligible entries to 409 no_eligible_entries", async () => {
    mockPrisma.raffleDraw.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.raffleDraw.findUnique.mockResolvedValue({
      id: "draw_1",
      eventId: "event_1",
      event: { excludePreviousWinners: false },
    })
    mockPrisma.raffleEntry.findMany.mockResolvedValue([])

    const res = await postDraw("s1", "draw_1")

    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toEqual({ status: "no_eligible_entries" })
  })

  it("maps a transaction timeout to 409 draw_in_progress", async () => {
    mockPrisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("transaction timed out", {
        code: "P2028",
        clientVersion: "6.19.3",
      })
    )

    const res = await postDraw("s1", "draw_1")

    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toEqual({ status: "draw_in_progress" })
  })

  it("maps an unexpected transaction failure to 503 draw_failed", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    mockPrisma.$transaction.mockRejectedValue(new Error("connection reset"))

    const res = await postDraw("s1", "draw_1")

    expect(res.status).toBe(503)
    await expect(res.json()).resolves.toEqual({ status: "draw_failed" })
    consoleError.mockRestore()
  })

  it("returns 404 for a missing draw", async () => {
    mockPrisma.raffleDraw.updateMany.mockResolvedValue({ count: 0 })
    mockPrisma.raffleDraw.findUnique.mockResolvedValue(null)

    const res = await postDraw("s1", "missing")

    expect(res.status).toBe(404)
  })

  it("returns 404 when the screen cookie is missing", async () => {
    const res = await postDraw("s1", "draw_1", null)

    expect(res.status).toBe(404)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it("rejects a valid URL key when the screen cookie is missing", async () => {
    const res = await POST(
      new NextRequest(
        `http://localhost/api/raffle/s1/draws/draw_1/draw?key=${RAW_TOKEN}`,
        { method: "POST" }
      ),
      routeParams("s1", "draw_1")
    )

    expect(res.status).toBe(404)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it("returns 404 when the screen cookie does not match the event's token", async () => {
    const res = await postDraw("s1", "draw_1", "wrong-raw-token")

    expect(res.status).toBe(404)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it("returns 404 for an unknown slug", async () => {
    mockPrisma.raffleEvent.findUnique.mockResolvedValue(null)

    const res = await postDraw("unknown", "draw_1")

    expect(res.status).toBe(404)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })
})
