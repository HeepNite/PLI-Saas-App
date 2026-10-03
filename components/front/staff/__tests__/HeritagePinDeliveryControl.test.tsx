import { readFileSync } from "node:fs"
import { join } from "node:path"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { HeritagePinDeliveryControl } from "@/components/front/staff/cards/HeritagePinDeliveryControl"

const pendingPin = {
  status: "pending" as const,
  countryCode: "AR",
  countryName: "Argentina",
  sourcePurchaseId: "purchase_123",
  earnedAt: "2026-10-03T12:34:26.000Z",
  deliveredAt: null,
}

describe("HeritagePinDeliveryControl", () => {
  it("renders an authorized pending pin as the complete gray flag with a focusable delivery action", () => {
    const html = renderToStaticMarkup(
      <HeritagePinDeliveryControl
        userId="user_123"
        heritagePin={pendingPin}
        canDeliver
        onDelivered={() => undefined}
      />,
    )

    expect(html).toContain("aria-label=\"Mark Argentina pin delivered\"")
    expect(html).toContain("🇦🇷")
    expect(html).toContain("data-pin-shape=\"flag\"")
    expect(html).toContain("grayscale")
    expect(html).not.toContain("rounded-full")
    expect(html).toContain("group-focus-within:opacity-100")
  })

  it("shows pending status without exposing a delivery button to unauthorized staff", () => {
    const html = renderToStaticMarkup(
      <HeritagePinDeliveryControl
        userId="user_123"
        heritagePin={pendingPin}
        canDeliver={false}
        onDelivered={() => undefined}
      />,
    )

    expect(html).toContain("aria-label=\"Argentina Heritage pin pending\"")
    expect(html).not.toContain("<button")
  })

  it("renders a delivered pin as the complete full-color earned flag", () => {
    const html = renderToStaticMarkup(
      <HeritagePinDeliveryControl
        userId="user_123"
        heritagePin={{ ...pendingPin, status: "delivered", deliveredAt: "2026-10-04T21:00:00.000Z" }}
        canDeliver
        onDelivered={() => undefined}
      />,
    )

    expect(html).toContain("aria-label=\"Argentina Heritage pin delivered\"")
    expect(html).toContain("🇦🇷")
    expect(html).toContain("data-pin-shape=\"flag\"")
    expect(html).not.toContain("grayscale")
    expect(html).not.toContain("rounded-full")
    expect(html).not.toContain("<button")
  })

  it("replaces full-width pin rows on both student-card variants", () => {
    const profileSource = readFileSync(join(process.cwd(), "components/front/staff/cards/ProfileStudentCard.tsx"), "utf8")
    const paymentSource = readFileSync(join(process.cwd(), "components/front/staff/cards/PaymentStudentCard.tsx"), "utf8")

    expect(profileSource).toContain("<HeritagePinDeliveryControl")
    expect(paymentSource).toContain("<HeritagePinDeliveryControl")
    expect(paymentSource).not.toContain("Country pin pending")
    expect(paymentSource).not.toContain("Mark ${heritagePin.countryName} pin delivered")
  })
})
