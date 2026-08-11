import { describe, expect, it } from "vitest"
import { deviceEnrolledMessage, enrollmentOtpMessage } from "@/lib/sms/staff-sms-copy"

/**
 * `lib/sms/staff-sms-copy.ts` — A2P-aligned message copy for staff device
 * enrollment. These strings must stay in sync with Twilio's registered A2P
 * 10DLC campaign samples: brand prefix, "do not share" warning (OTP only),
 * and the mandatory HELP/STOP compliance footer (both messages).
 */
describe("lib/sms/staff-sms-copy: A2P-aligned message copy", () => {
  describe("enrollmentOtpMessage", () => {
    it("starts with the PLI brand prefix", () => {
      expect(enrollmentOtpMessage("123456")).toMatch(/^Palladium Latin Art \(PLI\):/)
    })

    it("includes the verification code", () => {
      expect(enrollmentOtpMessage("654321")).toContain("654321")
    })

    it('includes "Do not share this code."', () => {
      expect(enrollmentOtpMessage("123456")).toContain("Do not share this code.")
    })

    it('ends with the HELP/STOP compliance footer', () => {
      expect(enrollmentOtpMessage("123456")).toContain("Reply HELP for help, STOP to opt out.")
    })
  })

  describe("deviceEnrolledMessage", () => {
    it("starts with the PLI brand prefix", () => {
      expect(deviceEnrolledMessage()).toMatch(/^Palladium Latin Art \(PLI\):/)
    })

    it('includes the HELP/STOP compliance footer', () => {
      expect(deviceEnrolledMessage()).toContain("Reply HELP for help, STOP to opt out.")
    })

    it('does NOT include the OTP-only "Do not share this code." warning', () => {
      expect(deviceEnrolledMessage()).not.toContain("Do not share this code.")
    })
  })
})
