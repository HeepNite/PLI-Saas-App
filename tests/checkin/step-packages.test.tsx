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
})
