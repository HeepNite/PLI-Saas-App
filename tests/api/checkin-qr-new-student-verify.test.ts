import { beforeEach, describe, expect, it, vi } from "vitest"

const mockFindClerkUserByIdentifiers = vi.fn()
const mockUserFindFirst = vi.fn()
const mockPurchaseFindFirst = vi.fn()
const mockAuth = vi.fn()

vi.mock("@clerk/nextjs/server", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}))

vi.mock("@/lib/clerk-users", () => ({
  findClerkUserByIdentifiers: (...args: unknown[]) => mockFindClerkUserByIdentifiers(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findFirst: (...args: unknown[]) => mockUserFindFirst(...args),
    },
    purchase: {
      findFirst: (...args: unknown[]) => mockPurchaseFindFirst(...args),
    },
  },
}))

describe("qr new-student verify route", () => {
  beforeEach(() => {
    mockFindClerkUserByIdentifiers.mockReset()
    mockUserFindFirst.mockReset()
    mockPurchaseFindFirst.mockReset()
    mockAuth.mockReset()
    mockAuth.mockResolvedValue({ userId: null })
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/test"
  })

  it("returns 400 for invalid identifiers", async () => {
    const { POST } = await import("@/app/api/checkin/qr/new-student/verify/route")
    const req = new Request("http://localhost/api/checkin/qr/new-student/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "abc" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("returns exists=true when clerk user already exists", async () => {
    mockFindClerkUserByIdentifiers.mockResolvedValue({ id: "clerk_123" })
    mockUserFindFirst.mockResolvedValue(null)
    mockPurchaseFindFirst.mockResolvedValue(null)

    const { POST } = await import("@/app/api/checkin/qr/new-student/verify/route")
    const req = new Request("http://localhost/api/checkin/qr/new-student/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+1 (929) 387-6584" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.exists).toBe(true)
    expect(data.hasCompletedPurchase).toBe(false)
    expect(data.sources.clerk).toBe(true)
    expect(data.requiresLogin).toBe(false)
    expect(data.sessionOwnsPhone).toBe(false)
  })

  it("returns exists=true when there is a completed purchase", async () => {
    mockFindClerkUserByIdentifiers.mockResolvedValue(null)
    mockUserFindFirst.mockResolvedValue(null)
    mockPurchaseFindFirst.mockResolvedValue({ id: "pur_123" })

    const { POST } = await import("@/app/api/checkin/qr/new-student/verify/route")
    const req = new Request("http://localhost/api/checkin/qr/new-student/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+1 (929) 387-6584" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.exists).toBe(true)
    expect(data.hasCompletedPurchase).toBe(true)
    expect(data.sources.completedPurchase).toBe(true)
    expect(data.requiresLogin).toBe(true)
  })

  it("matches phone variants with and without country code", async () => {
    mockFindClerkUserByIdentifiers.mockResolvedValue(null)
    mockUserFindFirst.mockResolvedValue({ id: "usr_123" })
    mockPurchaseFindFirst.mockResolvedValue(null)

    const { POST } = await import("@/app/api/checkin/qr/new-student/verify/route")
    const req = new Request("http://localhost/api/checkin/qr/new-student/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+1 (929) 387-6584" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.exists).toBe(true)
    expect(data.sources.databaseUser).toBe(true)
    expect(mockUserFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { phone: "19293876584" },
            { phone: "9293876584" },
            { phone: { contains: "19293876584" } },
            { phone: { contains: "9293876584" } },
          ]),
        }),
      })
    )
  })

  it("returns sessionOwnsPhone=true when session user owns that phone", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_123" })
    mockFindClerkUserByIdentifiers.mockResolvedValue({ id: "clerk_123" })
    mockUserFindFirst.mockResolvedValue({ id: "usr_123", clerkId: "clerk_123" })
    mockPurchaseFindFirst.mockResolvedValue(null)

    const { POST } = await import("@/app/api/checkin/qr/new-student/verify/route")
    const req = new Request("http://localhost/api/checkin/qr/new-student/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+1 (929) 387-6584" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.exists).toBe(true)
    expect(data.hasCompletedPurchase).toBe(false)
    expect(data.sessionOwnsPhone).toBe(true)
    expect(data.requiresLogin).toBe(false)
  })

  it("returns requiresLogin=false when there is no completed purchase, even if session user differs", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_other" })
    mockFindClerkUserByIdentifiers.mockResolvedValue({ id: "clerk_123" })
    mockUserFindFirst.mockResolvedValue({ id: "usr_123", clerkId: "clerk_123" })
    mockPurchaseFindFirst.mockResolvedValue(null)

    const { POST } = await import("@/app/api/checkin/qr/new-student/verify/route")
    const req = new Request("http://localhost/api/checkin/qr/new-student/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+1 (929) 387-6584" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.exists).toBe(true)
    expect(data.hasCompletedPurchase).toBe(false)
    expect(data.sessionOwnsPhone).toBe(false)
    expect(data.requiresLogin).toBe(false)
  })

  it("returns requiresLogin=true when there is completed purchase and session user differs", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_other" })
    mockFindClerkUserByIdentifiers.mockResolvedValue({ id: "clerk_123" })
    mockUserFindFirst.mockResolvedValue({ id: "usr_123", clerkId: "clerk_123" })
    mockPurchaseFindFirst.mockResolvedValue({
      id: "pur_123",
      user: { clerkId: "clerk_123" },
    })

    const { POST } = await import("@/app/api/checkin/qr/new-student/verify/route")
    const req = new Request("http://localhost/api/checkin/qr/new-student/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+1 (929) 387-6584" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.exists).toBe(true)
    expect(data.hasCompletedPurchase).toBe(true)
    expect(data.sessionOwnsPhone).toBe(false)
    expect(data.requiresLogin).toBe(true)
  })
})
