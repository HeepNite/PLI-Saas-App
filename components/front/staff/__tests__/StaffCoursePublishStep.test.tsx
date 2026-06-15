// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import StaffCoursePublishStep from "@/components/front/staff/StaffCoursePublishStep"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type Props = React.ComponentProps<typeof StaffCoursePublishStep>

const createProps = (overrides: Partial<Props> = {}): Props => ({
  visible: true,
  courseEditingSlug: "salsa-basics",
  previewPublicHref: "/courses/salsa-basics",
  schoolBusy: null,
  courseMediaUploading: null,
  onCopyCourseLink: vi.fn(),
  onShareCourse: vi.fn(),
  onResetCourseBuilder: vi.fn(),
  ...overrides,
})

describe("StaffCoursePublishStep", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    vi.restoreAllMocks()
  })

  async function renderStep(props: Props) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root!.render(<StaffCoursePublishStep {...props} />))
    return container
  }

  it("returns null when hidden", async () => {
    const node = await renderStep(createProps({ visible: false }))

    expect(node.textContent).toBe("")
  })

  it("allows saving the draft course from publish before it is persisted", async () => {
    const node = await renderStep(createProps({ courseEditingSlug: null }))
    const copyButton = Array.from(node.querySelectorAll("button")).find((button) => button.textContent === "Copy link")
    const saveButton = Array.from(node.querySelectorAll("button")).find((button) => button.textContent === "Save course")

    expect(node.textContent).toContain("Publish on social")
    expect(copyButton?.disabled).toBe(true)
    expect(saveButton?.disabled).toBe(false)
  })

  it("renders social actions and wires copy/share/reset callbacks", async () => {
    const props = createProps()
    const node = await renderStep(props)
    const buttons = Array.from(node.querySelectorAll("button"))

    await act(async () => {
      buttons.find((button) => button.textContent === "Copy link")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      buttons.find((button) => button.textContent === "Facebook")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      buttons.find((button) => button.textContent === "Reset")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    expect(node.textContent).toContain("Publish on social")
    expect(props.onCopyCourseLink).toHaveBeenCalledTimes(1)
    expect(props.onShareCourse).toHaveBeenCalledWith("facebook")
    expect(props.onResetCourseBuilder).toHaveBeenCalledTimes(1)
  })

  it("disables social actions without public href and shows saving state", async () => {
    const node = await renderStep(createProps({ previewPublicHref: "", schoolBusy: "course" }))
    const copyButton = Array.from(node.querySelectorAll("button")).find((button) => button.textContent === "Copy link")
    const saveButton = Array.from(node.querySelectorAll("button")).find((button) => button.textContent === "Saving...")

    expect(copyButton?.disabled).toBe(true)
    expect(saveButton?.disabled).toBe(true)
  })
})
