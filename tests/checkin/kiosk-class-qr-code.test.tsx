// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import { KioskClassQrCode } from "@/components/front/checkin/KioskClassQrCode"

vi.mock("qrcode.react", () => ({
  QRCodeSVG: ({ value }: { value: string }) => <div data-qr-value={value} />,
}))

const roots: ReturnType<typeof createRoot>[] = []

afterEach(() => {
  roots.splice(0).forEach((root) => root.unmount())
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe("KioskClassQrCode", () => {
  it("waits for a matching grant and renders the signed URL locally", async () => {
    let resolveGrant: ((response: Response) => void) | undefined
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { resolveGrant = resolve }))
    vi.stubGlobal("fetch", fetchMock)
    const container = document.createElement("div")
    const root = createRoot(container)
    roots.push(root)

    await act(async () => {
      root.render(<KioskClassQrCode url="https://pli.test/checkin?courseSlug=salsa&date=2026-10-23&time=19%3A00" size={180} />)
    })
    expect(container.querySelector("[data-qr-value]")).toBeNull()

    await act(async () => {
      resolveGrant?.(new Response(JSON.stringify({ grant: "signed.grant", expiresAt: "2099-10-23T23:00:00.000Z" }), { status: 200 }))
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledWith("/api/checkin/qr/cash-grant", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ courseSlug: "salsa", date: "2026-10-23", time: "19:00" }),
    }))
    expect(container.querySelector("[data-qr-value]")?.getAttribute("data-qr-value")).toContain("kioskQrCashGrant=signed.grant")
  })

  it("hides the QR when its grant expires while refresh is pending", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-23T20:00:00.000Z"))
    let calls = 0
    vi.stubGlobal("fetch", vi.fn(() => {
      calls += 1
      if (calls === 1) {
        return Promise.resolve(new Response(JSON.stringify({
          grant: "grant-a",
          expiresAt: "2026-10-23T20:01:00.000Z",
        }), { status: 200 }))
      }
      return new Promise<Response>(() => {})
    }))
    const container = document.createElement("div")
    const root = createRoot(container)
    roots.push(root)

    await act(async () => {
      root.render(<KioskClassQrCode url="https://pli.test/checkin?courseSlug=a&date=2026-10-23&time=19%3A00" size={180} />)
      await Promise.resolve()
    })
    expect(container.querySelector("[data-qr-value]")).not.toBeNull()

    await act(async () => { vi.advanceTimersByTime(61_000) })

    expect(calls).toBe(2)
    expect(container.querySelector("[data-qr-value]")).toBeNull()
  })

  it("never combines a new class URL with the previous class grant", async () => {
    const responses = [
      { grant: "grant-a", expiresAt: "2099-10-23T23:00:00.000Z" },
      { grant: "grant-b", expiresAt: "2099-10-23T23:00:00.000Z" },
    ]
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(responses.shift()), { status: 200 })))
    const container = document.createElement("div")
    const root = createRoot(container)
    roots.push(root)

    await act(async () => {
      root.render(<KioskClassQrCode url="https://pli.test/checkin?courseSlug=a&date=2026-10-23&time=19%3A00" size={180} />)
      await Promise.resolve()
    })
    await act(async () => {
      root.render(<KioskClassQrCode url="https://pli.test/checkin?courseSlug=b&date=2026-10-23&time=20%3A00" size={180} />)
    })

    expect(container.innerHTML).not.toContain("courseSlug=b&amp;date=2026-10-23&amp;time=20%3A00&amp;kioskQrCashGrant=grant-a")
  })

  it("replaces the previous timer pair and cancels both on URL change and unmount", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-23T20:00:00.000Z"))
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout")
    const expiresAt = ["2026-10-23T20:02:00.000Z", "2026-10-23T20:04:00.000Z", "2026-10-23T20:06:00.000Z"]
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({
      grant: `grant-${expiresAt.length}`,
      expiresAt: expiresAt.shift(),
    }), { status: 200 }))))
    const container = document.createElement("div")
    const root = createRoot(container)
    roots.push(root)

    await act(async () => {
      root.render(<KioskClassQrCode url="https://pli.test/checkin?courseSlug=a&date=2026-10-23&time=19%3A00" size={180} />)
      await Promise.resolve()
    })
    expect(vi.getTimerCount()).toBe(2)

    clearTimeoutSpy.mockClear()
    await act(async () => { await vi.advanceTimersByTimeAsync(90_000) })
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(2)

    clearTimeoutSpy.mockClear()
    await act(async () => {
      root.render(<KioskClassQrCode url="https://pli.test/checkin?courseSlug=b&date=2026-10-23&time=20%3A00" size={180} />)
      await Promise.resolve()
    })
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(2)

    clearTimeoutSpy.mockClear()
    await act(async () => { root.unmount() })
    roots.pop()
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
  })

  it("keeps the current grant while failed refreshes retry and then recovers", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-23T20:00:00.000Z"))
    const responses = [
      new Response(JSON.stringify({ grant: "grant-a", expiresAt: "2026-10-23T20:01:00.000Z" }), { status: 200 }),
      new Response(null, { status: 503 }),
      new Response(null, { status: 503 }),
      new Response(JSON.stringify({ grant: "grant-b", expiresAt: "2026-10-23T20:03:00.000Z" }), { status: 200 }),
    ]
    const fetchMock = vi.fn(async () => responses.shift() ?? new Response(null, { status: 503 }))
    vi.stubGlobal("fetch", fetchMock)
    const container = document.createElement("div")
    const root = createRoot(container)
    roots.push(root)

    await act(async () => {
      root.render(<KioskClassQrCode url="https://pli.test/checkin?courseSlug=a&date=2026-10-23&time=19%3A00" size={180} />)
      await Promise.resolve()
    })
    expect(container.querySelector("[data-qr-value]")?.getAttribute("data-qr-value")).toContain("grant-a")

    await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(container.querySelector("[data-qr-value]")?.getAttribute("data-qr-value")).toContain("grant-a")

    await act(async () => { await vi.advanceTimersByTimeAsync(5_000) })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(container.querySelector("[data-qr-value]")?.getAttribute("data-qr-value")).toContain("grant-a")

    await act(async () => { await vi.advanceTimersByTimeAsync(5_000) })
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(container.querySelector("[data-qr-value]")?.getAttribute("data-qr-value")).toContain("grant-b")
    expect(vi.getTimerCount()).toBe(2)
  })

  it("stops retrying after three consecutive grant failures", async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn(async () => new Response(null, { status: 503 }))
    vi.stubGlobal("fetch", fetchMock)
    const container = document.createElement("div")
    const root = createRoot(container)
    roots.push(root)

    await act(async () => {
      root.render(<KioskClassQrCode url="https://pli.test/checkin?courseSlug=a&date=2026-10-23&time=19%3A00" size={180} />)
      await Promise.resolve()
    })
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })

    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(vi.getTimerCount()).toBe(0)
    expect(container.querySelector("[data-qr-value]")).toBeNull()
  })

  it("does not schedule timers for a stale grant response", async () => {
    vi.useFakeTimers()
    let resolveFirst: ((response: Response) => void) | undefined
    let resolveSecond: ((response: Response) => void) | undefined
    vi.stubGlobal("fetch", vi.fn()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveFirst = resolve }))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveSecond = resolve })))
    const container = document.createElement("div")
    const root = createRoot(container)
    roots.push(root)

    await act(async () => {
      root.render(<KioskClassQrCode url="https://pli.test/checkin?courseSlug=a&date=2026-10-23&time=19%3A00" size={180} />)
    })
    await act(async () => {
      root.render(<KioskClassQrCode url="https://pli.test/checkin?courseSlug=b&date=2026-10-23&time=20%3A00" size={180} />)
    })
    await act(async () => {
      resolveFirst?.(new Response(JSON.stringify({ grant: "grant-a", expiresAt: "2026-10-23T20:02:00.000Z" }), { status: 200 }))
      await Promise.resolve()
    })

    expect(vi.getTimerCount()).toBe(0)
    expect(container.querySelector("[data-qr-value]")).toBeNull()
    expect(resolveSecond).toBeDefined()
  })
})
