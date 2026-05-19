// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ConsecutiveClassOffer } from "@/components/front/checkin/ConsecutiveClassOffer"

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

testGlobal.IS_REACT_ACT_ENVIRONMENT = true

const offer = {
  linkedCourseSlug: "salsa-night-beginner",
  linkedCourseTitle: "Salsa Beginner / Open Level",
  linkedCourseTime: "21:10",
  dropInConsecutiveCents: 1500,
  packageHolderConsecutiveCents: 1000,
  regularDropInCents: 2000,
  discountPercent: 50,
  hasAttendedFirstClass: true,
}

let root: Root | null = null
let container: HTMLDivElement | null = null

const renderOffer = async (
  props: Partial<React.ComponentProps<typeof ConsecutiveClassOffer>> = {}
) => {
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)

  await act(async () => {
    root?.render(
      <ConsecutiveClassOffer
        offer={offer}
        isPackageHolder
        onAccept={vi.fn()}
        onDecline={vi.fn()}
        onPayCash={vi.fn()}
        onPayCard={vi.fn()}
        {...props}
      />
    )
  })

  return container
}

afterEach(() => {
  act(() => root?.unmount())
  root = null
  container?.remove()
  container = null
})

describe("ConsecutiveClassOffer", () => {
  it("shows Processing only on No Thanks when declining", async () => {
    const view = await renderOffer({
      isProcessing: true,
      processingAction: "decline",
    })

    expect(view.textContent).toContain("Add Class")
    expect(view.textContent).toContain("Processing...")
    expect(view.textContent).not.toContain("Adding...")
  })

  it("shows Processing only on the selected payment method", async () => {
    const view = await renderOffer({
      isProcessing: true,
      processingAction: "cash",
      showPaymentSelection: true,
    })

    expect(view.textContent).toContain("Processing...")
    expect(view.textContent).toContain("Pay with Card")
    expect(view.textContent).not.toContain("Pay with Cash")
  })
})
