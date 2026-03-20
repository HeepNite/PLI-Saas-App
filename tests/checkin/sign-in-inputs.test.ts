import { describe, expect, it } from "vitest"
import { CODE_INPUT_ATTRIBUTES, PHONE_INPUT_ATTRIBUTES } from "@/lib/checkin/sign-in-inputs"

describe("sign-in input attributes", () => {
  it("uses numeric keypad attributes for phone input", () => {
    expect(PHONE_INPUT_ATTRIBUTES.type).toBe("text")
    expect(PHONE_INPUT_ATTRIBUTES.inputMode).toBe("numeric")
    expect(PHONE_INPUT_ATTRIBUTES.autoComplete).toBe("tel-national")
    expect(PHONE_INPUT_ATTRIBUTES.enterKeyHint).toBe("next")
  })

  it("uses numeric keypad attributes for sms code input", () => {
    expect(CODE_INPUT_ATTRIBUTES.type).toBe("text")
    expect(CODE_INPUT_ATTRIBUTES.inputMode).toBe("numeric")
    expect(CODE_INPUT_ATTRIBUTES.autoComplete).toBe("one-time-code")
    expect(CODE_INPUT_ATTRIBUTES.enterKeyHint).toBe("done")
  })
})
