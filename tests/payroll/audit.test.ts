import { Prisma } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockPrisma = {
  staffPayrollAudit: {
    create: vi.fn(),
  },
}

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

describe("writePayrollAudit", () => {
  beforeEach(() => {
    mockPrisma.staffPayrollAudit.create.mockReset()
    mockPrisma.staffPayrollAudit.create.mockResolvedValue({ id: "audit_1" })
  })

  it("writes with the default prisma client and normalizes nullable JSON fields", async () => {
    const { writePayrollAudit } = await import("@/lib/payroll/audit")

    await writePayrollAudit({
      staffAccountId: "staff_1",
      type: "MODEL_ASSIGNED",
      actorClerkUserId: "user_owner",
      previousValue: null,
      nextValue: { nextModelId: "model_1" },
      reason: "assignment",
      metadata: null,
    })

    expect(mockPrisma.staffPayrollAudit.create).toHaveBeenCalledWith({
      data: {
        entryId: null,
        staffAccountId: "staff_1",
        type: "MODEL_ASSIGNED",
        actorClerkUserId: "user_owner",
        previousValue: Prisma.JsonNull,
        nextValue: { nextModelId: "model_1" },
        reason: "assignment",
        metadata: Prisma.JsonNull,
      },
    })
  })

  it("uses the provided transaction client when available", async () => {
    const { writePayrollAudit } = await import("@/lib/payroll/audit")
    const tx = {
      staffPayrollAudit: {
        create: vi.fn().mockResolvedValue({ id: "audit_tx" }),
      },
    }

    await writePayrollAudit(
      {
        entryId: "entry_1",
        type: "PAID",
        nextValue: undefined,
      },
      tx as never
    )

    expect(tx.staffPayrollAudit.create).toHaveBeenCalledWith({
      data: {
        entryId: "entry_1",
        staffAccountId: null,
        type: "PAID",
        actorClerkUserId: null,
        previousValue: undefined,
        nextValue: undefined,
        reason: null,
        metadata: undefined,
      },
    })
    expect(mockPrisma.staffPayrollAudit.create).not.toHaveBeenCalled()
  })
})
