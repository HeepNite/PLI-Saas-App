import { beforeEach, describe, expect, it, vi } from "vitest"

const mockFindClerkUserByIdentifiers = vi.fn()
const mockUserFindMany = vi.fn()
const mockUserUpdate = vi.fn()
const mockPurchaseFindFirst = vi.fn()
const mockAuth = vi.fn()
const mockClerkGetUser = vi.fn()

vi.mock("@clerk/nextjs/server", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: async () => ({
    users: {
      getUser: (...args: unknown[]) => mockClerkGetUser(...args),
    },
  }),
}))

vi.mock("@/lib/clerk-users", () => ({
  findClerkUserByIdentifiers: (...args: unknown[]) => mockFindClerkUserByIdentifiers(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: (...args: unknown[]) => mockUserFindMany(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
    purchase: {
      findFirst: (...args: unknown[]) => mockPurchaseFindFirst(...args),
    },
  },
}))

describe("qr new-student verify route", () => {
  beforeEach(() => {
    mockFindClerkUserByIdentifiers.mockReset()
    mockUserFindMany.mockReset()
    mockUserUpdate.mockReset()
    mockPurchaseFindFirst.mockReset()
    mockAuth.mockReset()
    mockClerkGetUser.mockReset()
    mockAuth.mockResolvedValue({ userId: null })
    mockUserFindMany.mockResolvedValue([])
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
    expect(mockFindClerkUserByIdentifiers).not.toHaveBeenCalled()
    expect(mockUserFindMany).not.toHaveBeenCalled()
    expect(mockPurchaseFindFirst).not.toHaveBeenCalled()
  })

  it.each([
    ["+1 (202) 555-0123", "+12025550123", ["12025550123", "2025550123"]],
    ["2025550123", "+12025550123", ["12025550123", "2025550123"]],
    ["+12025550123", "+12025550123", ["12025550123", "2025550123"]],
    ["+525512345678", "+525512345678", ["525512345678"]],
  ])(
    "uses exact candidates for server phone input %s",
    async (phone, e164, digitCandidates) => {
      mockFindClerkUserByIdentifiers.mockResolvedValue(null)
      mockUserFindMany.mockResolvedValue([])
      mockPurchaseFindFirst.mockResolvedValue(null)

      const { POST } = await import("@/app/api/checkin/qr/new-student/verify/route")
      const res = await POST(new Request("http://localhost/api/checkin/qr/new-student/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      }))

      expect(res.status).toBe(200)
      expect(mockFindClerkUserByIdentifiers).toHaveBeenCalledWith({
        phone: e164,
        email: undefined,
      })
      expect(mockUserFindMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { OR: [{ phone: { in: digitCandidates } }] },
      }))
      expect(JSON.stringify(mockUserFindMany.mock.calls[0]?.[0])).not.toContain("contains")
      expect(JSON.stringify(mockPurchaseFindFirst.mock.calls[0]?.[0])).not.toContain("contains")
    }
  )

  it.each(["525512345678", "+80012345678", "+12005550123"])(
    "rejects unsupported phone input %s before lookup",
    async (phone) => {
      const { POST } = await import("@/app/api/checkin/qr/new-student/verify/route")
      const res = await POST(new Request("http://localhost/api/checkin/qr/new-student/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      }))

      expect(res.status).toBe(400)
      expect(mockFindClerkUserByIdentifiers).not.toHaveBeenCalled()
      expect(mockUserFindMany).not.toHaveBeenCalled()
      expect(mockPurchaseFindFirst).not.toHaveBeenCalled()
    }
  )

  it("matches an exact legacy US row without rewriting it", async () => {
    mockFindClerkUserByIdentifiers.mockResolvedValue(null)
    mockUserFindMany.mockResolvedValue([
      { id: "usr_legacy", clerkId: null, email: "legacy@example.com", phone: "2025550123" },
    ])
    mockPurchaseFindFirst.mockResolvedValue(null)

    const { POST } = await import("@/app/api/checkin/qr/new-student/verify/route")
    const res = await POST(new Request("http://localhost/api/checkin/qr/new-student/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+12025550123" }),
    }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.exists).toBe(true)
    expect(mockUserUpdate).not.toHaveBeenCalled()
  })

  it("returns requires_sms_verification for a truly new phone (no Clerk, no DB)", async () => {
    mockFindClerkUserByIdentifiers.mockResolvedValue(null)

    const { POST } = await import("@/app/api/checkin/qr/new-student/verify/route")
    const req = new Request("http://localhost/api/checkin/qr/new-student/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+1 (929) 387-6584" }),
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toMatchObject({
      outcome: "requires_sms_verification",
      reason: "phone_verification_required",
      eligibleForNewStudent: false,
      requiresSmsVerification: true,
      shouldFallbackToRegular: false,
      requiresLogin: false,
    })
  })

  it("returns requires_sms_verification when the phone exists in Clerk but there is no completed purchase", async () => {
    mockFindClerkUserByIdentifiers.mockResolvedValue({ id: "clerk_123" })
    mockPurchaseFindFirst.mockResolvedValue(null)

    const { POST } = await import("@/app/api/checkin/qr/new-student/verify/route")
    const req = new Request("http://localhost/api/checkin/qr/new-student/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+1 (929) 387-6584" }),
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toMatchObject({
      outcome: "requires_sms_verification",
      reason: "phone_verification_required",
      exists: true,
      hasCompletedPurchase: false,
      eligibleForNewStudent: false,
      requiresSmsVerification: true,
      shouldFallbackToRegular: false,
      requiresLogin: false,
    })
    expect(data.sources.clerk).toBe(true)
  })

  it("returns existing_user when existing Clerk user has no purchases", async () => {
    mockFindClerkUserByIdentifiers.mockResolvedValue({ id: "clerk_456" })
    mockPurchaseFindFirst.mockResolvedValue(null)

    const { POST } = await import("@/app/api/checkin/qr/new-student/verify/route")
    const req = new Request("http://localhost/api/checkin/qr/new-student/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+1 (929) 387-9999" }),
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    // This is a "known identity, no purchases" case — distinct from truly new.
    // The outcome still requires SMS verification to confirm phone ownership.
    expect(data).toMatchObject({
      outcome: "requires_sms_verification",
      reason: "phone_verification_required",
      eligibleForNewStudent: false,
      requiresSmsVerification: true,
      shouldFallbackToRegular: false,
      requiresLogin: false,
    })
  })

  it("returns fallback_regular when existing user has a completed purchase", async () => {
    mockFindClerkUserByIdentifiers.mockResolvedValue(null)
    mockPurchaseFindFirst.mockResolvedValue({ id: "pur_123" })

    const { POST } = await import("@/app/api/checkin/qr/new-student/verify/route")
    const req = new Request("http://localhost/api/checkin/qr/new-student/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+1 (929) 387-6584" }),
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toMatchObject({
      outcome: "fallback_regular",
      reason: "existing_customer",
      exists: true,
      hasCompletedPurchase: true,
      eligibleForNewStudent: false,
      requiresSmsVerification: false,
      shouldFallbackToRegular: true,
      requiresLogin: true,
    })
    expect(data.sources.completedPurchase).toBe(true)
  })

  it("returns fallback_regular when existing user has a purchase with status 'completed'", async () => {
    mockFindClerkUserByIdentifiers.mockResolvedValue({ id: "clerk_789" })
    mockPurchaseFindFirst.mockResolvedValue({ id: "pur_456" })

    const { POST } = await import("@/app/api/checkin/qr/new-student/verify/route")
    const req = new Request("http://localhost/api/checkin/qr/new-student/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+1 (929) 387-6584" }),
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toMatchObject({
      outcome: "fallback_regular",
      reason: "existing_customer",
      exists: true,
      hasCompletedPurchase: true,
      eligibleForNewStudent: false,
      requiresSmsVerification: false,
      shouldFallbackToRegular: true,
      requiresLogin: true,
    })
    expect(data.sources.clerk).toBe(true)
    expect(data.sources.completedPurchase).toBe(true)
    // Verify the query includes "completed" in the status filter
    expect(mockPurchaseFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: expect.objectContaining({
            in: expect.arrayContaining(["completed"]),
          }),
        }),
      })
    )
  })

  it("matches exact canonical and legacy US candidates", async () => {
    mockFindClerkUserByIdentifiers.mockResolvedValue(null)
    mockUserFindMany.mockResolvedValue([
      { id: "usr_123", clerkId: null, email: "student@example.com", phone: "19293876584" },
    ])
    mockPurchaseFindFirst.mockResolvedValue(null)

    const { POST } = await import("@/app/api/checkin/qr/new-student/verify/route")
    const req = new Request("http://localhost/api/checkin/qr/new-student/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+1 (929) 387-6584" }),
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.exists).toBe(true)
    expect(mockUserFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ phone: { in: ["19293876584", "9293876584"] } }] },
      })
    )
  })

  it("requires SMS when an active session matches the email but does not own the submitted phone", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_123" })
    mockFindClerkUserByIdentifiers.mockResolvedValue({ id: "clerk_123" })
    mockClerkGetUser.mockResolvedValue({
      id: "clerk_123",
      phoneNumbers: [{ phoneNumber: "+1 212 555 0100", verification: { status: "verified" } }],
    })
    mockUserFindMany.mockResolvedValue([
      { id: "usr_123", clerkId: "clerk_123", email: "active-session@example.com", phone: "19293876584" },
    ])
    mockPurchaseFindFirst.mockResolvedValue(null)

    const { POST } = await import("@/app/api/checkin/qr/new-student/verify/route")
    const req = new Request("http://localhost/api/checkin/qr/new-student/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "active-session@example.com",
        phone: "+1 (929) 387-6584",
      }),
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toMatchObject({
      outcome: "requires_sms_verification",
      reason: "phone_verification_required",
      eligibleForNewStudent: false,
      requiresSmsVerification: true,
    })
    expect(mockClerkGetUser).toHaveBeenCalledWith("clerk_123")
  })

  it("returns eligible when the active session owns both the matched identity and submitted phone", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_123" })
    mockFindClerkUserByIdentifiers.mockResolvedValue({ id: "clerk_123" })
    mockClerkGetUser.mockResolvedValue({
      id: "clerk_123",
      phoneNumbers: [{ phoneNumber: "+19293876584", verification: { status: "verified" } }],
    })
    mockUserFindMany.mockResolvedValue([
      { id: "usr_123", clerkId: "clerk_123", email: "student@example.com", phone: "19293876584" },
    ])
    mockPurchaseFindFirst.mockResolvedValue(null)

    const { POST } = await import("@/app/api/checkin/qr/new-student/verify/route")
    const req = new Request("http://localhost/api/checkin/qr/new-student/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+1 (929) 387-6584" }),
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toMatchObject({
      outcome: "eligible",
      reason: "verified_phone_session",
      sessionOwnsPhone: true,
      eligibleForNewStudent: true,
      requiresSmsVerification: false,
      shouldFallbackToRegular: false,
      requiresLogin: false,
    })
  })

  it("fails closed before lookup when phone parsing throws", async () => {
    vi.resetModules()
    vi.doMock("@/lib/phone", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/phone")>()
      return {
        ...actual,
        parseServerPhoneInput: () => {
          throw new Error("metadata unavailable")
        },
      }
    })

    try {
      const { POST } = await import("@/app/api/checkin/qr/new-student/verify/route")
      const res = await POST(new Request("http://localhost/api/checkin/qr/new-student/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "+12025550123" }),
      }))

      expect(res.status).toBe(500)
      expect(mockFindClerkUserByIdentifiers).not.toHaveBeenCalled()
      expect(mockUserFindMany).not.toHaveBeenCalled()
      expect(mockPurchaseFindFirst).not.toHaveBeenCalled()
    } finally {
      vi.doUnmock("@/lib/phone")
      vi.resetModules()
    }
  })
})
