import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizePortal = vi.fn()

const mockPrisma = {
  room: {
    count: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  classSession: {
    findMany: vi.fn(),
  },
  roomReservation: {
    findMany: vi.fn(),
  },
  roomAuditLog: {
    create: vi.fn(),
  },
  courseCatalog: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(),
}

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeStaffPortalRequest: (...args: unknown[]) => mockAuthorizePortal(...args),
  authorizeOwnerOrAdminRequest: (...args: unknown[]) => mockAuthorizePortal(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

const ROOM_ID = "123e4567-e89b-42d3-a456-426614174000"
const NOW = new Date("2026-04-04T12:00:00.000Z")

const buildRoom = (overrides: Partial<{ id: string; name: string; capacity: number; location: string | null; active: boolean }> = {}) => ({
  id: overrides.id ?? ROOM_ID,
  name: overrides.name ?? "Studio A",
  capacity: overrides.capacity ?? 24,
  location: overrides.location ?? "Main floor",
  active: overrides.active ?? true,
  createdAt: NOW,
  updatedAt: NOW,
})

describe("staff rooms routes", () => {
  beforeEach(() => {
    mockAuthorizePortal.mockReset()
    mockAuthorizePortal.mockResolvedValue({ ok: true, userId: "staff_1", role: "admin" })

    mockPrisma.room.count.mockReset()
    mockPrisma.room.findMany.mockReset()
    mockPrisma.room.create.mockReset()
    mockPrisma.room.findUnique.mockReset()
    mockPrisma.room.update.mockReset()
    mockPrisma.room.delete.mockReset()
    mockPrisma.classSession.findMany.mockReset()
    mockPrisma.roomReservation.findMany.mockReset()
    mockPrisma.roomAuditLog.create.mockReset()
    mockPrisma.courseCatalog.findMany.mockReset()
    mockPrisma.courseCatalog.updateMany.mockReset()
    mockPrisma.$transaction.mockReset()

    mockPrisma.room.count.mockResolvedValue(0)
    mockPrisma.room.findMany.mockResolvedValue([])
    mockPrisma.classSession.findMany.mockResolvedValue([])
    mockPrisma.roomReservation.findMany.mockResolvedValue([])
    mockPrisma.courseCatalog.findMany.mockResolvedValue([])
    mockPrisma.courseCatalog.updateMany.mockResolvedValue({ count: 0 })
    mockPrisma.roomAuditLog.create.mockResolvedValue({ id: "audit_1" })
    mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(mockPrisma))
  })

  it("GET lists rooms with serialized pagination payload", async () => {
    mockPrisma.room.count.mockResolvedValue(1)
    mockPrisma.room.findMany.mockResolvedValue([buildRoom()])

    const { GET } = await import("@/app/api/staff/rooms/route")
    const res = await GET(new Request("http://localhost/api/staff/rooms?page=1&pageSize=10&q=studio&active=true"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(mockPrisma.room.count).toHaveBeenCalled()
    expect(data).toEqual({
      items: [
        {
          id: ROOM_ID,
          name: "Studio A",
          capacity: 24,
          location: "Main floor",
          active: true,
        },
      ],
      pagination: {
        page: 1,
        pageSize: 10,
        total: 1,
        totalPages: 1,
      },
      filters: {
        q: "studio",
        active: true,
      },
    })
  })

  it("GET falls back invalid filters and clamps page size", async () => {
    mockPrisma.room.count.mockResolvedValue(0)
    mockPrisma.room.findMany.mockResolvedValue([])

    const { GET } = await import("@/app/api/staff/rooms/route")
    const res = await GET(new Request("http://localhost/api/staff/rooms?page=0&pageSize=1000&active=maybe"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(mockPrisma.room.count).toHaveBeenCalledWith({ where: {} })
    expect(mockPrisma.room.findMany).toHaveBeenCalledWith({
      where: {},
      select: expect.any(Object),
      orderBy: [{ name: "asc" }],
      skip: 0,
      take: 100,
    })
    expect(data.pagination).toMatchObject({ page: 1, pageSize: 100, totalPages: 0 })
    expect(data.filters).toEqual({ q: null, active: null })
  })

  it("POST creates a room and returns the shared response shape", async () => {
    mockPrisma.room.create.mockResolvedValue(buildRoom({ name: "Studio B", capacity: 30, location: "Upstairs" }))

    const { POST } = await import("@/app/api/staff/rooms/route")
    const res = await POST(
      new Request("http://localhost/api/staff/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Studio B", capacity: 30, location: "Upstairs" }),
      })
    )
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(mockPrisma.room.create).toHaveBeenCalledWith({
      data: {
        name: "Studio B",
        capacity: 30,
        location: "Upstairs",
        active: true,
      },
      select: expect.any(Object),
    })
    expect(data).toMatchObject({
      ok: true,
      message: "Room created.",
      item: {
        name: "Studio B",
        capacity: 30,
        location: "Upstairs",
        active: true,
      },
    })
  })

  it("POST returns 503 when the generated Prisma client does not expose the room delegate", async () => {
    const originalRoomDelegate = mockPrisma.room
    ;(mockPrisma as { room?: typeof mockPrisma.room }).room = undefined
    vi.resetModules()

    const { POST } = await import("@/app/api/staff/rooms/route")
    const res = await POST(
      new Request("http://localhost/api/staff/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Studio B", capacity: 30, location: "Upstairs" }),
      })
    )

    await expect(res.json()).resolves.toEqual({
      error: "Database schema is out of sync. Run Prisma migrations (npx prisma migrate deploy).",
    })
    expect(res.status).toBe(503)

    ;(mockPrisma as { room?: typeof mockPrisma.room }).room = originalRoomDelegate
    vi.resetModules()
  })

  it("PUT updates room fields", async () => {
    mockPrisma.room.findUnique.mockResolvedValue(buildRoom())
    mockPrisma.room.update.mockResolvedValue(buildRoom({ name: "Studio A2", capacity: 28, location: "West wing" }))

    const { PUT } = await import("@/app/api/staff/rooms/[id]/route")
    const res = await PUT(
      new Request(`http://localhost/api/staff/rooms/${ROOM_ID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Studio A2", capacity: 28, location: "West wing", active: true }),
      }),
      { params: Promise.resolve({ id: ROOM_ID }) }
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(mockPrisma.room.update).toHaveBeenCalledWith({
      where: { id: ROOM_ID },
      data: {
        name: "Studio A2",
        capacity: 28,
        location: "West wing",
        active: true,
      },
      select: expect.any(Object),
    })
    expect(data.item).toMatchObject({ name: "Studio A2", capacity: 28, location: "West wing", active: true })
  })

  it("DELETE soft-disables an active room", async () => {
    mockPrisma.room.findUnique.mockResolvedValue(buildRoom())
    mockPrisma.room.update.mockResolvedValue(buildRoom({ active: false }))

    const { DELETE } = await import("@/app/api/staff/rooms/[id]/route")
    const res = await DELETE(new Request(`http://localhost/api/staff/rooms/${ROOM_ID}`, { method: "DELETE" }), {
      params: Promise.resolve({ id: ROOM_ID }),
    })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(mockPrisma.room.update).toHaveBeenCalledWith({
      where: { id: ROOM_ID },
      data: { active: false },
      select: expect.any(Object),
    })
    expect(data).toMatchObject({ ok: true, message: "Room disabled.", item: { active: false } })
  })

  it("DELETE rejects disabling a room that is still in use", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    mockPrisma.room.findUnique.mockResolvedValue(buildRoom())
    mockPrisma.classSession.findMany.mockResolvedValue([
      {
        id: "session_1",
        startsAt: new Date("2026-04-04T12:30:00.000Z"),
        durationMinutes: 90,
      },
    ])

    const { DELETE } = await import("@/app/api/staff/rooms/[id]/route")
    const res = await DELETE(new Request(`http://localhost/api/staff/rooms/${ROOM_ID}`, { method: "DELETE" }), {
      params: Promise.resolve({ id: ROOM_ID }),
    })

    expect(res.status).toBe(409)
    expect(mockPrisma.room.update).not.toHaveBeenCalled()
    const payload = await res.json()
    expect(payload.error).toContain("next 24 hours")
    expect(payload.blockers).toBeInstanceOf(Array)
    vi.useRealTimers()
  })

  it("POST safe-delete rejects when blockers exist", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    mockPrisma.room.findUnique.mockResolvedValue(buildRoom())
    mockPrisma.classSession.findMany.mockResolvedValue([{ id: "s1", startsAt: new Date("2026-04-05T13:00:00.000Z") }])

    const { POST } = await import("@/app/api/staff/rooms/[id]/safe-delete/route")
    const res = await POST(
      new Request(`http://localhost/api/staff/rooms/${ROOM_ID}/safe-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "cleanup" }),
      }),
      { params: Promise.resolve({ id: ROOM_ID }) }
    )

    expect(res.status).toBe(409)
    vi.useRealTimers()
  })

  it("POST safe-delete enforces owner/admin auth boundary", async () => {
    mockAuthorizePortal.mockResolvedValueOnce({ ok: false, status: 403, error: "Owner or Admin role required" })

    const { POST } = await import("@/app/api/staff/rooms/[id]/safe-delete/route")
    const res = await POST(
      new Request(`http://localhost/api/staff/rooms/${ROOM_ID}/safe-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "cleanup" }),
      }),
      { params: Promise.resolve({ id: ROOM_ID }) }
    )

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: "Owner or Admin role required" })
  })

  it("POST reassign is all-or-nothing when conflicts exist", async () => {
    mockPrisma.room.findUnique
      .mockResolvedValueOnce(buildRoom({ id: ROOM_ID, name: "Source" }))
      .mockResolvedValueOnce(buildRoom({ id: "123e4567-e89b-42d3-a456-426614174111", name: "Target" }))

    mockPrisma.classSession.findMany.mockResolvedValue([
      { id: "src1", roomId: ROOM_ID, startsAt: new Date("2099-04-05T12:00:00.000Z"), durationMinutes: 60 },
      { id: "tgt1", roomId: "123e4567-e89b-42d3-a456-426614174111", startsAt: new Date("2099-04-05T12:30:00.000Z"), durationMinutes: 60 },
    ])

    const { POST } = await import("@/app/api/staff/rooms/[id]/reassign/route")
    const res = await POST(
      new Request(`http://localhost/api/staff/rooms/${ROOM_ID}/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetRoomId: "123e4567-e89b-42d3-a456-426614174111",
          moveFutureSessions: true,
        }),
      }),
      { params: Promise.resolve({ id: ROOM_ID }) }
    )

    expect(res.status).toBe(409)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it("POST reassign moves only selected course defaults", async () => {
    const targetRoomId = "123e4567-e89b-42d3-a456-426614174111"
    const selectedCourseId = "course_1"
    mockPrisma.room.findUnique
      .mockResolvedValueOnce(buildRoom({ id: ROOM_ID, name: "Source" }))
      .mockResolvedValueOnce(buildRoom({ id: targetRoomId, name: "Target" }))
    mockPrisma.courseCatalog.findMany.mockResolvedValue([{ id: selectedCourseId, slug: "boxing", title: "Boxing" }])

    const { POST } = await import("@/app/api/staff/rooms/[id]/reassign/route")
    const res = await POST(
      new Request(`http://localhost/api/staff/rooms/${ROOM_ID}/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetRoomId,
          moveFutureSessions: false,
          courseIds: [selectedCourseId],
        }),
      }),
      { params: Promise.resolve({ id: ROOM_ID }) }
    )

    expect(res.status).toBe(200)
    expect(mockPrisma.courseCatalog.updateMany).toHaveBeenCalledWith({
      where: { defaultRoomId: ROOM_ID, id: { in: [selectedCourseId] } },
      data: { defaultRoomId: targetRoomId },
    })
  })

  it("POST reassign rejects invalid selected courses", async () => {
    const targetRoomId = "123e4567-e89b-42d3-a456-426614174111"
    mockPrisma.room.findUnique
      .mockResolvedValueOnce(buildRoom({ id: ROOM_ID, name: "Source" }))
      .mockResolvedValueOnce(buildRoom({ id: targetRoomId, name: "Target" }))
    mockPrisma.courseCatalog.findMany.mockResolvedValue([{ id: "course_1", slug: "boxing", title: "Boxing" }])

    const { POST } = await import("@/app/api/staff/rooms/[id]/reassign/route")
    const res = await POST(
      new Request(`http://localhost/api/staff/rooms/${ROOM_ID}/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetRoomId,
          moveFutureSessions: false,
          courseIds: ["course_1", "course_2"],
        }),
      }),
      { params: Promise.resolve({ id: ROOM_ID }) }
    )
    const data = await res.json()

    expect(res.status).toBe(409)
    expect(data.error).toContain("not assigned to the source room")
    expect(Array.isArray(data.blockers)).toBe(true)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it("POST reassign with selected courses only moves matching future sessions", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    const targetRoomId = "123e4567-e89b-42d3-a456-426614174111"
    const selectedCourseId = "course_1"
    mockPrisma.room.findUnique
      .mockResolvedValueOnce(buildRoom({ id: ROOM_ID, name: "Source" }))
      .mockResolvedValueOnce(buildRoom({ id: targetRoomId, name: "Target" }))
    mockPrisma.courseCatalog.findMany.mockResolvedValue([{ id: selectedCourseId, slug: "boxing", title: "Boxing" }])
    mockPrisma.classSession.findMany.mockResolvedValue([
      {
        id: "src-boxing",
        roomId: ROOM_ID,
        courseSlug: "boxing",
        startsAt: new Date("2099-04-05T12:00:00.000Z"),
        durationMinutes: 60,
      },
      {
        id: "src-yoga",
        roomId: ROOM_ID,
        courseSlug: "yoga",
        startsAt: new Date("2099-04-05T14:00:00.000Z"),
        durationMinutes: 60,
      },
    ])

    const updateManyMock = vi
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 })
    const tx = {
      ...mockPrisma,
      courseCatalog: { ...mockPrisma.courseCatalog, updateMany: updateManyMock },
      classSession: { ...mockPrisma.classSession, updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      roomAuditLog: { ...mockPrisma.roomAuditLog, create: vi.fn().mockResolvedValue({ id: "audit_1" }) },
    }
    mockPrisma.$transaction.mockImplementationOnce(async (cb: (trx: typeof tx) => Promise<unknown>) => cb(tx))

    const { POST } = await import("@/app/api/staff/rooms/[id]/reassign/route")
    const res = await POST(
      new Request(`http://localhost/api/staff/rooms/${ROOM_ID}/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetRoomId,
          moveFutureSessions: true,
          courseIds: [selectedCourseId],
        }),
      }),
      { params: Promise.resolve({ id: ROOM_ID }) }
    )

    expect(res.status).toBe(200)
    expect(tx.classSession.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["src-boxing"] } },
      data: { roomId: targetRoomId },
    })
    vi.useRealTimers()
  })
})
