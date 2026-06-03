// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import StaffPerformanceMetricsPanel from "@/components/front/staff/StaffPerformanceMetricsPanel"
import type { StaffUserRow } from "@/components/front/staff/staffAdminTypes"

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type StaffPerformanceMetricsPanelProps = React.ComponentProps<typeof StaffPerformanceMetricsPanel>

const teacherRow: StaffUserRow = {
  id: "teacher-1",
  paymentModelId: null,
  email: "teacher@example.com",
  phone: "555-0100",
  avatarUrl: "",
  location: "Austin",
  hasPin: true,
  firstName: "Jane",
  lastName: "Teacher",
  role: "staff",
  category: "teacher",
  payrollHoursWorked: 24,
  payrollHourlyRate: 5000,
  payrollStatus: "pending",
  payrollPaydayWeekday: null,
  payrollDelayEntries: [],
  performanceRating: 4.2,
  performanceReviewsCount: 8,
  performanceReviewCycleDays: 30,
  teacherType: "lead",
  teacherAssignedUserId: "teacher-1",
  teacherRecurrenceUnit: "month",
  teacherRecurrenceInterval: 1,
  teacherCourseSlugs: ["bachata"],
  teacherWeekdays: [1, 3],
  teacherShiftStart: "09:00",
  teacherShiftEnd: "17:00",
  teacherWeeklyHours: 12,
  teacherBonusTargetHours: 30,
  banned: false,
  locked: false,
  online: true,
  authOnline: true,
  lastActiveAt: null,
  staffLastCheckInAt: null,
  createdAt: 1,
  lastSignInAt: null,
}

const createProps = (overrides: Partial<StaffPerformanceMetricsPanelProps> = {}): StaffPerformanceMetricsPanelProps => ({
  showStaffOps: true,
  teacherRows: [teacherRow],
  teacherUserId: teacherRow.id,
  selectedTeacher: teacherRow,
  teacherRating: 4.2,
  teacherAiTips: ["Keep the strong attendance trend.", "Review late payroll entries."],
  visibleTeacherMetrics: [
    { key: "rating", label: "Star rating", value: 84, color: "#ff6b6b", valueLabel: "4.2 / 5" },
    { key: "hours", label: "Bonus hours", value: 80, color: "#4dabf7", valueLabel: "24 / 30h" },
    { key: "punctuality", label: "Punctuality", value: 95, color: "#51cf66", valueLabel: "95%" },
  ],
  metricsView: "current",
  teacherReviewCycleDays: 30,
  metricsSaving: false,
  metricsSuccess: null,
  metricsError: null,
  teacherDonutStyle: { background: "conic-gradient(#ff6b6b 0 40%, #4dabf7 40% 75%, #51cf66 75% 100%)" },
  teacherMetricsAverage: 86,
  setTeacherUserId: vi.fn(),
  setMetricsView: vi.fn(),
  setTeacherReviewCycleDays: vi.fn(),
  saveTeacherReviewCycle: vi.fn(),
  ...overrides,
})

describe("StaffPerformanceMetricsPanel", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount()
      })
    }
    container?.remove()
    root = null
    container = null
    vi.restoreAllMocks()
  })

  async function renderPanel(props: StaffPerformanceMetricsPanelProps) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root!.render(<StaffPerformanceMetricsPanel {...props} />)
    })
    return container
  }

  it("renders nothing when staff ops are hidden", async () => {
    const node = await renderPanel(createProps({ showStaffOps: false }))

    expect(node.textContent).not.toContain("Performance metrics")
  })

  it("renders teacher metrics and recommendations", async () => {
    const node = await renderPanel(createProps())

    expect(node.textContent).toContain("Performance metrics")
    expect(node.textContent).toContain("Jane Teacher")
    expect(node.textContent).toContain("4.2 / 5")
    expect(node.textContent).toContain("8 reviews")
    expect(node.textContent).toContain("Keep the strong attendance trend.")
    expect(node.textContent).toContain("86%")
  })

  it("wires teacher, view, cycle, and save callbacks", async () => {
    const setTeacherUserId = vi.fn()
    const setMetricsView = vi.fn()
    const setTeacherReviewCycleDays = vi.fn()
    const saveTeacherReviewCycle = vi.fn()
    const otherTeacher = { ...teacherRow, id: "teacher-2", firstName: "Sam", lastName: "Coach", email: "sam@example.com" }
    const node = await renderPanel(
      createProps({
        teacherRows: [teacherRow, otherTeacher],
        setTeacherUserId,
        setMetricsView,
        setTeacherReviewCycleDays,
        saveTeacherReviewCycle,
      })
    )

    const teacherSelect = node.querySelector<HTMLSelectElement>('select[name="metricsTeacherSelect"]')
    const viewSelect = node.querySelector<HTMLSelectElement>('select[name="metricsView"]')
    const cycleSelect = node.querySelector<HTMLSelectElement>('select[name="teacherReviewCycleDays"]')
    const saveButton = Array.from(node.querySelectorAll("button")).find((button) => button.textContent === "Save")

    await act(async () => {
      teacherSelect!.value = "teacher-2"
      teacherSelect!.dispatchEvent(new Event("change", { bubbles: true }))
      viewSelect!.value = "previous_cycle"
      viewSelect!.dispatchEvent(new Event("change", { bubbles: true }))
      cycleSelect!.value = "45"
      cycleSelect!.dispatchEvent(new Event("change", { bubbles: true }))
      saveButton!.click()
    })

    expect(setTeacherUserId).toHaveBeenCalledWith("teacher-2")
    expect(setMetricsView).toHaveBeenCalledWith("previous_cycle")
    expect(setTeacherReviewCycleDays).toHaveBeenCalledWith(45)
    expect(saveTeacherReviewCycle).toHaveBeenCalledTimes(1)
  })
})
