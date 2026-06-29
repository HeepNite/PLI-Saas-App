import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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
  $transaction: vi.fn(async (callback: (tx: typeof mockPrisma) => unknown) => callback(mockPrisma)),
  classSession: {
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  courseCatalog: {
    findMany: vi.fn(),
  },
  attendance: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  packagePurchase: {
    findMany: vi.fn(),
  },
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

const mockReservePackageCreditForAttendanceTx = vi.fn()
const mockEnsureAttendancePackagePurchase = vi.fn()

vi.mock("@/lib/packages", () => ({
  reservePackageCreditForAttendanceTx: (...args: unknown[]) => mockReservePackageCreditForAttendanceTx(...args),
}))

vi.mock("@/lib/purchase-attendance", () => ({
  ensureAttendancePackagePurchase: (...args: unknown[]) => mockEnsureAttendancePackagePurchase(...args),
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

const selectableSession = () => ({
  id: "session_1",
  courseSlug: "salsa-basics",
  title: "Salsa Basics",
  startsAt: new Date(),
  durationMinutes: 60,
})

const activePackagePurchase = {
  id: "package_purchase_1",
  packageId: "package_1",
  packageLabel: "Salsa 5 Pack",
  courseSlug: "salsa-basics",
  isUnlimited: false,
  remainingCredits: 3,
  expiresAt: null,
  status: "active",
  packagePlan: { courseSlugs: ["salsa-basics"] },
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
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-05-01T18:30:00.000Z"))
    vi.resetModules()
    mockAuthorizeStudentOperationalRequest.mockReset()
    mockFindClerkUserByIdentifiers.mockReset()
    mockEnsureClerkUser.mockReset()
    mockUpdateClerkUserIfMissing.mockReset()
    mockUpsertUserByIdentifiers.mockReset()
    mockClerkClient.mockReset()
    mockPrisma.$transaction.mockClear()
    mockPrisma.classSession.findMany.mockReset()
    mockPrisma.classSession.upsert.mockReset()
    mockPrisma.courseCatalog.findMany.mockReset()
    mockPrisma.attendance.findUnique.mockReset()
    mockPrisma.attendance.create.mockReset()
    mockPrisma.packagePurchase.findMany.mockReset()
    mockPrisma.purchase.create.mockReset()
    mockWriteStudentDataAudit.mockReset()
    mockStripeCheckoutSessionsCreate.mockReset()
    mockReservePackageCreditForAttendanceTx.mockReset()
    mockEnsureAttendancePackagePurchase.mockReset()
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
    mockPrisma.classSession.findMany.mockResolvedValue([selectableSession()])
    mockPrisma.classSession.upsert.mockResolvedValue(selectableSession())
    mockPrisma.courseCatalog.findMany.mockResolvedValue([])
    mockPrisma.attendance.findUnique.mockResolvedValue(null)
    mockPrisma.attendance.create.mockResolvedValue({
      id: "attendance_1",
      userId: "user_student_1",
      sessionId: "session_1",
      status: "checked_in_no_package",
    })
    mockPrisma.packagePurchase.findMany.mockResolvedValue([])
    mockReservePackageCreditForAttendanceTx.mockResolvedValue({ consumed: false, packagePurchase: null })
    mockEnsureAttendancePackagePurchase.mockResolvedValue(undefined)
    mockWriteStudentDataAudit.mockResolvedValue(undefined)
    mockStripeCheckoutSessionsCreate.mockResolvedValue({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/pay/cs_test_123",
    })
  })

  afterEach(() => {
    vi.useRealTimers()
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

  it("accepts valid international E.164 phone numbers", async () => {
    const res = await postCreateStudent({ phone: "+5491123456789", name: "International Student" })

    expect(res.status).toBe(201)
    expect(mockFindClerkUserByIdentifiers).toHaveBeenCalledWith({ email: undefined, phone: "+5491123456789" })
    expect(mockEnsureClerkUser).toHaveBeenCalledWith({ email: undefined, phone: "+5491123456789", name: "International Student" })
  })

  it("rejects malformed phone numbers before calling Clerk", async () => {
    const res = await postCreateStudent({ phone: "201-539", name: "Bad Phone" })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "Enter a valid E.164 phone number (for example +5491123456789) or a 10-digit US phone number." })
    expect(mockFindClerkUserByIdentifiers).not.toHaveBeenCalled()
    expect(mockEnsureClerkUser).not.toHaveBeenCalled()
  })

  it("rejects malformed + phone numbers before calling Clerk", async () => {
    const res = await postCreateStudent({ phone: "+0123456789", name: "Bad International Phone" })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "Enter a valid E.164 phone number (for example +5491123456789) or a 10-digit US phone number." })
    expect(mockFindClerkUserByIdentifiers).not.toHaveBeenCalled()
    expect(mockEnsureClerkUser).not.toHaveBeenCalled()
  })

  it("rejects short + phone numbers before calling Clerk", async () => {
    const res = await postCreateStudent({ phone: "+1234567", name: "Short International Phone" })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "Enter a valid E.164 phone number (for example +5491123456789) or a 10-digit US phone number." })
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

  it("creates attendance for the selected class session and links the manual purchase metadata", async () => {
    const res = await postCreateStudent({
      email: "student@example.com",
      amountCents: 1000,
      paymentMode: "cash",
      checkIn: { enabled: true, sessionId: "session_1" },
    })

    expect(res.status).toBe(201)
    await expect(res.json()).resolves.toMatchObject({ attendanceId: "attendance_1", purchaseId: "purchase_1" })
    expect(mockPrisma.classSession.findMany).toHaveBeenCalledWith({
      where: { startsAt: { gte: expect.any(Date), lt: expect.any(Date) } },
      select: { id: true, courseSlug: true, title: true, startsAt: true, durationMinutes: true },
      orderBy: { startsAt: "desc" },
      take: 50,
    })
    expect(mockPrisma.attendance.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user_student_1",
        sessionId: "session_1",
        status: "checked_in_no_package",
        metadata: expect.objectContaining({ source: "staff_created_student", staffUserId: "front_desk_1" }),
      }),
    })
    expect(mockPrisma.purchase.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: expect.objectContaining({ attendanceId: "attendance_1" }),
      }),
    })
  })

  it("accepts a selectable check-in session for the selected prior date", async () => {
    mockPrisma.classSession.findMany.mockResolvedValue([
      {
        id: "session_prior_day",
        courseSlug: "salsa-basics",
        title: "Salsa Basics",
        startsAt: new Date("2026-04-30T18:00:00.000Z"),
        durationMinutes: 60,
      },
    ])
    mockPrisma.attendance.create.mockResolvedValue({
      id: "attendance_prior",
      userId: "user_student_1",
      sessionId: "session_prior_day",
      status: "checked_in_no_package",
    })

    const res = await postCreateStudent({
      email: "student@example.com",
      checkIn: { enabled: true, date: "2026-04-30", sessionId: "session_prior_day" },
    })

    expect(res.status).toBe(201)
    await expect(res.json()).resolves.toMatchObject({ attendanceId: "attendance_prior" })
    expect(mockPrisma.classSession.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        startsAt: {
          gte: new Date("2026-04-30T04:00:00.000Z"),
          lt: new Date("2026-05-01T04:00:00.000Z"),
        },
      },
    }))
    expect(mockPrisma.attendance.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ sessionId: "session_prior_day" }),
    })
  })

  it("materializes a valid synthetic scheduled session before creating attendance", async () => {
    mockPrisma.classSession.findMany.mockResolvedValue([])
    mockPrisma.courseCatalog.findMany.mockResolvedValue([
      {
        slug: "salsa-basics",
        title: "Salsa Basics",
        durationMinutes: 60,
        availableWeekdays: [5],
        availableTimes: ["18:00"],
        scheduleRules: null,
      },
    ])
    mockPrisma.classSession.upsert.mockResolvedValue({
      id: "session_materialized",
      courseSlug: "salsa-basics",
      title: "Salsa Basics",
      startsAt: new Date("2026-05-01T22:00:00.000Z"),
      durationMinutes: 60,
    })
    mockPrisma.attendance.create.mockResolvedValue({
      id: "attendance_materialized",
      userId: "user_student_1",
      sessionId: "session_materialized",
      status: "checked_in_no_package",
    })

    const res = await postCreateStudent({
      email: "student@example.com",
      checkIn: {
        enabled: true,
        date: "2026-05-01",
        sessionId: "scheduled:salsa-basics:2026-05-01:18:00",
      },
    })

    expect(res.status).toBe(201)
    await expect(res.json()).resolves.toMatchObject({ attendanceId: "attendance_materialized" })
    expect(mockPrisma.classSession.upsert).toHaveBeenCalledWith({
      where: {
        courseSlug_startsAt: {
          courseSlug: "salsa-basics",
          startsAt: new Date("2026-05-01T22:00:00.000Z"),
        },
      },
      update: {
        title: "Salsa Basics",
        durationMinutes: 60,
      },
      create: {
        courseSlug: "salsa-basics",
        title: "Salsa Basics",
        startsAt: new Date("2026-05-01T22:00:00.000Z"),
        durationMinutes: 60,
      },
      select: {
        id: true,
        courseSlug: true,
        title: true,
        startsAt: true,
        durationMinutes: true,
      },
    })
    expect(mockPrisma.attendance.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ sessionId: "session_materialized" }),
    })
  })

  it("accepts a valid synthetic scheduled session ID after the class session already exists", async () => {
    mockPrisma.classSession.findMany.mockResolvedValue([
      {
        id: "session_existing",
        courseSlug: "salsa-basics",
        title: "Salsa Basics Live",
        startsAt: new Date("2026-05-01T22:00:00.000Z"),
        durationMinutes: 75,
      },
    ])
    mockPrisma.courseCatalog.findMany.mockResolvedValue([
      {
        slug: "salsa-basics",
        title: "Salsa Basics",
        durationMinutes: 60,
        availableWeekdays: [5],
        availableTimes: ["18:00"],
        scheduleRules: null,
      },
    ])
    mockPrisma.classSession.upsert.mockResolvedValue({
      id: "session_existing",
      courseSlug: "salsa-basics",
      title: "Salsa Basics Live",
      startsAt: new Date("2026-05-01T22:00:00.000Z"),
      durationMinutes: 75,
    })
    mockPrisma.attendance.create.mockResolvedValue({
      id: "attendance_existing",
      userId: "user_student_1",
      sessionId: "session_existing",
      status: "checked_in_no_package",
    })

    const res = await postCreateStudent({
      email: "student@example.com",
      checkIn: {
        enabled: true,
        date: "2026-05-01",
        sessionId: "scheduled:salsa-basics:2026-05-01:18:00",
      },
    })

    expect(res.status).toBe(201)
    await expect(res.json()).resolves.toMatchObject({ attendanceId: "attendance_existing" })
    expect(mockPrisma.classSession.upsert).toHaveBeenCalledWith({
      where: {
        courseSlug_startsAt: {
          courseSlug: "salsa-basics",
          startsAt: new Date("2026-05-01T22:00:00.000Z"),
        },
      },
      update: {
        title: "Salsa Basics Live",
        durationMinutes: 75,
      },
      create: {
        courseSlug: "salsa-basics",
        title: "Salsa Basics Live",
        startsAt: new Date("2026-05-01T22:00:00.000Z"),
        durationMinutes: 75,
      },
      select: {
        id: true,
        courseSlug: true,
        title: true,
        startsAt: true,
        durationMinutes: true,
      },
    })
    expect(mockPrisma.attendance.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ sessionId: "session_existing" }),
    })
  })

  it("rejects a check-in session that is not selectable for the selected date", async () => {
    mockPrisma.classSession.findMany.mockResolvedValue([])

    const res = await postCreateStudent({
      email: "student@example.com",
      checkIn: { enabled: true, date: "2026-04-30", sessionId: "session_current_day" },
    })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "Selected class session is not available for staff check-in." })
    expect(mockFindClerkUserByIdentifiers).not.toHaveBeenCalled()
    expect(mockPrisma.attendance.create).not.toHaveBeenCalled()
  })

  it("rejects an arbitrary synthetic session ID that is not generated for the selected date", async () => {
    mockPrisma.classSession.findMany.mockResolvedValue([])
    mockPrisma.courseCatalog.findMany.mockResolvedValue([
      {
        slug: "salsa-basics",
        title: "Salsa Basics",
        durationMinutes: 60,
        availableWeekdays: [5],
        availableTimes: ["18:00"],
        scheduleRules: null,
      },
    ])

    const res = await postCreateStudent({
      email: "student@example.com",
      checkIn: {
        enabled: true,
        date: "2026-05-01",
        sessionId: "scheduled:salsa-basics:2026-05-01:19:00",
      },
    })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "Selected class session is not available for staff check-in." })
    expect(mockFindClerkUserByIdentifiers).not.toHaveBeenCalled()
    expect(mockPrisma.classSession.upsert).not.toHaveBeenCalled()
    expect(mockPrisma.attendance.create).not.toHaveBeenCalled()
  })

  it.each([
    ["malformed", "2026-04-30-extra"],
    ["overlong", `2026-04-30${"0".repeat(80)}`],
  ])("rejects a %s check-in date before identity creation", async (_label, date) => {
    const res = await postCreateStudent({
      email: "student@example.com",
      checkIn: { enabled: true, date, sessionId: "session_1" },
    })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "Invalid check-in date. Use YYYY-MM-DD." })
    expect(mockPrisma.classSession.findMany).not.toHaveBeenCalled()
    expect(mockFindClerkUserByIdentifiers).not.toHaveBeenCalled()
    expect(mockPrisma.attendance.create).not.toHaveBeenCalled()
  })

  it.each([
    ["future", "2026-05-02"],
    ["too-old historical", "2026-04-16"],
  ])("rejects a %s check-in date before identity creation", async (_label, date) => {
    const res = await postCreateStudent({
      email: "student@example.com",
      checkIn: { enabled: true, date, sessionId: "session_1" },
    })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "Check-in date must be today or within the last 14 days." })
    expect(mockPrisma.classSession.findMany).not.toHaveBeenCalled()
    expect(mockFindClerkUserByIdentifiers).not.toHaveBeenCalled()
    expect(mockPrisma.attendance.create).not.toHaveBeenCalled()
  })

  it.each([
    ["stale", "session_stale"],
    ["far-future", "session_future"],
    ["non-selectable", "session_51"],
  ])("rejects %s class sessions outside the selectable sessions contract", async (_label, sessionId) => {
    mockPrisma.classSession.findMany.mockResolvedValue([selectableSession()])

    const res = await postCreateStudent({
      email: "student@example.com",
      checkIn: { enabled: true, sessionId },
    })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "Selected class session is not available for staff check-in." })
    expect(mockFindClerkUserByIdentifiers).not.toHaveBeenCalled()
    expect(mockEnsureClerkUser).not.toHaveBeenCalled()
    expect(mockPrisma.attendance.create).not.toHaveBeenCalled()
    expect(mockPrisma.purchase.create).not.toHaveBeenCalled()
  })

  it("reserves an active package credit and creates a package-credit purchase link for attendance", async () => {
    mockPrisma.packagePurchase.findMany.mockResolvedValue([activePackagePurchase])
    mockPrisma.attendance.create.mockResolvedValue({
      id: "attendance_1",
      userId: "user_student_1",
      sessionId: "session_1",
      status: "checked_in",
    })
    mockReservePackageCreditForAttendanceTx.mockResolvedValue({
      consumed: true,
      packagePurchase: { ...activePackagePurchase, remainingCredits: 2 },
    })

    const res = await postCreateStudent({
      email: "student@example.com",
      checkIn: { enabled: true, sessionId: "session_1" },
    })

    expect(res.status).toBe(201)
    await expect(res.json()).resolves.toMatchObject({ attendanceId: "attendance_1" })
    expect(mockPrisma.packagePurchase.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: "user_student_1", status: "active" }),
      take: 1,
    }))
    expect(mockPrisma.attendance.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: "checked_in" }),
    })
    expect(mockReservePackageCreditForAttendanceTx).toHaveBeenCalledWith(mockPrisma, {
      packagePurchaseId: "package_purchase_1",
      userId: "user_student_1",
      attendanceId: "attendance_1",
      courseSlug: "salsa-basics",
      at: expect.any(Date),
      reason: "STAFF_CREATED_STUDENT_CHECK_IN",
    })
    expect(mockEnsureAttendancePackagePurchase).toHaveBeenCalledWith(mockPrisma, expect.objectContaining({
      attendanceId: "attendance_1",
      userId: "user_student_1",
      courseSlug: "salsa-basics",
      packageId: "package_1",
      packagePurchaseId: "package_purchase_1",
      source: "staff_created_student",
    }))
  })

  it("uses the selected check-in date for package-credit purchase metadata", async () => {
    mockPrisma.classSession.findMany.mockResolvedValue([
      {
        id: "session_late_local_day",
        courseSlug: "salsa-basics",
        title: "Salsa Basics",
        startsAt: new Date("2026-05-01T02:00:00.000Z"),
        durationMinutes: 60,
      },
    ])
    mockPrisma.packagePurchase.findMany.mockResolvedValue([activePackagePurchase])
    mockPrisma.attendance.create.mockResolvedValue({
      id: "attendance_late_local_day",
      userId: "user_student_1",
      sessionId: "session_late_local_day",
      status: "checked_in",
    })
    mockReservePackageCreditForAttendanceTx.mockResolvedValue({
      consumed: true,
      packagePurchase: { ...activePackagePurchase, remainingCredits: 2 },
    })

    const res = await postCreateStudent({
      email: "student@example.com",
      checkIn: { enabled: true, date: "2026-04-30", sessionId: "session_late_local_day" },
    })

    expect(res.status).toBe(201)
    expect(mockEnsureAttendancePackagePurchase).toHaveBeenCalledWith(mockPrisma, expect.objectContaining({
      attendanceId: "attendance_late_local_day",
      date: "2026-04-30",
      time: "02:00",
    }))
  })

  it("does not create manual or package-credit purchase records when duplicate attendance is rejected", async () => {
    mockPrisma.attendance.findUnique.mockResolvedValue({ id: "attendance_existing" })
    mockPrisma.packagePurchase.findMany.mockResolvedValue([activePackagePurchase])

    const res = await postCreateStudent({
      email: "student@example.com",
      amountCents: 1000,
      paymentMode: "cash",
      checkIn: { enabled: true, sessionId: "session_1" },
    })

    expect(res.status).toBe(409)
    expect(mockPrisma.attendance.create).not.toHaveBeenCalled()
    expect(mockReservePackageCreditForAttendanceTx).not.toHaveBeenCalled()
    expect(mockEnsureAttendancePackagePurchase).not.toHaveBeenCalled()
    expect(mockPrisma.purchase.create).not.toHaveBeenCalled()
  })

  it("returns 409 when attendance already exists for the selected class session", async () => {
    mockPrisma.attendance.findUnique.mockResolvedValue({ id: "attendance_existing" })

    const res = await postCreateStudent({
      email: "student@example.com",
      checkIn: { enabled: true, sessionId: "session_1" },
    })

    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toEqual({ error: "Student is already checked in for this class session." })
    expect(mockPrisma.attendance.create).not.toHaveBeenCalled()
    expect(mockPrisma.purchase.create).not.toHaveBeenCalled()
  })

  it("preserves existing creation behavior when attendance is omitted", async () => {
    const res = await postCreateStudent({ email: "student@example.com", amountCents: 0 })

    expect(res.status).toBe(201)
    expect(mockPrisma.classSession.findMany).not.toHaveBeenCalled()
    expect(mockPrisma.attendance.create).not.toHaveBeenCalled()
    const data = await res.json()
    expect(data.userId).toBe("user_student_1")
    expect(data).not.toHaveProperty("attendanceId")
  })
})
