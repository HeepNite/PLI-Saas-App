// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useStaffTeacherAdmin } from "@/components/front/staff/useStaffTeacherAdmin"
import type { StaffUserRow } from "@/components/front/staff/staffAdminTypes"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type HookState = ReturnType<typeof useStaffTeacherAdmin>

const teacherRow: StaffUserRow = {
  id: "teacher-1",
  clerkUserId: "clerk-1",
  email: "teacher@example.com",
  firstName: "Ada",
  lastName: "Teacher",
  role: "staff",
  category: "teacher",
  status: "active",
  locked: false,
  disabled: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  profileImageUrl: null,
  avatarUrl: null,
  paymentModelId: null,
  payrollHoursWorked: 12,
  payrollDelayEntries: [{ id: "delay-1", dateLabel: "May 29", expectedTime: "10:00", actualTime: "10:05", delayMinutes: 5 }],
  teacherBonusTargetHours: 20,
  teacherWeekdays: [1, 3, 5],
  performanceRating: 4.4,
  performanceReviewCycleDays: 21,
  teacherAssignedUserId: "teacher-1",
  teacherRecurrenceUnit: "month",
  teacherRecurrenceInterval: 2,
  teacherCourseSlugs: ["mat"],
} as unknown as StaffUserRow

function HookHarness({ rows = [teacherRow], onState, refreshRows }: { rows?: StaffUserRow[]; onState: (state: HookState) => void; refreshRows: () => Promise<void> }) {
  const state = useStaffTeacherAdmin({ rows, refreshRows })
  onState(state)
  return <div>{state.selectedTeacher?.id || "none"}</div>
}

const jsonResponse = (body: unknown, ok = true, status = ok ? 200 : 500) =>
  Promise.resolve({ ok, status, json: () => Promise.resolve(body) } as Response)

describe("useStaffTeacherAdmin", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null
  let latestState: HookState | null = null
  let refreshRows: () => Promise<void>

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    latestState = null
    vi.restoreAllMocks()
  })

  async function renderHookHarness(rows = [teacherRow]) {
    refreshRows = vi.fn(async () => undefined) as unknown as () => Promise<void>
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root!.render(<HookHarness rows={rows} refreshRows={refreshRows} onState={(state) => { latestState = state }} />))
    return latestState!
  }

  it("selects the first teacher row and derives metrics", async () => {
    const state = await renderHookHarness()

    expect(state.teacherRows).toHaveLength(1)
    expect(state.selectedTeacher?.id).toBe("teacher-1")
    expect(state.teacherRating).toBe(4.4)
    expect(state.visibleTeacherMetrics.map((metric) => metric.key)).toEqual(["rating", "hours", "punctuality"])
    expect(state.teacherMetricsAverage).toBeGreaterThan(0)
    expect(state.teacherAiTips.length).toBeGreaterThan(0)
  })

  it("toggles teacher courses and marks assignment dirty", async () => {
    const state = await renderHookHarness()

    await act(async () => {
      state.toggleTeacherCourse("reformer")
    })

    expect(latestState!.teacherCourseSlugs).toContain("reformer")
    expect(latestState!.teacherAssignmentDirty).toBe(true)
  })

  it("saves assignment and refreshes rows", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ message: "ok" }) as unknown as Response)
    const state = await renderHookHarness()

    await act(async () => {
      await state.saveTeacherPerformance()
    })

    expect(fetchMock).toHaveBeenCalledWith("/api/staff/users/teacher-1/performance", expect.objectContaining({ method: "PATCH" }))
    expect(vi.mocked(refreshRows)).toHaveBeenCalledTimes(1)
    expect(latestState!.teacherSuccess).toBe("Teaching assignment saved.")
  })
})
