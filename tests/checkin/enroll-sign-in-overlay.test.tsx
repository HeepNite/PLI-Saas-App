import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import EnrollSignInOverlay from "@/components/front/courses/enroll/steps/EnrollSignInOverlay"
import type { EnrollSignInOverlayProps } from "@/components/front/courses/enroll/steps/EnrollSignInOverlay"

vi.mock("@/components/front/auth/EmbeddedSignIn", () => ({
  default: ({ bare }: { bare?: boolean }) => (
    <div data-testid="embedded-sign-in" data-bare={bare ? "true" : "false"} />
  ),
}))

const baseProps: EnrollSignInOverlayProps = {
  title: "Sign in to continue",
  subtitle: "We found an existing account linked to this email.",
  variant: "compact",
  signInReturnTo: "/courses/salsa-nocturno?enroll=1&step=3",
  phoneE164: "+15555555555",
  isKioskTerminalFlow: false,
  isCheckInFlow: false,
  onDismiss: () => {},
  onSuccessAction: async () => {},
  cancelLabel: "Cancel",
  backLabel: "Go back",
}

describe("EnrollSignInOverlay — visibility", () => {
  it("renders title and subtitle", () => {
    const html = renderToStaticMarkup(<EnrollSignInOverlay {...baseProps} />)
    expect(html).toContain("Sign in to continue")
    expect(html).toContain("We found an existing account linked to this email.")
  })

  it("renders EmbeddedSignIn", () => {
    const html = renderToStaticMarkup(<EnrollSignInOverlay {...baseProps} />)
    expect(html).toContain("embedded-sign-in")
  })

  it("renders with fixed inset overlay wrapper", () => {
    const html = renderToStaticMarkup(<EnrollSignInOverlay {...baseProps} />)
    expect(html).toContain("fixed inset-0")
    expect(html).toContain("z-[10020]")
  })

  it("renders cancel button with cancelLabel text", () => {
    const html = renderToStaticMarkup(<EnrollSignInOverlay {...baseProps} cancelLabel="Close" />)
    expect(html).toContain("Close")
  })
})

describe("EnrollSignInOverlay — variant", () => {
  it("renders compact centering class when variant=compact", () => {
    const html = renderToStaticMarkup(<EnrollSignInOverlay {...baseProps} variant="compact" />)
    expect(html).toContain("items-center justify-center")
    expect(html).toContain("max-w-sm")
  })

  it("renders sheet alignment class when variant=sheet", () => {
    const html = renderToStaticMarkup(<EnrollSignInOverlay {...baseProps} variant="sheet" />)
    expect(html).toContain("items-stretch justify-end")
    expect(html).toContain("sm:max-w-md")
  })

  it("renders back link in sheet variant", () => {
    const html = renderToStaticMarkup(<EnrollSignInOverlay {...baseProps} variant="sheet" backLabel="Back to booking" />)
    expect(html).toContain("Back to booking")
  })

  it("does not render back link in compact variant", () => {
    const html = renderToStaticMarkup(<EnrollSignInOverlay {...baseProps} variant="compact" backLabel="Back to booking" />)
    expect(html).not.toContain("Back to booking")
  })
})

describe("EnrollSignInOverlay — dismiss callback wiring", () => {
  it("calls onDismiss when backdrop button is clicked", () => {
    const onDismiss = vi.fn()
    const overlay = (
      <EnrollSignInOverlay {...baseProps} onDismiss={onDismiss} />
    )
    const html = renderToStaticMarkup(overlay)
    expect(html).toContain("absolute inset-0 bg-black/70")
    expect(typeof onDismiss).toBe("function")
  })
})
