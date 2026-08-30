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

  it("shows the current priced class with the retained 20:10 class", async () => {
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
          priceLabel="$35.00 special class"
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

    expect(container.textContent).toContain("Bachata Intermediate")
    expect(container.textContent).toContain("9:10 PM")
    expect(container.textContent).toContain("Start current check-in")
    expect(container.querySelector('img[alt="Check-in QR code"]')).not.toBeNull()
    expect(container.textContent).toContain("Salsa Fundamentals")
    expect(container.textContent).toContain("8:10 PM")
    expect(container.querySelector('img[alt="Salsa Fundamentals QR code"]')).not.toBeNull()
    expect(container.textContent).toContain("$35.00 special class")
    expect(container.textContent).not.toContain("$20 drop-in")
    expect(container.textContent).not.toContain("$15 first time")
  })
})
