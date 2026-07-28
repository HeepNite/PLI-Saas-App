import { describe, it, expect } from "vitest"
import { formatUSPhone, getUsPhoneDigits, hasPhoneDigits, isCompleteUSPhone, toE164Phone } from "@/components/front/courses/utils/phone"

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
})
