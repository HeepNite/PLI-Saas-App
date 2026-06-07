import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizeOwnerOrAdmin = vi.fn()
const mockWriteAudit = vi.fn()

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
  classSession: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  attendance: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  packagePurchase: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  packageUsageLedger: {
    findFirst: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  $transaction: vi.fn(),
}

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeOwnerOrAdminRequest: (...args: unknown[]) => mockAuthorizeOwnerOrAdmin(...args),
}))

vi.mock("@/lib/audit/student-data-audit", () => ({
  writeStudentDataAudit: (...args: unknown[]) => mockWriteAudit(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

const USER_ID = "user_student_1"
const SESSION_ID = "session_1"
const SESSION_ID_2 = "session_2"
const SESSION_ID_3 = "session_3"
const ATTENDANCE_ID = "attendance_1"

const buildTransactionMock = (result: unknown) => {
  mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => {
    return fn(mockPrisma)
  })
  return result
}

describe("PATCH /api/staff/students/[userId]/attendance", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuthorizeOwnerOrAdmin.mockReset()
    mockAuthorizeOwnerOrAdmin.mockResolvedValue({ ok: true, userId: "user_owner_1", role: "owner", category: null })
    mockWriteAudit.mockReset()
    mockWriteAudit.mockResolvedValue(undefined)

    mockPrisma.user.findUnique.mockReset()
    mockPrisma.classSession.findUnique.mockReset()
    mockPrisma.classSession.findMany.mockReset()
    mockPrisma.attendance.findUnique.mockReset()
    mockPrisma.attendance.create.mockReset()
    mockPrisma.attendance.update.mockReset()
    mockPrisma.attendance.delete.mockReset()
    mockPrisma.packagePurchase.findFirst.mockReset()
    mockPrisma.packagePurchase.update.mockReset()
    mockPrisma.packageUsageLedger.findFirst.mockReset()
    mockPrisma.packageUsageLedger.create.mockReset()
    mockPrisma.packageUsageLedger.delete.mockReset()
    mockPrisma.$transaction.mockReset()

    mockPrisma.user.findUnique.mockResolvedValue({ id: USER_ID, name: "Test Student" })
    mockPrisma.classSession.findUnique.mockResolvedValue({ id: SESSION_ID })
    // Default: findMany returns the requested sessions
    mockPrisma.classSession.findMany.mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) => {
      return (where?.id?.in ?? []).map((id: string) => ({ id, title: `Session ${id}`, courseSlug: "test-course" }))
    })
  })

  it("returns 403 when authorization fails", async () => {
    mockAuthorizeOwnerOrAdmin.mockResolvedValue({ ok: false, status: 403, error: "Insufficient role" })

    const { PATCH } = await import("@/app/api/staff/students/[userId]/attendance/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/attendance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", status: "checked_in", sessionId: SESSION_ID, reason: "Test" }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(403)
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuthorizeOwnerOrAdmin.mockResolvedValue({ ok: false, status: 401, error: "Unauthorized" })

    const { PATCH } = await import("@/app/api/staff/students/[userId]/attendance/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/attendance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", status: "checked_in", sessionId: SESSION_ID, reason: "Test" }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(401)
  })

  it("returns 400 when action is invalid", async () => {
    const { PATCH } = await import("@/app/api/staff/students/[userId]/attendance/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/attendance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "invalid", sessionId: SESSION_ID, reason: "Test" }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "Invalid action. Must be 'add', 'remove', or 'update'." })
  })

  it("returns 400 when reason is missing", async () => {
    const { PATCH } = await import("@/app/api/staff/students/[userId]/attendance/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/attendance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", status: "checked_in", sessionId: SESSION_ID }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "Reason is required (max 500 characters)." })
  })

  it("returns 400 when both sessionId and sessionIds are missing", async () => {
    const { PATCH } = await import("@/app/api/staff/students/[userId]/attendance/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/attendance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", status: "checked_in", reason: "Test" }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "sessionId or sessionIds is required." })
  })

  it("returns 400 when sessionIds array is empty", async () => {
    const { PATCH } = await import("@/app/api/staff/students/[userId]/attendance/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/attendance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", status: "checked_in", sessionIds: [], reason: "Test" }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "sessionId or sessionIds is required." })
  })

  // ─── Legacy sessionId (backward compatibility) ───

  it("add: creates attendance record and writes audit (legacy sessionId)", async () => {
    mockPrisma.attendance.findUnique.mockResolvedValue(null)
    mockPrisma.attendance.create.mockResolvedValue({ id: ATTENDANCE_ID, status: "checked_in" })
    mockPrisma.packagePurchase.findFirst.mockResolvedValue(null)

    buildTransactionMock({ ok: true, data: { action: "add", processed: 1, results: [{ sessionId: SESSION_ID, ok: true }] } })

    const { PATCH } = await import("@/app/api/staff/students/[userId]/attendance/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/attendance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          status: "checked_in",
          sessionId: SESSION_ID,
          reason: "Student arrived late",
        }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(mockPrisma.attendance.create).toHaveBeenCalled()
  })

  it("add: returns 409 when attendance already exists (legacy sessionId)", async () => {
    mockPrisma.attendance.findUnique.mockResolvedValue({ id: ATTENDANCE_ID, status: "checked_in" })

    buildTransactionMock({ error: "Attendance already exists for session session_1.", status: 409 })

    const { PATCH } = await import("@/app/api/staff/students/[userId]/attendance/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/attendance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          status: "checked_in",
          sessionId: SESSION_ID,
          reason: "Test",
        }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toEqual({ error: "Attendance already exists for session session_1." })
  })

  it("remove: deletes attendance and writes audit (legacy sessionId)", async () => {
    mockPrisma.attendance.findUnique.mockResolvedValue({ id: ATTENDANCE_ID, status: "checked_in" })
    mockPrisma.packageUsageLedger.findFirst.mockResolvedValue(null)

    buildTransactionMock({ ok: true, data: { action: "remove", processed: 1, results: [{ sessionId: SESSION_ID, ok: true }] } })

    const { PATCH } = await import("@/app/api/staff/students/[userId]/attendance/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/attendance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove",
          sessionId: SESSION_ID,
          reason: "Erroneous check-in",
        }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(mockPrisma.attendance.delete).toHaveBeenCalled()
  })

  it("remove: returns 404 when attendance not found (legacy sessionId)", async () => {
    mockPrisma.attendance.findUnique.mockResolvedValue(null)

    buildTransactionMock({ error: "Attendance not found for session session_1.", status: 404 })

    const { PATCH } = await import("@/app/api/staff/students/[userId]/attendance/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/attendance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove",
          sessionId: SESSION_ID,
          reason: "Test",
        }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(404)
  })

  it("update: changes status with optimistic concurrency (legacy sessionId)", async () => {
    mockPrisma.attendance.findUnique.mockResolvedValue({ id: ATTENDANCE_ID, status: "scheduled" })
    mockPrisma.attendance.update.mockResolvedValue({ id: ATTENDANCE_ID, status: "no_show" })
    mockPrisma.packageUsageLedger.findFirst.mockResolvedValue(null)

    buildTransactionMock({ ok: true, data: { action: "update", processed: 1, results: [{ sessionId: SESSION_ID, ok: true }] } })

    const { PATCH } = await import("@/app/api/staff/students/[userId]/attendance/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/attendance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          status: "no_show",
          sessionId: SESSION_ID,
          valueBefore: "scheduled",
          reason: "Student left early",
        }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(200)
    expect(mockPrisma.attendance.update).toHaveBeenCalled()
  })

  it("update: returns 409 on concurrent modification (legacy sessionId)", async () => {
    mockPrisma.attendance.findUnique.mockResolvedValue({ id: ATTENDANCE_ID, status: "checked_in" })

    buildTransactionMock({ error: "Concurrent modification detected. The record has changed since you last viewed it.", status: 409 })

    const { PATCH } = await import("@/app/api/staff/students/[userId]/attendance/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/attendance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          status: "no_show",
          sessionId: SESSION_ID,
          valueBefore: "scheduled",
          reason: "Test",
        }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(409)
  })

  it("returns 404 when student not found", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)

    buildTransactionMock({ error: "Student not found", status: 404 })

    const { PATCH } = await import("@/app/api/staff/students/[userId]/attendance/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/attendance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          status: "checked_in",
          sessionId: SESSION_ID,
          reason: "Test",
        }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(404)
  })

  it("returns 404 when session not found", async () => {
    mockPrisma.classSession.findMany.mockResolvedValue([])

    buildTransactionMock({ error: "Session(s) not found: session_1", status: 404 })

    const { PATCH } = await import("@/app/api/staff/students/[userId]/attendance/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/attendance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          status: "checked_in",
          sessionId: SESSION_ID,
          reason: "Test",
        }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(404)
  })

  // ─── New multi-session (sessionIds array) ───

  it("add: accepts sessionIds array and creates multiple records", async () => {
    mockPrisma.attendance.findUnique.mockResolvedValue(null)
    mockPrisma.attendance.create.mockResolvedValue({ id: ATTENDANCE_ID, status: "checked_in" })
    mockPrisma.packagePurchase.findFirst.mockResolvedValue(null)

    buildTransactionMock({
      ok: true,
      data: {
        action: "add",
        processed: 3,
        results: [
          { sessionId: SESSION_ID, ok: true },
          { sessionId: SESSION_ID_2, ok: true },
          { sessionId: SESSION_ID_3, ok: true },
        ],
      },
    })

    const { PATCH } = await import("@/app/api/staff/students/[userId]/attendance/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/attendance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          status: "checked_in",
          sessionIds: [SESSION_ID, SESSION_ID_2, SESSION_ID_3],
          reason: "Bulk check-in for three sessions",
        }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.data.processed).toBe(3)
    expect(data.data.results).toHaveLength(3)
  })

  it("add: returns 400 when too many sessionIds (>20)", async () => {
    const manyIds = Array.from({ length: 21 }, (_, i) => `session_${i}`)

    const { PATCH } = await import("@/app/api/staff/students/[userId]/attendance/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/attendance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          status: "checked_in",
          sessionIds: manyIds,
          reason: "Too many",
        }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "Too many sessions. Maximum is 20." })
  })

  it("add: deduplicates sessionIds", async () => {
    mockPrisma.attendance.findUnique.mockResolvedValue(null)
    mockPrisma.attendance.create.mockResolvedValue({ id: ATTENDANCE_ID, status: "checked_in" })
    mockPrisma.packagePurchase.findFirst.mockResolvedValue(null)

    buildTransactionMock({
      ok: true,
      data: {
        action: "add",
        processed: 1,
        results: [{ sessionId: SESSION_ID, ok: true }],
      },
    })

    const { PATCH } = await import("@/app/api/staff/students/[userId]/attendance/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/attendance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          status: "checked_in",
          sessionIds: [SESSION_ID, SESSION_ID, SESSION_ID],
          reason: "Duplicate IDs should be deduplicated",
        }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.data.processed).toBe(1)
  })

  it("add: all-or-nothing — fails if any session has existing attendance", async () => {
    // Simulate: first session ok, second already exists
    let callCount = 0
    mockPrisma.attendance.findUnique.mockImplementation(async () => {
      callCount++
      return callCount === 2 ? { id: ATTENDANCE_ID, status: "checked_in" } : null
    })
    mockPrisma.attendance.create.mockResolvedValue({ id: ATTENDANCE_ID, status: "checked_in" })
    mockPrisma.packagePurchase.findFirst.mockResolvedValue(null)

    buildTransactionMock({ error: "Attendance already exists for session session_2.", status: 409 })

    const { PATCH } = await import("@/app/api/staff/students/[userId]/attendance/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/attendance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          status: "checked_in",
          sessionIds: [SESSION_ID, SESSION_ID_2],
          reason: "Should fail on second session",
        }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toEqual({ error: "Attendance already exists for session session_2." })
  })

  it("remove: accepts sessionIds array", async () => {
    mockPrisma.attendance.findUnique.mockResolvedValue({ id: ATTENDANCE_ID, status: "checked_in" })
    mockPrisma.packageUsageLedger.findFirst.mockResolvedValue(null)

    buildTransactionMock({
      ok: true,
      data: {
        action: "remove",
        processed: 2,
        results: [
          { sessionId: SESSION_ID, ok: true },
          { sessionId: SESSION_ID_2, ok: true },
        ],
      },
    })

    const { PATCH } = await import("@/app/api/staff/students/[userId]/attendance/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/attendance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove",
          sessionIds: [SESSION_ID, SESSION_ID_2],
          reason: "Bulk remove",
        }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.data.processed).toBe(2)
  })

  it("update: accepts sessionIds array", async () => {
    mockPrisma.attendance.findUnique.mockResolvedValue({ id: ATTENDANCE_ID, status: "scheduled" })
    mockPrisma.attendance.update.mockResolvedValue({ id: ATTENDANCE_ID, status: "no_show" })
    mockPrisma.packageUsageLedger.findFirst.mockResolvedValue(null)

    buildTransactionMock({
      ok: true,
      data: {
        action: "update",
        processed: 2,
        results: [
          { sessionId: SESSION_ID, ok: true },
          { sessionId: SESSION_ID_2, ok: true },
        ],
      },
    })

    const { PATCH } = await import("@/app/api/staff/students/[userId]/attendance/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/attendance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          status: "no_show",
          sessionIds: [SESSION_ID, SESSION_ID_2],
          reason: "Bulk update status",
        }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.data.processed).toBe(2)
  })

  it("returns 404 when some sessions not found in sessionIds", async () => {
    mockPrisma.classSession.findMany.mockResolvedValue([{ id: SESSION_ID, title: "Session 1", courseSlug: "test" }])

    buildTransactionMock({ error: "Session(s) not found: session_99", status: 404 })

    const { PATCH } = await import("@/app/api/staff/students/[userId]/attendance/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/attendance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          status: "checked_in",
          sessionIds: [SESSION_ID, "session_99"],
          reason: "One session missing",
        }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(404)
  })
})
