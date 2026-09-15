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
  updatedAt: "2026-01-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  specialClassOperationsEnabled: false,
  specialClassCapacity: null,
  authoringSlots: [],
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
  saveDraftCourseLinkForCourse: vi.fn().mockResolvedValue({ ok: true, skipped: true }),
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
    expect(captured!.courseForm.specialClassOperationsEnabled).toBe(false)
    await act(async () => {
      captured!.setCourseForm((previous) => ({ ...previous, kind: "workshop" }))
    })
    expect(captured!.courseForm.specialClassOperationsEnabled).toBe(false)
  })

  it("hydrates stable authoring identity and concrete slot IDs", async () => {
    await renderHook()
    const course = createCourse({
      updatedAt: "2030-01-02T00:00:00.000Z",
      specialClassOperationsEnabled: true,
      specialClassCapacity: 12,
      authoringSlots: [{ id: "slot-1", date: "2030-06-01", time: "10:00", specialClassId: "special-1", classSessionId: "session-1", specialClassSlug: "stable-slug", status: "draft" }],
    })

    await act(async () => captured!.loadCourseIntoForm(course))

    expect(captured!.courseForm).toMatchObject({ courseCatalogId: "course-1", expectedUpdatedAt: course.updatedAt, specialClassOperationsEnabled: true, specialClassCapacity: "12" })
    expect(captured!.courseScheduleSlots).toEqual([expect.objectContaining({ id: "slot-1", specialClassId: "special-1", date: "2030-06-01", time: "10:00" })])
  })

  it("requires capacity only when operations are enabled", async () => {
    vi.stubGlobal("fetch", vi.fn())
    const input = await renderHook()
    await act(async () => {
      captured!.setCourseForm((previous) => ({ ...previous, specialClassOperationsEnabled: true }))
    })
    await act(async () => {
      await captured!.saveCourseCatalog({ preventDefault: vi.fn() } as unknown as React.FormEvent)
    })

    expect(input.setSchoolError).toHaveBeenCalledWith("Enter a positive shared capacity for Special Class operations.")
    expect(fetch).not.toHaveBeenCalled()
  })

  it("reuses an operation ID after transport failure and rotates it after a semantic change", async () => {
    const successfulResponse = { ok: true, json: vi.fn().mockResolvedValue({ courseCatalogId: "course-1", revision: "2030-01-02T00:00:00.000Z", projections: [] }) }
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("lost response")).mockRejectedValueOnce(new Error("lost response")).mockResolvedValue(successfulResponse)
    vi.stubGlobal("fetch", fetchMock)
    const input = await renderHook()
    await act(async () => {
      captured!.setCourseForm((previous) => ({ ...previous, slug: "salsa-special", title: "Salsa Special", description: "One night class", dropInPriceCents: "25", durationMinutes: "55", location: "Room A", specialClassOperationsEnabled: true, specialClassCapacity: "12" }))
      captured!.setCourseScheduleSlots([{ date: "2030-06-01", time: "10:00" }])
    })

    await act(async () => captured!.saveCourseCatalog({ preventDefault: vi.fn() } as unknown as React.FormEvent, "publish"))
    await act(async () => captured!.saveCourseCatalog({ preventDefault: vi.fn() } as unknown as React.FormEvent, "publish"))
    const firstId = JSON.parse(fetchMock.mock.calls[0][1].body).authoringCommand.operationId
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).authoringCommand.operationId).toBe(firstId)
    expect(input.setSchoolError).toHaveBeenLastCalledWith("Network error while saving course.")

    await act(async () => captured!.setCourseForm((previous) => ({ ...previous, title: "Changed title" })))
    await act(async () => captured!.saveCourseCatalog({ preventDefault: vi.fn() } as unknown as React.FormEvent, "publish"))
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).authoringCommand.operationId).not.toBe(firstId)
    await act(async () => captured!.saveCourseCatalog({ preventDefault: vi.fn() } as unknown as React.FormEvent, "publish"))
    expect(JSON.parse(fetchMock.mock.calls[3][1].body).authoringCommand.operationId).not.toBe(JSON.parse(fetchMock.mock.calls[2][1].body).authoringCommand.operationId)
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

  it("saves a draft consecutive link after creating the course", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ message: "Course saved.", item: { slug: "salsa-foundations" } }),
    })
    vi.stubGlobal("fetch", fetchMock)
    const input = await renderHook({
      ...createInput(),
      saveDraftCourseLinkForCourse: vi.fn().mockResolvedValue({ ok: true, skipped: false }),
    })

    await act(async () => {
      captured!.setCourseForm((prev) => ({ ...prev, slug: "salsa-foundations", title: "Salsa Foundations" }))
    })
    await act(async () => {
      await captured!.saveCourseCatalog({ preventDefault: vi.fn() } as unknown as React.FormEvent)
    })

    expect(input.saveDraftCourseLinkForCourse).toHaveBeenCalledWith("salsa-foundations")
    expect(input.setSchoolSuccess).toHaveBeenCalledWith("Course saved. Consecutive link saved.")
    expect(input.fetchSchoolData).toHaveBeenCalledWith({ showLoader: false })
  })

  it("keeps the saved course loaded when draft consecutive link persistence fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ message: "Course saved.", item: { slug: "salsa-foundations" } }),
      })
    )
    const input = await renderHook({
      ...createInput(),
      saveDraftCourseLinkForCourse: vi.fn().mockResolvedValue({ ok: false, skipped: false, error: "Duplicate course link." }),
    })

    await act(async () => {
      captured!.setCourseForm((prev) => ({ ...prev, slug: "salsa-foundations", title: "Salsa Foundations" }))
    })
    await act(async () => {
      await captured!.saveCourseCatalog({ preventDefault: vi.fn() } as unknown as React.FormEvent)
    })

    expect(captured!.courseEditingSlug).toBe("salsa-foundations")
    expect(input.loadCourseLinks).toHaveBeenCalledWith("salsa-foundations")
    expect(input.setSchoolSuccess).toHaveBeenCalledWith("Course saved.")
    expect(input.setSchoolError).toHaveBeenCalledWith("Duplicate course link.")
    expect(input.clearCourseLinks).not.toHaveBeenCalled()
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

  it("does not treat lookalike video hosts as trusted embeds", async () => {
    await renderHook()

    await act(async () => {
      captured!.setCourseForm((prev) => ({
        ...prev,
        previewVideoUrl: "https://evil.example/vimeo.com/12345",
      }))
    })

    expect(captured!.embedPreviewVideoUrl).toBe("https://evil.example/vimeo.com/12345")
    expect(captured!.previewVideoSource).toBe("https://evil.example/vimeo.com/12345")
  })
})
