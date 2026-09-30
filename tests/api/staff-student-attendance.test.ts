import { beforeEach, describe, expect, it, vi } from "vitest"

const reserveCredit = vi.fn()
const guardPackageCredit = vi.fn()
const withStaffGuard = vi.fn()
const writeAudit = vi.fn()

const tx = {
  user: { findUnique: vi.fn(), update: vi.fn() },
  classSession: { findMany: vi.fn() },
  attendance: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  packagePurchase: { findFirst: vi.fn(), update: vi.fn() },
  packageUsageLedger: { findFirst: vi.fn(), create: vi.fn(), delete: vi.fn() },
  purchase: { findMany: vi.fn(), delete: vi.fn() },
}
const prisma = { ...tx, $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) }

vi.mock("@/lib/prisma", () => ({ prisma }))
vi.mock("@/lib/packages", () => ({
  reservePackageCreditForAttendanceTx: (...args: unknown[]) => reserveCredit(...args),
  guardPackagePurchaseEligibleForCreditTx: (...args: unknown[]) => guardPackageCredit(...args),
}))
vi.mock("@/lib/security/with-staff-guard", () => ({ withStaffGuard: (...args: unknown[]) => withStaffGuard(...args) }))
vi.mock("@/lib/security/staff-portal-auth", () => ({ authorizeOwnerOrAdminRequest: vi.fn() }))
vi.mock("@/lib/audit/student-data-audit", () => ({ writeStudentDataAudit: (...args: unknown[]) => writeAudit(...args) }))

describe("staff attendance credit reservation", () => {
  beforeEach(() => {
    vi.resetModules()
    for (const group of Object.values(tx)) for (const mock of Object.values(group)) mock.mockReset()
    prisma.$transaction.mockClear()
    reserveCredit.mockReset()
    guardPackageCredit.mockReset().mockResolvedValue(true)
    withStaffGuard.mockReset().mockResolvedValue({ ok: true, auth: { userId: "staff_1", staffName: "Staff" } })
    writeAudit.mockReset().mockResolvedValue(undefined)
    tx.user.findUnique.mockResolvedValue({ id: "student_1" })
    tx.classSession.findMany.mockResolvedValue([{ id: "session_1", title: "Class", courseSlug: "salsa", startsAt: new Date("2026-09-01T12:00:00Z") }])
    tx.attendance.findUnique.mockResolvedValue(null)
    tx.attendance.create.mockResolvedValue({ id: "attendance_1" })
    tx.packagePurchase.findFirst.mockResolvedValue({ id: "package_1", remainingCredits: 1 })
    reserveCredit.mockResolvedValue({ consumed: true })
  })

  it.each([
    ["remove", undefined],
    ["update", "scheduled"],
  ])("preserves attendance and usage history when %s would undo a reversed/manual Purchase", async (action, status) => {
    tx.attendance.findUnique.mockResolvedValue({ id: "attendance_1", status: "checked_in" })
    tx.packageUsageLedger.findFirst.mockResolvedValue({
      id: "usage_1", packagePurchaseId: "package_1", delta: -1,
      packagePurchase: { id: "package_1", purchaseId: "purchase_1", status: "revoked" },
    })
    guardPackageCredit.mockResolvedValue(false)

    const { PATCH } = await import("@/app/api/staff/students/[userId]/attendance/route")
    const response = await PATCH(new Request("http://localhost/api/staff/students/student_1/attendance", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, ...(status ? { status } : {}), sessionId: "session_1", reason: "undo" }),
    }), { params: Promise.resolve({ userId: "student_1" }) })

    expect(response.status).toBe(409)
    expect(guardPackageCredit).toHaveBeenCalledWith(tx, expect.objectContaining({ id: "package_1", purchaseId: "purchase_1" }))
    expect(tx.attendance.delete).not.toHaveBeenCalled()
    expect(tx.attendance.update).not.toHaveBeenCalled()
    expect(tx.packagePurchase.update).not.toHaveBeenCalled()
    expect(tx.packageUsageLedger.delete).not.toHaveBeenCalled()
  })

  it("routes staff attendance consumption through the guarded shared reservation helper", async () => {
    const { PATCH } = await import("@/app/api/staff/students/[userId]/attendance/route")
    const response = await PATCH(new Request("http://localhost/api/staff/students/student_1/attendance", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "add", status: "checked_in", sessionId: "session_1", reason: "check in" }),
    }), { params: Promise.resolve({ userId: "student_1" }) })

    expect(response.status).toBe(200)
    expect(reserveCredit).toHaveBeenCalledWith(tx, expect.objectContaining({
      packagePurchaseId: "package_1", userId: "student_1", attendanceId: "attendance_1", reason: "staff_override_add_attendance",
    }))
    expect(tx.packageUsageLedger.create).not.toHaveBeenCalled()
  })
})
