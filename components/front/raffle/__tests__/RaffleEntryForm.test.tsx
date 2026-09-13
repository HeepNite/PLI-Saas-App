// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import RaffleEntryForm, {
  buildRaffleEntryPayload,
  GENERIC_ERROR_MESSAGE,
  NAME_FIELD_ERROR_MESSAGE,
  PHONE_FIELD_ERROR_MESSAGE,
  RATE_LIMITED_MESSAGE,
  resolveRaffleEntrySubmitOutcome,
} from "@/components/front/raffle/RaffleEntryForm"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

describe("resolveRaffleEntrySubmitOutcome", () => {
  it("maps a 201 entered response to a success outcome", () => {
    expect(resolveRaffleEntrySubmitOutcome(201, { status: "entered" })).toEqual({
      kind: "success",
      state: "entered",
    })
  })

  it("maps a 200 already_entered response to a success outcome", () => {
    expect(resolveRaffleEntrySubmitOutcome(200, { status: "already_entered" })).toEqual({
      kind: "success",
      state: "already_entered",
    })
  })

  it("maps a 410 event_closed response to a closed outcome", () => {
    expect(resolveRaffleEntrySubmitOutcome(410, { status: "event_closed" })).toEqual({ kind: "closed" })
  })

  it("maps invalid_name to a name field error", () => {
    expect(resolveRaffleEntrySubmitOutcome(400, { status: "invalid_name" })).toEqual({
      kind: "field_error",
      errors: { name: NAME_FIELD_ERROR_MESSAGE },
    })
  })

  it("maps invalid_phone to a phone field error", () => {
    expect(resolveRaffleEntrySubmitOutcome(400, { status: "invalid_phone" })).toEqual({
      kind: "field_error",
      errors: { phone: PHONE_FIELD_ERROR_MESSAGE },
    })
  })

  it("maps invalid_body to both field errors", () => {
    expect(resolveRaffleEntrySubmitOutcome(400, { status: "invalid_body" })).toEqual({
      kind: "field_error",
      errors: { name: NAME_FIELD_ERROR_MESSAGE, phone: PHONE_FIELD_ERROR_MESSAGE },
    })
  })

  it("maps a 429 response to the rate-limited generic error", () => {
    expect(resolveRaffleEntrySubmitOutcome(429, { status: "rate_limited" })).toEqual({
      kind: "error",
      message: RATE_LIMITED_MESSAGE,
    })
  })

  it("maps an unrecognized response to the generic error", () => {
    expect(resolveRaffleEntrySubmitOutcome(500, null)).toEqual({ kind: "error", message: GENERIC_ERROR_MESSAGE })
  })
})

describe("buildRaffleEntryPayload", () => {
  it("trims name and phone before building the payload", () => {
    expect(buildRaffleEntryPayload("  Jane Doe  ", " 5551234567 ", "US")).toEqual({
      name: "Jane Doe",
      phone: "5551234567",
      country: "US",
    })
  })
})

describe("RaffleEntryForm", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  async function render(props: React.ComponentProps<typeof RaffleEntryForm>) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root!.render(<RaffleEntryForm {...props} />))
    return container
  }

  // React tracks the last value it set on a controlled input, so assigning
  // `.value` directly (the instance property) is silently ignored by its
  // change-detection when the subsequent "input" event fires. Writing
  // through the native prototype setter first (same trick React Testing
  // Library's fireEvent uses internally) makes the dispatched event carry a
  // value React actually treats as a change.
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  )!.set!

  const typeInto = (input: HTMLInputElement, value: string) => {
    nativeInputValueSetter.call(input, value)
    input.dispatchEvent(new Event("input", { bubbles: true }))
  }

  const fillAndSubmit = async (node: HTMLElement, name: string, phone: string) => {
    const nameInput = node.querySelector('input[autocomplete="name"]') as HTMLInputElement
    const phoneInput = node.querySelector('input[type="tel"]') as HTMLInputElement
    await act(async () => {
      typeInto(nameInput, name)
      typeInto(phoneInput, phone)
    })
    const form = node.querySelector("form") as HTMLFormElement
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    })
  }

  it("submits the trimmed name and phone to the entries endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 201,
      json: async () => ({ status: "entered" }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const node = await render({ slug: "ple-launch", eventTitle: "PLE Launch Night" })
    await fillAndSubmit(node, "  Jane Doe  ", " 5551234567 ")

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("/api/raffle/ple-launch/entries")
    expect(JSON.parse(init.body)).toEqual({ name: "Jane Doe", phone: "5551234567", country: "US" })
  })

  it("gives country and phone distinct full-width rows and accessible labels", async () => {
    const node = await render({ slug: "ple-launch", eventTitle: "PLE Launch Night" })
    const country = node.querySelector("select")!
    const phone = node.querySelector('input[type="tel"]') as HTMLInputElement
    expect(country.labels?.[0].textContent).toContain("Country / calling code")
    expect(phone.labels?.[0].textContent).toBe("Phone")
    expect(country.closest("label")).not.toBe(phone.closest("label"))
    expect(country.compareDocumentPosition(phone) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    for (const control of [country, phone]) {
      expect(control.classList.contains("w-full")).toBe(true)
      expect(control.classList.contains("min-h-11")).toBe(true)
      expect(control.closest("label")?.classList.contains("block")).toBe(true)
    }
  })

  it("hides the form and shows a success message once entered", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ status: 201, json: async () => ({ status: "entered" }) })
    )

    const node = await render({ slug: "ple-launch", eventTitle: "PLE Launch Night" })
    await fillAndSubmit(node, "Jane Doe", "5551234567")

    expect(node.querySelector("form")).toBeNull()
    expect(node.textContent).toContain("You're entered!")
  })

  it("hides the form and shows the already-entered message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ status: 200, json: async () => ({ status: "already_entered" }) })
    )

    const node = await render({ slug: "ple-launch", eventTitle: "PLE Launch Night" })
    await fillAndSubmit(node, "Jane Doe", "5551234567")

    expect(node.querySelector("form")).toBeNull()
    expect(node.textContent).toContain("already entered")
  })

  it("shows the closed message and no form when the event is closed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ status: 410, json: async () => ({ status: "event_closed" }) })
    )

    const node = await render({ slug: "ple-launch", eventTitle: "PLE Launch Night" })
    await fillAndSubmit(node, "Jane Doe", "5551234567")

    expect(node.querySelector("form")).toBeNull()
    expect(node.textContent).toContain("closed")
  })

  it("renders as closed immediately when initiallyClosed is true, without calling fetch", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const node = await render({ slug: "ple-launch", eventTitle: "PLE Launch Night", initiallyClosed: true })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(node.querySelector("form")).toBeNull()
    expect(node.textContent).toContain("closed")
  })

  it("renders an inline validation error and keeps the form visible", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ status: 400, json: async () => ({ status: "invalid_phone" }) })
    )

    const node = await render({ slug: "ple-launch", eventTitle: "PLE Launch Night" })
    await fillAndSubmit(node, "Jane Doe", "1")

    expect(node.querySelector("form")).not.toBeNull()
    expect(node.textContent).toContain(PHONE_FIELD_ERROR_MESSAGE)
  })

  it("shows a generic error with the form still available to retry", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")))

    const node = await render({ slug: "ple-launch", eventTitle: "PLE Launch Night" })
    await fillAndSubmit(node, "Jane Doe", "5551234567")

    expect(node.textContent).toContain(GENERIC_ERROR_MESSAGE)
    expect(node.querySelector("form")).not.toBeNull()
    expect(node.querySelector('button[type="submit"]')).not.toBeNull()
  })
})
