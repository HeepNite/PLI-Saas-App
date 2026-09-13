import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { hashScreenToken, screenCookieName } from "@/lib/raffle/screen-token"

const { cookieGet, findUnique, redirect } = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  findUnique: vi.fn(),
  redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT") }),
}))
vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookieGet }) }))
vi.mock("next/navigation", () => ({ redirect }))
vi.mock("@/lib/prisma", () => ({ prisma: { raffleEvent: { findUnique } } }))

import RifaPage from "@/app/rifa/page"

const slug = "raffle-tablet-test-20260912t234420593z"

describe("GET /rifa", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cookieGet.mockReturnValue(undefined)
    findUnique.mockResolvedValue({ screenTokenHash: hashScreenToken("test-private-key") })
  })

  it("renders the public access page without a redirect or database lookup when unauthorized", async () => {
    const html = renderToStaticMarkup(await RifaPage())
    expect(html).toContain("Raffle tablet access")
    expect(html).toContain('type="password"')
    expect(html).toContain("original private link")
    expect(html).toContain("36 hours")
    expect(html).not.toContain("test-private-key")
    expect(redirect).not.toHaveBeenCalled()
    expect(findUnique).not.toHaveBeenCalled()
  })

  it("redirects an authorized browser to the existing clean screen", async () => {
    cookieGet.mockReturnValue({ value: "test-private-key" })
    await expect(RifaPage()).rejects.toThrow("NEXT_REDIRECT")
    expect(cookieGet).toHaveBeenCalledWith(screenCookieName(slug))
    expect(findUnique).toHaveBeenCalledWith({ where: { slug }, select: { screenTokenHash: true } })
    expect(redirect).toHaveBeenCalledWith(`/staff/raffle/${slug}/screen`)
  })

  it.each(["wrong-key", "another-event-key"])("keeps %s unauthorized", async (value) => {
    cookieGet.mockReturnValue({ value })
    expect(renderToStaticMarkup(await RifaPage())).toContain("Raffle tablet access")
    expect(redirect).not.toHaveBeenCalled()
  })

  it("keeps the access page available when the target event is missing", async () => {
    cookieGet.mockReturnValue({ value: "test-private-key" })
    findUnique.mockResolvedValue(null)
    expect(renderToStaticMarkup(await RifaPage())).toContain("Raffle tablet access")
    expect(redirect).not.toHaveBeenCalled()
  })
})
