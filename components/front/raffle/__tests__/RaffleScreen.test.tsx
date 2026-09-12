// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import RaffleScreen, { resolveDrawFailureMessage } from "@/components/front/raffle/RaffleScreen"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

describe("resolveDrawFailureMessage", () => {
  it("maps draw_in_progress to a retryable message", () => {
    expect(resolveDrawFailureMessage(409, "draw_in_progress")).toMatch(/already in progress/i)
  })

  it("maps no_eligible_entries to its own message", () => {
    expect(resolveDrawFailureMessage(409, "no_eligible_entries")).toMatch(/no eligible entries/i)
  })

  it("maps a 503 draw_failed to a server-failure message", () => {
    expect(resolveDrawFailureMessage(503, "draw_failed")).toMatch(/failed/i)
  })

  it("maps a 404 to a not-found message", () => {
    expect(resolveDrawFailureMessage(404, undefined)).toMatch(/could not be found/i)
  })

  it("falls back to a generic message for anything else", () => {
    expect(resolveDrawFailureMessage(500, undefined)).toMatch(/something went wrong/i)
  })
})

const screenStateResponse = (overrides: Record<string, unknown> = {}) => ({
  now: new Date().toISOString(),
  event: { slug: "ple-launch", title: "PLE Launch Night", entryUrl: "https://pli.test/raffle/ple-launch" },
  entryCount: 3,
  currentDrawId: "draw_1",
  draws: [
    { id: "draw_1", order: 1, prizeLabel: "Grand Prize", status: "open", drawAt: new Date(Date.now() + 200).toISOString() },
  ],
  ...overrides,
})

