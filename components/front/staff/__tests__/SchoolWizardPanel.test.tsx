// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import StaffCoursePublishStep from "@/components/front/staff/StaffCoursePublishStep"
import { SchoolWizardPanel } from "@/components/front/staff/school/SchoolWizardPanel"
import type { SchoolWizardState } from "@/components/front/staff/school/school-wizard-types"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

const wizard: SchoolWizardState = {
  activeEntity: "courses",
  step: 6,
  setStep: vi.fn(),
  goToEntity: vi.fn(),
  nextStep: vi.fn(),
  prevStep: vi.fn(),
  totalSteps: 7,
}

function PublishFailureHarness({ action }: { action: "Save Draft" | "Publish" }) {
  const [busy, setBusy] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const failRequest = async () => {
    setBusy("course")
    await Promise.resolve()
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    setError("Network error while saving course.")
    setBusy(null)
  }

  return (
    <SchoolWizardPanel wizard={wizard} enabledContext={{ courseEditingSlug: "salsa-basics" }} error={error}>
      <StaffCoursePublishStep
        visible
        courseEditingSlug="salsa-basics"
        previewPublicHref="/courses/salsa-basics"
        schoolBusy={busy}
        courseMediaUploading={null}
        onCopyCourseLink={vi.fn()}
        onShareCourse={vi.fn()}
        onResetCourseBuilder={vi.fn()}
        onSaveDraft={action === "Save Draft" ? () => void failRequest() : vi.fn()}
        onPublish={action === "Publish" ? () => void failRequest() : vi.fn()}
      />
    </SchoolWizardPanel>
  )
}

describe("SchoolWizardPanel", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    vi.restoreAllMocks()
  })

  async function render(element: React.ReactNode) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root!.render(element))
    return container
  }

  it("keeps the exact seven-step Course Studio order", async () => {
    const node = await render(<SchoolWizardPanel wizard={wizard} enabledContext={{ courseEditingSlug: null }} />)
    const nav = node.querySelector('nav[aria-label="Wizard steps"]')
    const labels = Array.from(nav?.querySelectorAll("button > span:last-child") || []).map((item) => item.textContent)

    expect(labels).toEqual(["Info", "Prices", "Media", "Schedule", "Relations", "Preview", "Publish"])
  })

  it.each(["Save Draft", "Publish"] as const)("announces an asynchronous %s failure and restores focus", async (action) => {
    const node = await render(<PublishFailureHarness action={action} />)
    const button = Array.from(node.querySelectorAll("button")).find((item) => item.textContent === action)!
    button.focus()

    await act(async () => {
      button.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    const alert = node.querySelector('[role="alert"]')
    expect(alert?.getAttribute("aria-live")).toBe("assertive")
    expect(alert?.textContent).toContain("Network error while saving course.")
    expect(document.activeElement).toBe(button)
  })
})
