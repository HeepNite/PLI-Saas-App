// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import StaffCourseMediaStep from "@/components/front/staff/StaffCourseMediaStep"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type Props = React.ComponentProps<typeof StaffCourseMediaStep>

const createProps = (overrides: Partial<Props> = {}): Props => ({
  visible: true,
  courseEditingSlug: "salsa-basics",
  courseForm: {
    slug: "salsa-basics",
    title: "Salsa Basics",
    kind: "course",
    category: "Salsa",
    description: "Intro class",
    previewImageUrl: "https://example.com/cover.jpg",
    previewVideoUrl: "https://example.com/video.mp4",
    dropInPriceCents: "20",
    firstClassPriceCents: "15",
    level: "Beginner",
    durationMinutes: "55",
    location: "54 Coles St",
    defaultRoomId: "",
    publicationMode: "publish_now",
    launchDate: "",
    specialDiscountType: "none",
    specialDiscountCustomLabel: "",
    specialDiscountPrice: "",
    availableTimesCsv: "",
    active: true,
  },
  setCourseForm: vi.fn(),
  courseMediaUploading: null,
  courseLocalVideoName: "preview.mp4",
  courseLocalImageName: "cover.jpg",
  onUploadVideo: vi.fn(),
  onUploadImage: vi.fn(),
  ...overrides,
})

describe("StaffCourseMediaStep", () => {
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
    await act(async () => root!.render(<StaffCourseMediaStep {...props} />))
    return container
  }

  it("returns null when hidden", async () => {
    const node = await renderStep(createProps({ visible: false }))

    expect(node.textContent).toBe("")
  })

  it("allows editing media before the course is persisted", async () => {
    const node = await renderStep(createProps({ courseEditingSlug: null }))

    expect(node.textContent).toContain("Media assets")
    expect(node.querySelector<HTMLInputElement>('input[name="coursePreviewVideoUrl"]')?.value).toBe("https://example.com/video.mp4")
  })

  it("renders media urls and local file labels", async () => {
    const node = await renderStep(createProps())

    expect(node.textContent).toContain("Media assets")
    expect(node.querySelector<HTMLInputElement>('input[name="coursePreviewVideoUrl"]')?.value).toBe("https://example.com/video.mp4")
    expect(node.querySelector<HTMLInputElement>('input[name="coursePreviewImageUrl"]')?.value).toBe("https://example.com/cover.jpg")
    expect(node.textContent).toContain("Local video: preview.mp4")
    expect(node.textContent).toContain("Local image: cover.jpg")
  })

  it("wires upload callbacks and disables both buttons while uploading", async () => {
    const props = createProps({ courseMediaUploading: "video" })
    const node = await renderStep(props)
    const buttons = Array.from(node.querySelectorAll("button"))

    await act(async () => {
      buttons[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      buttons[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    expect(node.textContent).toContain("Uploading video...")
    expect(buttons.every((button) => button.disabled)).toBe(true)
    expect(props.onUploadVideo).not.toHaveBeenCalled()
    expect(props.onUploadImage).not.toHaveBeenCalled()
  })
})
