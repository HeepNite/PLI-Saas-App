// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/components/front/auth/EmbeddedSignIn", () => ({
  default: () => <div data-testid="embedded-sign-in" />,
}))

import EnrollFlowPopup from "@/components/front/courses/enroll/steps/EnrollFlowPopup"
import EnrollSignInOverlay from "@/components/front/courses/enroll/steps/EnrollSignInOverlay"

// The kiosk tablet GPU recomputes a backdrop blur on every frame
// (docs/ops/kiosk-performance-report.md), so kiosk overlays render without one
// while the web booking flow keeps it.
describe("enroll overlays backdrop blur", () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  const blurred = () =>
    Array.from(container.querySelectorAll<HTMLElement>("[class]")).filter((el) =>
      /backdrop-blur/.test(el.getAttribute("class") ?? "")
    )

  const renderSignIn = (isKioskTerminalFlow: boolean) =>
    act(() => {
      root.render(
        <EnrollSignInOverlay
          title="Sign in"
          subtitle="Confirm your phone"
          variant="compact"
          signInReturnTo="/"
          phoneE164="+15555550100"
          isKioskTerminalFlow={isKioskTerminalFlow}
          isCheckInFlow={isKioskTerminalFlow}
          onDismiss={vi.fn()}
          cancelLabel="Cancel"
          backLabel="Back"
        />
      )
    })

  it("renders the booking popup without blur when blur is off", () => {
    act(() => root.render(<EnrollFlowPopup title="T" message="M" onContinue={vi.fn()} blur={false} />))
    expect(container.textContent).toContain("Continue")
    expect(blurred()).toEqual([])
  })

  it("keeps the booking popup blur by default", () => {
    act(() => root.render(<EnrollFlowPopup title="T" message="M" onContinue={vi.fn()} />))
    expect(blurred()).toHaveLength(1)
  })

  it("renders the kiosk sign-in overlay without blur", () => {
    renderSignIn(true)
    expect(container.querySelector('[data-testid="embedded-sign-in"]')).not.toBeNull()
    expect(blurred()).toEqual([])
  })

  it("keeps the sign-in overlay blur on the web", () => {
    renderSignIn(false)
    expect(blurred()).toHaveLength(1)
  })
})
