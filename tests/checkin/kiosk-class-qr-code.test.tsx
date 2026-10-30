// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import { KioskClassQrCode } from "@/components/front/checkin/KioskClassQrCode"

vi.mock("qrcode", () => ({
  toCanvas: vi.fn(async (canvas: HTMLCanvasElement, value: string) => { canvas.dataset.qrValue = value }),
}))

const roots: ReturnType<typeof createRoot>[] = []
afterEach(() => {
  roots.splice(0).forEach((root) => root.unmount())
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe("KioskClassQrCode", () => {
  it("waits for a matching grant and renders the signed URL locally", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ grant: "signed.grant", expiresAt: "2099-10-23T23:00:00.000Z" }), { status: 200 })))
    const container = document.createElement("div")
    const root = createRoot(container)
    roots.push(root)
    await act(async () => {
      root.render(<KioskClassQrCode url="https://pli.test/checkin?courseSlug=salsa&date=2026-10-23&time=19%3A00" size={180} />)
      await Promise.resolve()
    })
    expect(fetch).toHaveBeenCalledWith("/api/checkin/qr/cash-grant", expect.objectContaining({ method: "POST", body: JSON.stringify({ courseSlug: "salsa", date: "2026-10-23", time: "19:00" }) }))
    await act(async () => { await Promise.resolve() })
    expect(container.querySelector("canvas")?.dataset.qrValue).toContain("kioskQrCashGrant=signed.grant")
  })

  it("keeps a special-class public QR scannable without minting cash authority", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const container = document.createElement("div")
    const root = createRoot(container)
    roots.push(root)
    const url = `${window.location.origin}/special-classes/special-salsa-tuesday`

    await act(async () => {
      root.render(<KioskClassQrCode url={url} size={180} />)
      await Promise.resolve()
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(container.querySelector("canvas")?.dataset.qrValue).toBe(url)
  })

  it("does not render a cross-origin grantless special-class URL", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const container = document.createElement("div")
    const root = createRoot(container)
    roots.push(root)

    await act(async () => {
      root.render(<KioskClassQrCode url="https://evil.example/special-classes/phish" size={180} />)
      await Promise.resolve()
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(container.querySelector("canvas")).toBeNull()
    expect(container.textContent).toContain("Preparing QR…")
  })

  it.each(["/courses/public-salsa", "/checkin", "not a public QR URL"])(
    "hides arbitrary grantless URL %s",
    async (url) => {
      const fetchMock = vi.fn()
      vi.stubGlobal("fetch", fetchMock)
      const container = document.createElement("div")
      const root = createRoot(container)
      roots.push(root)

      await act(async () => {
        root.render(<KioskClassQrCode url={url} size={180} />)
        await Promise.resolve()
      })

      expect(fetchMock).not.toHaveBeenCalled()
      expect(container.querySelector("canvas")).toBeNull()
    },
  )

  it("hides the QR when its grant expires while refresh is pending", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-23T20:00:00.000Z"))
    let calls = 0
    vi.stubGlobal("fetch", vi.fn(() => {
      calls += 1
      return calls === 1
        ? Promise.resolve(new Response(JSON.stringify({ grant: "grant-a", expiresAt: "2026-10-23T20:01:00.000Z" }), { status: 200 }))
        : new Promise<Response>(() => {})
    }))
    const container = document.createElement("div")
    const root = createRoot(container)
    roots.push(root)
    await act(async () => {
      root.render(<KioskClassQrCode url="https://pli.test/checkin?courseSlug=a&date=2026-10-23&time=19%3A00" size={180} />)
      await Promise.resolve()
    })
    await act(async () => { vi.advanceTimersByTime(61_000) })
    expect(calls).toBe(2)
    expect(container.querySelector("canvas")).toBeNull()
  })
})
