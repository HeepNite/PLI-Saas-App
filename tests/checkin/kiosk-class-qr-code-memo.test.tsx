// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const qrRenders = vi.hoisted(() => ({ values: [] as string[] }))

vi.mock("qrcode.react", () => ({
  QRCodeSVG: ({ value }: { value: string }) => {
    qrRenders.values.push(value)
    return <svg data-testid="qr" data-value={value} />
  },
}))

import { KioskClassQrCode } from "@/components/front/checkin/KioskClassQrCode"

// QRCodeSVG rebuilds its SVG path on every render, and the kiosk screens
// around the QR re-render on every poll (docs/ops/kiosk-performance-report.md).
describe("KioskClassQrCode", () => {
  let container: HTMLDivElement
  let root: Root
  const url = "/checkin/qr?courseSlug=salsa&date=2026-11-10&time=19:00"

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    qrRenders.values = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ grant: "g1", expiresAt: new Date(Date.now() + 3_600_000).toISOString() }),
      }))
    )
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  function Parent({ tick, qrUrl }: { tick: number; qrUrl: string }) {
    return (
      <div data-tick={tick}>
        <KioskClassQrCode url={qrUrl} size={160} />
      </div>
    )
  }

  it("does not redraw the QR when the parent re-renders with the same props", async () => {
    await act(async () => root.render(<Parent tick={0} qrUrl={url} />))
    expect(qrRenders.values).toHaveLength(1)
    expect(qrRenders.values[0]).toContain("kioskQrCashGrant=g1")

    for (let tick = 1; tick <= 5; tick += 1) {
      await act(async () => root.render(<Parent tick={tick} qrUrl={url} />))
    }
    expect(qrRenders.values).toHaveLength(1)
  })

  it("redraws the QR when the class URL changes", async () => {
    await act(async () => root.render(<Parent tick={0} qrUrl={url} />))
    const nextUrl = url.replace("19:00", "20:00")
    await act(async () => root.render(<Parent tick={1} qrUrl={nextUrl} />))
    expect(qrRenders.values.at(-1)).toContain("time=20%3A00")
  })
})
