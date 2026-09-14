import { describe, expect, it } from "vitest"
import { describeOpenPaymentRow } from "@/components/front/staff/staffPaymentCardPresentation"

describe("describeOpenPaymentRow", () => {
  it("labels an expired card attempt as not completed", () => {
    expect(
      describeOpenPaymentRow({
        paymentChannel: "card",
        settlementStatus: "pending",
        paymentStatus: "expired",
      })
    ).toEqual({ label: "Card attempt not completed", tone: expect.any(String) })
  })

  it("returns null for a cash pending row", () => {
    expect(
      describeOpenPaymentRow({
        paymentChannel: "cash",
        settlementStatus: "pending",
        paymentStatus: "pending",
      })
    ).toBeNull()
  })

  it("returns null for a refunded card purchase", () => {
    expect(
      describeOpenPaymentRow({
        paymentChannel: "card",
        settlementStatus: "pending",
        paymentStatus: "refunded",
      })
    ).toBeNull()
  })
})
