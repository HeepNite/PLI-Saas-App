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
  createdAt: "2026-01-01T00:00:00.000Z",
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
    vi.unstubAllGlobals()
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

  it("saves a course catalog draft and refreshes school data on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ message: "Course saved." }),
    })
    vi.stubGlobal("fetch", fetchMock)
    const input = await renderHook()

    await act(async () => {
      captured!.setCourseForm((prev) => ({
        ...prev,
        slug: "salsa-foundations",
        title: "Salsa Foundations",
        category: "Dance",
        dropInPriceCents: "30",
        firstClassPriceCents: "20",
      }))
      captured!.toggleCourseRecurringWeekday(2)
    })
    await act(async () => {
      captured!.addCourseScheduleSlot()
    })

    await act(async () => {
      await captured!.saveCourseCatalog({ preventDefault: vi.fn() } as unknown as React.FormEvent)
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/staff/school/courses",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    )
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(payload).toMatchObject({
      slug: "salsa-foundations",
      title: "Salsa Foundations",
      category: "Dance",
      dropInPriceCents: 3000,
      firstClassPriceCents: 2000,
      availableWeekdays: [2],
      availableTimes: ["10:00"],
      active: true,
    })
    expect(payload.scheduleRules).toMatchObject({
      mode: "regular",
      rules: [{ weekday: 2, times: ["10:00"] }],
    })
    expect(input.fetchSchoolData).toHaveBeenCalledWith({ showLoader: false })
    expect(input.setSchoolSuccess).toHaveBeenCalledWith("Course saved.")
    expect(input.setSchoolBusy).toHaveBeenNthCalledWith(1, "course")
    expect(input.setSchoolBusy).toHaveBeenLastCalledWith(null)
  })

  it("keeps the course draft open and reports the API message when save is unauthorized", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({ error: "Unauthorized" }),
      })
    )
    const input = await renderHook()

    await act(async () => {
      captured!.setCourseForm((prev) => ({ ...prev, slug: "private-course", title: "Private Course" }))
    })
    await act(async () => {
      await captured!.saveCourseCatalog({ preventDefault: vi.fn() } as unknown as React.FormEvent)
    })

    expect(input.setSchoolError).toHaveBeenCalledWith("Unauthorized")
    expect(input.fetchSchoolData).not.toHaveBeenCalled()
    expect(input.clearCourseLinks).not.toHaveBeenCalled()
    expect(captured!.courseForm.slug).toBe("private-course")
  })

  it("rejects invalid local image files before upload", async () => {
    vi.stubGlobal("fetch", vi.fn())
    const input = await renderHook()
    const target = {
      files: [new File(["not an image"], "course.gif", { type: "image/gif" })],
      value: "course.gif",
    }

    await act(async () => {
      await captured!.handleCourseLocalImage({ target } as unknown as React.ChangeEvent<HTMLInputElement>)
    })

    expect(input.setSchoolError).toHaveBeenCalledWith("Formato inválido. Solo jpeg/png/webp.")
    expect(target.value).toBe("")
    expect(fetch).not.toHaveBeenCalled()
  })
})
