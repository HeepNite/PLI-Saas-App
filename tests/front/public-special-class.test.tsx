// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import PublicSpecialClass from "@/components/front/special-classes/PublicSpecialClass"

const item = {
  slug: "public-class",
  title: "Public class",
  description: "Description",
  coverImageUrl: null,
  priceCents: 2500,
  currency: "usd",
  session: { startsAt: "2026-08-30T16:00:00.000Z", durationMinutes: 60, location: "Studio", capacity: 10 },
  availability: { remaining: 1, capacity: 10 },
}

const updateInput = async (input: HTMLInputElement, value: string) => {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
    setter?.call(input, value)
    input.dispatchEvent(new Event("input", { bubbles: true }))
  })
}

describe("PublicSpecialClass", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("submits the selected country's phone number as E.164", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url: "https://stripe.example.test/checkout" }) })
    vi.stubGlobal("fetch", fetch)
    vi.stubGlobal("crypto", { randomUUID: () => "00000000-0000-4000-8000-000000000001" })
    const container = document.createElement("div")
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => root.render(<PublicSpecialClass item={item} />))

    const country = container.querySelector('select[name="phone-country"]') as HTMLSelectElement | null
    expect(country).not.toBeNull()
    expect(Array.from(country!.options).some((option) => option.value === "US" && option.textContent?.includes("+1"))).toBe(true)
    await updateInput(container.querySelector('input[name="name"]')!, "Ada Lovelace")
    await updateInput(container.querySelector('input[name="email"]')!, "ada@example.com")
    await updateInput(container.querySelector('input[name="phone"]')!, "2075550123")
    await act(async () => {
      country!.value = "GB"
      country!.dispatchEvent(new Event("change", { bubbles: true }))
    })
    expect(country!.value).toBe("GB")
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })))

    expect(JSON.parse(fetch.mock.calls[0]?.[1]?.body as string)).toMatchObject({ phone: "+442075550123" })

    await act(async () => root.unmount())
    container.remove()
  })

  it("accepts a pasted international E.164 number", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url: "https://stripe.example.test/checkout" }) })
    vi.stubGlobal("fetch", fetch)
    vi.stubGlobal("crypto", { randomUUID: () => "00000000-0000-4000-8000-000000000001" })
    const container = document.createElement("div")
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => root.render(<PublicSpecialClass item={item} />))
    await updateInput(container.querySelector('input[name="name"]')!, "Ada Lovelace")
    await updateInput(container.querySelector('input[name="email"]')!, "ada@example.com")
    await updateInput(container.querySelector('input[name="phone"]')!, "+442070313000")
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })))

    expect(JSON.parse(fetch.mock.calls[0]?.[1]?.body as string)).toMatchObject({ phone: "+442070313000" })
    expect((container.querySelector('select[name="phone-country"]') as HTMLSelectElement).value).toBe("GB")

    await act(async () => root.unmount())
    container.remove()
  })
})
