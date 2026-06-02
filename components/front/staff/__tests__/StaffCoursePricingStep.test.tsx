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

  it("asks to create the course before editing prices", async () => {
    const node = await renderStep(createProps({ courseEditingSlug: null }))

    expect(node.textContent).toContain("Create the course first to configure this step.")
  })

  it("renders price fields and disables discount price when no discount is selected", async () => {
    const node = await renderStep(createProps())

    expect(node.textContent).toContain("Prices and special discounts")
    expect(node.querySelector<HTMLInputElement>('input[name="courseDropInPrice"]')?.value).toBe("20")
    expect(node.querySelector<HTMLInputElement>('input[name="courseSpecialDiscountPrice"]')?.disabled).toBe(true)
  })

  it("renders custom label and wires discount type changes", async () => {
    const setCourseForm = vi.fn()
    const node = await renderStep(createProps({
      setCourseForm,
      courseForm: { ...createProps().courseForm, specialDiscountType: "custom", specialDiscountCustomLabel: "Anniversary Week" },
    }))
    const discountType = node.querySelector<HTMLSelectElement>('select[name="courseSpecialDiscountType"]')

    await act(async () => {
      discountType!.value = "none"
      discountType!.dispatchEvent(new Event("change", { bubbles: true }))
    })

    expect(node.querySelector<HTMLInputElement>('input[name="courseSpecialDiscountCustomLabel"]')?.value).toBe("Anniversary Week")
    expect(setCourseForm).toHaveBeenCalledTimes(1)
  })
})
