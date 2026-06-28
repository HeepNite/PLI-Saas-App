import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizeStudentOperationalRequest = vi.fn()
const mockFindClerkUserByIdentifiers = vi.fn()
const mockEnsureClerkUser = vi.fn()
const mockUpdateClerkUserIfMissing = vi.fn()
const mockUpsertUserByIdentifiers = vi.fn()
const mockClerkClient = vi.fn()

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeStudentOperationalRequest: (...args: unknown[]) => mockAuthorizeStudentOperationalRequest(...args),
}))

vi.mock("@/lib/clerk-users", () => ({
  ensureClerkUser: (...args: unknown[]) => mockEnsureClerkUser(...args),
  findClerkUserByIdentifiers: (...args: unknown[]) => mockFindClerkUserByIdentifiers(...args),
  updateClerkUserIfMissing: (...args: unknown[]) => mockUpdateClerkUserIfMissing(...args),
}))

vi.mock("@/lib/users", () => ({
  upsertUserByIdentifiers: (...args: unknown[]) => mockUpsertUserByIdentifiers(...args),
}))

const mockPrisma = {
  purchase: {
    create: vi.fn(),
  },
}

const mockWriteStudentDataAudit = vi.fn()
const mockStripeCheckoutSessionsCreate = vi.fn()

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

vi.mock("@/lib/security/rate-limit", () => ({
  buildRateLimitKey: vi.fn(() => "staff:students:create"),
  consumeRateLimit: vi.fn(() => ({ ok: true })),
  getClientIp: vi.fn(() => "127.0.0.1"),
}))

vi.mock("@/lib/audit/student-data-audit", () => ({
  writeStudentDataAudit: (...args: unknown[]) => mockWriteStudentDataAudit(...args),
}))

vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake")

vi.mock("stripe", () => {
  const StripeMock = function () {
    return {
      checkout: {
        sessions: {
          create: (...args: unknown[]) => mockStripeCheckoutSessionsCreate(...args),
        },
      },
    }
  }
  return { default: StripeMock }
})

const frontDeskAuth = {
  ok: true,
  userId: "front_desk_1",
  role: "staff",
  category: "front_desk",
  staffName: "Ana Desk",
}

const createdClerkUser = {
  id: "clerk_student_1",
  firstName: "Maria",
  lastName: "Student",
  emailAddresses: [{ emailAddress: "student@example.com" }],
  phoneNumbers: [{ phoneNumber: "+15551234567" }],
}

const localStudent = {
  id: "user_student_1",
  clerkId: "clerk_student_1",
  email: "student@example.com",
  phone: "15551234567",
  name: "Maria Student",
}

