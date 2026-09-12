import { beforeEach, describe, expect, it, vi } from "vitest"
import { hashScreenToken, screenCookieName } from "@/lib/raffle/screen-token"

const { mockCookieGet, mockCookies, mockNotFound, mockPrisma, mockRedirect } = vi.hoisted(() => ({
  mockCookieGet: vi.fn(),
  mockCookies: vi.fn(),
  mockNotFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND")
  }),
  mockPrisma: { raffleEvent: { findUnique: vi.fn() } },
  mockRedirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT")
  }),
}))

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))
vi.mock("next/headers", () => ({ cookies: mockCookies }))
vi.mock("next/navigation", () => ({ notFound: mockNotFound, redirect: mockRedirect }))

import RaffleScreenPage from "@/app/staff/raffle/[slug]/screen/page"

const RAW_TOKEN = "tablet-raw-token"
const params = Promise.resolve({ slug: "s1" })

describe("GET /staff/raffle/[slug]/screen", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.raffleEvent.findUnique.mockResolvedValue({
      screenTokenHash: hashScreenToken(RAW_TOKEN),
    })
    mockCookieGet.mockReturnValue({ value: RAW_TOKEN })
    mockCookies.mockResolvedValue({
      get: mockCookieGet,
    })
  })

  it("sends a URL key to the cookie exchange endpoint", async () => {
    await expect(
      RaffleScreenPage({
        params,
        searchParams: Promise.resolve({ key: "tablet key/&" }),
      })
    ).rejects.toThrow("NEXT_REDIRECT")

    expect(mockRedirect).toHaveBeenCalledWith(
      "/api/raffle/s1/screen-session?key=tablet%20key%2F%26"
    )
    expect(mockPrisma.raffleEvent.findUnique).not.toHaveBeenCalled()
  })

  it("renders the clean screen only when its event cookie is valid", async () => {
    const element = await RaffleScreenPage({
      params,
      searchParams: Promise.resolve({}),
    })

    expect(element.props).toEqual({ slug: "s1" })
    expect(mockCookieGet).toHaveBeenCalledWith(screenCookieName("s1"))
  })

  it("returns not found on the clean URL without a cookie", async () => {
    mockCookieGet.mockReturnValue(undefined)

    await expect(
      RaffleScreenPage({ params, searchParams: Promise.resolve({}) })
    ).rejects.toThrow("NEXT_NOT_FOUND")
  })
})
