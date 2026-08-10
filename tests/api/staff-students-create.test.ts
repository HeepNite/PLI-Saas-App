import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizeStudentOperationalRequest = vi.fn()
const mockFindClerkUserByIdentifiers = vi.fn()
const mockEnsureClerkUser = vi.fn()
const mockUpdateClerkUserIfMissing = vi.fn()
const mockUpsertUserByIdentifiers = vi.fn()
const mockWasUserCreatedByUpsert = vi.fn()
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
  wasUserCreatedByUpsert: (...args: unknown[]) => mockWasUserCreatedByUpsert(...args),
}))

const mockPrisma = {
  classSession: {
    findUnique: vi.fn(),
  },
  purchase: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}

const mockWriteStudentDataAudit = vi.fn()
const mockStripeCheckoutSessionsCreate = vi.fn()
const mockReservePackageCreditForAttendanceTx = vi.fn()
const mockConsumeRateLimit = vi.fn()

const mockTx = {
  attendance: { findUnique: vi.fn(), create: vi.fn() },
  packagePurchase: { findFirst: vi.fn() },
  studentDataAudit: { create: vi.fn() },
}

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

vi.mock("@/lib/security/rate-limit", () => ({
  buildRateLimitKey: vi.fn(() => "staff:students:create"),
  consumeRateLimit: (...args: unknown[]) => mockConsumeRateLimit(...args),
  getClientIp: vi.fn(() => "127.0.0.1"),
}))

vi.mock("@/lib/audit/student-data-audit", () => ({
  writeStudentDataAudit: (...args: unknown[]) => mockWriteStudentDataAudit(...args),
}))

