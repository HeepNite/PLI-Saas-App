import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { hashScreenToken, screenCookieName } from "@/lib/raffle/screen-token"

const { cookieGet, findUnique, notFound, redirect } = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  findUnique: vi.fn(),
  notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND") }),
  redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT") }),
}))
vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookieGet }) }))
vi.mock("next/navigation", () => ({ notFound, redirect }))
vi.mock("@/lib/prisma", () => ({ prisma: { raffleEvent: { findUnique } } }))

import RifaDayPage from "@/app/rifa/[day]/page"

const events = {
  "30": { slug: "october-30-raffle-2026", title: "October 30 Raffle", key: "october-30-private-key" },
  "31": { slug: "october-31-raffle-2026", title: "October 31 Raffle", key: "october-31-private-key" },
} as const

describe("GET /rifa/[day]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cookieGet.mockReturnValue(undefined)
    findUnique.mockImplementation(async ({ where }: { where: { slug: string } }) => {
      const event = Object.values(events).find(({ slug }) => slug === where.slug)
      return event ? { screenTokenHash: hashScreenToken(event.key) } : null
    })
  })

  it.each(Object.entries(events))("renders the %s event access without exposing its key", async (day, event) => {
    const html = renderToStaticMarkup(await RifaDayPage({ params: Promise.resolve({ day }) }))

    expect(html).toContain(event.title)
    expect(html).toContain('type="password"')
    expect(html).toContain(`/rifa/${day}`)
    expect(html).not.toContain(event.key)
    expect(findUnique).not.toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
  })

  it.each(Object.entries(events))("redirects an authorized %s browser only to its own screen", async (day, event) => {
    cookieGet.mockImplementation((name: string) => name === screenCookieName(event.slug) ? { value: event.key } : undefined)

    await expect(RifaDayPage({ params: Promise.resolve({ day }) })).rejects.toThrow("NEXT_REDIRECT")
    expect(cookieGet).toHaveBeenCalledWith(screenCookieName(event.slug))
    expect(findUnique).toHaveBeenCalledWith({ where: { slug: event.slug }, select: { screenTokenHash: true } })
    expect(redirect).toHaveBeenCalledWith(`/staff/raffle/${event.slug}/screen`)
  })

  it("does not authorize October 31 with the October 30 key", async () => {
    cookieGet.mockReturnValue({ value: events["30"].key })

    const html = renderToStaticMarkup(await RifaDayPage({ params: Promise.resolve({ day: "31" }) }))
    expect(html).toContain(events["31"].title)
    expect(redirect).not.toHaveBeenCalled()
  })

  it("keeps access available when the selected event is not seeded yet", async () => {
    cookieGet.mockReturnValue({ value: events["30"].key })
    findUnique.mockResolvedValue(null)

    const html = renderToStaticMarkup(await RifaDayPage({ params: Promise.resolve({ day: "30" }) }))
    expect(html).toContain(events["30"].title)
    expect(redirect).not.toHaveBeenCalled()
  })

  it.each(["29", "32", "october-30", "30/details"])("returns not found for unsupported day %s", async (day) => {
    await expect(RifaDayPage({ params: Promise.resolve({ day }) })).rejects.toThrow("NEXT_NOT_FOUND")
    expect(notFound).toHaveBeenCalledOnce()
    expect(cookieGet).not.toHaveBeenCalled()
    expect(findUnique).not.toHaveBeenCalled()
  })
})
