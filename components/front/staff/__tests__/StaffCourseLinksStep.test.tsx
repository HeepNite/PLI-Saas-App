// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import StaffCourseLinksStep from "@/components/front/staff/StaffCourseLinksStep"
import type { SchoolCourseRow } from "@/components/front/staff/staffAdminTypes"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type Props = React.ComponentProps<typeof StaffCourseLinksStep>

const createCourse = (overrides: Partial<SchoolCourseRow> = {}): SchoolCourseRow => ({
  id: "course-1",
  slug: "salsa-basics",
  title: "Salsa Basics",
  kind: "course",
  category: "Salsa",
  description: "Intro class",
  coverImageUrl: null,
  previewVideoUrl: null,
  dropInPriceCents: 2000,
  firstClassPriceCents: 1500,
  level: "Beginner",
  durationMinutes: 55,
  location: "54 Coles St",
  defaultRoomId: null,
  availableWeekdays: [1, 3],
  availableTimes: ["09:00"],
  scheduleRules: null,
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
})

const createProps = (overrides: Partial<Props> = {}): Props => ({
  visible: true,
  courseEditingSlug: "salsa-basics",
  schoolCourses: [
    createCourse(),
    createCourse({ id: "course-2", slug: "bachata-next", title: "Bachata Next", availableWeekdays: [2], availableTimes: ["10:30"] }),
    createCourse({ id: "course-3", slug: "inactive-course", title: "Inactive Course", active: false }),
  ],
  courseLinkError: "Link failed",
  courseLinkSuccess: "Link saved",
  courseLinkForm: {
    courseSlugB: "bachata-next",
    dropInConsecutiveCents: "12",
    packageHolderConsecutiveCents: "5",
    active: true,
  },
  setCourseLinkForm: vi.fn(),
  courseLinkSaving: false,
  courseLinkEditingId: null,
  courseLinksAsA: [
    {
      id: "link-a",
      courseSlugA: "salsa-basics",
      courseSlugB: "bachata-next",
      dropInConsecutiveCents: 1200,
      packageHolderConsecutiveCents: 500,
      active: true,
    },
  ],
  courseLinksAsB: [
    {
      id: "link-b",
      courseSlugA: "bachata-next",
      courseSlugB: "salsa-basics",
      dropInConsecutiveCents: 1000,
      packageHolderConsecutiveCents: 400,
      active: false,
    },
  ],
  onSaveCourseLink: vi.fn(),
  onResetCourseLinkForm: vi.fn(),
  onToggleCourseLinkActive: vi.fn(),
  onEditCourseLink: vi.fn(),
  onDeleteCourseLink: vi.fn(),
  formatUsdInputLabel: (value) => `$${value}`,
  centsToUsdInput: (cents) => ((cents ?? 0) / 100).toFixed(2),
  ...overrides,
})

describe("StaffCourseLinksStep", () => {
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
    await act(async () => root!.render(<StaffCourseLinksStep {...props} />))
    return container
  }

  it("returns null when hidden", async () => {
    const node = await renderStep(createProps({ visible: false }))

    expect(node.textContent).toBe("")
  })

  it("allows preparing a draft link before the course is created", async () => {
    const node = await renderStep(createProps({ courseEditingSlug: null }))
    const options = Array.from(node.querySelectorAll("option")).map((option) => option.textContent)

    expect(node.textContent).toContain("The link will be saved automatically when this course is created.")
    expect(node.textContent).toContain("Save draft link")
    expect(options).toContain("Bachata Next — Tue · 10:30")
  })

  it("renders link form, feedback, active course options, and existing link lists", async () => {
    const node = await renderStep(createProps())
    const options = Array.from(node.querySelectorAll("option")).map((option) => option.textContent)

    expect(node.textContent).toContain("Consecutive Classes")
    expect(node.textContent).toContain("Link Salsa Basics to a consecutive class with special pricing.")
    expect(node.textContent).toContain("Link failed")
    expect(node.textContent).toContain("Link saved")
    expect(options).toContain("Bachata Next — Tue · 10:30")
    expect(options).not.toContain("Inactive Course — Mon, Wed · 09:00")
    expect(node.textContent).toContain("Courses after this one (1)")
    expect(node.textContent).toContain("Salsa Basics → Bachata Next")
    expect(node.textContent).toContain("Courses before this one (1)")
    expect(node.textContent).toContain("Bachata Next → Salsa Basics")
    expect(node.textContent).toContain("Drop-in: $12.00 · Package: $5.00")
  })

  it("wires form and list actions", async () => {
    const props = createProps({ courseLinkEditingId: "link-a" })
    const node = await renderStep(props)
    const buttons = Array.from(node.querySelectorAll("button"))

    await act(async () => {
      buttons.find((button) => button.textContent === "Active")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      buttons.find((button) => button.textContent === "Update link")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      buttons.find((button) => button.textContent === "Cancel")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      buttons.find((button) => button.textContent === "Edit")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      buttons.find((button) => button.textContent === "Remove")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    expect(props.setCourseLinkForm).toHaveBeenCalledOnce()
    expect(props.onSaveCourseLink).toHaveBeenCalledOnce()
    expect(props.onResetCourseLinkForm).toHaveBeenCalledOnce()
    expect(props.onEditCourseLink).toHaveBeenCalledWith(props.courseLinksAsA[0])
    expect(props.onDeleteCourseLink).toHaveBeenCalledWith("link-a")
  })

  it("renders the empty state when there are no links", async () => {
    const node = await renderStep(createProps({ courseLinksAsA: [], courseLinksAsB: [], courseLinkError: null, courseLinkSuccess: null }))

    expect(node.textContent).toContain("No consecutive class links yet.")
  })
})
