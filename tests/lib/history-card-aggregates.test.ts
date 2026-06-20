import { describe, expect, it } from "vitest"

import {
  buildHistoryStudentCard,
  buildHistoryStudentPaidEntries,
  resolveHistoryStudentCardAmountPaidCents,
  type HistoryCardPaymentLike,
} from "@/components/front/staff/historyCardAggregates"

const payment = (overrides: Partial<HistoryCardPaymentLike> = {}): HistoryCardPaymentLike => ({
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
  ...overrides,
})

describe("buildHistoryStudentCard", () => {
  it("marks aggregated cards with source payment", () => {
    const card = buildHistoryStudentCard([payment()])

    expect(card?.source).toBe("payment")
  })

  it("does not count package credit rows as collected money", () => {
    const cash = payment({ id: "cash_1", amount: 1000, paymentChannel: "cash" })
    const packageCredit = payment({
      id: "package_credit_1",
      amount: 2000,
      paymentChannel: "package_credit",
      packageClassNumber: 1,
      attendanceId: "attendance_1",
    })

    const card = buildHistoryStudentCard([cash, packageCredit])

    expect(card?.totalCollectedCents).toBe(1000)
    expect(card?.paidPayments).toBe(1)
    expect(resolveHistoryStudentCardAmountPaidCents(card!, "daily")).toBe(1000)
    expect(buildHistoryStudentPaidEntries([cash, packageCredit])).toEqual([
      expect.objectContaining({ id: "cash_1", amount: 1000 }),
    ])
  })
})
