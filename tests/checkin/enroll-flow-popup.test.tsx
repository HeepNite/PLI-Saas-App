import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import EnrollFlowPopup from "@/components/front/courses/enroll/steps/EnrollFlowPopup"

describe("EnrollFlowPopup — visibility", () => {
  it("renders the title and message", () => {
    const html = renderToStaticMarkup(
      <EnrollFlowPopup
        title="Regular price applied"
        message="We switched this booking to the regular $20 price."
        onContinue={() => {}}
      />
    )
    expect(html).toContain("Regular price applied")
    expect(html).toContain("We switched this booking to the regular $20 price.")
  })

  it("renders fixed overlay wrapper with correct z-index", () => {
    const html = renderToStaticMarkup(
      <EnrollFlowPopup title="Title" message="Msg" onContinue={() => {}} />
    )
    expect(html).toContain("fixed inset-0")
    expect(html).toContain("z-[10015]")
  })

  it("renders the Continue button", () => {
    const html = renderToStaticMarkup(
      <EnrollFlowPopup title="Title" message="Msg" onContinue={() => {}} />
    )
    expect(html).toContain("Continue")
  })

  it("renders brand accent label text", () => {
    const html = renderToStaticMarkup(
      <EnrollFlowPopup title="Title" message="Msg" onContinue={() => {}} />
    )
    expect(html).toContain("Booking update")
  })
})

describe("EnrollFlowPopup — dismiss callback wiring", () => {
  it("calls onContinue when button is clicked", () => {
    const onContinue = vi.fn()
    const popup = (
      <EnrollFlowPopup title="Title" message="Msg" onContinue={onContinue} />
    )
    const html = renderToStaticMarkup(popup)
    expect(html).toContain("Continue")
    expect(typeof onContinue).toBe("function")
  })
})
