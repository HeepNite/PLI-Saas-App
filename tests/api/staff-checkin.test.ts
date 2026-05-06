import { beforeEach, describe, expect, it, vi } from "vitest"

const mockConsumePackageCredit = vi.fn()
const mockClerkAuth = vi.fn(async () => ({ userId: null, sessionClaims: null }))
const mockClerkClient = vi.fn(async () => ({
  users: {
    getUser: vi.fn(),
  },
}))

const mockPrisma = {
  user: {
    findFirst: vi.fn(),
  },
  courseCatalog: {
    findUnique: vi.fn(),
  },
  purchase: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  room: {
    findUnique: vi.fn(),
  },
  roomReservation: {
    findMany: vi.fn(),
  },
  classSession: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  attendance: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  pointsRule: {
    findUnique: vi.fn(),
  },
  pointsLedger: {
    create: vi.fn(),
  },
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
}

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

vi.mock("@/lib/packages", () => ({
  consumePackageCreditForAttendance: (...args: unknown[]) => mockConsumePackageCredit(...args),
}))

vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mockClerkAuth(),
  clerkClient: () => mockClerkClient(),
}))

describe("staff checkin route", () => {
  beforeEach(() => {
    mockPrisma.user.findFirst.mockReset()
    mockPrisma.room.findUnique.mockReset()
    mockPrisma.room.findUnique.mockResolvedValue(null)
    mockPrisma.roomReservation.findMany.mockReset()
    mockPrisma.roomReservation.findMany.mockResolvedValue([])
    mockPrisma.classSession.findUnique.mockReset()
    mockPrisma.classSession.findUnique.mockResolvedValue(null)
    mockPrisma.classSession.findMany.mockReset()
    mockPrisma.classSession.findMany.mockResolvedValue([])
    mockPrisma.classSession.upsert.mockReset()
    mockPrisma.attendance.findUnique.mockReset()
    mockPrisma.attendance.upsert.mockReset()
    mockPrisma.attendance.update.mockReset()
    mockPrisma.attendance.count.mockReset()
    mockPrisma.courseCatalog.findUnique.mockReset()
    mockPrisma.courseCatalog.findUnique.mockResolvedValue({ title: "Mock Course", dropInPriceCents: 2000 })
    mockPrisma.purchase.create.mockReset()
    mockPrisma.purchase.findFirst.mockReset()
    mockPrisma.purchase.create.mockResolvedValue({ id: "mock-purchase" })
    mockPrisma.purchase.findFirst.mockResolvedValue(null)
    mockPrisma.pointsRule.findUnique.mockReset()
    mockPrisma.pointsLedger.create.mockReset()
    mockPrisma.$executeRaw.mockReset()
    mockPrisma.$executeRaw.mockResolvedValue(1)
    mockPrisma.$transaction.mockReset()
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => Promise<unknown>) => callback(mockPrisma))
    mockConsumePackageCredit.mockReset()
    mockClerkAuth.mockReset()
    mockClerkAuth.mockResolvedValue({ userId: null, sessionClaims: null })
    mockClerkClient.mockReset()
    process.env.STAFF_CHECKIN_TOKEN = "test-token"
    delete process.env.ENABLE_RATE_LIMIT_IN_TESTS
    vi.useRealTimers()
  })

  it("returns 401 for invalid token", async () => {
    const { POST } = await import("@/app/api/staff/checkin/route")
    const req = new Request("http://localhost/api/staff/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-staff-token": "wrong" },
      body: JSON.stringify({ courseSlug: "salsa-femenina-matutina", email: "test@example.com" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("creates checkin and consumes package credit", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: "db_user" })
    mockPrisma.classSession.upsert.mockResolvedValue({ id: "session_1" })
    mockPrisma.attendance.upsert.mockResolvedValue({
      id: "att_1",
      checkedInAt: new Date("2026-02-14T12:00:00.000Z"),
    })
    mockPrisma.attendance.count.mockResolvedValue(1)
    mockConsumePackageCredit.mockResolvedValue({
      packagePurchase: {
        id: "pkg_1",
        packageId: "morning-3-week",
        packageLabel: "Morning 3-week pack",
        isUnlimited: false,
        remainingCredits: 11,
        status: "active",
      },
      consumed: true,
    })

    const { POST } = await import("@/app/api/staff/checkin/route")
    const req = new Request("http://localhost/api/staff/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-staff-token": "test-token" },
      body: JSON.stringify({ courseSlug: "salsa-femenina-matutina", email: "test@example.com" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.package.packageId).toBe("morning-3-week")
    expect(data.attendance.status).toBe("checked_in")
  })

  it("does not create a duplicate package purchase when the attendance already has one", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: "db_user",
      email: "test@example.com",
      name: "Test User",
      phone: "+1 555 111 2222",
    })
    mockPrisma.classSession.upsert.mockResolvedValue({ id: "session_1" })
    mockPrisma.attendance.upsert.mockResolvedValue({
      id: "att_1",
      checkedInAt: new Date("2026-02-14T12:00:00.000Z"),
    })
    mockPrisma.attendance.count.mockResolvedValue(1)
    mockPrisma.purchase.findFirst.mockResolvedValue({ id: "existing_purchase" })
    mockConsumePackageCredit.mockResolvedValue({
      packagePurchase: {
        id: "pkg_1",
        packageId: "morning-3-week",
        packageLabel: "Morning 3-week pack",
        isUnlimited: false,
        remainingCredits: 11,
        status: "active",
      },
      consumed: false,
    })

    const { POST } = await import("@/app/api/staff/checkin/route")
    const req = new Request("http://localhost/api/staff/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-staff-token": "test-token" },
      body: JSON.stringify({ courseSlug: "salsa-femenina-matutina", email: "test@example.com" }),
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(mockPrisma.purchase.create).not.toHaveBeenCalled()
  })

  it("returns 400 on invalid staff payload", async () => {
    const { POST } = await import("@/app/api/staff/checkin/route")
    const req = new Request("http://localhost/api/staff/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-staff-token": "test-token" },
      body: JSON.stringify({ courseSlug: "Musica Bebes", email: "test@example.com" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("marks attendance without package when no credits available", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: "db_user" })
    mockPrisma.classSession.upsert.mockResolvedValue({ id: "session_1" })
    mockPrisma.attendance.upsert.mockResolvedValue({
      id: "att_1",
      checkedInAt: new Date("2026-02-14T12:00:00.000Z"),
    })
    mockPrisma.attendance.count.mockResolvedValue(1)
    mockConsumePackageCredit.mockResolvedValue({
      packagePurchase: null,
      consumed: false,
    })

    const { POST } = await import("@/app/api/staff/checkin/route")
    const req = new Request("http://localhost/api/staff/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-staff-token": "test-token" },
      body: JSON.stringify({ courseSlug: "salsa-femenina-matutina", email: "test@example.com" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockPrisma.attendance.update).toHaveBeenCalled()
    const data = await res.json()
    expect(data.attendance.status).toBe("checked_in_no_package")
  })

  it("rejects missing or inactive assigned rooms", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: "db_user" })
    mockPrisma.room.findUnique.mockResolvedValue({ id: "room_1", active: false })

    const { POST } = await import("@/app/api/staff/checkin/route")
    const req = new Request("http://localhost/api/staff/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-staff-token": "test-token" },
      body: JSON.stringify({
        courseSlug: "salsa-femenina-matutina",
        email: "test@example.com",
        roomId: "123e4567-e89b-42d3-a456-426614174000",
      }),
    })

    const res = await POST(req)

    expect(res.status).toBe(404)
    expect(mockPrisma.classSession.upsert).not.toHaveBeenCalled()
    await expect(res.json()).resolves.toEqual({ error: "Assigned room not found or inactive." })
  })

  it("creates checkin successfully when the requested room is available", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: "db_user" })
    mockPrisma.room.findUnique
      .mockResolvedValueOnce({
        id: "123e4567-e89b-42d3-a456-426614174000",
        name: "Studio A",
        capacity: 24,
        location: "Main floor",
        active: true,
      })
      .mockResolvedValueOnce({
        id: "123e4567-e89b-42d3-a456-426614174000",
        name: "Studio A",
        capacity: 24,
        location: "Main floor",
        active: true,
      })
    mockPrisma.classSession.findMany.mockResolvedValue([])
    mockPrisma.classSession.upsert.mockResolvedValue({
      id: "session_1",
      courseSlug: "salsa-femenina-matutina",
      title: "Morning room class",
      startsAt: new Date("2026-02-14T10:30:00.000Z"),
      location: "Main floor",
    })
    mockPrisma.attendance.upsert.mockResolvedValue({
      id: "att_1",
      checkedInAt: new Date("2026-02-14T10:25:00.000Z"),
    })
    mockPrisma.attendance.count.mockResolvedValue(1)
    mockConsumePackageCredit.mockResolvedValue({
      packagePurchase: {
        id: "pkg_1",
        packageId: "morning-3-week",
        packageLabel: "Morning 3-week pack",
        isUnlimited: false,
        remainingCredits: 11,
        status: "active",
      },
      consumed: true,
    })

    const { POST } = await import("@/app/api/staff/checkin/route")
    const req = new Request("http://localhost/api/staff/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-staff-token": "test-token" },
      body: JSON.stringify({
        courseSlug: "salsa-femenina-matutina",
        email: "test@example.com",
        roomId: "123e4567-e89b-42d3-a456-426614174000",
        startsAt: "2026-02-14T10:30:00.000Z",
        durationMinutes: 60,
        location: "Main floor",
        sessionTitle: "Morning room class",
      }),
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(mockPrisma.classSession.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ roomId: "123e4567-e89b-42d3-a456-426614174000" }),
        create: expect.objectContaining({ roomId: "123e4567-e89b-42d3-a456-426614174000" }),
      })
    )
    expect(data.session.room).toEqual({
      id: "123e4567-e89b-42d3-a456-426614174000",
      name: "Studio A",
      capacity: 24,
      location: "Main floor",
      active: true,
    })
  })

  it("returns 409 when the requested room overlaps another session", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: "db_user" })
    mockPrisma.room.findUnique.mockResolvedValue({ id: "room_1", active: true })
    mockPrisma.classSession.findMany.mockResolvedValue([
      {
        id: "session_conflict",
        roomId: "123e4567-e89b-42d3-a456-426614174000",
        startsAt: new Date("2026-02-14T10:00:00.000Z"),
        durationMinutes: 60,
        title: "Morning class",
        courseSlug: "bachata-beginners",
      },
    ])

    const { POST } = await import("@/app/api/staff/checkin/route")
    const req = new Request("http://localhost/api/staff/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-staff-token": "test-token" },
      body: JSON.stringify({
        courseSlug: "salsa-femenina-matutina",
        email: "test@example.com",
        roomId: "123e4567-e89b-42d3-a456-426614174000",
        startsAt: "2026-02-14T10:30:00.000Z",
        durationMinutes: 60,
      }),
    })

    const res = await POST(req)

    expect(res.status).toBe(409)
    expect(mockPrisma.classSession.upsert).not.toHaveBeenCalled()
    await expect(res.json()).resolves.toMatchObject({
      error: "Room is unavailable for the requested time slot.",
      conflict: {
        sessionId: "session_conflict",
        courseSlug: "bachata-beginners",
        title: "Morning class",
      },
    })
  })

  it("keeps the legacy null-room flow working", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: "db_user" })
    mockPrisma.classSession.upsert.mockResolvedValue({
      id: "session_legacy",
      courseSlug: "salsa-femenina-matutina",
      title: "Legacy session",
      startsAt: new Date("2026-02-14T10:00:00.000Z"),
      location: null,
    })
    mockPrisma.attendance.upsert.mockResolvedValue({
      id: "att_legacy",
      checkedInAt: new Date("2026-02-14T10:00:00.000Z"),
    })
    mockPrisma.attendance.count.mockResolvedValue(1)
    mockConsumePackageCredit.mockResolvedValue({
      packagePurchase: null,
      consumed: false,
    })

    const { POST } = await import("@/app/api/staff/checkin/route")
    const req = new Request("http://localhost/api/staff/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-staff-token": "test-token" },
      body: JSON.stringify({
        courseSlug: "salsa-femenina-matutina",
        email: "test@example.com",
        startsAt: "2026-02-14T10:00:00.000Z",
        durationMinutes: 60,
        roomId: null,
      }),
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(mockPrisma.room.findUnique).not.toHaveBeenCalled()
    expect(mockPrisma.classSession.findMany).not.toHaveBeenCalled()
    expect(mockPrisma.classSession.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.not.objectContaining({ roomId: expect.anything() }),
        create: expect.not.objectContaining({ roomId: expect.anything() }),
      })
    )
    expect(data.session.room).toBeNull()
    expect(data.attendance.status).toBe("checked_in_no_package")
  })

  it("checks out attendance and stores a server timestamp", async () => {
    const serverCheckedOutAt = new Date("2026-03-30T18:45:00.000Z")
    vi.useFakeTimers()
    vi.setSystemTime(serverCheckedOutAt)

    mockPrisma.attendance.findUnique.mockResolvedValue({
      id: "att_1",
      status: "checked_in",
      checkedInAt: new Date("2026-03-30T18:00:00.000Z"),
      checkedOutAt: null,
      session: {
        courseSlug: "salsa-femenina-matutina",
        title: "Salsa femenina matutina",
      },
    })
    mockPrisma.attendance.update.mockResolvedValue({
      id: "att_1",
      status: "checked_out",
      checkedInAt: new Date("2026-03-30T18:00:00.000Z"),
      checkedOutAt: serverCheckedOutAt,
      session: {
        courseSlug: "salsa-femenina-matutina",
        title: "Salsa femenina matutina",
      },
    })

    const { PATCH } = await import("@/app/api/staff/checkin/route")
    const req = new Request("http://localhost/api/staff/checkin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-staff-token": "test-token" },
      body: JSON.stringify({ attendanceId: "att_1", checkedOutAt: "1999-01-01T00:00:00.000Z" }),
    })
    const res = await PATCH(req)

    expect(res.status).toBe(200)
    expect(mockPrisma.attendance.findUnique).toHaveBeenCalledWith({
      where: { id: "att_1" },
      include: { session: true },
    })
    expect(mockPrisma.attendance.update).toHaveBeenCalledWith({
      where: { id: "att_1" },
      data: {
        status: "checked_out",
        checkedOutAt: serverCheckedOutAt,
      },
      include: { session: true },
    })

    const data = await res.json()
    expect(data.attendance).toEqual({
      id: "att_1",
      status: "checked_out",
      checkedInAt: "2026-03-30T18:00:00.000Z",
      checkedOutAt: "2026-03-30T18:45:00.000Z",
      courseSlug: "salsa-femenina-matutina",
      sessionTitle: "Salsa femenina matutina",
    })
  })

  it("returns 409 when attendance was already checked out", async () => {
    mockPrisma.attendance.findUnique.mockResolvedValue({
      id: "att_1",
      status: "checked_out",
      checkedInAt: new Date("2026-03-30T18:00:00.000Z"),
      checkedOutAt: new Date("2026-03-30T18:30:00.000Z"),
      session: {
        courseSlug: "salsa-femenina-matutina",
        title: "Salsa femenina matutina",
      },
    })

    const { PATCH } = await import("@/app/api/staff/checkin/route")
    const req = new Request("http://localhost/api/staff/checkin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-staff-token": "test-token" },
      body: JSON.stringify({ attendanceId: "att_1" }),
    })
    const res = await PATCH(req)

    expect(res.status).toBe(409)
    expect(mockPrisma.attendance.update).not.toHaveBeenCalled()
    await expect(res.json()).resolves.toEqual({ error: "Attendance already checked out" })
  })

  it("returns 400 when attendanceId is missing", async () => {
    const { PATCH } = await import("@/app/api/staff/checkin/route")
    const req = new Request("http://localhost/api/staff/checkin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-staff-token": "test-token" },
      body: JSON.stringify({}),
    })
    const res = await PATCH(req)

    expect(res.status).toBe(400)
    expect(mockPrisma.attendance.findUnique).not.toHaveBeenCalled()
    expect(mockPrisma.attendance.update).not.toHaveBeenCalled()
    await expect(res.json()).resolves.toEqual({ error: "Invalid attendanceId" })
  })

  it("returns 404 when attendance does not exist", async () => {
    mockPrisma.attendance.findUnique.mockResolvedValue(null)

    const { PATCH } = await import("@/app/api/staff/checkin/route")
    const req = new Request("http://localhost/api/staff/checkin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-staff-token": "test-token" },
      body: JSON.stringify({ attendanceId: "missing_attendance" }),
    })
    const res = await PATCH(req)

    expect(res.status).toBe(404)
    expect(mockPrisma.attendance.findUnique).toHaveBeenCalledWith({
      where: { id: "missing_attendance" },
      include: { session: true },
    })
    expect(mockPrisma.attendance.update).not.toHaveBeenCalled()
    await expect(res.json()).resolves.toEqual({ error: "Attendance not found" })
  })

  it("returns 401 for checkout without auth before any DB operation", async () => {
    const { PATCH } = await import("@/app/api/staff/checkin/route")
    const req = new Request("http://localhost/api/staff/checkin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendanceId: "att_1" }),
    })
    const res = await PATCH(req)

    expect(res.status).toBe(401)
    expect(mockPrisma.attendance.findUnique).not.toHaveBeenCalled()
    expect(mockPrisma.attendance.update).not.toHaveBeenCalled()
  })

  it("applies rate limiting to checkout requests", async () => {
    process.env.ENABLE_RATE_LIMIT_IN_TESTS = "1"

    const { PATCH } = await import("@/app/api/staff/checkin/route")
    const makeReq = () =>
      new Request("http://localhost/api/staff/checkin", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-staff-token": "test-token",
          "x-forwarded-for": "203.0.113.10",
        },
        body: JSON.stringify({ attendanceId: "att_1" }),
      })

    mockPrisma.attendance.findUnique.mockResolvedValue(null)

    let res: Response | undefined
    for (let index = 0; index < 121; index += 1) {
      res = await PATCH(makeReq())
    }

    expect(res?.status).toBe(429)
    expect(res?.headers.get("Retry-After")).toBeTruthy()
  })
})
