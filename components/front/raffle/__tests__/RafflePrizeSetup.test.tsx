// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import RafflePrizeSetup from "@/components/front/raffle/RafflePrizeSetup"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

describe("RafflePrizeSetup", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null
  const onRefresh = vi.fn()
  const onStarted = vi.fn()

  beforeEach(() => {
    onRefresh.mockReset()
    onStarted.mockReset()
  })

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  async function render() {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root!.render(
      <RafflePrizeSetup
        slug="october-30-raffle-2026"
        revision="revision_1"
        prizes={["First", "Grand Prize"]}
        entryCount={7}
        onRefresh={onRefresh}
        onStarted={onStarted}
      />
    ))
    return container
  }

  const button = (node: HTMLElement, label: string) =>
    [...node.querySelectorAll("button")].find((candidate) => candidate.textContent === label) as HTMLButtonElement

  it("adds, renames, removes, and reorders prizes before start", async () => {
    const node = await render()
    expect(node.textContent).toContain("7 entered")

    await act(async () => { button(node, "Add prize").click() })
    let inputs = [...node.querySelectorAll("input")] as HTMLInputElement[]
    expect(inputs).toHaveLength(3)
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(inputs[2], "Third")
      inputs[2].dispatchEvent(new Event("input", { bubbles: true }))
    })
    await act(async () => { (node.querySelector('[aria-label="Move prize 3 up"]') as HTMLButtonElement).click() })
    inputs = [...node.querySelectorAll("input")] as HTMLInputElement[]
    expect(inputs.map((input) => input.value)).toEqual(["First", "Third", "Grand Prize"])
    await act(async () => { (node.querySelector('[aria-label="Remove prize 1"]') as HTMLButtonElement).click() })
    inputs = [...node.querySelectorAll("input")] as HTMLInputElement[]
    expect(inputs.map((input) => input.value)).toEqual(["Third", "Grand Prize"])
  })

  it("preserves unsaved edits when polling repeats the same revision", async () => {
    const node = await render()
    const first = node.querySelector('input[aria-label="Prize 1"]') as HTMLInputElement
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(first, "Operator edit")
      first.dispatchEvent(new Event("input", { bubbles: true }))
    })

    await act(async () => root!.render(
      <RafflePrizeSetup
        slug="october-30-raffle-2026"
        revision="revision_1"
        prizes={["First", "Grand Prize"]}
        entryCount={8}
        onRefresh={onRefresh}
        onStarted={onStarted}
      />
    ))

    expect((node.querySelector('input[aria-label="Prize 1"]') as HTMLInputElement).value).toBe("Operator edit")
  })

  it("saves the displayed order with its exact revision", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "saved", revision: "revision_2", prizes: ["First", "Grand Prize"] }),
    })
    vi.stubGlobal("fetch", fetchMock)
    const node = await render()

    await act(async () => { button(node, "Save prizes").click(); await Promise.resolve(); await Promise.resolve() })

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/raffle/october-30-raffle-2026/prizes",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ action: "save", revision: "revision_1", prizes: ["First", "Grand Prize"] }),
      })
    )
    expect(node.textContent).toContain("Prize list saved")
    expect(onRefresh).toHaveBeenCalledOnce()
  })

  it("does not start when the operator cancels confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false)
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const node = await render()

    await act(async () => { button(node, "Start raffle").click() })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(onStarted).not.toHaveBeenCalled()
  })

  it("requires confirmation before Start raffle and reports the successful lock", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true)
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "started" }) })
    vi.stubGlobal("fetch", fetchMock)
    const node = await render()

    await act(async () => { button(node, "Start raffle").click(); await Promise.resolve(); await Promise.resolve() })

    expect(window.confirm).toHaveBeenCalledWith("Start raffle? The prize list cannot be edited after this.")
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/raffle/october-30-raffle-2026/prizes",
      expect.objectContaining({
        body: JSON.stringify({ action: "start", revision: "revision_1", prizes: ["First", "Grand Prize"] }),
      })
    )
    expect(onStarted).toHaveBeenCalledOnce()
  })
})
