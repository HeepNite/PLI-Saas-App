import { beforeEach, describe, expect, it, vi } from "vitest"

const { definitionAuthorizer, rosterAuthorizer, mockWithStaffGuard, mockPrisma } = vi.hoisted(() => ({
  definitionAuthorizer: vi.fn(),
  rosterAuthorizer: vi.fn(),
  mockWithStaffGuard: vi.fn(),
  mockPrisma: {
    specialClass: { findMany: vi.fn(), findUnique: vi.fn() },
    specialClassAuditLog: { findUnique: vi.fn() },
    attendance: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    purchase: { count: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))
vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeSpecialClassDefinitionRequest: definitionAuthorizer,
  authorizeSpecialClassRosterRequest: rosterAuthorizer,
}))
vi.mock("@/lib/security/with-staff-guard", () => ({ withStaffGuard: (...args: unknown[]) => mockWithStaffGuard(...args) }))

import { GET, POST } from "@/app/api/staff/special-classes/route"
import { GET as GET_DETAIL, PATCH } from "@/app/api/staff/special-classes/[id]/route"
import { POST as POST_ROSTER_ACTION } from "@/app/api/staff/special-classes/[id]/roster/[attendanceId]/actions/route"

const denied = { ok: false as const, response: new Response(JSON.stringify({ error: "Insufficient role" }), { status: 403 }) }
const authorized = { ok: true as const, auth: { userId: "staff_1", role: "owner", category: "manager", subCategory: null, staffName: "Owner" } }

