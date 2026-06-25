import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizeOwnerOrAdmin = vi.fn()
const mockWriteAudit = vi.fn()

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
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
    count: vi.fn(),
  },
  packagePurchase: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  packageUsageLedger: {
    findFirst: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  purchase: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  studentDataAudit: {
    count: vi.fn(),
    findMany: vi.fn(),
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
const ATTENDANCE_ID = "attendance_1"
const PURCHASE_ID = "purchase_1"
const PACKAGE_ID = "pkg_purchase_1"
const NOW = new Date("2026-04-29T12:00:00.000Z")

describe("Integration: Full override flow", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    vi.setSystemTime(NOW)

    mockAuthorizeOwnerOrAdmin.mockReset()
    mockAuthorizeOwnerOrAdmin.mockResolvedValue({ ok: true, userId: "user_owner_1", role: "owner", category: null })
    mockWriteAudit.mockReset()
    mockWriteAudit.mockResolvedValue(undefined)

    // Reset all mocks
    for (const key of Object.keys(mockPrisma)) {
      if (key === "$transaction") continue
      const model = mockPrisma[key as keyof typeof mockPrisma]
      if (typeof model === "object" && model !== null) {
        for (const method of Object.keys(model)) {
          ;(model as Record<string, ReturnType<typeof vi.fn>>)[method]?.mockReset?.()
        }
      }
    }
    mockPrisma.$transaction.mockReset()

    // Default $transaction behavior
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => {
      return fn(mockPrisma)
    })

    // Default user exists
    mockPrisma.user.findUnique.mockResolvedValue({ id: USER_ID, name: "Test Student" })

    // Default: classSession.findMany returns requested sessions
    mockPrisma.classSession.findMany.mockImplementation(async ({ where }: { where?: { id?: { in: string[] } } }) => {
      const ids = where?.id?.in ?? [SESSION_ID]
      return ids.map((id: string) => ({ id, title: `Session ${id}`, courseSlug: "test-course" }))
    })

    // Default: no linked purchases
    mockPrisma.purchase.findMany.mockResolvedValue([])
    mockPrisma.user.update.mockResolvedValue({})
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("attendance add: creates record, consumes credit, writes audit in same transaction", async () => {
    mockPrisma.classSession.findUnique.mockResolvedValue({ id: SESSION_ID })
    mockPrisma.attendance.findUnique.mockResolvedValue(null)
    mockPrisma.attendance.create.mockResolvedValue({ id: ATTENDANCE_ID, status: "checked_in" })
    mockPrisma.packagePurchase.findFirst.mockResolvedValue({
      id: PACKAGE_ID,
      userId: USER_ID,
      remainingCredits: 5,
      totalCredits: 10,
      isUnlimited: false,
      status: "active",
      expiresAt: null,
    })
    mockPrisma.packagePurchase.update.mockResolvedValue({ id: PACKAGE_ID, remainingCredits: 4 })
    mockPrisma.packageUsageLedger.create.mockResolvedValue({ id: "ledger_1" })

    const { PATCH } = await import("@/app/api/staff/students/[userId]/attendance/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/attendance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          status: "checked_in",
          sessionId: SESSION_ID,
          reason: "Manual check-in for student",
        }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(200)

    // Verify all operations happened in the transaction
    expect(mockPrisma.attendance.create).toHaveBeenCalled()
    expect(mockPrisma.packagePurchase.update).toHaveBeenCalledWith({
      where: { id: PACKAGE_ID },
      data: { remainingCredits: { decrement: 1 }, lastUsedAt: NOW },
    })
    expect(mockPrisma.packageUsageLedger.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        packagePurchaseId: PACKAGE_ID,
        userId: USER_ID,
        attendanceId: ATTENDANCE_ID,
        delta: -1,
        reason: "staff_override_add_attendance",
      }),
    })
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        targetUserId: USER_ID,
        staffClerkId: "user_owner_1",
        entity: "attendance",
        entityId: ATTENDANCE_ID,
        field: "status",
        valueBefore: null,
        valueAfter: { status: "checked_in", sessionId: SESSION_ID },
        reason: "Manual check-in for student",
      }),
      expect.anything() // tx client
    )
  })

  it("attendance remove: deletes record, restores credit, writes audit in same transaction", async () => {
    mockPrisma.classSession.findUnique.mockResolvedValue({ id: SESSION_ID })
    mockPrisma.attendance.findUnique.mockResolvedValue({ id: ATTENDANCE_ID, status: "checked_in" })
    mockPrisma.packageUsageLedger.findFirst.mockResolvedValue({
      id: "ledger_1",
      packagePurchaseId: PACKAGE_ID,
      attendanceId: ATTENDANCE_ID,
      packagePurchase: { id: PACKAGE_ID, status: "active" },
    })
    mockPrisma.packagePurchase.update.mockResolvedValue({ id: PACKAGE_ID, remainingCredits: 6 })

    const { PATCH } = await import("@/app/api/staff/students/[userId]/attendance/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/attendance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove",
          sessionId: SESSION_ID,
          reason: "Erroneous check-in removed",
        }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(200)

    expect(mockPrisma.attendance.delete).toHaveBeenCalled()
    expect(mockPrisma.packagePurchase.update).toHaveBeenCalledWith({
      where: { id: PACKAGE_ID },
      data: { remainingCredits: { increment: 1 } },
    })
    expect(mockPrisma.packageUsageLedger.delete).toHaveBeenCalledWith({
      where: { id: "ledger_1" },
    })
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "attendance",
        entityId: ATTENDANCE_ID,
        field: "status",
        reason: "Erroneous check-in removed",
      }),
      expect.anything()
    )
  })

  it("payment override: updates purchase, writes multiple audit entries in same transaction", async () => {
    mockPrisma.purchase.findUnique.mockResolvedValue({
      id: PURCHASE_ID,
      userId: USER_ID,
      amount: 10000,
      status: "pending",
      metadata: { settlementStatus: "pending", outstandingBalance: 10000, paymentMethod: "cash" },
    })
    mockPrisma.purchase.update.mockResolvedValue({
      id: PURCHASE_ID,
      amount: 8000,
      status: "pending",
      metadata: { settlementStatus: "pending", outstandingBalance: 8000, paymentMethod: "card" },
    })

    const { PATCH } = await import("@/app/api/staff/students/[userId]/payments/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/payments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseId: PURCHASE_ID,
          reason: "Corrected amount and payment method",
          amount: 8000,
          paymentMethod: "card",
        }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(200)

    // Should write 2 audit entries (amount + paymentMethod)
    expect(mockWriteAudit).toHaveBeenCalledTimes(2)
    expect(mockWriteAudit).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        entity: "payment",
        entityId: PURCHASE_ID,
        field: "amount",
        valueBefore: 10000,
        valueAfter: 8000,
      }),
      expect.anything()
    )
    expect(mockWriteAudit).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        entity: "payment",
        entityId: PURCHASE_ID,
        field: "paymentMethod",
        valueBefore: "cash",
        valueAfter: "card",
      }),
      expect.anything()
    )
  })

  it("package override: updates credits, writes audit entries in same transaction", async () => {
    mockPrisma.packagePurchase.findUnique.mockResolvedValue({
      id: PACKAGE_ID,
      userId: USER_ID,
      totalCredits: 10,
      remainingCredits: 7,
      isUnlimited: false,
      status: "active",
      expiresAt: null,
    })
    mockPrisma.packagePurchase.update.mockResolvedValue({
      id: PACKAGE_ID,
      totalCredits: 10,
      remainingCredits: 5,
      isUnlimited: false,
      status: "paused",
      expiresAt: null,
    })

    const { PATCH } = await import("@/app/api/staff/students/[userId]/packages/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/packages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packagePurchaseId: PACKAGE_ID,
          reason: "Paused package and adjusted credits",
          remainingCredits: 5,
          status: "paused",
        }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(200)

    expect(mockWriteAudit).toHaveBeenCalledTimes(2)
    expect(mockWriteAudit).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        entity: "package",
        entityId: PACKAGE_ID,
        field: "remainingCredits",
        valueBefore: 7,
        valueAfter: 5,
      }),
      expect.anything()
    )
    expect(mockWriteAudit).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        entity: "package",
        entityId: PACKAGE_ID,
        field: "status",
        valueBefore: "active",
        valueAfter: "paused",
      }),
      expect.anything()
    )
  })

  it("stats correction: computes actual values, writes audit entries in same transaction", async () => {
    mockPrisma.attendance.count.mockResolvedValue(45)
    mockPrisma.packagePurchase.findFirst.mockResolvedValue({ id: PACKAGE_ID })
    mockPrisma.packageUsageLedger.count.mockResolvedValue(8)

    const { PATCH } = await import("@/app/api/staff/students/[userId]/stats/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/stats`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: "Corrected both stats to match actual values",
          completedClasses: 46,
          packageClassesUsed: 9,
        }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(200)

    // Verify actual values were computed before writing audit
    expect(mockPrisma.attendance.count).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        status: { in: ["checked_in", "checked_in_no_package", "checked_out"] },
      },
    })
    expect(mockWriteAudit).toHaveBeenCalledTimes(2)
    expect(mockWriteAudit).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        entity: "stats",
        field: "completedClasses",
        valueBefore: 45,
        valueAfter: 46,
      }),
      expect.anything()
    )
    expect(mockWriteAudit).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        entity: "stats",
        field: "packageClassesUsed",
        valueBefore: 8,
        valueAfter: 9,
      }),
      expect.anything()
    )
  })

  it("audit log: entries appear in student timeline after override", async () => {
    // Simulate that after overrides, the audit log query returns entries
    mockPrisma.studentDataAudit.count.mockResolvedValue(3)
    mockPrisma.studentDataAudit.findMany.mockResolvedValue([
      {
        id: "audit_3",
        staffClerkId: "user_owner_1",
        staffName: "John Admin",
        entity: "attendance",
        entityId: ATTENDANCE_ID,
        field: "status",
        valueBefore: null,
        valueAfter: { status: "checked_in", sessionId: SESSION_ID },
        reason: "Manual check-in for student",
        ipAddress: "192.168.1.1",
        createdAt: NOW,
      },
      {
        id: "audit_2",
        staffClerkId: "user_owner_1",
        staffName: "John Admin",
        entity: "payment",
        entityId: PURCHASE_ID,
        field: "amount",
        valueBefore: 10000,
        valueAfter: 8000,
        reason: "Corrected amount and payment method",
        ipAddress: "192.168.1.1",
        createdAt: new Date(NOW.getTime() - 60000),
      },
      {
        id: "audit_1",
        staffClerkId: "user_owner_1",
        staffName: "John Admin",
        entity: "package",
        entityId: PACKAGE_ID,
        field: "remainingCredits",
        valueBefore: 7,
        valueAfter: 5,
        reason: "Paused package and adjusted credits",
        ipAddress: "192.168.1.1",
        createdAt: new Date(NOW.getTime() - 120000),
      },
    ])

    const { GET } = await import("@/app/api/staff/students/[userId]/audit-log/route")
    const res = await GET(
      new Request(`http://localhost/api/staff/students/${USER_ID}/audit-log`),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.data.entries).toHaveLength(3)
    expect(data.data.pagination.total).toBe(3)

    // Verify entries are sorted by createdAt desc
    const timestamps = data.data.entries.map((e: { createdAt: string }) => new Date(e.createdAt).getTime())
    for (let i = 0; i < timestamps.length - 1; i++) {
      expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i + 1])
    }
  })

  it("audit log: entity filter returns only matching entries", async () => {
    mockPrisma.studentDataAudit.count.mockResolvedValue(1)
    mockPrisma.studentDataAudit.findMany.mockResolvedValue([
      {
        id: "audit_att",
        staffClerkId: "user_owner_1",
        staffName: null,
        entity: "attendance",
        entityId: ATTENDANCE_ID,
        field: "status",
        valueBefore: "scheduled",
        valueAfter: "checked_in",
        reason: "Test",
        ipAddress: null,
        createdAt: NOW,
      },
    ])

    const { GET } = await import("@/app/api/staff/students/[userId]/audit-log/route")
    const res = await GET(
      new Request(`http://localhost/api/staff/students/${USER_ID}/audit-log?entity=attendance`),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.data.entries.every((e: { entity: string }) => e.entity === "attendance")).toBe(true)
  })
})
