// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { VerifyResolutionControl } from "@/components/front/staff/cards/VerifyResolutionControl"
import type { PaymentRow } from "@/components/front/staff/staffAdminTypes"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const formatMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`

const verifyRow = (overrides: Partial<PaymentRow> = {}) => ({
  id: "purchase_verify",
  courseTitle: "Salsa",
  amount: 2500,
  currency: "usd",
  verify: true,
  verifyReason: "card_declined",
  verifyResolution: null,
  ...overrides,
}) as PaymentRow

let root: Root | null = null
let container: HTMLDivElement | null = null

const render = async (payment: PaymentRow, onResolved = vi.fn()) => {
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root!.render(<VerifyResolutionControl payment={payment} formatMoney={formatMoney} onResolved={onResolved} />)
  })
  return container
}

const buttonByText = (node: HTMLElement, text: string) =>
  Array.from(node.querySelectorAll("button")).find((button) => button.textContent?.trim() === text)

const click = async (element: Element | undefined) => {
  await act(async () => {
    element!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
  })
}

const typeInto = async (element: HTMLTextAreaElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!
  await act(async () => {
    setter.call(element, value)
    element.dispatchEvent(new Event("input", { bubbles: true }))
  })
}

describe("VerifyResolutionControl", () => {
  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    vi.unstubAllGlobals()
  })

  it("renders nothing for a row that is not in Verify and has no resolution", async () => {
    const node = await render(verifyRow({ verify: false, verifyReason: null }))
    expect(node.querySelector("button")).toBeNull()
    expect(node.textContent).toBe("")
  })

  it("offers Collected and Dismiss on a verify row with its amount and reason", async () => {
    const node = await render(verifyRow())
    expect(node.textContent).toContain("Salsa")
    expect(node.textContent).toContain("$25.00")
    expect(node.textContent).toContain("Card declined")
    expect(buttonByText(node, "Collected")).toBeDefined()
    expect(buttonByText(node, "Dismiss")).toBeDefined()
  })

  it("asks for confirmation before marking a verify item collected", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    const onResolved = vi.fn()
    const node = await render(verifyRow(), onResolved)

    await click(buttonByText(node, "Collected"))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(node.querySelector("[role='dialog']")?.textContent).toContain("$25.00")

    await click(buttonByText(node, "Confirm"))
    expect(fetchMock).toHaveBeenCalledWith("/api/staff/payments/purchase_verify", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ action: "verify_collected" }),
    }))
    expect(onResolved).toHaveBeenCalledTimes(1)
  })

  it("requires a reason before dismissing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    const onResolved = vi.fn()
    const node = await render(verifyRow(), onResolved)

    await click(buttonByText(node, "Dismiss"))
    const confirm = buttonByText(node, "Confirm")!
    expect(confirm.disabled).toBe(true)
    const reason = node.querySelector<HTMLTextAreaElement>("textarea[aria-label='Dismiss reason']")!
    await typeInto(reason, "   ")
    expect(buttonByText(node, "Confirm")!.disabled).toBe(true)

    await typeInto(reason, "Class not taken")
    expect(buttonByText(node, "Confirm")!.disabled).toBe(false)
    await click(buttonByText(node, "Confirm"))

    expect(fetchMock).toHaveBeenCalledWith("/api/staff/payments/purchase_verify", expect.objectContaining({
      body: JSON.stringify({ action: "verify_dismissed", reason: "Class not taken" }),
    }))
    expect(onResolved).toHaveBeenCalledTimes(1)
  })

  it("shows the server error and keeps the item when the resolution fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Purchase is not in Verify" }), { status: 409 })))
    const onResolved = vi.fn()
    const node = await render(verifyRow(), onResolved)

    await click(buttonByText(node, "Collected"))
    await click(buttonByText(node, "Confirm"))

    expect(node.querySelector("[role='alert']")?.textContent).toContain("Purchase is not in Verify")
    expect(onResolved).not.toHaveBeenCalled()
  })

  it("shows who collected a resolved item and why one was dismissed, without actions", async () => {
    const collected = await render(verifyRow({
      verify: false,
      paymentChannel: "cash",
      verifyResolution: { action: "collected", by: "staff_1", byName: "Elvira", at: "2026-10-23T16:00:00.000Z", reason: null },
    }))
    expect(collected.textContent).toContain("Collected by Elvira")
    expect(collected.querySelector("button")).toBeNull()
    await act(async () => root?.unmount())
    container?.remove()

    const dismissed = await render(verifyRow({
      verify: false,
      verifyResolution: { action: "dismissed", by: "staff_1", byName: "Elvira", at: "2026-10-23T16:00:00.000Z", reason: "Class not taken" },
    }))
    expect(dismissed.textContent).toContain("Dismissed: Class not taken")
    expect(dismissed.querySelector("button")).toBeNull()
  })
})
