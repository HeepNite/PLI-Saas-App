// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useStaffCourseLinksAdmin } from "@/components/front/staff/useStaffCourseLinksAdmin"
import type { CourseLinkRow } from "@/components/front/staff/staffAdminTypes"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type HookState = ReturnType<typeof useStaffCourseLinksAdmin>

function HookHarness({ onState }: { onState: (state: HookState) => void }) {
  const state = useStaffCourseLinksAdmin()
  onState(state)
  return <div>{state.courseLinksAsA.length}</div>
}

const jsonResponse = (body: unknown, ok = true, status = ok ? 200 : 500) =>
  Promise.resolve({ ok, status, json: () => Promise.resolve(body) } as Response)

const submitEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent

describe("useStaffCourseLinksAdmin", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null
  let latestState: HookState | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    latestState = null
    vi.restoreAllMocks()
  })

  async function renderHookHarness() {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root!.render(<HookHarness onState={(state) => { latestState = state }} />))
    return latestState!
  }

  it("loads course links and resets to empty on failures", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ asA: [{ id: "link-a" }], asB: [{ id: "link-b" }] }) as unknown as Response)
      .mockResolvedValueOnce(jsonResponse({ error: "nope" }, false, 500) as unknown as Response)
    const state = await renderHookHarness()

    await act(async () => {
      await state.loadCourseLinks("bachata")
    })
    expect(latestState!.courseLinksAsA.map((link) => link.id)).toEqual(["link-a"])
    expect(latestState!.courseLinksAsB.map((link) => link.id)).toEqual(["link-b"])

    await act(async () => {
      await latestState!.loadCourseLinks("bachata")
    })
    expect(latestState!.courseLinksAsA).toEqual([])
    expect(latestState!.courseLinksAsB).toEqual([])
  })

  it("validates save preconditions before posting", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const state = await renderHookHarness()

    await act(async () => {
      await state.saveCourseLink(submitEvent, null)
    })
    expect(latestState!.courseLinkError).toBe("Save the course first before adding consecutive class links.")

    await act(async () => {
      latestState!.setCourseLinkForm((prev) => ({ ...prev, courseSlugB: "bachata" }))
    })
    await act(async () => {
      await latestState!.saveCourseLink(submitEvent, "bachata")
    })
    expect(latestState!.courseLinkError).toBe("A course cannot be linked to itself.")
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("saves a new course link and refreshes links", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ message: "Course link saved." }) as unknown as Response)
      .mockResolvedValueOnce(jsonResponse({ asA: [{ id: "saved-link" }], asB: [] }) as unknown as Response)
    const state = await renderHookHarness()

    await act(async () => {
      state.setCourseLinkForm((prev) => ({ ...prev, courseSlugB: "salsa", dropInConsecutiveCents: "12.50" }))
    })
    await act(async () => {
      await latestState!.saveCourseLink(submitEvent, "bachata")
    })

    expect(globalThis.fetch).toHaveBeenCalledWith("/api/staff/school/course-links", expect.objectContaining({ method: "POST" }))
    expect(latestState!.courseLinksAsA.map((link) => link.id)).toEqual(["saved-link"])
    expect(latestState!.courseLinkForm.courseSlugB).toBe("")
  })

  it("clears loaded course links without touching form state", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ asA: [{ id: "link-a" }], asB: [{ id: "link-b" }] }) as unknown as Response)
    const state = await renderHookHarness()

    await act(async () => {
      state.setCourseLinkForm((prev) => ({ ...prev, courseSlugB: "salsa" }))
      await state.loadCourseLinks("bachata")
    })
    await act(async () => {
      latestState!.clearCourseLinks()
    })

    expect(latestState!.courseLinksAsA).toEqual([])
    expect(latestState!.courseLinksAsB).toEqual([])
    expect(latestState!.courseLinkForm.courseSlugB).toBe("salsa")
  })

  it("loads link data into the edit form", async () => {
    const state = await renderHookHarness()

    await act(async () => {
      state.editCourseLink({
        id: "link-1",
        courseSlugB: "salsa",
        dropInConsecutiveCents: 1250,
        packageHolderConsecutiveCents: 950,
        active: false,
      } as CourseLinkRow)
    })

    expect(latestState!.courseLinkEditingId).toBe("link-1")
    expect(latestState!.courseLinkForm).toMatchObject({
      courseSlugB: "salsa",
      dropInConsecutiveCents: "12.50",
      packageHolderConsecutiveCents: "9.50",
      active: false,
    })
  })

  it("deletes a course link and resets the form when deleting the edited link", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ message: "Course link removed." }) as unknown as Response)
      .mockResolvedValueOnce(jsonResponse({ asA: [], asB: [] }) as unknown as Response)
    const state = await renderHookHarness()

    await act(async () => {
      state.editCourseLink({ id: "link-1", courseSlugB: "salsa", dropInConsecutiveCents: 0, packageHolderConsecutiveCents: 0, active: true } as CourseLinkRow)
    })
    await act(async () => {
      await latestState!.deleteCourseLink("link-1", "bachata")
    })

    expect(globalThis.fetch).toHaveBeenCalledWith("/api/staff/school/course-links", expect.objectContaining({ method: "DELETE" }))
    expect(latestState!.courseLinkEditingId).toBeNull()
  })

  it("surfaces delete failures without clearing the edited form", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ error: "Cannot delete" }, false, 400) as unknown as Response)
    const state = await renderHookHarness()

    await act(async () => {
      state.editCourseLink({ id: "link-1", courseSlugB: "salsa", dropInConsecutiveCents: 0, packageHolderConsecutiveCents: 0, active: true } as CourseLinkRow)
    })
    await act(async () => {
      await latestState!.deleteCourseLink("link-1", "bachata")
    })

    expect(latestState!.courseLinkError).toBe("Cannot delete")
    expect(latestState!.courseLinkEditingId).toBe("link-1")
  })

  it("toggles course link active state and refreshes links for the current course", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({}) as unknown as Response)
      .mockResolvedValueOnce(jsonResponse({ asA: [{ id: "link-1", active: false }], asB: [] }) as unknown as Response)
    const state = await renderHookHarness()

    await act(async () => {
      await state.toggleCourseLinkActive({ id: "link-1", active: true } as CourseLinkRow, "bachata")
    })

    expect(globalThis.fetch).toHaveBeenNthCalledWith(1, "/api/staff/school/course-links", expect.objectContaining({ method: "PUT" }))
    expect(globalThis.fetch).toHaveBeenNthCalledWith(2, "/api/staff/school/course-links?courseSlug=bachata")
    expect(latestState!.courseLinksAsA.map((link) => link.id)).toEqual(["link-1"])
  })

  it("derives unique course link stats from the catalog map", async () => {
    const state = await renderHookHarness()

    await act(async () => {
      state.setAllCourseLinksMap({
        bachata: { asA: [{ id: "shared", active: true } as CourseLinkRow], asB: [] },
        salsa: { asA: [{ id: "shared", active: true } as CourseLinkRow], asB: [{ id: "inactive", active: false } as CourseLinkRow] },
      })
    })

    expect(latestState!.courseLinkStats).toEqual({ total: 2, active: 1, inactive: 1 })
  })
})
