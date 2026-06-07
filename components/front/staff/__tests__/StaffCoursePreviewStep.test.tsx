// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import StaffCoursePreviewStep from "@/components/front/staff/StaffCoursePreviewStep"

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}))

vi.mock("@/components/front/ui/CalendarPicker", () => ({
  default: ({ values }: { values: string[] }) => <div data-testid="calendar">{values.join(",")}</div>,
}))

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type Props = React.ComponentProps<typeof StaffCoursePreviewStep>

const createProps = (overrides: Partial<Props> = {}): Props => ({
  visible: true,
  schoolLoading: false,
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
    specialDiscountType: "custom",
    specialDiscountCustomLabel: "Anniversary Week",
    specialDiscountPrice: "10",
    availableTimesCsv: "",
    active: true,
  },
  selectedCourseKindLabel: "Course",
  selectedCourseKindReviewLabel: "Course review",
  courseReviewVariants: [{ kind: "course", label: "Course", hint: "Standard class", active: true }],
  reviewPreviewHover: null,
  setReviewPreviewHover: vi.fn(),
  previewVideoSource: "",
  isEmbedPreviewVideo: false,
  previewMediaUrl: "/cover.jpg",
  previewEditorHref: "/admin/courses/salsa-basics",
  defaultRoomName: "Studio A",
  scheduleTimes: ["10:00"],
  scheduleCalendarValues: ["2026-06-01"],
  formatUsdInputLabel: (value) => `$${value}`,
  formatClockLabel: (value) => value,
  getCourseScheduleDateTooltip: () => undefined,
  getCourseScheduleDateTone: () => undefined,
  ...overrides,
})

describe("StaffCoursePreviewStep", () => {
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
    await act(async () => root!.render(<StaffCoursePreviewStep {...props} />))
    return container
  }

  it("returns null when hidden", async () => {
    const node = await renderStep(createProps({ visible: false }))

    expect(node.textContent).toBe("")
  })

  it("renders preview cards, summary, reviews, and calendar", async () => {
    const node = await renderStep(createProps())

    expect(node.textContent).toContain("Course review")
    expect(node.textContent).toContain("Home card")
    expect(node.textContent).toContain("Single page")
    expect(node.textContent).toContain("Salsa Basics")
    expect(node.textContent).toContain("Default room: Studio A")
    expect(node.textContent).toContain("Anniversary Week")
    expect(node.querySelector('[data-testid="calendar"]')?.textContent).toContain("2026-06-01")
  })

  it("wires hover state for home preview", async () => {
    const setReviewPreviewHover = vi.fn()
    const node = await renderStep(createProps({ setReviewPreviewHover }))
    const homeCard = node.querySelector('[data-testid="preview-card-home"]')

    await act(async () => {
      homeCard?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
      homeCard?.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }))
    })

    expect(setReviewPreviewHover).toHaveBeenCalled()
  })

  it("renders loading skeleton", async () => {
    const node = await renderStep(createProps({ schoolLoading: true }))

    expect(node.textContent).toContain("Course review")
    expect(node.querySelector('[data-testid="calendar"]')).toBeNull()
  })
})
