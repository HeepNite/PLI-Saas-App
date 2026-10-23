// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { CourseCardPanel } from "@/components/front/checkin/CourseCardPanel"

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe("CourseCardPanel", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    vi.restoreAllMocks()
  })

  it("shows the current 21:10 class with the retained 20:10 class", async () => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(
        <CourseCardPanel
          cardImage="/bachata-intermediate.jpg"
          courseTitle="Bachata Intermediate"
          category="Bachata"
          badge="Intermediate"
          duration="55 min"
          students="All levels"
          description="Current class"
          teacher="Mariana"
          displayDate="2026-05-22"
          displayTime="21:10"
          qrImage="/qr/bachata-intermediate-2110.png"
          compact
          actionSlot={<button type="button">Start current check-in</button>}
          terminalPastClasses={[{
            courseSlug: "salsa-fundamentals",
            title: "Salsa Fundamentals",
            date: "2026-05-22",
            time: "20:10",
            durationMinutes: 55,
            level: "Beginner",
            category: "Salsa",
            imageUrl: "/salsa-fundamentals.jpg",
            qrImageUrl: "/qr/salsa-fundamentals-2010.png",
          }]}
        />
      )
    })

    const currentCourseHeadings = Array.from(container.querySelectorAll("p")).filter(
      (element) => element.textContent === "Current Course"
    )

    expect(currentCourseHeadings).toHaveLength(1)
    expect(container.textContent).toContain("Bachata Intermediate")
    expect(container.textContent).toContain("9:10 PM")
    expect(container.textContent).toContain("Start current check-in")
    expect(container.querySelector('[aria-label="Check-in QR code"]')).not.toBeNull()
    expect(container.textContent).toContain("Salsa Fundamentals")
    expect(container.textContent).toContain("8:10 PM")
    expect(container.querySelector('[aria-label="Salsa Fundamentals QR code"]')).not.toBeNull()
  })
  const renderPriced = async (prices?: React.ComponentProps<typeof CourseCardPanel>["prices"]) => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root?.render(
        <CourseCardPanel
          cardImage="/salsa.jpg"
          courseTitle="Salsa Timba"
          category="Salsa"
          badge="Beginner"
          duration="55 min"
          students="All levels"
          description="Current class"
          teacher="Mariana"
          displayDate="2026-10-23"
          displayTime="19:00"
          qrImage="/qr/salsa.png"
          compact
          actionSlot={<button type="button">Start</button>}
          prices={prices}
        />
      )
    })
    return container.textContent || ""
  }

  it("renders the real drop-in and first-time prices of the displayed class", async () => {
    const text = await renderPriced({ dropIn: 1, firstClass: 1.5, promotionLabel: null })
    expect(text).toContain("$1 drop-in")
    expect(text).toContain("$1.50 first time")
    expect(text).not.toContain("$20")
    expect(text).not.toContain("$15")
  })

  it("renders the promotional price with its label when a promotion applies", async () => {
    const text = await renderPriced({ dropIn: 12, firstClass: 10, promotionLabel: "October special" })
    expect(text).toContain("$12 drop-in")
    expect(text).toContain("$10 first time")
    expect(text).toContain("October special")
  })

  it("renders no price badge rather than a fake price when prices are missing", async () => {
    const text = await renderPriced(undefined)
    expect(text).not.toContain("drop-in")
    expect(text).not.toContain("first time")
  })
})
