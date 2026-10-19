import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { hashScreenToken, screenCookieName } from "@/lib/raffle/screen-token"

const { mockPrisma, mockResolve } = vi.hoisted(() => ({
  mockPrisma: {
    raffleEvent: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
  mockResolve: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))
vi.mock("@/lib/raffle/attendance", () => ({
  resolveDrawAttendance: (...args: unknown[]) => mockResolve(...args),
}))

import { POST } from "@/app/api/raffle/[slug]/draws/[drawId]/attendance/route"

const RAW_TOKEN = "tablet-raw-token"
const params = { params: Promise.resolve({ slug: "s1", drawId: "draw_1" }) }
const request = (body: unknown, token: string | null = RAW_TOKEN) =>
  new NextRequest("http://localhost/api/raffle/s1/draws/draw_1/attendance", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { cookie: `${screenCookieName("s1")}=${token}` } : {}),
    },
    body: JSON.stringify(body),
  })

describe("POST raffle attendance", () => {
  beforeEach(() => {
    mockPrisma.raffleEvent.findUnique.mockReset()
    mockPrisma.raffleEvent.findUnique.mockResolvedValue({ id: "event_1", screenTokenHash: hashScreenToken(RAW_TOKEN) })
    mockPrisma.$transaction.mockReset()
    mockPrisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(mockPrisma))
    mockResolve.mockReset()
  })

  it("confirms the exact pending attempt", async () => {
    mockResolve.mockResolvedValue({ status: "confirmed" })

    const response = await POST(request({ attemptId: "attempt_1", action: "showed_up" }), params)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ status: "confirmed", drawId: "draw_1", attemptId: "attempt_1" })
    expect(mockResolve).toHaveBeenCalledWith(mockPrisma, expect.objectContaining({
      eventId: "event_1", drawId: "draw_1", attemptId: "attempt_1", action: "showed_up",
    }))
  })

  it("returns the replacement winner for an audited redraw", async () => {
    mockResolve.mockResolvedValue({
      status: "redrawn",
      attemptId: "attempt_2",
      winner: { id: "entry_2", name: "Beto Cruz", phoneE164: "+12125555678" },
    })

    const response = await POST(request({ attemptId: "attempt_1", action: "draw_again" }), params)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      status: "drawn", drawId: "draw_1", attemptId: "attempt_2", winner: { name: "Beto Cruz", phoneLast4: "5678" },
    })
  })

  it("rejects malformed input without mutating state", async () => {
    const response = await POST(request({ action: "draw_again" }), params)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ status: "invalid_body" })
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    expect(mockResolve).not.toHaveBeenCalled()
  })

  it("requires the event-scoped screen cookie", async () => {
    const response = await POST(request({ attemptId: "attempt_1", action: "showed_up" }, null), params)

    expect(response.status).toBe(404)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })
})