vi.mock("@/lib/packages", () => ({
  reservePackageCreditForAttendanceTx: (...args: unknown[]) => mockReservePackageCreditForAttendanceTx(...args),
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
    mockWasUserCreatedByUpsert.mockReset().mockImplementation((user: { created?: boolean } | null) => Boolean(user?.created))
    mockClerkClient.mockReset()
    mockPrisma.purchase.create.mockReset()
    mockPrisma.classSession.findUnique.mockReset()
    mockPrisma.$transaction.mockReset().mockImplementation(async (callback: (tx: typeof mockTx) => unknown) => callback(mockTx))
    mockWriteStudentDataAudit.mockReset()
    mockReservePackageCreditForAttendanceTx.mockReset()
    mockConsumeRateLimit.mockReset().mockReturnValue({ ok: true })
    mockStripeCheckoutSessionsCreate.mockReset()
    mockAuthorizeStudentOperationalRequest.mockResolvedValue(frontDeskAuth)
    mockFindClerkUserByIdentifiers.mockResolvedValue(null)
    mockEnsureClerkUser.mockResolvedValue(createdClerkUser)
    mockUpdateClerkUserIfMissing.mockResolvedValue(undefined)
    mockUpsertUserByIdentifiers.mockResolvedValue({ ...localStudent, created: true })
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
    mockTx.attendance.findUnique.mockReset().mockResolvedValue(null)
    mockTx.attendance.create.mockReset().mockResolvedValue({ id: "attendance_1" })
    mockTx.packagePurchase.findFirst.mockReset().mockResolvedValue(null)
    mockTx.studentDataAudit.create.mockReset().mockResolvedValue({ id: "audit_1" })
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

  it.each([
    { role: "owner", category: null },
    { role: "admin", category: null },
    { role: "staff", category: "front_desk" },
  ])("preserves $role authorization accepted by the operational guard", async (auth) => {
    mockAuthorizeStudentOperationalRequest.mockResolvedValue({ ...frontDeskAuth, ...auth })

    const res = await postCreateStudent({ email: "student@example.com", amountCents: 0 })

    expect(res.status).toBe(201)
  })

  it("preserves the create limiter and Retry-After response", async () => {
    mockConsumeRateLimit.mockReturnValue({ ok: false, retryAfterSec: 12 })

    const res = await postCreateStudent({ email: "student@example.com" })

    expect(res.status).toBe(429)
    expect(res.headers.get("Retry-After")).toBe("12")
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
      phone: "+1 555 123 4567",
      name: "Maria Student",
    })
    await expect(res.json()).resolves.toMatchObject({ isExisting: true, userId: "user_student_1" })
  })

  it("records a historical attendance at the persisted session start and never emits profile.created for local reuse", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-29T16:00:00.000Z"))
    const startsAt = new Date("2026-07-15T23:00:00.000Z")
    mockFindClerkUserByIdentifiers.mockResolvedValue(createdClerkUser)
    mockUpsertUserByIdentifiers.mockResolvedValue({ ...localStudent, created: false })
    mockPrisma.classSession.findUnique.mockResolvedValue({
      id: "session_1",
      courseSlug: "salsa",
      title: "Salsa",
      startsAt,
      durationMinutes: 60,
    })

    try {
      const res = await postCreateStudent({
        email: "student@example.com",
        amountCents: 0,
        checkIn: { enabled: true, date: "2026-07-15", sessionId: "session_1" },
      })

      expect(res.status).toBe(201)
      expect(mockTx.attendance.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          userId: "user_student_1",
          sessionId: "session_1",
          checkedInAt: startsAt,
        }),
      }))
      expect(mockWriteStudentDataAudit).toHaveBeenCalledWith(expect.objectContaining({
        entity: "attendance",
        entityId: "attendance_1",
        staffClerkId: "front_desk_1",
      }), mockTx)
      expect(mockWriteStudentDataAudit).not.toHaveBeenCalledWith(expect.objectContaining({ entity: "profile", field: "created" }))
    } finally {
      vi.useRealTimers()
    }
  })

  it("accepts a persisted session on New York today", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-29T16:00:00.000Z"))
    const startsAt = new Date("2026-07-29T23:00:00.000Z")
    mockPrisma.classSession.findUnique.mockResolvedValue({ id: "session_today", courseSlug: "salsa", title: "Salsa", startsAt })

    try {
      const res = await postCreateStudent({ email: "student@example.com", checkIn: { enabled: true, date: "2026-07-29", sessionId: "session_today" } })

      expect(res.status).toBe(201)
      expect(mockTx.attendance.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ sessionId: "session_today", checkedInAt: startsAt }),
      }))
    } finally {
      vi.useRealTimers()
    }
  })

  it("rejects a session ID that does not resolve to a persisted session", async () => {
    mockPrisma.classSession.findUnique.mockResolvedValue(null)

    const res = await postCreateStudent({ email: "student@example.com", checkIn: { enabled: true, date: "2026-07-15", sessionId: "missing_session" } })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "Selected class session is not available for staff check-in." })
    expect(mockEnsureClerkUser).not.toHaveBeenCalled()
  })

  it("rejects duplicate attendance before reserving package credit", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-29T16:00:00.000Z"))
    mockPrisma.classSession.findUnique.mockResolvedValue({ id: "session_1", courseSlug: "salsa", title: "Salsa", startsAt: new Date("2026-07-15T23:00:00.000Z") })
    mockTx.attendance.findUnique.mockResolvedValue({ id: "attendance_existing" })

    try {
      const res = await postCreateStudent({ email: "student@example.com", checkIn: { enabled: true, date: "2026-07-15", sessionId: "session_1" } })

      expect(res.status).toBe(409)
      expect(mockReservePackageCreditForAttendanceTx).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it.each([
    ["future", "2026-07-30", new Date("2026-07-30T23:00:00.000Z")],
    ["too-old", "2026-07-14", new Date("2026-07-14T23:00:00.000Z")],
    ["date-mismatched", "2026-07-15", new Date("2026-07-16T23:00:00.000Z")],
  ])("rejects a $0 session check-in", async (_label, date, startsAt) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-29T16:00:00.000Z"))
    mockPrisma.classSession.findUnique.mockResolvedValue({ id: "session_1", courseSlug: "salsa", title: "Salsa", startsAt })

    try {
      const res = await postCreateStudent({ email: "student@example.com", checkIn: { enabled: true, date, sessionId: "session_1" } })

      expect(res.status).toBe(400)
      expect(mockTx.attendance.create).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it("rejects missing and invalid session selections", async () => {
    const missingSession = await postCreateStudent({ email: "student@example.com", checkIn: { enabled: true, date: "2026-07-15" } })
    const invalidDate = await postCreateStudent({ email: "student@example.com", checkIn: { enabled: true, date: "not-a-date", sessionId: "session_1" } })

    expect(missingSession.status).toBe(400)
    expect(invalidDate.status).toBe(400)
  })

  it("reserves a generic eligible package at the selected session start", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-29T16:00:00.000Z"))
    const startsAt = new Date("2026-07-15T23:00:00.000Z")
    mockPrisma.classSession.findUnique.mockResolvedValue({ id: "session_1", courseSlug: "salsa", title: "Salsa", startsAt })
    mockTx.packagePurchase.findFirst.mockResolvedValue({ id: "package_1" })

    try {
      const res = await postCreateStudent({ email: "student@example.com", checkIn: { enabled: true, date: "2026-07-15", sessionId: "session_1" } })

      expect(res.status).toBe(201)
      expect(mockTx.packagePurchase.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([expect.objectContaining({ OR: expect.arrayContaining([{ courseSlug: null, packagePlanId: null }]) })]),
        }),
      }))
      expect(mockReservePackageCreditForAttendanceTx).toHaveBeenCalledWith(mockTx, expect.objectContaining({ packagePurchaseId: "package_1", at: startsAt }))
    } finally {
      vi.useRealTimers()
    }
  })

  it("does not select a package purchased after the historical session", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-29T16:00:00.000Z"))
    const startsAt = new Date("2026-07-15T23:00:00.000Z")
    mockPrisma.classSession.findUnique.mockResolvedValue({ id: "session_1", courseSlug: "salsa", title: "Salsa", startsAt })

    try {
      const res = await postCreateStudent({ email: "student@example.com", checkIn: { enabled: true, date: "2026-07-15", sessionId: "session_1" } })

      expect(res.status).toBe(201)
      expect(mockTx.packagePurchase.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ purchasedAt: { lte: startsAt } }),
      }))
      expect(mockReservePackageCreditForAttendanceTx).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it("writes distinct profile and attendance audits for a newly created student check-in", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-29T16:00:00.000Z"))
    const startsAt = new Date("2026-07-15T23:00:00.000Z")
    mockPrisma.classSession.findUnique.mockResolvedValue({ id: "session_1", courseSlug: "salsa", title: "Salsa", startsAt })

    try {
      const res = await postCreateStudent({ email: "student@example.com", checkIn: { enabled: true, date: "2026-07-15", sessionId: "session_1" } })

      expect(res.status).toBe(201)
      expect(mockWriteStudentDataAudit).toHaveBeenCalledWith(expect.objectContaining({ entity: "attendance", staffClerkId: "front_desk_1", ipAddress: "127.0.0.1" }), mockTx)
      expect(mockWriteStudentDataAudit).toHaveBeenCalledWith(expect.objectContaining({ entity: "profile", field: "created", staffClerkId: "front_desk_1", ipAddress: "127.0.0.1" }))
    } finally {
      vi.useRealTimers()
    }
  })

  it("creates a phone-only Clerk and local student identity", async () => {
    const res = await postCreateStudent({ phone: "+1 555 123 4567", name: "Phone Student" })

    expect(res.status).toBe(201)
    expect(mockEnsureClerkUser).toHaveBeenCalledWith({ email: undefined, phone: "+1 555 123 4567", name: "Phone Student" })
    await expect(res.json()).resolves.toMatchObject({
      activation: { emailInvitationAttempted: false, phoneSignInAvailable: true },
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
