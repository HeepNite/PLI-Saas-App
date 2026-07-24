import { describe, it, expect } from "vitest"
import {
  formatUSPhone,
  formatUSPhoneOnChange,
  getUsPhoneDigits,
  hasPhoneDigits,
  isCompleteUSPhone,
  toE164Phone,
} from "@/components/front/courses/utils/phone"

describe("phone utils", () => {
  it("normalizes to 10 digits", () => {
    expect(getUsPhoneDigits("+1 (929) 387-6584")).toBe("9293876584")
    expect(getUsPhoneDigits("1-646-229-6664")).toBe("6462296664")
    expect(getUsPhoneDigits("6462296664")).toBe("6462296664")
  })

  it("formats US phone numbers", () => {
    expect(formatUSPhone("9293876584")).toBe("+1 (929) 387-6584")
    expect(formatUSPhone("+1 6462296664")).toBe("+1 (646) 229-6664")
    expect(formatUSPhone("")).toBe("+1 ")
  })

  it("validates completeness", () => {
    expect(isCompleteUSPhone("9293876584")).toBe(true)
    expect(isCompleteUSPhone("929387")).toBe(false)
    expect(hasPhoneDigits("+1 ")).toBe(false)
    expect(hasPhoneDigits("929")).toBe(true)
  })

  it("returns E164 when complete", () => {
    expect(toE164Phone("9293876584")).toBe("+19293876584")
    expect(toE164Phone("929387")).toBeUndefined()
  })

  describe("formatUSPhoneOnChange", () => {
    it("formats forward typing normally", () => {
      expect(formatUSPhoneOnChange("+1 (515", "+1 (51")).toBe("+1 (515)")
    })

    it("removes a digit on normal backspace over a digit", () => {
      // Field shows "+1 (515) 123-4567", user backspaces the last digit "7"
      expect(formatUSPhoneOnChange("+1 (515) 123-456", "+1 (515) 123-4567")).toBe(
        "+1 (515) 123-456"
      )
    })

    it("strips a digit when backspacing over a trailing format char (no loop)", () => {
      // Field shows "+1 (515", cursor backspaces the "5" but browser also
      // eats the space, leaving digit count unchanged ("515" -> "515").
      expect(formatUSPhoneOnChange("+1 (51", "+1 (515")).toBe("+1 (51")
    })

    it("does not freeze on repeated backspacing over format chars", () => {
      let value = "+1 (515"
      value = formatUSPhoneOnChange("+1 (51", value)
      expect(value).toBe("+1 (51")
      value = formatUSPhoneOnChange("+1 (5", value)
      expect(value).toBe("+1 (5")
      value = formatUSPhoneOnChange("+1 (", value)
      expect(value).toBe("+1 ")
    })

    it("formats a full pasted number", () => {
      expect(formatUSPhoneOnChange("5151234567", "")).toBe("+1 (515) 123-4567")
    })

    it("handles delete-to-empty", () => {
      expect(formatUSPhoneOnChange("", "+1 ")).toBe("+1 ")
    })

    it("handles mid-string digit insert/delete without regression", () => {
      expect(formatUSPhoneOnChange("+1 (925) 387-6584", "+1 (95) 387-6584")).toBe(
        "+1 (925) 387-6584"
      )
    })
  })
})
