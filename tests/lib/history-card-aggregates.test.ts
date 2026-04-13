import { describe, expect, it } from "vitest"

import { buildHistoryStudentCard } from "@/components/front/staff/historyCardAggregates"

describe("buildHistoryStudentCard", () => {
  it("marks aggregated cards with source payment", () => {
    const card = buildHistoryStudentCard([
      {
        id: "payment_1",
        userId: "user_1",
        customerEmail: "student@example.com",
        courseSlug: "salsa-1",
        courseTitle: "Salsa 1",
        paymentChannel: "card",
        purchaseCategory: "dropin",
        amount: 2500,
        currency: "usd",
        classPaid: true,
        createdAt: "2026-04-01T12:00:00.000Z",
        classDate: "2026-04-01",
        classTime: "18:00",
        classStartsAt: "2026-04-01T18:00:00.000Z",
        attendanceId: null,
        checkInStatus: "none",
        checkInAt: null,
        checkedOutAt: null,
        packageClassNumber: null,
      },
    ])

    expect(card?.source).toBe("payment")
  })
})
