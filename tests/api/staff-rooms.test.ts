import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizePortal = vi.fn()

const mockPrisma = {
  room: {
    count: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  classSession: {
    findMany: vi.fn(),
  },
}

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeStaffPortalRequest: (...args: unknown[]) => mockAuthorizePortal(...args),
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
    mockPrisma.classSession.findMany.mockReset()

    mockPrisma.room.count.mockResolvedValue(0)
    mockPrisma.room.findMany.mockResolvedValue([])
    mockPrisma.classSession.findMany.mockResolvedValue([])
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
        startsAt: new Date("2026-04-04T11:30:00.000Z"),
        durationMinutes: 90,
      },
    ])

    const { DELETE } = await import("@/app/api/staff/rooms/[id]/route")
    const res = await DELETE(new Request(`http://localhost/api/staff/rooms/${ROOM_ID}`, { method: "DELETE" }), {
      params: Promise.resolve({ id: ROOM_ID }),
    })

    expect(res.status).toBe(422)
    expect(mockPrisma.room.update).not.toHaveBeenCalled()
    await expect(res.json()).resolves.toEqual({ error: "Cannot deactivate a room with active or future sessions." })
    vi.useRealTimers()
  })
})
