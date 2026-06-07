// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import StaffCourseCatalogPanel from "@/components/front/staff/StaffCourseCatalogPanel"
import type { SchoolCourseRow } from "@/components/front/staff/staffAdminTypes"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

vi.mock("next/image", () => ({
  default: ({ unoptimized, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) => {
    void unoptimized
    return React.createElement("img", props)
  },
}))

type Props = React.ComponentProps<typeof StaffCourseCatalogPanel>

const createCourse = (overrides: Partial<SchoolCourseRow> = {}): SchoolCourseRow => ({
  id: "course-1",
  slug: "salsa-basics",
  title: "Salsa Basics",
  kind: "course",
  category: "Salsa",
  description: null,
  coverImageUrl: "/cover.jpg",
  previewVideoUrl: null,
  dropInPriceCents: 2000,
  firstClassPriceCents: 1500,
  level: "Beginner",
  durationMinutes: 55,
  location: "54 Coles St",
  defaultRoomId: null,
  availableWeekdays: [3, 1],
  availableTimes: ["09:00"],
  scheduleRules: null,
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
})

const createProps = (overrides: Partial<Props> = {}): Props => ({
  visible: true,
  schoolLoading: false,
  schoolCourses: [
    createCourse(),
    createCourse({ id: "course-2", slug: "bachata-next", title: "Bachata Next", active: false, coverImageUrl: null, previewVideoUrl: "https://example.com/video.mp4" }),
  ],
  courseCatalogSearch: "",
  setCourseCatalogSearch: vi.fn(),
  courseCatalogFilter: "all",
  setCourseCatalogFilter: vi.fn(),
  allCourseLinksMap: {
    "salsa-basics": {
      asA: [{ id: "link-1", courseSlugA: "salsa-basics", courseSlugB: "bachata-next", dropInConsecutiveCents: 1200, packageHolderConsecutiveCents: 500, active: true }],
      asB: [],
    },
  },
  schoolBusy: null,
  currentRole: "owner",
  onEditCourse: vi.fn(),
  onToggleCourseActive: vi.fn(),
  onDeleteCourse: vi.fn(),
  ...overrides,
})

describe("StaffCourseCatalogPanel", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    vi.restoreAllMocks()
  })

  async function renderPanel(props: Props) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root!.render(<StaffCourseCatalogPanel {...props} />))
    return container
  }

  it("returns null when hidden", async () => {
    const node = await renderPanel(createProps({ visible: false }))

    expect(node.textContent).toBe("")
  })

  it("renders saved courses, schedule labels, statuses, and linked-course pills", async () => {
    const node = await renderPanel(createProps())

    expect(node.textContent).toContain("Course catalog")
    expect(node.textContent).toContain("Saved courses")
    expect(node.textContent).toContain("Salsa Basics")
    expect(node.textContent).toContain("Mon, Wed · 09:00")
    expect(node.textContent).toContain("↔ Bachata Next")
    expect(node.textContent).toContain("Inactive")
  })

  it("wires search, filter, and course actions", async () => {
    const props = createProps()
    const node = await renderPanel(props)
    const search = node.querySelector<HTMLInputElement>('input[placeholder="Search by name or slug..."]')
    const buttons = Array.from(node.querySelectorAll("button"))

    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(search, "bachata")
      search!.dispatchEvent(new Event("input", { bubbles: true }))
      buttons.find((button) => button.textContent === "Active")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      buttons.find((button) => button.textContent === "Edit")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      buttons.find((button) => button.textContent === "Hold")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      buttons.find((button) => button.textContent === "Delete")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    expect(props.setCourseCatalogSearch).toHaveBeenCalledWith("bachata")
    expect(props.setCourseCatalogFilter).toHaveBeenCalledWith("active")
    expect(props.onEditCourse).toHaveBeenCalledWith(props.schoolCourses[0])
    expect(props.onToggleCourseActive).toHaveBeenCalledWith(props.schoolCourses[0])
    expect(props.onDeleteCourse).toHaveBeenCalledWith("salsa-basics", "Salsa Basics")
  })

  it("shows the filtered empty state", async () => {
    const node = await renderPanel(createProps({ courseCatalogSearch: "missing" }))

    expect(node.textContent).toContain("No courses match the current filter.")
  })
})
