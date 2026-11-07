// @vitest-environment jsdom

import React, { act, useEffect } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import StaffTerminalShell from "@/components/front/staff/StaffTerminalShell"
import { advance, installBridge, installFetch, makeCharge, PENDING_URL, removeBridge, setVisibility } from "./helpers"

const kiosk = vi.hoisted(() => ({ mounts: 0 }))
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }))
vi.mock("@/components/front/checkin/CheckInQrClient", () => ({
  default: function MockCheckInQrClient() {
    useEffect(() => {
      kiosk.mounts += 1
    }, [])
    return <div data-kiosk-home>Kiosk home</div>
  },
}))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root
let container: HTMLDivElement
const takeover = () => container.querySelector("[data-terminal-charge-takeover]")

beforeEach(async () => {
  vi.useFakeTimers()
  setVisibility("visible")
  kiosk.mounts = 0
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  removeBridge()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const mountShell = async (props: { terminalChargesEnabled?: boolean } = { terminalChargesEnabled: true }) => {
  container = document.body.appendChild(document.createElement("div"))
  root = createRoot(container)
  const terminal = { id: "terminal-1", slug: "front-desk", name: "Front Desk", location: "Studio", defaultCourseSlug: "salsa" }
  await act(async () => root.render(<StaffTerminalShell terminal={terminal} {...props} />))
  await advance(0)
}

/** The React key of the mounted CheckInQrClient, read from its rendered node's fiber. */
const kioskKey = () => {
  const node = container.querySelector("[data-kiosk-home]") as unknown as Record<string, { return: { key: string | null } }>
  return node[Object.keys(node).find((name) => name.startsWith("__reactFiber$"))!].return.key
}

it("renders exactly the origin/main kiosk on a tablet not enabled for charges: no polling, unprefixed key", async () => {
  const fetch = installFetch({ pending: makeCharge() })
  await mountShell({})
  await advance(10_000)
  expect(fetch.state.calls.some((call) => call.url === PENDING_URL)).toBe(false)
  expect([takeover(), kioskKey()]).toEqual([null, "default"])
})

it("shows the normal kiosk with no takeover when no charge is pending", async () => {
  const fetch = installFetch({ pending: null })
  await mountShell()
  expect(container.querySelector("[data-kiosk-home]")).not.toBeNull()
  expect(takeover()).toBeNull()
  expect(fetch.callsTo(PENDING_URL).length).toBeGreaterThan(0)
})

it("returns the kiosk to its start screen after a paid charge", async () => {
  installBridge({ pollStates: ["paid"] })
  installFetch({ pending: makeCharge() })
  await mountShell()
  expect(takeover()).not.toBeNull()
  const mountsBefore = kiosk.mounts
  await advance(3_100)
  expect(takeover()).toBeNull()
  expect(kiosk.mounts).toBe(mountsBefore + 1)
})
