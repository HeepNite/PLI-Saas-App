import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import KioskQrPaymentPanel from "@/components/front/checkin/KioskQrPaymentPanel"

describe("KioskQrPaymentPanel", () => {
  it("renders the QR inside a dedicated modal overlay", () => {
    const markup = renderToStaticMarkup(
      <KioskQrPaymentPanel
        checkoutState={{
          phase: "qr_ready",
          sessionId: "cs_test_123",
          url: "https://checkout.stripe.com/pay/cs_test_123",
          expiresAt: "2026-03-24T19:30:00.000Z",
          awaitingWebhook: false,
          purchaseId: null,
          paymentStatus: null,
          error: null,
        }}
        onCancel={() => {}}
        onRetry={() => {}}
      />
    )

    expect(markup).toContain("fixed inset-0")
    expect(markup).toContain('role="dialog"')
    expect(markup).toContain("Card payment QR")
    expect(markup).toContain("Hosted checkout QR")
    expect(markup).toContain("Open checkout link")
    expect(markup).toContain("max-h-[calc(100vh-2rem)]")
    expect(markup).toContain("h-52 w-52")
  })
})
