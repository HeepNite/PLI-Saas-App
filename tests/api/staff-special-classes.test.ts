import { beforeEach, describe, expect, it, vi } from "vitest"

const { definitionAuthorizer, rosterAuthorizer, mockWithStaffGuard, mockPrisma } = vi.hoisted(() => ({
  definitionAuthorizer: vi.fn(),
  rosterAuthorizer: vi.fn(),
  mockWithStaffGuard: vi.fn(),
  mockPrisma: {
    specialClass: { findMany: vi.fn(), findUnique: vi.fn() },
    specialClassAuditLog: { findUnique: vi.fn() },
    attendance: { findMany: vi.fn(), findUnique: vi.fn() },
    purchase: { count: vi.fn() },
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
import { PATCH } from "@/app/api/staff/special-classes/[id]/route"
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

  it("rejects a transition out of a terminal state", async () => {
    mockPrisma.specialClass.findUnique.mockResolvedValue({
      id: "class_1", status: "closed", title: "Closed", description: "Closed class", currency: "usd", priceCents: 2000,
      coverImageUrl: null, publishedAt: new Date(), cancelledAt: null, classSessionId: "session_1",
      classSession: { id: "session_1", startsAt: new Date(Date.now() + 60_000), capacity: 10, durationMinutes: 60, location: null },
    })
    const response = await PATCH(
      new Request("http://localhost/api/staff/special-classes/class_1", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "published" }) }),
      { params: Promise.resolve({ id: "class_1" }) },
    )
    expect(response.status).toBe(409)
    expect(mockPrisma.purchase.count).not.toHaveBeenCalled()
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

  it("audits the complete class definition and canonical session on creation", async () => {
    const startsAt = new Date(Date.now() + 86_400_000)
    const session = { id: "session_created", courseSlug: "special-created", title: "Created class", startsAt, durationMinutes: 75, capacity: 18, location: "Studio A" }
    const item = {
      id: "class_created", slug: "created-class", status: "draft", classSessionId: session.id, title: "Created class",
      description: "Complete definition", coverImageUrl: "https://example.com/cover.jpg", currency: "usd", priceCents: 3200,
      salesOpenAt: null, salesCloseAt: null, publishedAt: null, cancelledAt: null, createdBy: "staff_1", classSession: session,
    }
    const auditCreate = vi.fn()
    const tx = {
      classSession: { create: vi.fn().mockResolvedValue(session) },
      specialClass: { create: vi.fn().mockResolvedValue(item) },
      specialClassAuditLog: { create: auditCreate },
    }
    mockPrisma.$transaction.mockImplementation(async (callback: (transaction: typeof tx) => unknown) => callback(tx))

    const response = await POST(new Request("http://localhost/api/staff/special-classes", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-correlation-id": "create-attempt-1" },
      body: JSON.stringify({
        slug: item.slug, title: item.title, description: item.description, coverImageUrl: item.coverImageUrl,
        startsAt: startsAt.toISOString(), courseSlug: session.courseSlug, durationMinutes: session.durationMinutes,
        capacity: session.capacity, location: session.location, currency: item.currency, priceCents: item.priceCents,
      }),
    }))

    expect(response.status).toBe(201)
    expect(auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      specialClassId: item.id,
      classSessionId: session.id,
      afterState: {
        specialClass: {
          id: item.id, slug: item.slug, status: item.status, classSessionId: session.id, title: item.title,
          description: item.description, coverImageUrl: item.coverImageUrl, currency: item.currency, priceCents: item.priceCents,
          salesOpenAt: null, salesCloseAt: null, publishedAt: null, cancelledAt: null, createdBy: "staff_1",
        },
        classSession: {
          id: session.id, courseSlug: session.courseSlug, title: session.title, startsAt: startsAt.toISOString(),
          durationMinutes: session.durationMinutes, capacity: session.capacity, location: session.location,
        },
      },
    }) })
  })
})
