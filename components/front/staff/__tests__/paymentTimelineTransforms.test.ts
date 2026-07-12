import { describe, expect, it } from "vitest"
import { transformPaymentRowsToAttendance } from "@/components/front/staff/paymentTimelineTransforms"

type PaymentTimelineRow = Parameters<typeof transformPaymentRowsToAttendance>[0][number]

function makeRow(overrides: Partial<PaymentTimelineRow> = {}): PaymentTimelineRow {
  return {
    id: "row-1",
    userId: "user-1",
    attendanceId: "att-1",
    paymentChannel: "cash",
    purchaseCategory: "dropin",
    amount: 1500,
    paymentStatus: "paid",
    settlementStatus: "paid",
    classPaid: true,
    createdAt: "2026-04-20T14:00:00.000Z",
    classDate: "2026-04-20",
    classTime: "10:00",
    courseTitle: "Yoga",
    courseSlug: "yoga",
    packageId: null,
    serviceId: null,
    outstandingBalance: null,
    stripeFailure: null,
    checkInStatus: "checked_out",
    checkInAt: "2026-04-20T14:00:00.000Z",
    checkedOutAt: "2026-04-20T15:00:00.000Z",
    activePackage: null,
    ...overrides,
  } as PaymentTimelineRow
}

describe("transformPaymentRowsToAttendance date parsing", () => {
  it("parses a plain YYYY-MM-DD classDate into a valid local date", () => {
    const { events } = transformPaymentRowsToAttendance([makeRow({ classDate: "2026-04-20" })])
    expect(events).toHaveLength(1)
    const date = events[0].date
    expect(Number.isNaN(date.getTime())).toBe(false)
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(3) // April (0-indexed)
    expect(date.getDate()).toBe(20)
  })

  it("falls back to createdAt when classDate is a full ISO datetime instead of YYYY-MM-DD", () => {
    const createdAt = "2026-05-15T18:30:00.000Z"
    const { events } = transformPaymentRowsToAttendance([
      makeRow({ classDate: "2026-04-20T19:00:00.000Z", createdAt }),
    ])
    expect(events).toHaveLength(1)
    const date = events[0].date
    expect(Number.isNaN(date.getTime())).toBe(false)
    expect(date.getTime()).toBe(new Date(createdAt).getTime())
  })
})
