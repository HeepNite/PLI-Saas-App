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

describe("resolveRecentVerifyAmountCents", () => {
  const now = Date.parse("2026-05-26T12:00:00.000Z")
  const row = (id: string, verifySince: string | null, amount = 2500, verify = true) => ({ id, verify, verifySince, amount })

  it("sums verify attempts within 24 h of the attempt and ignores older or non-verify rows", async () => {
    const { resolveRecentVerifyAmountCents } = await import("@/components/front/staff/staffPaymentCardPresentation")
    expect(resolveRecentVerifyAmountCents([
      row("recent", "2026-05-26T02:00:00.000Z"),
      row("edge", "2026-05-25T12:00:00.001Z", 1000),
      row("stale", "2026-05-25T11:59:59.000Z"),
      row("not-verify", "2026-05-26T02:00:00.000Z", 9999, false),
      row("no-time", null),
    ], now)).toBe(3500)
    expect(resolveRecentVerifyAmountCents([row("stale", "2026-05-25T11:00:00.000Z")], now)).toBe(0)
  })
})
