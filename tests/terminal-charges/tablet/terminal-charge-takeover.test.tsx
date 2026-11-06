// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { TERMINAL_CHARGE_COLLECT_DEADLINE_MS, TerminalChargeTakeover } from "@/components/front/staff/terminal-charge/TerminalChargeTakeover"
import { TERMINAL_CHARGE_POLL_TIMEOUT_MS } from "@/components/front/staff/terminal-charge/useTerminalChargePoll"
import { TERMINAL_CHARGE_POLL_MS } from "@/lib/terminal-charges/contract"
import { PENDING_URL, PREPARED_REFERENCE, advance, installBridge, installFetch, makeCharge, removeBridge, setVisibility } from "./helpers"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root | null = null
let container: HTMLDivElement
const onReturnHome = vi.fn()
const onActiveChange = vi.fn()

async function mount() {
  container = document.body.appendChild(document.createElement("div"))
  root = createRoot(container)
  await act(async () => root?.render(<TerminalChargeTakeover onReturnHome={onReturnHome} onActiveChange={onActiveChange} />))
  await advance(0)
}
const dialog = () => container.querySelector("[data-terminal-charge-takeover]")
const text = () => dialog()?.textContent ?? ""
const button = (label: string) => Array.from(container.querySelectorAll("button")).find((candidate) => candidate.textContent === label)
const click = async (label: string) => {
  await act(async () => button(label)?.click())
  await advance(0)
}
const expectHome = () => {
  expect(dialog()).toBeNull()
  expect(onReturnHome).toHaveBeenCalledOnce()
}

