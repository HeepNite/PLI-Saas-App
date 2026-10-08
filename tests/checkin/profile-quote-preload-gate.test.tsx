import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import ProfileQuotePreloadGate from "@/components/front/courses/enroll/ProfileQuotePreloadGate"

const renderGate = (
  props: Partial<React.ComponentProps<typeof ProfileQuotePreloadGate>> & { isProfileQuoteReady?: boolean } = {}
) =>
  renderToStaticMarkup(
    <ProfileQuotePreloadGate
      isProfileQuoteRequired
      isProfileQuoteReady={false}
      profileQuoteError={null}
      retryProfileQuote={vi.fn()}
      {...props}
    >
      <div>Packages local $20</div>
    </ProfileQuotePreloadGate>
  )

describe("ProfileQuotePreloadGate", () => {
  it("hides quote-sensitive children while a required quote is not ready", () => {
    const unresolved = renderGate()

    expect(unresolved).toContain("Loading price")
    expect(unresolved).not.toContain("Packages local $20")
    expect(unresolved).not.toContain("Updating price")
  })

  it("renders children only when the required quote matches the current request", () => {
    const stale = renderGate({ isProfileQuoteReady: false })
    const ready = renderGate({ isProfileQuoteReady: true })

    expect(stale).toContain("Loading price")
    expect(stale).not.toContain("Packages local $20")
    expect(ready).toContain("Packages local $20")
    expect(ready).not.toContain("Loading price")
  })

  it("shows a modal-level retry action after a quote error", () => {
    const html = renderGate({ profileQuoteError: "request failed" })

    expect(html).toContain("Price unavailable")
    expect(html).toContain("Try again")
    expect(html).not.toContain("Packages local $20")
  })

  it("renders children immediately when the profile quote is not required", () => {
    const html = renderGate({ isProfileQuoteRequired: false })

    expect(html).toContain("Packages local $20")
  })
})
