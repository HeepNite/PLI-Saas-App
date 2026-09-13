// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import AssistantWidget from "@/components/front/AssistantWidgetMountI18n"
import FloatingTopHomeButton from "@/components/front/ui/FloatingTopHomeButton"

const navigation = vi.hoisted(() => ({ pathname: "/courses" }))
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock("@/components/front/AssistantWidgetMount", () => ({
  default: () => <div data-testid="assistant" />,
}))

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
    await act(async () => root!.render(<><AssistantWidget /><FloatingTopHomeButton /></>))
  }

  it.each(["/raffle/launch", "/raffle/launch/", "/staff/raffle/launch/screen", "/staff/raffle/launch/screen/"])(
    "hides both widgets on %s and restores them after navigation",
    async (pathname) => {
      await render(pathname)
      expect(container.childElementCount).toBe(0)
      await render("/courses")
      expect(container.querySelector('[data-testid="assistant"]')).not.toBeNull()
      expect(container.querySelector("button")).not.toBeNull()
    },
  )

  it.each(["/courses", "/raffle", "/raffle-news/launch", "/raffle/launch/details"])(
    "preserves both widgets on unrelated %s",
    async (pathname) => {
      await render(pathname)
      expect(container.querySelector('[data-testid="assistant"]')).not.toBeNull()
      expect(container.querySelector("button")).not.toBeNull()
    },
  )

  it("does not suppress the assistant on other staff raffle routes", async () => {
    await render("/staff/raffle/launch/settings")
    expect(container.querySelector('[data-testid="assistant"]')).not.toBeNull()
  })

  it("preserves modal scroll-lock suppression", async () => {
    document.body.style.overflow = "hidden"
    await render("/courses")
    expect(container.childElementCount).toBe(0)
  })
})
