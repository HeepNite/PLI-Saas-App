import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    studentPinAudit: {
      create: vi.fn(),
    },
  },
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

import { writeStudentPinAudit } from "@/lib/security/student-pin-audit"

describe("student PIN audit helpers", () => {
  beforeEach(() => {
    mockPrisma.studentPinAudit.create.mockReset()
  })

  it("writes audit rows with the shared prisma client by default", async () => {
    mockPrisma.studentPinAudit.create.mockResolvedValue({ id: "audit_1" })

    await writeStudentPinAudit({
      userId: "user_1",
      action: "reset",
      result: "success",
      actorType: "staff",
    })

    expect(mockPrisma.studentPinAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user_1",
        action: "reset",
        result: "success",
        actorType: "staff",
      }),
    })
  })

  it("accepts a transaction-scoped db client", async () => {
    const tx = {
      studentPinAudit: {
        create: vi.fn().mockResolvedValue({ id: "audit_2" }),
      },
    }

    await writeStudentPinAudit({
      userId: "user_2",
      action: "staff_denied",
      result: "denied",
      actorType: "staff",
      db: tx as never,
    })

    expect(tx.studentPinAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user_2",
        action: "staff_denied",
        result: "denied",
      }),
    })
    expect(mockPrisma.studentPinAudit.create).not.toHaveBeenCalled()
  })
})
