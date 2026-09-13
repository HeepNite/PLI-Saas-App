// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import RaffleAccessForm from "../RaffleAccessForm"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

describe("private raffle key entry", () => {
  afterEach(() => vi.unstubAllGlobals())

  it.each([404, 429])("reuses the existing exchange and clears the input after HTTP %s", async (status) => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status })
    vi.stubGlobal("fetch", fetchMock)
    const container = document.createElement("div")
    document.body.appendChild(container)
    const root = createRoot(container)
    try {
      await act(async () => root.render(<RaffleAccessForm slug="s1" />))
      const input = container.querySelector("input")!
      expect(input.type).toBe("password")
      expect(container.querySelector("form")!.method).toBe("post")
      input.value = "test key/&"
      await act(async () => {
        container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
      })
      expect(fetchMock).toHaveBeenCalledWith("/api/raffle/s1/screen-session?key=test%20key%2F%26", {
        credentials: "same-origin", cache: "no-store", referrerPolicy: "no-referrer",
      })
      expect(input.value).toBe("")
      expect(container.querySelector('[role="alert"]')!.textContent).toContain(status === 429 ? "Too many attempts" : "Access could not be authorized")
      expect(container.innerHTML).not.toContain("test key")
      expect(localStorage.length).toBe(0)
      expect(sessionStorage.length).toBe(0)
    } finally {
      await act(async () => root.unmount())
      container.remove()
    }
  })
})
