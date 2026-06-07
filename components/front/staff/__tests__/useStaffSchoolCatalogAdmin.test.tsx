// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useStaffSchoolCatalogAdmin } from "@/components/front/staff/useStaffSchoolCatalogAdmin"
import type { SchoolCourseRow, SchoolPackageRow } from "@/components/front/staff/staffAdminTypes"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type HookState = ReturnType<typeof useStaffSchoolCatalogAdmin>

type HarnessProps = {
  canAccessSchoolNav?: boolean
  isSchoolView?: boolean
  showStaffOps?: boolean
  onCourseLinksMapLoaded?: (map: Record<string, unknown>) => void
  handleStaffAuthFailure?: (status: number) => boolean
  onState: (state: HookState) => void
}

function HookHarness({
  canAccessSchoolNav = false,
  isSchoolView = false,
  showStaffOps = false,
  onCourseLinksMapLoaded = vi.fn(),
  handleStaffAuthFailure = vi.fn(() => false),
  onState,
}: HarnessProps) {
  const state = useStaffSchoolCatalogAdmin({
    canAccessSchoolNav,
    isSchoolView,
    showStaffOps,
    ensureMinimumLoadingTime: React.useCallback(async () => undefined, []),
    handleStaffAuthFailure,
    onCourseLinksMapLoaded,
  })
  onState(state)
  return <div>{state.schoolCourses.length}</div>
}

const jsonResponse = (body: unknown, ok = true, status = ok ? 200 : 500) =>
  Promise.resolve({ ok, status, json: () => Promise.resolve(body) } as Response)

const submitEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent

describe("useStaffSchoolCatalogAdmin", () => {
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

  async function renderHookHarness(props: Omit<HarnessProps, "onState"> = {}) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root!.render(<HookHarness {...props} onState={(state) => { latestState = state }} />))
    return latestState!
  }

  it("fetches school catalog data and forwards course-link maps", async () => {
    const onCourseLinksMapLoaded = vi.fn()
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input)
      if (url.includes("/api/staff/school/courses")) return jsonResponse({ items: [{ slug: "bachata", title: "Bachata" }] })
      if (url.includes("/api/staff/rooms")) return jsonResponse({ items: [{ id: "room-1", name: "Room 1" }] })
      if (url.includes("/api/staff/school/packages")) return jsonResponse({ items: [{ id: "pkg-1", key: "pkg", label: "Package", status: "ACTIVE" }] })
      if (url.includes("/api/staff/school/points-rules")) return jsonResponse({ items: [{ key: "profile-completed", points: 15, active: true }] })
      if (url.includes("/api/staff/room-reservations")) return jsonResponse({ items: [{ id: "reservation-1" }] })
      if (url.includes("/api/staff/school/course-links")) return jsonResponse({ asA: [{ id: "link-a" }], asB: [] })
      return jsonResponse({})
    })
    const state = await renderHookHarness({ onCourseLinksMapLoaded })

    await act(async () => {
      await state.fetchSchoolData({ showLoader: false })
      await Promise.resolve()
    })

    expect(latestState!.schoolCourses).toHaveLength(1)
    expect(latestState!.schoolRooms).toHaveLength(1)
    expect(latestState!.schoolPackages).toHaveLength(1)
    expect(latestState!.schoolPointsRules).toHaveLength(1)
    expect(latestState!.roomReservations).toHaveLength(1)
    expect(onCourseLinksMapLoaded).toHaveBeenCalledWith({ bachata: { asA: [{ id: "link-a" }], asB: [] } })
  })

  it("routes school fetch auth failures through the staff auth handler", async () => {
    const handleStaffAuthFailure = vi.fn(() => true)
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input)
      if (url.includes("/api/staff/school/courses")) return jsonResponse({ error: "expired" }, false, 401)
      return jsonResponse({ items: [] })
    })
    const state = await renderHookHarness({ handleStaffAuthFailure })

    await act(async () => {
      await state.fetchSchoolData({ showLoader: false })
    })

    expect(handleStaffAuthFailure).toHaveBeenCalledWith(401)
    expect(latestState!.schoolError).toBeNull()
  })

  it("validates package saves before posting", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const state = await renderHookHarness()

    await act(async () => {
      state.setEditingPackageId("pkg-1")
      state.setPackageForm((prev) => ({ ...prev, courseSlugs: [] }))
    })
    await act(async () => {
      await latestState!.savePackagePlan(submitEvent)
    })

    expect(latestState!.schoolError).toBe("Select at least one course for this package.")
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("saves package plans and refreshes catalog data", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = String(input)
      if (url.includes("/api/staff/school/packages") && init && "method" in init && init.method === "POST") {
        return jsonResponse({ message: "Saved" })
      }
      if (url.includes("/api/staff/school/course-links")) return jsonResponse({ asA: [], asB: [] })
      return jsonResponse({ items: [] })
    })
    const state = await renderHookHarness()

    await act(async () => {
      state.setPackageForm((prev) => ({
        ...prev,
        key: "starter",
        label: "Starter",
        courseSlugs: ["bachata"],
        priceCents: "12000",
      }))
    })
    await act(async () => {
      await latestState!.savePackagePlan(submitEvent)
    })

    expect(globalThis.fetch).toHaveBeenCalledWith("/api/staff/school/packages", expect.objectContaining({ method: "POST" }))
    expect(latestState!.schoolSuccess).toBe("Saved")
    expect(latestState!.editingPackageId).toBeNull()
  })

  it("short-circuits package deletion when confirmation is declined", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false)
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const state = await renderHookHarness()

    await act(async () => {
      await state.deletePackagePlan({ key: "starter", label: "Starter" } as SchoolPackageRow)
    })

    expect(window.confirm).toHaveBeenCalledWith('Delete package "Starter"? You can restore it later from the Deleted filter.')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("saves points rules from the selected template", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input)
      if (url.includes("/api/staff/school/points-rules")) return jsonResponse({ message: "Points rule saved." })
      return jsonResponse({ items: [] })
    })
    const state = await renderHookHarness()

    await act(async () => {
      state.setPointsRuleForm((prev) => ({ ...prev, templateKey: "profile-completed", points: "25", active: false }))
    })
    await act(async () => {
      await latestState!.savePointsRule(submitEvent)
    })

    expect(globalThis.fetch).toHaveBeenCalledWith("/api/staff/school/points-rules", expect.objectContaining({ method: "POST" }))
    expect(latestState!.schoolSuccess).toBe("Points rule saved.")
  })

  it("loads assignment courses when staff ops opens without school courses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ items: [{ slug: "salsa", title: "Salsa" }] }) as unknown as Response)

    await renderHookHarness({ showStaffOps: true })

    expect(latestState!.schoolCourses.map((course: SchoolCourseRow) => course.slug)).toEqual(["salsa"])
  })
})
