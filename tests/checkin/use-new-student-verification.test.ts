import { describe, expect, it } from "vitest"

import {
  initialState,
  resolveNewStudentVerificationOutcome,
  verificationReducer,
} from "@/components/front/courses/hooks/useNewStudentVerification"

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

  it("keeps returning-customer fallback gated when SMS ownership is required", () => {
    expect(resolveNewStudentVerificationOutcome({
      outcome: "requires_sms_verification",
      requiresSmsVerification: true,
      shouldFallbackToRegular: true,
    })).toBe("sms_pending")
  })

  it("retains regular-price routing until SMS verification succeeds", () => {
    const pending = verificationReducer(initialState, {
      type: "VERIFY_NEW",
      shouldFallbackToRegular: true,
      message: "Verify this phone number to continue with regular pricing.",
    })
    const verified = verificationReducer(pending, { type: "SMS_VERIFIED" })

    expect(verified).toMatchObject({
      status: "verified",
      ctx: {
        shouldFallbackToRegular: true,
        message: "Verify this phone number to continue with regular pricing.",
      },
    })
  })

  it("rejects an unknown response instead of treating it as SMS pending", () => {
    expect(() => resolveNewStudentVerificationOutcome({ outcome: "unknown" })).toThrow("Unexpected verification response")
  })
})
