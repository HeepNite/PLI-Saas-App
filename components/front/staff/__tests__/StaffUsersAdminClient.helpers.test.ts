import { describe, expect, it } from "vitest"
import {
  formatStudentPaymentCardDateTimeLabel,
  formatStudentPaymentCardSlotLabel,
} from "@/components/front/staff/studentPaymentCardFormatters"

describe("StaffUsersAdminClient helpers", () => {
  it("formats daily card class slots with the long date label", () => {
    expect(formatStudentPaymentCardSlotLabel("2026-03-20", "18:00")).toBe("Friday, 20 Mar 2026 · 6:00 PM")
  })

  it("falls back cleanly when the slot is incomplete", () => {
    expect(formatStudentPaymentCardSlotLabel("2026-03-20", null)).toBe("Friday, 20 Mar 2026")
    expect(formatStudentPaymentCardSlotLabel(null, "18:00")).toBe("No class slot")
  })

  it("formats visible daily-card timestamps with the same long date label", () => {
    expect(formatStudentPaymentCardDateTimeLabel("2026-03-20T18:00:00")).toBe("Friday, 20 Mar 2026 · 6:00:00 PM")
  })
})
