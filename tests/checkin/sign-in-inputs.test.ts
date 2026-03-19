import { describe, expect, it } from "vitest"
import { CODE_INPUT_ATTRIBUTES, PHONE_INPUT_ATTRIBUTES } from "@/lib/checkin/sign-in-inputs"

describe("sign-in input attributes", () => {
  it("uses numeric keypad attributes for phone input", () => {
    expect(PHONE_INPUT_ATTRIBUTES.type).toBe("tel")
    expect(PHONE_INPUT_ATTRIBUTES.inputMode).toBe("numeric")
    expect(PHONE_INPUT_ATTRIBUTES.autoComplete).toBe("tel-national")
    expect(PHONE_INPUT_ATTRIBUTES.pattern).toBe("[0-9]*")
  })

  it("uses numeric keypad attributes for sms code input", () => {
    expect(CODE_INPUT_ATTRIBUTES.type).toBe("tel")
    expect(CODE_INPUT_ATTRIBUTES.inputMode).toBe("numeric")
    expect(CODE_INPUT_ATTRIBUTES.autoComplete).toBe("one-time-code")
    expect(CODE_INPUT_ATTRIBUTES.pattern).toBe("[0-9]*")
  })
})
