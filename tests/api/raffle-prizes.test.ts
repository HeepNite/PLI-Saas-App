import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { hashScreenToken, screenCookieName } from "@/lib/raffle/screen-token"

const { mockPrisma, mockUpdate, mockConsumeRateLimit } = vi.hoisted(() => ({
  mockPrisma: {
    raffleEvent: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
  mockUpdate: vi.fn(),
  mockConsumeRateLimit: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))
vi.mock("@/lib/raffle/prizes", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/raffle/prizes")>()
  return { ...actual, updateDraftPrizes: (...args: unknown[]) => mockUpdate(...args) }
})
vi.mock("@/lib/security/rate-limit", () => ({
  buildRateLimitKey: vi.fn(() => "prize-rate-key"),
  consumeRateLimit: (...args: unknown[]) => mockConsumeRateLimit(...args),
  getClientIp: vi.fn(() => "127.0.0.1"),
}))

import { POST } from "@/app/api/raffle/[slug]/prizes/route"

const RAW_PIN = "123456"
const params = { params: Promise.resolve({ slug: "october-30-raffle-2026" }) }
const request = (body: unknown, pin: string | null = RAW_PIN) =>
  new NextRequest("http://localhost/api/raffle/october-30-raffle-2026/prizes", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(pin ? { cookie: `${screenCookieName("october-30-raffle-2026")}=${pin}` } : {}),
    },
    body: JSON.stringify(body),
  })

describe("POST raffle prizes", () => {
  beforeEach(() => {
    mockPrisma.raffleEvent.findUnique.mockReset()
    mockPrisma.raffleEvent.findUnique.mockResolvedValue({ id: "event_1", screenTokenHash: hashScreenToken(RAW_PIN) })
    mockPrisma.$transaction.mockReset()
    mockPrisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(mockPrisma))
    mockUpdate.mockReset()
    mockConsumeRateLimit.mockReset()
    mockConsumeRateLimit.mockReturnValue({ ok: true })
  })

  it("saves a normalized ordered draft through a serializable transaction", async () => {
    mockUpdate.mockResolvedValue({ status: "saved", revision: "next_revision", prizes: ["First", "Grand Prize"] })

    const response = await POST(request({ action: "save", revision: "revision_1", prizes: [" First ", "Grand Prize"] }), params)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ status: "saved", revision: "next_revision", prizes: ["First", "Grand Prize"] })
    expect(mockUpdate).toHaveBeenCalledWith(mockPrisma, {
      eventId: "event_1", action: "save", revision: "revision_1", labels: ["First", "Grand Prize"],
    })
    expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: "Serializable" }))
  })

  it("starts and permanently locks the displayed prize list", async () => {
    mockUpdate.mockResolvedValue({ status: "started" })

    const response = await POST(request({ action: "start", revision: "revision_1", prizes: ["Grand Prize"] }), params)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ status: "started" })
  })

  it.each([
    [{ action: "save", revision: "revision_1", prizes: [] }],
    [{ action: "save", revision: "", prizes: ["Prize"] }],
    [{ action: "delete", revision: "revision_1", prizes: ["Prize"] }],
    [{ action: "save", revision: "revision_1", prizes: [" "] }],
  ])("rejects malformed input without opening a transaction", async (body) => {
    const response = await POST(request(body), params)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ status: "invalid_body" })
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("rejects a wrong event PIN without reading or mutating prize state", async () => {
    const response = await POST(request({ action: "save", revision: "revision_1", prizes: ["Prize"] }, "654321"), params)

    expect(response.status).toBe(404)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it.each([
    ["conflict", "prize_revision_conflict"],
    ["locked", "prize_setup_locked"],
  ])("maps %s without claiming success", async (domainStatus, apiStatus) => {
    mockUpdate.mockResolvedValue({ status: domainStatus })

    const response = await POST(request({ action: "save", revision: "revision_1", prizes: ["Prize"] }), params)

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({ status: apiStatus })
  })

  it("returns Retry-After when prize authoring is rate limited", async () => {
    mockConsumeRateLimit.mockReturnValue({ ok: false, retryAfterSec: 17 })

    const response = await POST(request({ action: "save", revision: "revision_1", prizes: ["Prize"] }), params)

    expect(response.status).toBe(429)
    expect(response.headers.get("Retry-After")).toBe("17")
    await expect(response.json()).resolves.toEqual({ status: "rate_limited" })
    expect(mockPrisma.raffleEvent.findUnique).not.toHaveBeenCalled()
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })
})
