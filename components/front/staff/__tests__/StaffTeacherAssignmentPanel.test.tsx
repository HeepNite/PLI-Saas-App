// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import StaffTeacherAssignmentPanel from "@/components/front/staff/StaffTeacherAssignmentPanel"
import { normalizeRecurrenceIntervalInput } from "@/components/front/staff/staffTeacherAssignmentHelpers"
import type {
  AssignmentCourseOption,
  StaffUserRow,
} from "@/components/front/staff/staffAdminTypes"

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type StaffTeacherAssignmentPanelProps = React.ComponentProps<typeof StaffTeacherAssignmentPanel>

const teacherRow = (overrides: Partial<StaffUserRow> = {}): StaffUserRow => ({
  id: "teacher-1",
  paymentModelId: null,
  email: "alex@example.com",
  phone: "",
  avatarUrl: "",
  location: "",
  hasPin: true,
  firstName: "Alex",
  lastName: "Stone",
  role: "staff",
  category: "teacher",
  payrollHoursWorked: null,
  payrollHourlyRate: null,
  payrollStatus: null,
  payrollPaydayWeekday: null,
  payrollDelayEntries: [],
  performanceRating: null,
  performanceReviewsCount: null,
  performanceReviewCycleDays: null,
  teacherType: "lead",
  teacherAssignedUserId: "teacher-1",
  teacherRecurrenceUnit: "month",
  teacherRecurrenceInterval: 1,
  teacherCourseSlugs: [],
  teacherWeekdays: [],
  teacherShiftStart: "",
  teacherShiftEnd: "",
  teacherWeeklyHours: null,
  teacherBonusTargetHours: null,
  banned: false,
  locked: false,
  online: false,
  authOnline: false,
  lastActiveAt: null,
  staffLastCheckInAt: null,
  createdAt: 1,
  lastSignInAt: null,
  ...overrides,
})

const bachata: AssignmentCourseOption = {
  slug: "bachata",
  title: "Bachata",
  description: "Latin dance",
  imageUrl: null,
  scheduleLabel: "Mon/Wed",
  kindLabel: "Latin",
}

const salsa: AssignmentCourseOption = {
  slug: "salsa",
  title: "Salsa",
  description: null,
  imageUrl: null,
  scheduleLabel: null,
  kindLabel: null,
}

const createProps = (overrides: Partial<StaffTeacherAssignmentPanelProps> = {}): StaffTeacherAssignmentPanelProps => {
  const teacher = teacherRow()
  return {
    showStaffOps: true,
    selection: {
      teacherRows: [teacher],
      teacherUserId: teacher.id,
      setTeacherUserId: vi.fn(),
      teacherAssignedUserId: teacher.id,
      setTeacherAssignedUserId: vi.fn(),
      selectedTeacher: teacher,
      assignedTeacher: teacher,
    },
    recurrence: {
      unit: "month",
      setUnit: vi.fn(),
      interval: 1,
      setInterval: vi.fn(),
      helperText: "Recurs every month",
    },
    courses: {
      options: [bachata, salsa],
      selectedSlugs: ["bachata"],
      toggle: vi.fn(),
    },
    status: {
      dirty: false,
      saving: false,
      success: null,
      error: null,
    },
    onSave: vi.fn(),
    ...overrides,
  }
}

