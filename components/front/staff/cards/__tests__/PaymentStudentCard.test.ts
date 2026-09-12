import { describe, expect, it } from "vitest"
import { resolvePendingRowAmountCents } from "@/components/front/staff/cards/PaymentStudentCard"

describe("resolvePendingRowAmountCents", () => {
  it("returns null when the amount is unrecorded and no drop-in price is configured", () => {
    expect(resolvePendingRowAmountCents({ amount: 0, dueAmountCents: null })).toBeNull()
  })
})
