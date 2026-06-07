import { Prisma } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockPrisma = {
  studentDataAudit: {
    create: vi.fn(),
  },
}

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

describe("writeStudentDataAudit", () => {
  beforeEach(() => {
    mockPrisma.studentDataAudit.create.mockReset()
    mockPrisma.studentDataAudit.create.mockResolvedValue({ id: "audit_1" })
  })

  it("writes with the default prisma client and normalizes nullable JSON fields", async () => {
    const { writeStudentDataAudit } = await import("@/lib/audit/student-data-audit")

    await writeStudentDataAudit({
      targetUserId: "user_1",
      staffClerkId: "staff_owner",
      staffName: "John Admin",
      entity: "attendance",
      entityId: "attendance_1",
      field: "status",
      valueBefore: "scheduled",
      valueAfter: "checked_in",
      reason: "Student arrived late",
      ipAddress: "192.168.1.1",
    })

    expect(mockPrisma.studentDataAudit.create).toHaveBeenCalledWith({
      data: {
        targetUserId: "user_1",
        staffClerkId: "staff_owner",
        staffName: "John Admin",
        entity: "attendance",
        entityId: "attendance_1",
        field: "status",
        valueBefore: "scheduled",
        valueAfter: "checked_in",
        reason: "Student arrived late",
        ipAddress: "192.168.1.1",
      },
    })
  })

  it("normalizes null values to Prisma.JsonNull for JSON fields", async () => {
    const { writeStudentDataAudit } = await import("@/lib/audit/student-data-audit")

    await writeStudentDataAudit({
      targetUserId: "user_1",
      staffClerkId: "staff_owner",
      entity: "payment",
      entityId: "purchase_1",
      field: "amount",
      valueBefore: null,
      valueAfter: 5000,
      reason: "Corrected amount",
    })

    expect(mockPrisma.studentDataAudit.create).toHaveBeenCalledWith({
      data: {
        targetUserId: "user_1",
        staffClerkId: "staff_owner",
        staffName: null,
        entity: "payment",
        entityId: "purchase_1",
        field: "amount",
        valueBefore: Prisma.JsonNull,
        valueAfter: 5000,
        reason: "Corrected amount",
        ipAddress: null,
      },
    })
  })

  it("converts undefined valueBefore to JsonNull", async () => {
    const { writeStudentDataAudit } = await import("@/lib/audit/student-data-audit")
    const { Prisma } = await import("@prisma/client")

    await writeStudentDataAudit({
      targetUserId: "user_1",
      staffClerkId: "staff_owner",
      entity: "stats",
      field: "completedClasses",
      valueAfter: 46,
      reason: "Corrected stat",
    })

    expect(mockPrisma.studentDataAudit.create).toHaveBeenCalledWith({
      data: {
        targetUserId: "user_1",
        staffClerkId: "staff_owner",
        staffName: null,
        entity: "stats",
        entityId: null,
        field: "completedClasses",
        valueBefore: Prisma.JsonNull,
        valueAfter: 46,
        reason: "Corrected stat",
        ipAddress: null,
      },
    })
  })

  it("uses the provided transaction client when available", async () => {
    const { writeStudentDataAudit } = await import("@/lib/audit/student-data-audit")
    const tx = {
      studentDataAudit: {
        create: vi.fn().mockResolvedValue({ id: "audit_tx" }),
      },
    }

    await writeStudentDataAudit(
      {
        targetUserId: "user_1",
        staffClerkId: "staff_owner",
        entity: "package",
        entityId: "pkg_1",
        field: "remainingCredits",
        valueBefore: 5,
        valueAfter: 7,
        reason: "Restored credits",
      },
      tx as never
    )

    expect(tx.studentDataAudit.create).toHaveBeenCalledWith({
      data: {
        targetUserId: "user_1",
        staffClerkId: "staff_owner",
        staffName: null,
        entity: "package",
        entityId: "pkg_1",
        field: "remainingCredits",
        valueBefore: 5,
        valueAfter: 7,
        reason: "Restored credits",
        ipAddress: null,
      },
    })
    expect(mockPrisma.studentDataAudit.create).not.toHaveBeenCalled()
  })

  it("handles all entity types", async () => {
    const { writeStudentDataAudit } = await import("@/lib/audit/student-data-audit")

    const entities = ["attendance", "payment", "package", "stats"] as const

    for (const entity of entities) {
      mockPrisma.studentDataAudit.create.mockReset()
      mockPrisma.studentDataAudit.create.mockResolvedValue({ id: `audit_${entity}` })

      await writeStudentDataAudit({
        targetUserId: "user_1",
        staffClerkId: "staff_owner",
        entity,
        field: "test_field",
        valueAfter: "test",
        reason: "Test",
      })

      expect(mockPrisma.studentDataAudit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ entity }),
        })
      )
    }
  })
})
