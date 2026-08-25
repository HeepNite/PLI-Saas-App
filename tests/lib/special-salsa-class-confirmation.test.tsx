import { beforeEach, describe, expect, it, vi } from "vitest"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

const mockRetrieve = vi.fn()
const mockFindPurchase = vi.fn()
const mockPurchaseWrite = vi.fn()

vi.mock("stripe", () => ({
  default: class Stripe {
    checkout = { sessions: { retrieve: (...args: unknown[]) => mockRetrieve(...args) } }
  },
}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    purchase: {
      findUnique: (...args: unknown[]) => mockFindPurchase(...args),
      update: (...args: unknown[]) => mockPurchaseWrite(...args),
      create: (...args: unknown[]) => mockPurchaseWrite(...args),
      upsert: (...args: unknown[]) => mockPurchaseWrite(...args),
    },
  },
}))

import { resolveSpecialClassConfirmation } from "@/lib/checkout/special-class-confirmation"
import { SpecialSalsaClassConfirmation } from "@/components/front/special-salsa-class/SpecialSalsaClassConfirmation"

const paidSession = {
  id: "cs_special_123",
  payment_status: "paid",
  status: "complete",
  metadata: { specialEventKey: "special-salsa-class-2026-08-30", email: "private@example.com" },
  customer: "cus_private",
  customer_details: { phone: "+12015550123" },
}

describe("special salsa class public confirmation", () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = "sk_test"
    mockRetrieve.mockReset()
    mockFindPurchase.mockReset()
    mockPurchaseWrite.mockReset()
  })

  it("returns confirmed only for paid Stripe state plus durable Purchase", async () => {
    mockRetrieve.mockResolvedValue(paidSession)
    mockFindPurchase.mockResolvedValue({ status: "paid" })
    await expect(resolveSpecialClassConfirmation("cs_special_123")).resolves.toEqual({ state: "confirmed" })
  })

  it("returns finalizing when payment is paid before durable webhook persistence", async () => {
    mockRetrieve.mockResolvedValue(paidSession)
    mockFindPurchase.mockResolvedValue({ status: "pending" })
    await expect(resolveSpecialClassConfirmation("cs_special_123")).resolves.toEqual({ state: "finalizing" })
  })

  it.each([
    [{ ...paidSession, payment_status: "unpaid", status: "open" }, "not-confirmed"],
    [{ ...paidSession, payment_status: "unpaid", status: "expired" }, "unavailable"],
    [{ ...paidSession, metadata: { specialEventKey: "other-event" } }, "unavailable"],
  ] as const)("maps non-paid or wrong-event sessions without disclosure", async (session, state) => {
    mockRetrieve.mockResolvedValue(session)
    await expect(resolveSpecialClassConfirmation("cs_special_123")).resolves.toEqual({ state })
    expect(mockPurchaseWrite).not.toHaveBeenCalled()
  })

  it("returns unavailable for missing or malformed sessions and performs no fulfillment write", async () => {
    mockRetrieve.mockRejectedValue(new Error("not found"))
    await expect(resolveSpecialClassConfirmation("cs_missing")).resolves.toEqual({ state: "unavailable" })
    await expect(resolveSpecialClassConfirmation("not-a-session")).resolves.toEqual({ state: "unavailable" })
    expect(mockPurchaseWrite).not.toHaveBeenCalled()
  })

  it("renders safe outcome and refund copy without PII or raw identifiers", () => {
    const html = renderToStaticMarkup(<SpecialSalsaClassConfirmation state="confirmed" />)
    expect(html).toContain("Reservation confirmed")
    expect(html).toContain("Salsa de Cali")
    expect(html).not.toContain("Special Salsa Caleña Class")
    expect(html).not.toContain("America/New_York")
    expect(html).toContain("Eligible refunds are handled manually by PLI staff")
    expect(html).not.toContain("private@example.com")
    expect(html).not.toContain("+12015550123")
    expect(html).not.toContain("cus_private")
    expect(html).not.toContain("clerk_")
    expect(html).not.toContain("<main")
    expect(html).toContain("autofocus=\"\"")
  })
})
