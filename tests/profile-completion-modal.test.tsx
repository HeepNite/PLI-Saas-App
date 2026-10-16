// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ProfileCompletionModal } from "@/components/front/profile/modals/ProfileCompletionModal"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: ReturnType<typeof createRoot>
let container: HTMLDivElement

describe("ProfileCompletionModal", () => {
  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it("opens as a blocking accessible dialog and focuses its only action", async () => {
    const onComplete = vi.fn()
    await act(async () => root.render(<ProfileCompletionModal isOpen onComplete={onComplete} />))

    const dialog = document.querySelector<HTMLDialogElement>("[data-testid='profile-completion-modal']")
    const backdrop = document.querySelector<HTMLElement>("[data-testid='profile-completion-modal-backdrop']")
    const button = dialog?.querySelector<HTMLButtonElement>("button")

    expect(dialog?.hasAttribute("open")).toBe(true)
    expect(dialog?.getAttribute("aria-modal")).toBe("true")
    expect(backdrop?.hidden).toBe(false)
    expect(backdrop?.className).toContain("backdrop-blur-[2px]")
    expect(button).toBe(document.activeElement)
    expect(dialog?.querySelectorAll("button")).toHaveLength(1)

    await act(async () => button?.click())
    expect(onComplete).toHaveBeenCalledOnce()
  })

  it("stays closed when the completion prompt is not eligible", async () => {
    await act(async () => root.render(<ProfileCompletionModal isOpen={false} onComplete={vi.fn()} />))

    const dialog = document.querySelector<HTMLDialogElement>("[data-testid='profile-completion-modal']")
    const backdrop = document.querySelector<HTMLElement>("[data-testid='profile-completion-modal-backdrop']")
    expect(dialog?.hasAttribute("open")).toBe(false)
    expect(backdrop?.hidden).toBe(true)
  })
})
