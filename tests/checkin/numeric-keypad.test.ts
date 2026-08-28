import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import KioskNumericKeypad from "@/components/front/checkin/KioskNumericKeypad"
import {
  appendCodeDigit,
  appendPhoneDigit,
  clearCodeDigits,
  clearPhoneDigits,
  removeCodeDigit,
  removePhoneDigit,
} from "@/lib/checkin/numeric-keypad"

describe("numeric keypad helpers", () => {
  it("removes keypad press motion for reduced-motion users", () => {
    const markup = renderToStaticMarkup(React.createElement(KioskNumericKeypad, {
      onDigit: () => {},
      onBackspace: () => {},
      onClear: () => {},
    }))

    expect(markup).toContain("motion-reduce:transition-none")
    expect(markup).toContain("motion-reduce:transform-none")
  })

  it("formats phone digits as the kiosk keypad appends them", () => {
    let value = clearPhoneDigits()
    for (const digit of "9293876584") {
      value = appendPhoneDigit(value, digit)
    }

    expect(value).toBe("+1 (929) 387-6584")
  })

  it("removes the last phone digit and keeps the format stable", () => {
    expect(removePhoneDigit("+1 (929) 387-6584")).toBe("+1 (929) 387-658")
    expect(clearPhoneDigits()).toBe("+1 ")
  })

  it("limits sms codes to the requested max length", () => {
    let code = clearCodeDigits()
    for (const digit of "1234567") {
      code = appendCodeDigit(code, digit, 6)
    }

    expect(code).toBe("123456")
    expect(removeCodeDigit(code)).toBe("12345")
  })
})
