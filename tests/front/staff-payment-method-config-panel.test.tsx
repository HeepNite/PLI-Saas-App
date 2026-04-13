// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import StaffPaymentMethodConfigPanel from "@/components/front/staff/payroll/StaffPaymentMethodConfigPanel"

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
  fetch: typeof fetch
}

describe("StaffPaymentMethodConfigPanel", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  beforeEach(() => {
    testGlobal.IS_REACT_ACT_ENVIRONMENT = true
    testGlobal.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes("/api/staff/payroll/payment-methods")) {
        return new Response(JSON.stringify({
          items: [
            {
              id: "pm_1",
              name: "Bank Transfer",
              adapterType: "bank_transfer",
              currency: "ARS",
              active: true,
              configJson: { accountAlias: "pli" },
            },
          ],
        }), { status: 200 })
      }

      if (url.includes("/api/staff/payroll/payment-models")) {
        return new Response(JSON.stringify({
          items: [
            {
              id: "model_1",
              name: "Teachers ARS",
              hourlyRate: 2500,
              currency: "ARS",
              paydayWeekday: 5,
              creditCapCents: 10000,
              defaultPaymentMethodId: "pm_1",
              defaultPaymentMethod: null,
              isDefault: true,
              active: true,
            },
          ],
        }), { status: 200 })
      }

      if (url.includes("/api/staff/payroll/currencies")) {
        return new Response(JSON.stringify({
          items: [{ id: "curr_ars", code: "ARS", symbol: "$", decimals: 2, active: true }],
        }), { status: 200 })
      }

      return new Response(JSON.stringify({ error: "Not found" }), { status: 404 })
    }) as typeof fetch
  })

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount()
      })
    }

    container?.remove()
    root = null
    container = null
    vi.restoreAllMocks()
  })

  it("shows configured methods and resolves default method names from the methods payload", async () => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(<StaffPaymentMethodConfigPanel />)
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(container.textContent).toContain("Payroll config")
    expect(container.textContent).not.toContain("Owner payroll config")
    expect(container.textContent).toContain("Configured in payroll")
    expect(container.textContent).toContain("Used by: Teachers ARS")
    expect(container.textContent).not.toContain("Requests")

    const paymentModelsTab = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Payment Models"
    )

    expect(paymentModelsTab).toBeTruthy()

    await act(async () => {
      paymentModelsTab?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    expect(container.textContent).toContain("Default method: Bank Transfer")
    expect(container.textContent).not.toContain("Default method: Not set")

    expect(testGlobal.fetch).toHaveBeenCalledWith(
      "/api/staff/payroll/payment-methods",
      expect.objectContaining({ cache: "no-store" })
    )
    expect(testGlobal.fetch).toHaveBeenCalledWith(
      "/api/staff/payroll/payment-models",
      expect.objectContaining({ cache: "no-store" })
    )
  })

  it("keeps successful slices populated when one config request fails", async () => {
    testGlobal.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes("/api/staff/payroll/payment-methods")) {
        return new Response(JSON.stringify({
          items: [
            {
              id: "pm_1",
              name: "Bank Transfer",
              adapterType: "bank_transfer",
              currency: "ARS",
              active: true,
              configJson: { accountAlias: "pli" },
            },
          ],
        }), { status: 200 })
      }

      if (url.includes("/api/staff/payroll/payment-models")) {
        return new Response(JSON.stringify({
          items: [
            {
              id: "model_1",
              name: "Teachers ARS",
              hourlyRate: 2500,
              currency: "ARS",
              paydayWeekday: 5,
              creditCapCents: 10000,
              defaultPaymentMethodId: "pm_1",
              defaultPaymentMethod: null,
              isDefault: true,
              active: true,
            },
          ],
        }), { status: 200 })
      }

      if (url.includes("/api/staff/payroll/currencies")) {
        return new Response(JSON.stringify({ error: "Currencies unavailable" }), { status: 500 })
      }

      return new Response(JSON.stringify({ error: "Not found" }), { status: 404 })
    }) as typeof fetch

    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(<StaffPaymentMethodConfigPanel />)
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(container.textContent).toContain("Bank Transfer")
    expect(container.textContent).toContain("Used by: Teachers ARS")
    expect(container.textContent).toContain("Currencies unavailable")

    const paymentModelsTab = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Payment Models"
    )

    expect(paymentModelsTab).toBeTruthy()

    await act(async () => {
      paymentModelsTab?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    expect(container.textContent).toContain("Default method: Bank Transfer")
  })

  it("does not request payment change approvals from payroll config", async () => {
    testGlobal.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes("/api/staff/payroll/payment-methods")) {
        return new Response(JSON.stringify({
          items: [
            {
              id: "pm_1",
              name: "Bank Transfer",
              adapterType: "bank_transfer",
              currency: "ARS",
              active: true,
              configJson: { accountAlias: "pli" },
            },
          ],
        }), { status: 200 })
      }

      if (url.includes("/api/staff/payroll/payment-models")) {
        return new Response(JSON.stringify({
          items: [
            {
              id: "model_1",
              name: "Teachers ARS",
              hourlyRate: 2500,
              currency: "ARS",
              paydayWeekday: 5,
              creditCapCents: 10000,
              defaultPaymentMethodId: "pm_1",
              defaultPaymentMethod: null,
              isDefault: true,
              active: true,
            },
          ],
        }), { status: 200 })
      }

      if (url.includes("/api/staff/payroll/currencies")) {
        return new Response(JSON.stringify({
          items: [{ id: "curr_ars", code: "ARS", symbol: "$", decimals: 2, active: true }],
        }), { status: 200 })
      }

      return new Response(JSON.stringify({ error: "Not found" }), { status: 404 })
    }) as typeof fetch

    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(<StaffPaymentMethodConfigPanel />)
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(container.textContent).toContain("Bank Transfer")
    expect(container.textContent).toContain("Used by: Teachers ARS")
    expect(testGlobal.fetch).not.toHaveBeenCalledWith(
      "/api/staff/payroll/change-requests",
      expect.anything()
    )
  })
})
