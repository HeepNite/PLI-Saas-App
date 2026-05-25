// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useStaffCoursesAdmin } from "@/components/front/staff/useStaffCoursesAdmin"
import type { SchoolCourseRow } from "@/components/front/staff/staffAdminTypes"

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

testGlobal.IS_REACT_ACT_ENVIRONMENT = true

const createCourse = (overrides: Partial<SchoolCourseRow> = {}): SchoolCourseRow => ({
  id: "course-1",
  slug: "bachata-basics",
  title: "Bachata Basics",
  kind: "course",
  category: "Dance",
  description: "Intro class",
  coverImageUrl: null,
  previewVideoUrl: null,
  dropInPriceCents: 2500,
  firstClassPriceCents: null,
  level: "Beginner",
  durationMinutes: 55,
  location: "Room A",
  defaultRoomId: null,
  availableWeekdays: [1],
  availableTimes: ["10:00"],
  scheduleRules: null,
  active: true,
  ...overrides,
})

const createInput = (overrides: Partial<Parameters<typeof useStaffCoursesAdmin>[0]> = {}) => ({
  schoolCourses: [],
  isSchoolView: true,
  searchParams: null,
  schoolWizard: {
    goToEntity: vi.fn(),
    setStep: vi.fn(),
  } as unknown as Parameters<typeof useStaffCoursesAdmin>[0]["schoolWizard"],
  fetchSchoolData: vi.fn().mockResolvedValue(undefined),
  loadCourseLinks: vi.fn().mockResolvedValue(undefined),
  clearCourseLinks: vi.fn(),
  resetCourseLinkForm: vi.fn(),
  handleStaffAuthFailure: vi.fn().mockReturnValue(false),
  setSchoolError: vi.fn(),
  setSchoolSuccess: vi.fn(),
  setSchoolBusy: vi.fn(),
  ...overrides,
})

type HookResult = ReturnType<typeof useStaffCoursesAdmin>

describe("useStaffCoursesAdmin", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null
  let captured: HookResult | null = null

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount()
      })
    }
    container?.remove()
    root = null
    container = null
    captured = null
    vi.restoreAllMocks()
  })

  async function renderHook(input = createInput()) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)

    function Harness() {
      captured = useStaffCoursesAdmin(input)
      return null
    }

    await act(async () => {
      root!.render(<Harness />)
    })

    return input
  }

  it("adds a recurring schedule slot from selected weekdays and clears the draft selection", async () => {
    await renderHook()

    await act(async () => {
      captured!.toggleCourseRecurringWeekday(1)
    })
    await act(async () => {
      captured!.addCourseScheduleSlot()
    })

    expect(captured!.courseScheduleSlots).toEqual([{ weekday: 1, recurring: true, time: "10:00" }])
    expect(captured!.courseRecurringWeekdays).toEqual([])
    expect(captured!.courseMirrorEnabled).toBe(false)
  })

  it("detects slug conflicts and applies the suggested slug", async () => {
    await renderHook({
      ...createInput(),
      schoolCourses: [createCourse(), createCourse({ id: "course-2", slug: "bachata-basics-2" })],
    })

    await act(async () => {
      captured!.setCourseForm((prev) => ({ ...prev, slug: "Bachata Basics" }))
    })

    expect(captured!.courseSlugConflict).toMatchObject({
      exists: true,
      suggestion: "bachata-basics-3",
      existingTitle: "Bachata Basics",
    })

    await act(async () => {
      captured!.handleUseSlugSuggestion()
    })

    expect(captured!.courseForm.slug).toBe("bachata-basics-3")
    expect(captured!.courseSlugConflict.exists).toBe(false)
  })
})