describe("RaffleScreen", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  async function render(slug = "ple-launch") {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root!.render(<RaffleScreen slug={slug} />))
    return container
  }

  async function flushPoll() {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
  }

  it("shows the Draw button once the countdown reaches zero and sends nothing before it is pressed", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => screenStateResponse() })
    vi.stubGlobal("fetch", fetchMock)

    const node = await render()
    await flushPoll()

    expect(node.querySelector("button")).toBeNull() // still counting down

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    const drawButton = node.querySelector("button")
    expect(drawButton?.textContent).toBe("Draw")
    // Only the polling GET happened — no draw POST fired automatically.
    expect(fetchMock.mock.calls.every(([, init]) => !init || init.method === undefined)).toBe(true)
  })

  it("ticks the rendered countdown between polls, with no poll in between", async () => {
    // R3-countdown-frozen-between-polls: drawAt is far enough out that no
    // tick reaches "ready" — only the displayed text should change.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => screenStateResponse({ draws: [{ id: "draw_1", order: 1, prizeLabel: "Grand Prize", status: "open", drawAt: new Date(Date.now() + 5_000).toISOString() }] }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const node = await render()
    await flushPoll()
    const countdownEl = node.querySelector(".tabular-nums") as HTMLElement
    const before = countdownEl.textContent

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_200) // several 250ms ticks, well under the 5s poll interval
    })

    expect(countdownEl.textContent).not.toBe(before)
    expect(fetchMock).toHaveBeenCalledTimes(1) // still no second poll — the change came from ticking, not polling
  })

  it("stays in waiting and never renders the Draw button while no draw has landed yet", async () => {
    // R3-tick-promotes-ready-without-draw: the poll is failing, so
    // selectCurrentDraw stays null across every tick.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")))

    const node = await render()
    await flushPoll()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000) // several ticks with no draw ever arriving
    })

    expect(node.querySelector("button")).toBeNull()
  })

  it("shows the winner once a draw succeeds", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ status: "drawn", drawId: "draw_1", winner: { name: "Jane Doe", phoneLast4: "1234" } }),
        })
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => screenStateResponse() })
    })
    vi.stubGlobal("fetch", fetchMock)

    const node = await render()
    await flushPoll()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    const drawButton = node.querySelector("button") as HTMLButtonElement
    await act(async () => {
      drawButton.dispatchEvent(new Event("click", { bubbles: true }))
      await Promise.resolve()
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(node.textContent).toContain("Jane Doe")
    expect(node.textContent).toContain("1234")
  })

  it("reveals only after both the video ends and the draw response arrive — video ends first", async () => {
    let resolveDraw: () => void = () => {}
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return new Promise((resolve) => {
          resolveDraw = () =>
            resolve({
              ok: true,
              status: 200,
              json: async () => ({ status: "drawn", drawId: "draw_1", winner: { name: "Jane Doe", phoneLast4: "1234" } }),
            })
        })
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => screenStateResponse() })
    })
    vi.stubGlobal("fetch", fetchMock)
    // Genuine (never-settling) playback, so the overlay only fires `onEnded`
    // when the test explicitly dispatches the native `ended` event below.
    vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(() => new Promise<void>(() => {}))

    const node = await render()
    await flushPoll()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    const drawButton = node.querySelector("button") as HTMLButtonElement
    await act(async () => {
      drawButton.dispatchEvent(new Event("click", { bubbles: true }))
      await Promise.resolve()
    })

    const video = node.querySelector("video") as HTMLVideoElement
    await act(async () => {
      video.dispatchEvent(new Event("ended"))
    })
    // Video finished, but the draw response has not arrived yet — no reveal.
    expect(node.textContent).not.toContain("Jane Doe")

    await act(async () => {
      resolveDraw()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(node.textContent).toContain("Jane Doe")
  })

  it("reveals only after both the video ends and the draw response arrive — draw response first", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ status: "drawn", drawId: "draw_1", winner: { name: "Jane Doe", phoneLast4: "1234" } }),
          })
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => screenStateResponse() })
      })
    )
    // Genuine (never-settling) playback, so the reveal must wait for the
    // explicit `ended` dispatch below even though the draw already resolved.
    vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(() => new Promise<void>(() => {}))

    const node = await render()
    await flushPoll()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    const drawButton = node.querySelector("button") as HTMLButtonElement
    await act(async () => {
      drawButton.dispatchEvent(new Event("click", { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })
    // Draw response already arrived, but the video is still "playing" — no reveal.
    expect(node.textContent).not.toContain("Jane Doe")

    const video = node.querySelector("video") as HTMLVideoElement
    await act(async () => {
      video.dispatchEvent(new Event("ended"))
    })
    expect(node.textContent).toContain("Jane Doe")
  })

  it("a rejected play() does not block the reveal once the draw response arrives", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ status: "drawn", drawId: "draw_1", winner: { name: "Jane Doe", phoneLast4: "1234" } }),
          })
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => screenStateResponse() })
      })
    )
    vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(() =>
      Promise.reject(new Error("NotAllowedError"))
    )

    const node = await render()
    await flushPoll()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    const drawButton = node.querySelector("button") as HTMLButtonElement
    await act(async () => {
      drawButton.dispatchEvent(new Event("click", { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(node.textContent).toContain("Jane Doe")
  })

  it("hides the video overlay outside a draw and shows it while one is in progress", async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        // Never resolves in this test — only the phase transition matters.
        return new Promise(() => {})
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => screenStateResponse() })
    })
    vi.stubGlobal("fetch", fetchMock)

    const node = await render()
    await flushPoll()
    expect((node.querySelector("video") as HTMLVideoElement).hidden).toBe(true)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
    const drawButton = node.querySelector("button") as HTMLButtonElement
    await act(async () => {
      drawButton.dispatchEvent(new Event("click", { bubbles: true }))
      await Promise.resolve()
    })
    expect((node.querySelector("video") as HTMLVideoElement).hidden).toBe(false)
  })

  it("shows a retry-able error on a draw failure without breaking the machine", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return Promise.resolve({ ok: false, status: 409, json: async () => ({ status: "draw_in_progress" }) })
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => screenStateResponse() })
    })
    vi.stubGlobal("fetch", fetchMock)

    const node = await render()
    await flushPoll()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    const drawButton = node.querySelector("button") as HTMLButtonElement
    await act(async () => {
      drawButton.dispatchEvent(new Event("click", { bubbles: true }))
      await Promise.resolve()
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(node.textContent).toMatch(/already in progress/i)
    // The machine returned to `ready`: the Draw button is still there for a retry.
    const retryButton = node.querySelector("button")
    expect(retryButton?.textContent).toBe("Draw")
  })

  it("renders the closing state when there is no current draw", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => screenStateResponse({ currentDrawId: null, draws: [] }) })
    vi.stubGlobal("fetch", fetchMock)

    const node = await render()
    await flushPoll()

    expect(node.textContent).toContain("Thanks for playing!")
    expect(node.querySelector("button")).toBeNull()
  })

  it("updates the displayed entry count as polling refreshes it", async () => {
    let entryCount = 3
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve({ ok: true, status: 200, json: async () => screenStateResponse({ entryCount }) })
    )
    vi.stubGlobal("fetch", fetchMock)

    const node = await render()
    await flushPoll()
    expect(node.textContent).toContain("3 entered")

    entryCount = 7
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })

    expect(node.textContent).toContain("7 entered")
  })
})
