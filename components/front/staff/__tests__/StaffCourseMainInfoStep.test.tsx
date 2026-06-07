// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import StaffCourseMainInfoStep from "@/components/front/staff/StaffCourseMainInfoStep"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type Props = React.ComponentProps<typeof StaffCourseMainInfoStep>

const createProps = (overrides: Partial<Props> = {}): Props => ({
  visible: true,
  courseForm: {
    slug: "salsa-basics",
    title: "Salsa Basics",
    kind: "course",
    category: "Salsa",
    description: "Intro class",
    previewImageUrl: "",
    previewVideoUrl: "",
    dropInPriceCents: "20",
    firstClassPriceCents: "15",
    level: "Beginner",
    durationMinutes: "55",
    location: "54 Coles St",
    defaultRoomId: "room-1",
    publicationMode: "publish_now",
    launchDate: "",
    specialDiscountType: "none",
    specialDiscountCustomLabel: "",
    specialDiscountPrice: "",
    availableTimesCsv: "",
    active: true,
  },
  setCourseForm: vi.fn(),
  courseSlugConflict: { exists: false, suggestion: null, existingTitle: null },
  courseRoomOptions: [{ id: "room-1", name: "Studio A", capacity: 12, location: "North", active: true }],
  roomById: { "room-1": { id: "room-1", name: "Studio A", capacity: 12, location: "North", active: true } },
  onUseSlugSuggestion: vi.fn(),
  onEditExistingCourse: vi.fn(),
  ...overrides,
})

describe("StaffCourseMainInfoStep", () => {
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
    await act(async () => root!.render(<StaffCourseMainInfoStep {...props} />))
    return container
  }

  it("returns null when hidden", async () => {
    const node = await renderStep(createProps({ visible: false }))

    expect(node.textContent).toBe("")
  })

  it("renders main course fields and selected default room details", async () => {
    const node = await renderStep(createProps())

    expect(node.textContent).toContain("Course main information")
    expect(node.querySelector<HTMLInputElement>('input[name="courseSlug"]')?.value).toBe("salsa-basics")
    expect(node.querySelector<HTMLInputElement>('input[name="courseTitle"]')?.value).toBe("Salsa Basics")
    expect(node.textContent).toContain("North · cap 12")
  })

  it("wires field updates through setCourseForm", async () => {
    const setCourseForm = vi.fn()
    const node = await renderStep(createProps({ setCourseForm }))
    const roomSelect = node.querySelector<HTMLSelectElement>('select[name="courseDefaultRoomId"]')

    await act(async () => {
      roomSelect!.value = ""
      roomSelect!.dispatchEvent(new Event("change", { bubbles: true }))
    })

    expect(setCourseForm).toHaveBeenCalledTimes(1)
  })

  it("renders slug conflict actions", async () => {
    const props = createProps({ courseSlugConflict: { exists: true, suggestion: "salsa-basics-2", existingTitle: "Salsa Basics" } })
    const node = await renderStep(props)

    await act(async () => {
      Array.from(node.querySelectorAll("button")).find((button) => button.textContent === "Use suggestion")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      Array.from(node.querySelectorAll("button")).find((button) => button.textContent === "Edit existing")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    expect(node.textContent).toContain("salsa-basics-2")
    expect(props.onUseSlugSuggestion).toHaveBeenCalledTimes(1)
    expect(props.onEditExistingCourse).toHaveBeenCalledTimes(1)
  })
})
