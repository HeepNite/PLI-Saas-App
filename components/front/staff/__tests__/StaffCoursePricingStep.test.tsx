// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import StaffCoursePricingStep from "@/components/front/staff/StaffCoursePricingStep"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type Props = React.ComponentProps<typeof StaffCoursePricingStep>

const createProps = (overrides: Partial<Props> = {}): Props => ({
  visible: true,
  courseEditingSlug: "salsa-basics",
  courseForm: {
    courseCatalogId: null,
    expectedUpdatedAt: null,
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
    defaultRoomId: "",
    publicationMode: "publish_now",
    launchDate: "",
    specialDiscountType: "none",
    specialDiscountCustomLabel: "",
    specialDiscountPrice: "",
    availableTimesCsv: "",
    active: true,
    specialClassOperationsEnabled: false,
    specialClassCapacity: "",
  },
  setCourseForm: vi.fn(),
  ...overrides,
})

describe("StaffCoursePricingStep", () => {
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
    await act(async () => root!.render(<StaffCoursePricingStep {...props} />))
    return container
  }

  it("returns null when hidden", async () => {
    const node = await renderStep(createProps({ visible: false }))

    expect(node.textContent).toBe("")
  })

  it("allows editing base prices before the course is persisted", async () => {
    const node = await renderStep(createProps({ courseEditingSlug: null }))

    expect(node.textContent).toContain("Base prices")
    expect(node.querySelector<HTMLInputElement>('input[name="courseDropInPrice"]')?.value).toBe("20")
  })

  it("keeps special-class guidance and moves campaigns to Promotions", async () => {
    const node = await renderStep(createProps({ courseForm: { ...createProps().courseForm, specialClassOperationsEnabled: true } }))

    expect(node.textContent).toContain("Base prices")
    expect(node.querySelector('input[name="courseSpecialDiscountPrice"]')).toBeNull()
    expect(node.textContent).toContain("configured in the Promotions step")
    expect(node.textContent).toContain("Drop-in is the shared initial Special Class price")
  })
})
