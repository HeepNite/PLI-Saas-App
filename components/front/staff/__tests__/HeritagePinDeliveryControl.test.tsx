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
  it("offers authorized staff the pending country-pin delivery action", () => {
    const html = renderToStaticMarkup(
      <HeritagePinDeliveryControl
        userId="user_123"
        heritagePin={pendingPin}
        canDeliver
        onDelivered={() => undefined}
      />,
    )

    expect(html).toContain("Mark Argentina pin delivered")
  })

  it("stays hidden without delivery authority", () => {
    const html = renderToStaticMarkup(
      <HeritagePinDeliveryControl
        userId="user_123"
        heritagePin={pendingPin}
        canDeliver={false}
        onDelivered={() => undefined}
      />,
    )

    expect(html).toBe("")
  })

  it("is mounted by both profile and payment-backed student cards", () => {
    const profileSource = readFileSync(join(process.cwd(), "components/front/staff/cards/ProfileStudentCard.tsx"), "utf8")
    const paymentSource = readFileSync(join(process.cwd(), "components/front/staff/cards/PaymentStudentCard.tsx"), "utf8")

    expect(profileSource).toContain("<HeritagePinDeliveryControl")
    expect(paymentSource).toContain("<HeritagePinDeliveryControl")
    expect(paymentSource).toContain("Country pin pending")
  })
})
