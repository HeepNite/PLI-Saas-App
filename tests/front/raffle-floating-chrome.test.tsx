// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import AssistantWidget from "@/components/front/AssistantWidgetMountI18n"
import FloatingTopHomeButton from "@/components/front/ui/FloatingTopHomeButton"
import { FloatingChromeProvider } from "@/components/front/ui/FloatingChromeVisibility"

const navigation = vi.hoisted(() => ({ pathname: "/courses" }))
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }))

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

describe("raffle floating chrome policy", () => {
  let root: Root | undefined
  let container: HTMLDivElement

  afterEach(async () => {
    await act(async () => root?.unmount())
    root = undefined
    container.remove()
    document.body.style.overflow = ""
    window.history.replaceState(null, "", "/")
  })

  async function render(pathname: string) {
    navigation.pathname = pathname
    if (!root) {
      container = document.createElement("div")
      document.body.appendChild(container)
      root = createRoot(container)
    }
    await act(async () => root!.render(<FloatingChromeProvider><AssistantWidget /><FloatingTopHomeButton /></FloatingChromeProvider>))
  }

  it.each(["/raffle/launch", "/raffle/launch/", "/staff/raffle/launch/screen", "/staff/raffle/launch/screen/"])(
    "hides both widgets on %s and restores them after navigation",
    async (pathname) => {
      await render(pathname)
      expect(container.childElementCount).toBe(0)
      await render("/courses")
      expect(container.querySelector('[aria-label="Open assistant"]')).not.toBeNull()
      expect(container.querySelector('[aria-label="Home"]')).not.toBeNull()
    },
  )

  it.each(["/courses", "/raffle", "/raffle-news/launch", "/raffle/launch/details"])(
    "preserves both widgets on unrelated %s",
    async (pathname) => {
      await render(pathname)
      expect(container.querySelector('[aria-label="Open assistant"]')).not.toBeNull()
      expect(container.querySelector('[aria-label="Home"]')).not.toBeNull()
    },
  )

  it("preserves the actual widgets' existing staff-route suppression", async () => {
    await render("/staff/raffle/launch/settings")
    expect(container.childElementCount).toBe(0)
  })

  it("hides existing widgets when navigating into the raffle with a query string", async () => {
    await render("/courses")
    expect(container.querySelector('[aria-label="Open assistant"]')).not.toBeNull()
    window.history.replaceState(null, "", "/raffle/launch?source=poster")
    await render("/raffle/launch")
    expect(container.childElementCount).toBe(0)
  })

  it("preserves modal scroll-lock suppression", async () => {
    document.body.style.overflow = "hidden"
    await render("/courses")
    expect(container.childElementCount).toBe(0)
  })
})
