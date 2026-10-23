import { describe, expect, it } from "vitest"

import { buildCurrentMonthStudentsSummary, matchesStripeStatus, resolveStudentCardPayments } from "@/components/front/staff/staffPaymentFilters"
import type { PaymentRow } from "@/components/front/staff/staffAdminTypes"

const row = (overrides: Partial<PaymentRow>): PaymentRow => ({
  id: "p", userId: "u", courseSlug: "salsa", courseTitle: "Salsa", customerName: "Ana", customerEmail: "a@example.com",
  customerPhone: "", customerAvatarUrl: null, packageId: null, serviceId: null, paymentChannel: "card", purchaseCategory: "dropin",
  amount: 2500, currency: "usd", paymentStatus: "paid", settlementStatus: "paid", settlementNote: "", settledAt: null,
  createdAt: "2026-05-26T12:00:00.000Z", updatedAt: "2026-05-26T12:00:00.000Z", classDate: "2026-05-26", classTime: "18:00",
  classStartsAt: "2026-05-26T22:00:00.000Z", location: null, pointsBalance: 0, pointsHistory: [], classPaid: true,
  attendanceId: null, checkInStatus: "none", checkInAt: null, checkedOutAt: null, activePackage: null,
  studentPin: { enabled: false, enrolled: false, locked: false, needsEnrollment: false, permanentStatus: null, provisionalActive: false, provisionalExpiresAt: null },
  packageClassNumber: null, completedClassesTotal: 0, packageClassesUsedTotal: 0, outstandingBalance: null,
  ...overrides,
}) as PaymentRow

describe("Verify status filter", () => {
  const paid = row({ id: "paid" })
  const declined = row({ id: "declined", paymentStatus: "failed", settlementStatus: "pending", classPaid: false, verify: true, verifyReason: "card_declined" })
  const cashPending = row({ id: "cash", paymentChannel: "cash", paymentStatus: "pending", settlementStatus: "pending", classPaid: false })

  it("matches only verify rows", () => {
    expect(matchesStripeStatus(declined, "verify")).toBe(true)
    expect(matchesStripeStatus(paid, "verify")).toBe(false)
    expect(matchesStripeStatus(cashPending, "verify")).toBe(false)
  })

  // D5 (owner, 2026-10-23): Pending is cash-only; an uncharged card is Verify only.
  it("keeps verify and resolved card attempts out of Pending, and counts a collected row as paid", () => {
    const dismissed = row({
      id: "dismissed", paymentStatus: "failed", settlementStatus: "pending", classPaid: false, verify: false,
      verifyResolution: { action: "dismissed", by: "staff_1", byName: "Elvira", at: "2026-10-23T16:00:00.000Z", reason: "Class not taken" },
    })
    const collected = row({
      id: "collected", paymentChannel: "cash", paymentStatus: "paid", settlementStatus: "paid", classPaid: true, verify: false,
      verifyResolution: { action: "collected", by: "staff_1", byName: "Elvira", at: "2026-10-23T16:00:00.000Z", reason: null },
    })
    expect(matchesStripeStatus(declined, "pending")).toBe(false)
    expect(matchesStripeStatus(dismissed, "pending")).toBe(false)
    expect(matchesStripeStatus(collected, "pending")).toBe(false)
    expect(matchesStripeStatus(collected, "paid")).toBe(true)
    expect(matchesStripeStatus(cashPending, "pending")).toBe(true)
  })

  it("lists only verify rows for a student under the Verify status", () => {
    const result = resolveStudentCardPayments([paid, declined, cashPending], {
      isHistoryMode: false, historyClassKey: "", historyPaymentMethodFilter: "all", historyAttendanceFilter: "all", historyEventKindFilter: "all",
      paymentCategoryFilter: "all", paymentsFilter: "verify", studentSearchQuery: "",
    })
    expect(result.map((payment) => payment.id)).toEqual(["declined"])
  })

  it("carries the API verify totals into the monthly summary", () => {
    const summary = buildCurrentMonthStudentsSummary({
      summary: { totalItems: 3, totalCollected: 2500, pendingSettlement: 1, paidSettlement: 0, pendingStripe: 1, paidStripe: 1, verifyItems: 1, verifyAmount: 2500 },
      studentCount: 2, checkedInStudents: 0,
    })
    expect(summary).toMatchObject({ verifyCount: 1, verifyAmountCents: 2500 })
  })
})
