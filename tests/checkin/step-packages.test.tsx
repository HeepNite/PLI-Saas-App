// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import StepPackages from "@/components/front/courses/enroll/steps/StepPackages"
import type { CourseEnrollmentData } from "@/components/front/courses/types"

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

testGlobal.IS_REACT_ACT_ENVIRONMENT = true

const course: CourseEnrollmentData = {
  slug: "salsa-beginner-open-level",
  title: "Salsa Beginner / Open Level",
  enrollment: {
    services: [
      { id: "new-student", label: "First class", price: 15 },
      { id: "drop-in", label: "Drop-in", price: 20 },
    ],
    packages: [{ id: "four-classes", label: "Four classes", price: 70 }],
  },
  location: { address: "PLI" },
  instructors: [],
  schedule: { day: "Friday", time: "20:00", starts: "2026-08-07" },
}

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(() => {
  act(() => root?.unmount())
  root = null
  container?.remove()
  container = null
})

describe("StepPackages", () => {
  it("uses the selected regular service price when an existing QR-mobile user chooses Drop-in", async () => {
    const setPkg = vi.fn()
    const regularService = course.enrollment.services.find((option) => option.id === "drop-in")
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(
        <StepPackages
          isCheckInNewFlow={false}
          course={course}
          pkg="four-classes"
          setPkg={setPkg}
          to12h={() => "8:00 PM"}
          time="20:00"
          formatPackageMeta={() => undefined}
          dropInPrice={regularService?.price}
        />
      )
    })

    const dropInButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Drop-in")
    )

    expect(dropInButton?.textContent).toContain("$20")
    expect(dropInButton?.textContent).not.toContain("$15")

    await act(async () => {
      dropInButton?.click()
    })

    expect(setPkg).toHaveBeenCalledWith("")
  })
  const renderStep = async (props: Partial<React.ComponentProps<typeof StepPackages>>) => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root?.render(
        <StepPackages
          isCheckInNewFlow={false}
          course={course}
          pkg=""
          setPkg={vi.fn()}
          to12h={() => "8:00 PM"}
          time="20:00"
          formatPackageMeta={() => undefined}
          {...props}
        />
      )
    })
    const dropInButton = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Drop-in"))
    return { text: container.textContent || "", dropIn: dropInButton?.textContent || "" }
  }

  it("shows the passed real price for a new student instead of a hardcoded $15", async () => {
    const { dropIn } = await renderStep({ isCheckInNewFlow: true, dropInPrice: 1 })
    expect(dropIn).toContain("$1")
    expect(dropIn).not.toContain("$15")
  })

  it("shows a fractional real price with cents (QR compact flow no longer forces $15)", async () => {
    const { dropIn } = await renderStep({ dropInPrice: 1.5 })
    expect(dropIn).toContain("$1.50")
    expect(dropIn).not.toContain("$15")
  })

  it("shows the real package price", async () => {
    const { text } = await renderStep({ dropInPrice: 1 })
    expect(text).toContain("$70")
  })

  it("shows the promotion label next to a promotional drop-in price", async () => {
    const { dropIn } = await renderStep({ dropInPrice: 0.5, promotionLabel: "October special" })
    expect(dropIn).toContain("$0.50")
    expect(dropIn).toContain("October special")
  })

  it("shows no price rather than a fake $20 when the price is missing", async () => {
    const { dropIn } = await renderStep({ dropInPrice: null })
    expect(dropIn).not.toContain("$")
  })
})
