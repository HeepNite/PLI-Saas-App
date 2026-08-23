import { describe, expect, it } from "vitest"

import { resolveNewStudentVerificationOutcome } from "@/components/front/courses/hooks/useNewStudentVerification"

describe("resolveNewStudentVerificationOutcome", () => {
  it("marks an eligible response without SMS as verified", () => {
    expect(resolveNewStudentVerificationOutcome({ outcome: "eligible", requiresSmsVerification: false })).toBe("verified")
  })

  it.each([
    { outcome: "requires_sms_verification" as const },
    { outcome: "eligible" as const, requiresSmsVerification: true },
  ])("keeps explicit SMS verification responses gated", (response) => {
    expect(resolveNewStudentVerificationOutcome(response)).toBe("sms_pending")
  })

  it("rejects an unknown response instead of treating it as SMS pending", () => {
    expect(() => resolveNewStudentVerificationOutcome({ outcome: "unknown" })).toThrow("Unexpected verification response")
  })
})
