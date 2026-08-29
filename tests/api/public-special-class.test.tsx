import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { findFirst, getAvailability } = vi.hoisted(() => ({ findFirst: vi.fn(), getAvailability: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: { specialClass: { findFirst } } }))
vi.mock("@/lib/checkout/special-class-reservation", () => ({ getSpecialClassAvailability: (...args: unknown[]) => getAvailability(...args) }))

import { GET } from "@/app/api/special-classes/[slug]/route"
import PublicSpecialClass from "@/components/front/special-classes/PublicSpecialClass"
import { SPECIAL_SALSA_CLASS } from "@/lib/special-salsa-class/config"

const item = {
  id: "class_1", slug: "public-class", status: "published", title: "Public class", description: "Description", coverImageUrl: null,
  priceCents: 2500, currency: "usd", classSession: { startsAt: new Date(Date.now() + 60_000), durationMinutes: 60, location: "Studio", capacity: 10 },
}

describe("public special class", () => {
  beforeEach(() => { vi.clearAllMocks() })
  afterEach(() => { vi.useRealTimers() })

  it("does not expose unpublished classes", async () => {
    findFirst.mockResolvedValue(null)
    const response = await GET(new Request("http://localhost/api/special-classes/draft"), { params: Promise.resolve({ slug: "draft" }) })
    expect(response.status).toBe(404)
    expect(getAvailability).not.toHaveBeenCalled()
  })

  it("returns only public availability totals without reservation internals", async () => {
    findFirst.mockResolvedValue(item)
    getAvailability.mockResolvedValue({ capacity: 10, remaining: 7, held: 1, paid: 2 })
    const response = await GET(new Request("http://localhost/api/special-classes/public-class"), { params: Promise.resolve({ slug: "public-class" }) })
    const body = await response.json() as { item: { availability: Record<string, number> } }
    expect(body.item.availability).toEqual({ capacity: 10, remaining: 7 })
    expect(JSON.stringify(body)).not.toContain("held")
    expect(JSON.stringify(body)).not.toContain("paid")
  })

  it("communicates sold-out and three-minute hold states", () => {
    const base = { slug: item.slug, title: item.title, description: item.description, coverImageUrl: null, priceCents: item.priceCents, currency: item.currency, session: { startsAt: item.classSession.startsAt.toISOString(), durationMinutes: 60, location: "Studio", capacity: 10 } }
    expect(renderToStaticMarkup(<PublicSpecialClass item={{ ...base, availability: { capacity: 10, remaining: 0 } }} />)).toContain("Sold out")
    expect(renderToStaticMarkup(<PublicSpecialClass item={{ ...base, availability: { capacity: 10, remaining: 1 } }} />)).toContain("held for up to three minutes")
  })

  it("renders the special-class start time consistently across host timezones", () => {
    const specialItem = {
      slug: "public-class",
      title: "Public class",
      description: "Description",
      coverImageUrl: null,
      priceCents: 2500,
      currency: "usd",
      session: { startsAt: "2026-08-30T20:00:00.000Z", durationMinutes: 60, location: "Studio", capacity: 10 },
      availability: { capacity: 10, remaining: 1 },
    }
    const previousTimeZone = process.env.TZ

    try {
      process.env.TZ = "UTC"
      const serverMarkup = renderToStaticMarkup(<PublicSpecialClass item={specialItem} />)
      process.env.TZ = "America/New_York"
      const browserMarkup = renderToStaticMarkup(<PublicSpecialClass item={specialItem} />)

      expect(serverMarkup).toContain("Sunday, August 30, 2026 at 4:00 PM")
      expect(browserMarkup).toBe(serverMarkup)
    } finally {
      process.env.TZ = previousTimeZone
    }
  })

  it("publishes the active Salsa promotion price instead of the persisted base price", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-27T12:00:00.000Z"))
    findFirst.mockResolvedValue({ ...item, slug: SPECIAL_SALSA_CLASS.key, priceCents: SPECIAL_SALSA_CLASS.amountCents })
    getAvailability.mockResolvedValue({ capacity: 40, remaining: 40, held: 0, paid: 0 })
    const response = await GET(new Request(`http://localhost/api/special-classes/${SPECIAL_SALSA_CLASS.key}`), { params: Promise.resolve({ slug: SPECIAL_SALSA_CLASS.key }) })
    const body = await response.json() as { item: { priceCents: number } }
    expect(body.item.priceCents).toBe(SPECIAL_SALSA_CLASS.promotion.amountCents)
  })
})
