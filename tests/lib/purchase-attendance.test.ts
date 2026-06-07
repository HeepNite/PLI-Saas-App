import { beforeEach, describe, expect, it, vi } from "vitest"

const mockPrisma = {
  $executeRaw: vi.fn(),
  purchase: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
}

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

describe("ensureAttendancePackagePurchase", () => {
  beforeEach(() => {
    mockPrisma.$executeRaw.mockReset()
    mockPrisma.purchase.findFirst.mockReset()
    mockPrisma.purchase.create.mockReset()
    mockPrisma.$executeRaw.mockResolvedValue(undefined)
    mockPrisma.purchase.findFirst.mockResolvedValue(null)
    mockPrisma.purchase.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => data)
  })

  it("persists packagePurchaseId in package credit purchase metadata", async () => {
    const { ensureAttendancePackagePurchase } = await import("@/lib/purchase-attendance")

    const created = await ensureAttendancePackagePurchase(mockPrisma as never, {
      attendanceId: "attendance_1",
      userId: "user_1",
      courseSlug: "salsa-beginners",
      courseTitle: "Salsa Beginners",
      email: "student@example.com",
      name: "Student",
      phone: "+1 555 0100",
      packageId: "pkg_1",
      packagePurchaseId: "package_purchase_1",
      source: "staff_checkin_package",
      date: "2026-03-20",
      time: "18:00",
    })

    expect(mockPrisma.purchase.create).toHaveBeenCalledOnce()
    expect(created).toMatchObject({
      metadata: {
        paymentChannel: "package_credit",
        attendanceId: "attendance_1",
        packagePurchaseId: "package_purchase_1",
      },
    })
  })
})