beforeEach(() => {
  vi.useFakeTimers()
  setVisibility("visible")
})
afterEach(async () => {
  if (root) await act(async () => root?.unmount())
  container.remove()
  root = null
  removeBridge()
  onReturnHome.mockReset()
  onActiveChange.mockReset()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("TerminalChargeTakeover", () => {
  it("takes over the screen with the payer, items and total, prepares once and hands the reference to the reader", async () => {
    const { requests } = installBridge({ pollStates: ["pending"] })
    const fetch = installFetch({ pending: makeCharge() })
    await mount()
    await advance(TERMINAL_CHARGE_POLL_MS * 3)
    expect(dialog()?.getAttribute("aria-modal")).toBe("true")
    for (const part of ["Ana Payer", "Outstanding — Salsa", "$20", "Extra classes", "$60", "$80", "Follow the instructions"]) expect(text()).toContain(part)
    expect(fetch.callsTo("/prepare")).toHaveLength(1)
    expect(requests.find((request) => request.operation === "startPreparedPurchase")?.payload).toEqual({ preparedPurchaseReference: PREPARED_REFERENCE })
    expect(onActiveChange).toHaveBeenLastCalledWith(true)
  })

  it("shows success for 3 s after the reader reports paid, then returns home without reporting a result", async () => {
    installBridge({ pollStates: ["paid"] })
    const fetch = installFetch({ pending: makeCharge() })
    await mount()
    await advance(10)
    expect(text()).toContain("Payment complete")
    await advance(3_000)
    expectHome()
    expect(fetch.callsTo("/result")).toHaveLength(0)
    expect(onActiveChange).toHaveBeenLastCalledWith(false)
  })

  it("reports a declined card, shows it for 4 s, then returns home", async () => {
    installBridge({ pollStates: ["rejected"] })
    const fetch = installFetch({ pending: makeCharge() })
    await mount()
    await advance(10)
    expect(fetch.callsTo("/result").map((call) => call.body)).toEqual([{ outcome: "declined" }])
    expect(text()).toContain("Card declined")
    await advance(4_000)
    expectHome()
  })

  it("keeps a declined card on screen when the report fails and retries it while polling (T4)", async () => {
    installBridge({ pollStates: ["rejected"] })
    const fetch = installFetch({ pending: makeCharge() })
    fetch.state.resultConflict = "Payment received, finishing up"
    await mount()
    await advance(10)
    for (let poll = 0; poll < 2; poll += 1) await advance(TERMINAL_CHARGE_POLL_MS)
    expect(text()).toContain("Payment received, finishing up")
    expect(onReturnHome).not.toHaveBeenCalled()
    expect(fetch.callsTo("/result")).toHaveLength(3)
    fetch.state.resultConflict = null
    await advance(TERMINAL_CHARGE_POLL_MS)
    await advance(4_000)
    expectHome()
  })

  it("says the reader didn't respond when it rejects the hand-off, without reporting a decline (T3)", async () => {
    installBridge({ startState: "rejected" })
    const fetch = installFetch({ pending: makeCharge() })
    await mount()
    await advance(10)
    expect(text()).toContain("The card reader didn't respond")
    expect(fetch.callsTo("/result")).toHaveLength(0)
    await click("Cancel")
    expect(fetch.callsTo("/result").map((call) => call.body)).toEqual([{ outcome: "cancelled" }])
  })

  it("gives up on a hung prepare after 8 s and offers Cancel (T1)", async () => {
    installBridge()
    installFetch({ pending: makeCharge() })
    const routed = globalThis.fetch
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => String(input).endsWith("/prepare")
      ? new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))))
      : routed(input, init)))
    await mount()
    expect(text()).toContain("Preparing card reader")
    await advance(8_000)
    expect(text()).toContain("We couldn't start the card reader")
    expect(button("Cancel")).toBeDefined()
  })

  it("returns home when the tablet loses its terminal session (T2)", async () => {
    removeBridge()
    installFetch({ pending: makeCharge() })
    await mount()
    expect(dialog()).not.toBeNull()
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ error: "Terminal session required" }) })))
    await advance(TERMINAL_CHARGE_POLL_MS)
    expectHome()
  })

  it.each([
    ["cancels or expires it", makeCharge({ status: "cancelled" })],
    ["drops it", null],
  ])("returns home and stops reading the reader when the server %s while collecting (F7)", async (_label, next) => {
    const reader = installBridge({ pollStates: ["pending"] })
    const fetch = installFetch({ pending: makeCharge() })
    await mount()
    await advance(10)
    fetch.state.pending = next
    await advance(TERMINAL_CHARGE_POLL_MS)
    expectHome()
    const polls = reader.readerPolls()
    await advance(5_000)
    expect(reader.readerPolls()).toBe(polls)
  })

  it("shows success when the webhook marks a collecting charge paid (F7)", async () => {
    installBridge({ pollStates: ["pending"] })
    const fetch = installFetch({ pending: makeCharge() })
    await mount()
    await advance(10)
    fetch.state.pending = makeCharge({ status: "paid" })
    await advance(TERMINAL_CHARGE_POLL_MS)
    expect(text()).toContain("Payment complete")
    await advance(3_000)
    expectHome()
  })

  it("without a native bridge says the reader is unavailable, never prepares, and lets the tablet cancel", async () => {
    removeBridge()
    const fetch = installFetch({ pending: makeCharge() })
    await mount()
    expect(text()).toContain("Card reader unavailable on this device")
    expect(fetch.callsTo("/prepare")).toHaveLength(0)
    await click("Cancel")
    expect(fetch.callsTo("/result").map((call) => call.body)).toEqual([{ outcome: "cancelled" }])
    expectHome()
  })

  it("keeps the charge on screen with the server's reason when the tablet cancel is refused (F10)", async () => {
    removeBridge()
    const fetch = installFetch({ pending: makeCharge() })
    fetch.state.resultConflict = "This charge is not being collected"
    await mount()
    await click("Cancel")
    expect(text()).toContain("This charge is not being collected")
    expect(onReturnHome).not.toHaveBeenCalled()
    fetch.state.pending = null
    await advance(TERMINAL_CHARGE_POLL_MS)
    expectHome()
  })

  it("offers Cancel charge after 30 s of confirming a payment and returns home once cancelled", async () => {
    installBridge({ pollStates: ["pending"] })
    const fetch = installFetch({ pending: makeCharge({ status: "collecting" }) }) // reloaded mid-collection
    await mount()
    expect(text()).toContain("Confirming payment")
    await advance(29_000)
    expect(button("Cancel charge")).toBeUndefined()
    await advance(1_000)
    await click("Cancel charge")
    expect(fetch.callsTo("/result").map((call) => call.body)).toEqual([{ outcome: "cancelled" }])
    expectHome()
  })

  it("stops following the reader after 3 minutes and moves to confirming the payment (F9)", async () => {
    const reader = installBridge({ pollStates: ["pending"] })
    installFetch({ pending: makeCharge() })
    await mount()
    await advance(TERMINAL_CHARGE_COLLECT_DEADLINE_MS + 1_000)
    expect(text()).toContain("Confirming payment")
    const polls = reader.readerPolls()
    await advance(5_000)
    expect(reader.readerPolls()).toBe(polls)
  })

  it("stops following the reader once unmounted (F9)", async () => {
    const reader = installBridge({ pollStates: ["pending"] })
    installFetch({ pending: makeCharge() })
    await mount()
    await advance(10)
    await act(async () => root?.unmount())
    root = null
    const polls = reader.readerPolls()
    await advance(5_000)
    expect(reader.readerPolls()).toBe(polls)
  })

  it("keeps polling when a pending-charge request hangs (F8)", async () => {
    removeBridge()
    const fetch = installFetch({ pending: makeCharge() })
    const routed = globalThis.fetch
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) !== PENDING_URL || fetch.state.calls.length > 0) return routed(input, init)
      fetch.state.calls.push({ url: PENDING_URL, method: "GET", body: undefined })
      return new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))))
    }))
    await mount()
    expect(dialog()).toBeNull()
    await advance(TERMINAL_CHARGE_POLL_TIMEOUT_MS + TERMINAL_CHARGE_POLL_MS)
    expect(dialog()).not.toBeNull()
  })

  it("pauses polling while the page is hidden and resumes when visible", async () => {
    removeBridge()
    const fetch = installFetch({ pending: null })
    await mount()
    setVisibility("hidden")
    await advance(TERMINAL_CHARGE_POLL_MS * 4)
    expect(fetch.callsTo(PENDING_URL)).toHaveLength(1)
    setVisibility("visible")
    await advance(TERMINAL_CHARGE_POLL_MS)
    expect(fetch.callsTo(PENDING_URL)).toHaveLength(3)
  })
})