const postCreateStudent = async (body: unknown) => {
  const { POST } = await import("@/app/api/staff/students/route")
  return POST(
    new Request("http://localhost/api/staff/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  )
}

describe("POST /api/staff/students", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuthorizeStudentOperationalRequest.mockReset()
    mockFindClerkUserByIdentifiers.mockReset()
    mockEnsureClerkUser.mockReset()
    mockUpdateClerkUserIfMissing.mockReset()
    mockUpsertUserByIdentifiers.mockReset()
    mockClerkClient.mockReset()
    mockPrisma.purchase.create.mockReset()
    mockWriteStudentDataAudit.mockReset()
    mockStripeCheckoutSessionsCreate.mockReset()
    mockAuthorizeStudentOperationalRequest.mockResolvedValue(frontDeskAuth)
    mockFindClerkUserByIdentifiers.mockResolvedValue(null)
    mockEnsureClerkUser.mockResolvedValue(createdClerkUser)
    mockUpdateClerkUserIfMissing.mockResolvedValue(undefined)
    mockUpsertUserByIdentifiers.mockResolvedValue(localStudent)
    mockClerkClient.mockResolvedValue({
      invitations: {
        createInvitation: vi.fn().mockResolvedValue({ id: "inv_1" }),
      },
    })
    mockPrisma.purchase.create.mockResolvedValue({
      id: "purchase_1",
      userId: "user_student_1",
      courseSlug: "_staff_registration",
      amount: 1000,
      status: "pending",
    })
    mockWriteStudentDataAudit.mockResolvedValue(undefined)
    mockStripeCheckoutSessionsCreate.mockResolvedValue({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/pay/cs_test_123",
    })
  })

  it("rejects unauthorized requests before validating the payload", async () => {
    mockAuthorizeStudentOperationalRequest.mockResolvedValue({ ok: false, status: 403, error: "Insufficient role" })

    const res = await postCreateStudent({ email: "student@example.com" })

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: "Insufficient role" })
  })

  it("rejects requests without email or phone", async () => {
    const res = await postCreateStudent({ name: "Walk In" })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "Provide an email or phone number." })
  })

  it("rejects negative amounts", async () => {
    const res = await postCreateStudent({ email: "student@example.com", amountCents: -1 })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "Amount must be zero or greater." })
  })

  it("requires a payment mode when amount is greater than zero", async () => {
    const res = await postCreateStudent({ email: "student@example.com", amountCents: 1000 })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "Payment mode is required when amount is greater than zero." })
  })

  it("rejects unsupported payment modes", async () => {
    const res = await postCreateStudent({ email: "student@example.com", amountCents: 1000, paymentMode: "sms" })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "Payment mode must be cash or card_qr." })
  })

  it("creates a Clerk and local student identity for zero-amount email-only input", async () => {
    const res = await postCreateStudent({ email: "student@example.com", amountCents: 0 })

    expect(res.status).toBe(201)
    expect(mockFindClerkUserByIdentifiers).toHaveBeenCalledWith({ email: "student@example.com", phone: undefined })
    expect(mockEnsureClerkUser).toHaveBeenCalledWith({ email: "student@example.com", phone: undefined, name: undefined })
    expect(mockUpsertUserByIdentifiers).toHaveBeenCalledWith({
      clerkId: "clerk_student_1",
      email: "student@example.com",
      phone: "+15551234567",
      name: "Maria Student",
      nameIsCanonical: false,
    })
    await expect(res.json()).resolves.toEqual({
      userId: "user_student_1",
      clerkUserId: "clerk_student_1",
      isExisting: false,
      activation: {
        emailInvitationAttempted: true,
        phoneSignInAvailable: false,
      },
    })
  })

  it("reuses an existing Clerk identity before linking the local student", async () => {
    mockFindClerkUserByIdentifiers.mockResolvedValue(createdClerkUser)

    const res = await postCreateStudent({ email: "student@example.com", phone: "+1 555 123 4567", name: "Maria Student" })

    expect(res.status).toBe(201)
    expect(mockEnsureClerkUser).not.toHaveBeenCalled()
    expect(mockUpdateClerkUserIfMissing).toHaveBeenCalledWith(createdClerkUser, {
      email: "student@example.com",
      phone: "+15551234567",
      name: "Maria Student",
    })
    await expect(res.json()).resolves.toMatchObject({ isExisting: true, userId: "user_student_1" })
  })

  it("creates a phone-only Clerk and local student identity", async () => {
    const res = await postCreateStudent({ phone: "+1 555 123 4567", name: "Phone Student" })

    expect(res.status).toBe(201)
    expect(mockEnsureClerkUser).toHaveBeenCalledWith({ email: undefined, phone: "+15551234567", name: "Phone Student" })
    await expect(res.json()).resolves.toMatchObject({
      activation: { emailInvitationAttempted: false, phoneSignInAvailable: true },
    })
  })

  it("normalizes 10 US phone digits with the +1 country code", async () => {
    const res = await postCreateStudent({ phone: "2015398283", name: "US Student" })

    expect(res.status).toBe(201)
    expect(mockFindClerkUserByIdentifiers).toHaveBeenCalledWith({ email: undefined, phone: "+12015398283" })
    expect(mockEnsureClerkUser).toHaveBeenCalledWith({ email: undefined, phone: "+12015398283", name: "US Student" })
  })

  it("passes valid +1 E.164 phone numbers through unchanged", async () => {
    const res = await postCreateStudent({ phone: "+12015398283", name: "US Student" })

    expect(res.status).toBe(201)
    expect(mockFindClerkUserByIdentifiers).toHaveBeenCalledWith({ email: undefined, phone: "+12015398283" })
    expect(mockEnsureClerkUser).toHaveBeenCalledWith({ email: undefined, phone: "+12015398283", name: "US Student" })
  })

  it("rejects malformed phone numbers before calling Clerk", async () => {
    const res = await postCreateStudent({ phone: "201-539", name: "Bad Phone" })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "Enter a valid US phone number with 10 digits or +1 followed by 10 digits." })
    expect(mockFindClerkUserByIdentifiers).not.toHaveBeenCalled()
    expect(mockEnsureClerkUser).not.toHaveBeenCalled()
  })

  it("returns a controlled retry response when Clerk identity lookup fails", async () => {
    mockFindClerkUserByIdentifiers.mockRejectedValue(Object.assign(new Error("rate limited"), { status: 429 }))

    const res = await postCreateStudent({ phone: "2015398283", name: "US Student" })

    expect(res.status).toBe(503)
    await expect(res.json()).resolves.toEqual({ error: "Student identity service is temporarily unavailable. Please try again." })
    expect(mockEnsureClerkUser).not.toHaveBeenCalled()
  })

  it("returns a controlled validation response when Clerk rejects contact details", async () => {
    mockEnsureClerkUser.mockRejectedValue(Object.assign(new Error("invalid phone"), { status: 400 }))

    const res = await postCreateStudent({ phone: "2015398283", name: "US Student" })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({
      error: "Unable to create student identity with the provided email or phone. Please check the contact details.",
    })
  })

  it("creates a pending cash purchase and profile/payment audits for cash mode", async () => {
    const res = await postCreateStudent({ email: "student@example.com", amountCents: 1000, paymentMode: "cash", note: "Walk-in deposit" })

    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.purchaseId).toBe("purchase_1")
    expect(data.paymentMode).toBe("cash")
    expect(data.stripeCheckoutUrl).toBeUndefined()

    // Purchase created with sentinel slug and metadata
    expect(mockPrisma.purchase.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user_student_1",
        courseSlug: "_staff_registration",
        courseTitle: "Staff Registration",
        amount: 1000,
        currency: "usd",
        status: "pending",
        metadata: expect.objectContaining({
          source: "staff_created_student",
          paymentMode: "cash",
          paymentChannel: "cash",
          isRegistrationDeposit: true,
          staffNote: "Walk-in deposit",
        }),
      }),
    })

    // Profile creation audit + payment audit
    expect(mockWriteStudentDataAudit).toHaveBeenCalledTimes(2)
    expect(mockWriteStudentDataAudit).toHaveBeenCalledWith(
      expect.objectContaining({ entity: "profile", field: "created", targetUserId: "user_student_1" })
    )
    expect(mockWriteStudentDataAudit).toHaveBeenCalledWith(
      expect.objectContaining({ entity: "payment", field: "created", targetUserId: "user_student_1" })
    )
  })

  it("creates a card QR purchase with Stripe Checkout Session and returns the checkout URL", async () => {
    const res = await postCreateStudent({ email: "student@example.com", amountCents: 2500, paymentMode: "card_qr" })

    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.purchaseId).toBe("purchase_1")
    expect(data.paymentMode).toBe("card_qr")
    expect(data.stripeCheckoutUrl).toBe("https://checkout.stripe.com/pay/cs_test_123")

    // Stripe session created with correct metadata and 30-minute expiry
    expect(mockStripeCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        expires_at: expect.any(Number),
        metadata: expect.objectContaining({
          purchaseId: "purchase_1",
          userId: "user_student_1",
          source: "staff_created_student",
          isRegistrationDeposit: "true",
        }),
      })
    )

    // Purchase updated with stripe session id
    expect(mockPrisma.purchase.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        courseSlug: "_staff_registration",
        amount: 2500,
        status: "pending",
        metadata: expect.objectContaining({
          paymentMode: "card_qr",
          paymentChannel: "card",
        }),
      }),
    })
  })

  it("writes a profile creation audit even for zero-amount creation", async () => {
    const res = await postCreateStudent({ email: "student@example.com", amountCents: 0 })

    expect(res.status).toBe(201)
    expect(mockWriteStudentDataAudit).toHaveBeenCalledTimes(1)
    expect(mockWriteStudentDataAudit).toHaveBeenCalledWith(
      expect.objectContaining({ entity: "profile", field: "created" })
    )
    expect(mockPrisma.purchase.create).not.toHaveBeenCalled()
  })

  it("does not create a purchase when amount is zero", async () => {
    const res = await postCreateStudent({ phone: "+15551234567" })

    expect(res.status).toBe(201)
    expect(mockPrisma.purchase.create).not.toHaveBeenCalled()
  })
})
