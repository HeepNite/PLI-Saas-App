// @vitest-environment jsdom

import fs from "node:fs"
import path from "node:path"
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import KioskNumericKeypad from "@/components/front/checkin/KioskNumericKeypad"

// Kiosk overlays render over the check-in screen on a low-end tablet GPU.
// A backdrop blur there is recomputed on every keypress and causes jank
// (docs/ops/kiosk-performance-report.md).
const KIOSK_OVERLAY_FILES = [
  "components/front/checkin/KioskPinModal.tsx",
  "components/front/checkin/PhoneSignInModal.tsx",
  "components/front/checkin/NativeTapToPayPopup.tsx",
  "components/front/checkin/KioskResolvingOverlay.tsx",
  "components/front/checkin/KioskQuickRepeatOverlay.tsx",
  "components/front/checkin/KioskQrPaymentPanel.tsx",
  "components/front/checkin/KioskPackageOfferScreen.tsx",
  "components/front/checkin/CourseCardPanel.tsx",
  "components/front/checkin/ConsecutiveClassOffer.tsx",
  "components/front/checkin/ClientPhoneCheckIn.tsx",
  "components/front/payments/StripePaymentModal.tsx",
]

describe("kiosk overlays", () => {
  it.each(KIOSK_OVERLAY_FILES)("%s does not use backdrop blur", (file) => {
    const source = fs.readFileSync(path.join(process.cwd(), file), "utf8")
    expect(source).not.toMatch(/backdrop-blur|backdrop-filter/)
  })
})

describe("KioskNumericKeypad input handling", () => {
  let container: HTMLDivElement
  let root: Root
  const onDigit = vi.fn()
  const onBackspace = vi.fn()
  const onClear = vi.fn()

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    onDigit.mockReset()
    onBackspace.mockReset()
    onClear.mockReset()
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  const render = (disabled = false) =>
    act(() => {
      root.render(
        <KioskNumericKeypad
          onDigit={onDigit}
          onBackspace={onBackspace}
          onClear={onClear}
          disabled={disabled}
          captureKeyboard={false}
        />
      )
    })

  const button = (label: string) =>
    Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === label || b.getAttribute("aria-label") === label
    ) as HTMLButtonElement

  const pointer = (el: HTMLElement, type: string, button = 0) =>
    act(() => {
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, button }))
    })

  const pointerDown = (el: HTMLElement) => pointer(el, "pointerdown")
  const pointerUp = (el: HTMLElement) => pointer(el, "pointerup")
  const tap = (el: HTMLElement) => {
    pointerDown(el)
    pointerUp(el)
  }

  const tapClick = (el: HTMLElement) =>
    act(() => {
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }))
    })

  it("shows the pressed state on pointerdown without entering the digit", () => {
    render()
    pointerDown(button("7"))
    expect(onDigit).not.toHaveBeenCalled()
    expect(button("7").className).toContain("scale-[0.98]")
  })

  it("enters the digit on pointerup and ignores the click that follows the tap", () => {
    render()
    tap(button("7"))
    expect(onDigit).toHaveBeenCalledTimes(1)
    expect(onDigit).toHaveBeenCalledWith("7")
    tapClick(button("7"))
    expect(onDigit).toHaveBeenCalledTimes(1)
  })

  it("fires clear and backspace on pointerup", () => {
    render()
    tap(button("Clear"))
    tap(button("Delete last digit"))
    expect(onClear).toHaveBeenCalledTimes(1)
    expect(onBackspace).toHaveBeenCalledTimes(1)
  })

  it("does not enter the digit when the finger slides off the key", () => {
    render()
    pointerDown(button("4"))
    act(() => {
      button("4").dispatchEvent(
        new MouseEvent("pointerout", { bubbles: true, relatedTarget: document.body })
      )
    })
    pointerUp(button("4"))
    expect(onDigit).not.toHaveBeenCalled()
    expect(button("4").className).not.toContain("scale-[0.98]")
  })

  it("does not enter the digit when the gesture is cancelled", () => {
    render()
    pointerDown(button("4"))
    pointer(button("4"), "pointercancel")
    pointerUp(button("4"))
    expect(onDigit).not.toHaveBeenCalled()
  })

  it("activates keys from a click that had no pointer sequence", () => {
    render()
    tapClick(button("8"))
    expect(onDigit).toHaveBeenCalledTimes(1)
    expect(onDigit).toHaveBeenCalledWith("8")
  })

  it("still activates keys from keyboard clicks (detail 0)", () => {
    render()
    act(() => button("3").click())
    act(() => button("Delete last digit").click())
    expect(onDigit).toHaveBeenCalledWith("3")
    expect(onDigit).toHaveBeenCalledTimes(1)
    expect(onBackspace).toHaveBeenCalledTimes(1)
  })

  it("ignores non-primary mouse buttons and disabled keys", () => {
    render()
    pointer(button("5"), "pointerdown", 2)
    pointer(button("5"), "pointerup", 2)
    expect(onDigit).not.toHaveBeenCalled()
    render(true)
    tap(button("5"))
    expect(onDigit).not.toHaveBeenCalled()
  })

  it("keys opt out of double-tap zoom and animate only cheap properties", () => {
    render()
    for (const b of Array.from(container.querySelectorAll("button"))) {
      expect(b.className).toContain("touch-manipulation")
      expect(b.className).not.toMatch(/(^|\s)transition(\s|$)/)
      expect(b.className).not.toMatch(/shadow-/)
    }
  })
})
