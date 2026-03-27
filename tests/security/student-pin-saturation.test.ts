import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    studentPinCredential: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

import {
  getActiveStudentPinCount,
  getStudentPinSaturationReport,
  resolveStudentPinSaturationAlertLevel,
} from "@/lib/security/student-pin-saturation"

const makePins = (count: number) => Array.from({ length: count }, (_, index) => ({ pinLookupDigest: `digest_${index}` }))

describe("student PIN saturation", () => {
  beforeEach(() => {
    mockPrisma.studentPinCredential.findMany.mockReset()
    mockPrisma.studentPinCredential.findMany.mockResolvedValue([])
  })

  it("counts distinct active lookup digests", async () => {
    mockPrisma.studentPinCredential.findMany.mockResolvedValue(makePins(42))

    await expect(getActiveStudentPinCount(mockPrisma as never)).resolves.toBe(42)
    expect(mockPrisma.studentPinCredential.findMany).toHaveBeenCalledWith({
      where: {
        status: { in: ["active", "rotation_required"] },
      },
      distinct: ["pinLookupDigest"],
      select: {
        pinLookupDigest: true,
      },
    })
  })

  it("marks warning and critical thresholds at 70 and 90 percent", async () => {
    mockPrisma.studentPinCredential.findMany.mockResolvedValue(makePins(7000))
    await expect(getStudentPinSaturationReport(mockPrisma as never)).resolves.toMatchObject({
      activePinCount: 7000,
      availablePinCount: 3000,
      saturationPct: 70,
      alertLevel: "warning",
      thresholds: { warningPct: 70, criticalPct: 90 },
    })

    mockPrisma.studentPinCredential.findMany.mockResolvedValue(makePins(9000))
    await expect(getStudentPinSaturationReport(mockPrisma as never)).resolves.toMatchObject({
      activePinCount: 9000,
      availablePinCount: 1000,
      saturationPct: 90,
      alertLevel: "critical",
    })
  })

  it("keeps the alert level normal below the warning threshold", () => {
    expect(resolveStudentPinSaturationAlertLevel(0.6999)).toBe("normal")
  })
})
