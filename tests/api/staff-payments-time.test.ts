import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/class-schedule", () => ({
  buildSessionStartsAt: (dateIso: string, time24: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return null
    if (time24 === "00:00") return new Date(`${dateIso}T00:00:00.000Z`)
    if (time24 === "23:59") return new Date(`${dateIso}T23:59:00.000Z`)
    return null
  },
  getStartOfDayNY: (dateIso: string) => new Date(`${dateIso}T05:00:00.000Z`),
  getTodayNewYork: () => "2026-02-10",
}))

import { getStaffPaymentsTodaySessionBounds, getStaffPaymentsTodayWindow } from "@/app/api/staff/payments/payments-time"

describe("staff payments time helpers", () => {
  it("builds the current New York day window", () => {
    expect(getStaffPaymentsTodayWindow()).toEqual({
      todayNY: "2026-02-10",
      startOfTodayNY: new Date("2026-02-10T05:00:00.000Z"),
      endOfTodayNY: new Date("2026-02-11T04:59:59.999Z"),
    })
  })

  it("builds named session boundaries for valid staff payments day keys", () => {
    expect(getStaffPaymentsTodaySessionBounds("2026-02-10")).toEqual({
      minStart: new Date("2026-02-10T00:00:00.000Z"),
      maxStart: new Date("2026-02-10T23:59:00.000Z"),
    })
  })

  it("throws when a day key cannot produce session boundaries", () => {
    expect(() => getStaffPaymentsTodaySessionBounds("not-a-date")).toThrow(
      "Unable to build staff payments minimum session boundary for not-a-date"
    )
  })
})