describe("StaffTeacherAssignmentPanel", () => {
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

  async function renderPanel(props: StaffTeacherAssignmentPanelProps) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root!.render(<StaffTeacherAssignmentPanel {...props} />)
    })
    return container
  }

  it("renders nothing when staff ops are hidden", async () => {
    const node = await renderPanel(createProps({ showStaffOps: false }))

    expect(node.textContent).not.toContain("Teacher-course assignment")
  })

  it("shows empty state when no teachers are available", async () => {
    const node = await renderPanel(
      createProps({
        selection: {
          teacherRows: [],
          teacherUserId: "",
          setTeacherUserId: vi.fn(),
          teacherAssignedUserId: "",
          setTeacherAssignedUserId: vi.fn(),
          selectedTeacher: null,
          assignedTeacher: null,
        },
      })
    )

    expect(node.textContent).toContain("No teacher-capable staff found yet.")
  })

  it("invokes setTeacherUserId when selected-teacher select changes", async () => {
    const setTeacherUserId = vi.fn()
    const second = teacherRow({ id: "teacher-2", firstName: "Sam", lastName: "Lee", email: "sam@example.com" })
    const teacher = teacherRow()
    const node = await renderPanel(
      createProps({
        selection: {
          teacherRows: [teacher, second],
          teacherUserId: teacher.id,
          setTeacherUserId,
          teacherAssignedUserId: teacher.id,
          setTeacherAssignedUserId: vi.fn(),
          selectedTeacher: teacher,
          assignedTeacher: teacher,
        },
      })
    )

    const select = node.querySelector("#teacherSelect") as HTMLSelectElement
    expect(select).toBeTruthy()
    await act(async () => {
      select.value = "teacher-2"
      select.dispatchEvent(new Event("change", { bubbles: true }))
    })
    expect(setTeacherUserId).toHaveBeenCalledWith("teacher-2")
  })

  it("invokes toggle when a course button is clicked", async () => {
    const toggle = vi.fn()
    const node = await renderPanel(
      createProps({
        courses: {
          options: [bachata, salsa],
          selectedSlugs: ["bachata"],
          toggle,
        },
      })
    )

    const salsaButton = Array.from(node.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Salsa")
    ) as HTMLButtonElement
    expect(salsaButton).toBeTruthy()
    await act(async () => {
      salsaButton.click()
    })
    expect(toggle).toHaveBeenCalledWith("salsa")
  })

  it("calls onSave when Save assignment is clicked and not saving", async () => {
    const onSave = vi.fn()
    const node = await renderPanel(createProps({ onSave }))

    const saveButton = Array.from(node.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Save assignment")
    ) as HTMLButtonElement
    expect(saveButton.disabled).toBe(false)
    await act(async () => {
      saveButton.click()
    })
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it("disables Save assignment when saving", async () => {
    const node = await renderPanel(
      createProps({
        status: { dirty: true, saving: true, success: null, error: null },
      })
    )

    const saveButton = Array.from(node.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Saving")
    ) as HTMLButtonElement
    expect(saveButton.disabled).toBe(true)
  })

  it("disables Save assignment when no selectedTeacher", async () => {
    const teacher = teacherRow()
    const node = await renderPanel(
      createProps({
        selection: {
          teacherRows: [teacher],
          teacherUserId: teacher.id,
          setTeacherUserId: vi.fn(),
          teacherAssignedUserId: teacher.id,
          setTeacherAssignedUserId: vi.fn(),
          selectedTeacher: null,
          assignedTeacher: teacher,
        },
      })
    )

    const saveButton = Array.from(node.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Save assignment")
    ) as HTMLButtonElement
    expect(saveButton.disabled).toBe(true)
  })

  it("renders unsaved-changes indicator when dirty", async () => {
    const node = await renderPanel(
      createProps({
        status: { dirty: true, saving: false, success: null, error: null },
      })
    )

    expect(node.textContent).toContain("Unsaved local changes")
  })

  it("renders the helper text for recurrence", async () => {
    const node = await renderPanel(
      createProps({
        recurrence: {
          unit: "year",
          setUnit: vi.fn(),
          interval: 2,
          setInterval: vi.fn(),
          helperText: "Recurs every 2 years",
        },
      })
    )

    expect(node.textContent).toContain("Recurs every 2 years")
  })

  it("renders the success message when present", async () => {
    const node = await renderPanel(
      createProps({
        status: { dirty: false, saving: false, success: "Teaching assignment saved.", error: null },
      })
    )

    expect(node.textContent).toContain("Teaching assignment saved.")
  })

  it("renders the error message when present", async () => {
    const node = await renderPanel(
      createProps({
        status: {
          dirty: false,
          saving: false,
          success: null,
          error: "Select at least one course for this program template.",
        },
      })
    )

    expect(node.textContent).toContain("Select at least one course for this program template.")
  })
})

describe("normalizeRecurrenceIntervalInput", () => {
  it("clamps values above 12 down to 12", () => {
    expect(normalizeRecurrenceIntervalInput("99")).toBe(12)
  })

  it("clamps values below 1 up to 1", () => {
    expect(normalizeRecurrenceIntervalInput("0")).toBe(1)
    expect(normalizeRecurrenceIntervalInput("-5")).toBe(1)
  })

  it("returns 1 when the input is empty or non-numeric", () => {
    expect(normalizeRecurrenceIntervalInput("")).toBe(1)
    expect(normalizeRecurrenceIntervalInput("abc")).toBe(1)
  })

  it("returns the parsed number when it is already within 1..12", () => {
    expect(normalizeRecurrenceIntervalInput("3")).toBe(3)
    expect(normalizeRecurrenceIntervalInput("12")).toBe(12)
  })
})
