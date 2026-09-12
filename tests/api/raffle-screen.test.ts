import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { hashScreenToken, screenCookieName } from "@/lib/raffle/screen-token"

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    raffleEvent: { findUnique: vi.fn() },
  },
}))

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))

import { GET as screenSession } from "@/app/api/raffle/[slug]/screen-session/route"
import { GET as screenState } from "@/app/api/raffle/[slug]/screen-state/route"

const RAW_TOKEN = "tablet-raw-token"
const EVENT = { id: "event_1", slug: "s1", screenTokenHash: hashScreenToken(RAW_TOKEN) }

const routeParams = (slug: string) => ({ params: Promise.resolve({ slug }) })

describe("GET /api/raffle/[slug]/screen-session", () => {
  beforeEach(() => {
    mockPrisma.raffleEvent.findUnique.mockReset()
    mockPrisma.raffleEvent.findUnique.mockResolvedValue(EVENT)
  })

  it("sets the screen cookie and redirects to the clean screen path on a valid key", async () => {
    const res = await screenSession(
      new NextRequest(`http://localhost/api/raffle/s1/screen-session?key=${RAW_TOKEN}`),
      routeParams("s1")
    )

    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toBe("http://localhost/staff/raffle/s1/screen")
    expect(res.headers.get("Referrer-Policy")).toBe("no-referrer")
    expect(res.headers.get("Cache-Control")).toBe("no-store")

    const cookie = res.cookies.get(screenCookieName("s1"))
    expect(cookie?.value).toBe(RAW_TOKEN)
    expect(cookie?.httpOnly).toBe(true)
    // Lax so the cookie survives arriving from another app; see the route.
    expect(cookie?.sameSite).toBe("lax")
  })

  it("returns 404 for a wrong key", async () => {
    const res = await screenSession(
      new NextRequest("http://localhost/api/raffle/s1/screen-session?key=wrong-token"),
      routeParams("s1")
    )

    expect(res.status).toBe(404)
  })

  it("returns 404 when the key is missing", async () => {
    const res = await screenSession(new NextRequest("http://localhost/api/raffle/s1/screen-session"), routeParams("s1"))

    expect(res.status).toBe(404)
  })

  it("returns 404 for an unknown slug", async () => {
    mockPrisma.raffleEvent.findUnique.mockResolvedValue(null)

    const res = await screenSession(
      new NextRequest(`http://localhost/api/raffle/unknown/screen-session?key=${RAW_TOKEN}`),
      routeParams("unknown")
    )

    expect(res.status).toBe(404)
  })

  it("returns 404 for a malformed slug", async () => {
    const res = await screenSession(
      new NextRequest(`http://localhost/api/raffle/Bad_Slug/screen-session?key=${RAW_TOKEN}`),
      routeParams("Bad_Slug")
    )

    expect(res.status).toBe(404)
    expect(mockPrisma.raffleEvent.findUnique).not.toHaveBeenCalled()
  })
})

describe("GET /api/raffle/[slug]/screen-state", () => {
  beforeEach(() => {
    mockPrisma.raffleEvent.findUnique.mockReset()
    mockPrisma.raffleEvent.findUnique.mockResolvedValue({ ...EVENT, title: "PLE Launch Night", draws: [], _count: { entries: 0 } })
  })

  it("returns 404 when the screen cookie is missing", async () => {
    const res = await screenState(new NextRequest("http://localhost/api/raffle/s1/screen-state"), routeParams("s1"))

    expect(res.status).toBe(404)
  })

  it("returns 404 when the cookie does not match the event's token", async () => {
    const res = await screenState(
      new NextRequest("http://localhost/api/raffle/s1/screen-state", {
        headers: { cookie: `${screenCookieName("s1")}=wrong-token` },
      }),
      routeParams("s1")
    )

    expect(res.status).toBe(404)
  })

  it("returns 404 for an unknown slug even with a well-formed cookie", async () => {
    mockPrisma.raffleEvent.findUnique.mockResolvedValue(null)

    const res = await screenState(
      new NextRequest("http://localhost/api/raffle/unknown/screen-state", {
        headers: { cookie: `${screenCookieName("unknown")}=${RAW_TOKEN}` },
      }),
      routeParams("unknown")
    )

    expect(res.status).toBe(404)
  })

  it("returns the screen state payload when the cookie matches", async () => {
    const res = await screenState(
      new NextRequest("http://localhost/api/raffle/s1/screen-state", {
        headers: { cookie: `${screenCookieName("s1")}=${RAW_TOKEN}` },
      }),
      routeParams("s1")
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.event).toEqual(expect.objectContaining({ slug: "s1", title: "PLE Launch Night" }))
    expect(body.currentDrawId).toBeNull()
  })
})
