import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Prisma } from "@prisma/client"

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    raffleEvent: { findUnique: vi.fn() },
    raffleEntry: { create: vi.fn() },
  },
}))

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))

import { POST } from "@/app/api/raffle/[slug]/entries/route"

const OPEN_EVENT = {
  id: "event_1",
  slug: "s1",
  eventDate: new Date("2026-09-12T04:00:00.000Z"),
}

const routeParams = (slug: string) => ({ params: Promise.resolve({ slug }) })

const postEntry = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new Request("http://localhost/api/raffle/s1/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.10", ...headers },
      body: JSON.stringify(body),
    }),
    routeParams("s1")
  )

describe("POST /api/raffle/[slug]/entries", () => {
  beforeEach(() => {
    mockPrisma.raffleEvent.findUnique.mockReset()
    mockPrisma.raffleEvent.findUnique.mockResolvedValue(OPEN_EVENT)
    mockPrisma.raffleEntry.create.mockReset()
    mockPrisma.raffleEntry.create.mockResolvedValue({ id: "entry_1" })
    delete process.env.ENABLE_RATE_LIMIT_IN_TESTS
  })

  afterEach(() => {
    delete process.env.ENABLE_RATE_LIMIT_IN_TESTS
  })

  it("accepts a valid entry and stores the parsed e164", async () => {
    const res = await postEntry({ name: "Ana Lopez", phone: "2125551234" })

    expect(res.status).toBe(201)
    await expect(res.json()).resolves.toEqual({ status: "entered" })
    expect(mockPrisma.raffleEntry.create).toHaveBeenCalledWith({
      data: {
        eventId: "event_1",
        name: "Ana Lopez",
        phoneE164: "+12125551234",
        phoneCountry: "US",
      },
    })
  })

  it("defaults to country US when country is omitted", async () => {
    const res = await postEntry({ name: "Ana Lopez", phone: "2125551234" })

    expect(res.status).toBe(201)
    expect(mockPrisma.raffleEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ phoneCountry: "US" }),
    })
  })

  it("rejects a non-object body with invalid_body", async () => {
    const res = await postEntry({ phone: "2125551234" })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ status: "invalid_body" })
    expect(mockPrisma.raffleEntry.create).not.toHaveBeenCalled()
  })

  it("rejects malformed JSON with invalid_body", async () => {
    const res = await POST(
      new Request("http://localhost/api/raffle/s1/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.10" },
        body: "{not json",
      }),
      routeParams("s1")
    )

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ status: "invalid_body" })
  })

  it("rejects a name shorter than 2 characters (1 char)", async () => {
    const res = await postEntry({ name: "A", phone: "2125551234" })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ status: "invalid_name" })
  })

  it("rejects a name longer than 60 characters (61 chars)", async () => {
    const res = await postEntry({ name: "A".repeat(61), phone: "2125551234" })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ status: "invalid_name" })
  })

  it("rejects an unparsable phone with invalid_phone", async () => {
    const res = await postEntry({ name: "Ana Lopez", phone: "123" })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ status: "invalid_phone" })
  })

  it("maps a duplicate phone (P2002) to 200 already_entered without a second row", async () => {
    mockPrisma.raffleEntry.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" })
    )

    const res = await postEntry({ name: "Ana Lopez", phone: "2125551234" })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ status: "already_entered" })
    expect(mockPrisma.raffleEntry.create).toHaveBeenCalledTimes(1)
  })

  it("returns 404 for an unknown slug", async () => {
    mockPrisma.raffleEvent.findUnique.mockResolvedValue(null)

    const res = await postEntry({ name: "Ana Lopez", phone: "2125551234" })

    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toEqual({ status: "event_not_found" })
    expect(mockPrisma.raffleEntry.create).not.toHaveBeenCalled()
  })

  it("returns 410 event_closed once the grace window has passed", async () => {
    mockPrisma.raffleEvent.findUnique.mockResolvedValue({
      ...OPEN_EVENT,
      eventDate: new Date("2020-01-01T00:00:00.000Z"),
    })

    const res = await postEntry({ name: "Ana Lopez", phone: "2125551234" })

    expect(res.status).toBe(410)
    await expect(res.json()).resolves.toEqual({ status: "event_closed" })
    expect(mockPrisma.raffleEntry.create).not.toHaveBeenCalled()
  })

  it("returns 429 with Retry-After once the per-IP limit is exceeded", async () => {
    process.env.ENABLE_RATE_LIMIT_IN_TESTS = "1"

    // Use a distinct phone per call so the tighter per-phone limiter (5/300s)
    // never fires first — this loop targets the per-IP limiter (10/60s).
    let res: Response | undefined
    for (let index = 0; index < 11; index += 1) {
      const phone = `2125551${index.toString().padStart(3, "0")}`
      res = await postEntry({ name: "Ana Lopez", phone })
    }

    expect(res?.status).toBe(429)
    expect(res?.headers.get("Retry-After")).toBeTruthy()
  })
})