describe("staff special classes API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWithStaffGuard.mockResolvedValue(authorized)
  })

  it("server-enforces roster denial before reading operational data", async () => {
    mockWithStaffGuard.mockResolvedValueOnce(denied)
    const response = await GET(new Request("http://localhost/api/staff/special-classes"))
    expect(response.status).toBe(403)
    expect(mockPrisma.specialClass.findMany).not.toHaveBeenCalled()
    expect(mockWithStaffGuard.mock.calls[0][1].authorize).toBe(rosterAuthorizer)
  })

  it("server-enforces definition denial before creating data", async () => {
    mockWithStaffGuard.mockResolvedValueOnce(denied)
    const response = await POST(new Request("http://localhost/api/staff/special-classes", { method: "POST", body: "{}" }))
    expect(response.status).toBe(403)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    expect(mockWithStaffGuard.mock.calls[0][1].authorize).toBe(definitionAuthorizer)
  })

  it("deprecates direct definition creation after authorization", async () => {
    const response = await POST(new Request("http://localhost/api/staff/special-classes", { method: "POST", body: "{}" }))
    expect(response.status).toBe(405)
    await expect(response.json()).resolves.toEqual({ error: "Create Special Classes in Course Studio." })
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it("exposes linked Course Studio identity and audit history in operational detail", async () => {
    mockPrisma.purchase.updateMany.mockResolvedValue({ count: 0 })
    mockPrisma.specialClass.findUnique.mockResolvedValue({
      id: "class_1", classSessionId: "session_1", classSession: { capacity: 12 },
      authoringSlot: { courseCatalog: { id: "course_1", title: "Source course" } },
      auditLogs: [{ id: "audit_1", action: "class_published", actorRole: "owner", createdAt: new Date("2030-05-01T12:00:00.000Z") }],
    })
    mockPrisma.purchase.count.mockResolvedValue(0)
    mockPrisma.attendance.count.mockResolvedValue(0)
    mockPrisma.purchase.findMany.mockResolvedValue([])

    const response = await GET_DETAIL(
      new Request("http://localhost/api/staff/special-classes/class_1"),
      { params: Promise.resolve({ id: "class_1" }) },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ item: {
      authoringCourse: { id: "course_1", title: "Source course" },
      auditLogs: [{ id: "audit_1", action: "class_published", actorRole: "owner" }],
    } })
  })

  it("rejects shared definition fields before entering the operational transaction", async () => {
    mockPrisma.specialClass.findUnique.mockResolvedValue({
      id: "class_1", status: "published", title: "Current", description: "Current", currency: "usd", priceCents: 2000,
      coverImageUrl: null, authoringSlotId: "slot_1", classSessionId: "session_1",
      classSession: { id: "session_1", startsAt: new Date(Date.now() + 60_000), capacity: 10, durationMinutes: 60, location: null },
    })
    const response = await PATCH(
      new Request("http://localhost/api/staff/special-classes/class_1", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "Bypass" }) }),
      { params: Promise.resolve({ id: "class_1" }) },
    )
    expect(response.status).toBe(422)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it("rejects initial publication of linked drafts outside Course Studio", async () => {
    mockPrisma.specialClass.findUnique.mockResolvedValue({
      id: "class_1", status: "draft", title: "Current", description: "Current", currency: "usd", priceCents: 2000,
      coverImageUrl: null, authoringSlotId: "slot_1", classSessionId: "session_1",
      classSession: { id: "session_1", startsAt: new Date(Date.now() + 60_000), capacity: 10, durationMinutes: 60, location: null },
    })
    const response = await PATCH(
      new Request("http://localhost/api/staff/special-classes/class_1", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "published" }) }),
      { params: Promise.resolve({ id: "class_1" }) },
    )
    expect(response.status).toBe(409)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it("retains locked operational price and capacity adjustments", async () => {
    const current = {
      id: "class_1", status: "published", title: "Current", description: "Current", currency: "usd", priceCents: 2000,
      coverImageUrl: null, authoringSlotId: "slot_1", classSessionId: "session_1", publishedAt: new Date(), cancelledAt: null,
      classSession: { id: "session_1", startsAt: new Date(Date.now() + 60_000), capacity: 10, durationMinutes: 60, location: null },
    }
    const tx = {
      $queryRaw: vi.fn(),
      specialClassAuditLog: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
      specialClass: {
        findUnique: vi.fn().mockResolvedValueOnce({ classSessionId: "session_1" }).mockResolvedValueOnce(current),
        update: vi.fn().mockResolvedValue({ ...current, priceCents: 2500, classSession: { ...current.classSession, capacity: 14 } }),
      },
      classSession: { update: vi.fn() },
      purchase: { updateMany: vi.fn(), count: vi.fn().mockResolvedValue(3) },
    }
    mockPrisma.specialClass.findUnique.mockResolvedValue(current)
    mockPrisma.$transaction.mockImplementation(async (callback: (transaction: typeof tx) => unknown) => callback(tx))

    const response = await PATCH(
      new Request("http://localhost/api/staff/special-classes/class_1", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ priceCents: 2500, capacity: 14 }) }),
      { params: Promise.resolve({ id: "class_1" }) },
    )

    expect(response.status).toBe(200)
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2)
    expect(tx.classSession.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ capacity: 14 }) }))
    expect(tx.specialClass.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ priceCents: 2500 }) }))
  })

  it("rejects operational adjustments in a terminal state", async () => {
    mockPrisma.specialClass.findUnique.mockResolvedValue({
      id: "class_1", status: "closed", title: "Closed", description: "Closed class", currency: "usd", priceCents: 2000,
      coverImageUrl: null, publishedAt: new Date(), cancelledAt: null, classSessionId: "session_1",
      classSession: { id: "session_1", startsAt: new Date(Date.now() + 60_000), capacity: 10, durationMinutes: 60, location: null },
    })
    const response = await PATCH(
      new Request("http://localhost/api/staff/special-classes/class_1", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ capacity: 11 }) }),
      { params: Promise.resolve({ id: "class_1" }) },
    )
    expect(response.status).toBe(409)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it("rejects check-in for a cancelled special class before mutating attendance", async () => {
    const attendance = { id: "attendance_1", userId: "user_1", sessionId: "session_1", status: "scheduled", checkedInAt: new Date() }
    const tx = {
      $queryRaw: vi.fn(),
      specialClass: { findUnique: vi.fn().mockResolvedValueOnce({ classSessionId: "session_1" }).mockResolvedValueOnce({ id: "class_1", status: "cancelled", classSessionId: "session_1", classSession: { id: "session_1" } }) },
      specialClassAuditLog: { findUnique: vi.fn().mockResolvedValue(null) },
      attendance: { findUnique: vi.fn().mockResolvedValue(attendance), update: vi.fn() },
      purchase: { findMany: vi.fn(), updateMany: vi.fn() },
    }
    mockPrisma.$transaction.mockImplementation(async (callback: (transaction: typeof tx) => unknown) => callback(tx))
    const response = await POST_ROSTER_ACTION(
      new Request("http://localhost/api/staff/special-classes/class_1/roster/attendance_1/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "check_in", idempotencyKey: "client_attempt_1" }) }),
      { params: Promise.resolve({ id: "class_1", attendanceId: "attendance_1" }) },
    )
    expect(response.status).toBe(409)
    expect(tx.attendance.update).not.toHaveBeenCalled()
    expect(tx.$queryRaw).toHaveBeenCalledTimes(3)
  })

  it("uses a server-owned audit correlation ID and snapshots every cancelled record", async () => {
    const checkedInAt = new Date("2026-08-27T12:00:00.000Z")
    const attendance = { id: "attendance_1", userId: "user_1", sessionId: "session_1", status: "scheduled", checkedInAt }
    const auditCreate = vi.fn()
    const attendanceUpdate = vi.fn()
    const purchaseUpdateMany = vi.fn()
    const tx = {
      $queryRaw: vi.fn(),
      specialClass: { findUnique: vi.fn().mockResolvedValueOnce({ classSessionId: "session_1" }).mockResolvedValueOnce({ id: "class_1", status: "published", classSessionId: "session_1", classSession: { id: "session_1" } }) },
      specialClassAuditLog: { findUnique: vi.fn().mockResolvedValue(null), create: auditCreate },
      attendance: { findUnique: vi.fn().mockResolvedValue(attendance), update: attendanceUpdate },
      purchase: {
        findMany: vi.fn().mockResolvedValue([{ id: "purchase_1", status: "paid" }, { id: "purchase_2", status: "completed" }]),
        updateMany: purchaseUpdateMany,
      },
    }
    mockPrisma.$transaction.mockImplementation(async (callback: (transaction: typeof tx) => unknown) => callback(tx))

    const response = await POST_ROSTER_ACTION(
      new Request("http://localhost/api/staff/special-classes/class_1/roster/attendance_1/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel", reason: "Customer request", idempotencyKey: "client_attempt_1" }) }),
      { params: Promise.resolve({ id: "class_1", attendanceId: "attendance_1" }) },
    )

    expect(response.status).toBe(200)
    expect(purchaseUpdateMany).toHaveBeenCalledWith({ where: { id: { in: ["purchase_1", "purchase_2"] } }, data: { status: "cancelled" } })
    const audit = auditCreate.mock.calls[0][0].data
    expect(audit.idempotencyKey).toBe("client_attempt_1")
    expect(audit.correlationId).not.toBe("client_attempt_1")
    expect(audit.beforeState.purchases).toEqual([{ id: "purchase_1", status: "paid" }, { id: "purchase_2", status: "completed" }])
    expect(audit.afterState.purchases).toEqual([{ id: "purchase_1", status: "cancelled" }, { id: "purchase_2", status: "cancelled" }])
  })

})
