// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import StaffTeamBoardPanel from "@/components/front/staff/StaffTeamBoardPanel"
import type {
  PayrollStaffRow,
  StaffPaymentModelOption,
  StaffUserRow,
} from "@/components/front/staff/staffAdminTypes"

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type StaffTeamBoardPanelProps = React.ComponentProps<typeof StaffTeamBoardPanel>

const baseRow = (overrides: Partial<StaffUserRow> = {}): StaffUserRow => ({
  id: "user-1",
  paymentModelId: null,
  email: "jane@example.com",
  phone: "555-0100",
  avatarUrl: "",
  location: "Austin",
  hasPin: true,
  firstName: "Jane",
  lastName: "Doe",
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
  teacherAssignedUserId: "",
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
  online: true,
  authOnline: true,
  lastActiveAt: null,
  staffLastCheckInAt: null,
  createdAt: 1,
  lastSignInAt: 1_700_000_000_000,
  ...overrides,
})

const basePayrollRow = (userId: string): PayrollStaffRow => ({
  userId,
  name: "Jane Doe",
  role: "staff",
  category: "teacher",
  hoursWorked: null,
  hourlyRate: null,
  amountCents: null,
  status: "unknown",
  delayDays: null,
  paydayWeekday: null,
  paydayLabel: "Not configured",
  dueDateLabel: null,
  delayEntries: [],
})

const paymentModelOption: StaffPaymentModelOption = {
  id: "model-default",
  name: "Default Model",
  active: true,
  isDefault: true,
}

const createProps = (overrides: Partial<StaffTeamBoardPanelProps> = {}): StaffTeamBoardPanelProps => ({
  showStaffOps: true,
  filters: {
    categoryFilter: "all",
    setCategoryFilter: vi.fn(),
  },
  search: {
    query: "",
    setQuery: vi.fn(),
    submitSearch: vi.fn(),
    refresh: vi.fn(),
  },
  data: {
    loading: false,
    rows: [baseRow()],
    payrollRows: [basePayrollRow("user-1")],
  },
  permissions: {
    canManageTarget: () => true,
    currentUserId: "admin-1",
    onPermissionDenied: vi.fn(),
  },
  payrollModels: {
    options: [paymentModelOption],
    loading: false,
    error: null,
    actionByUserId: {},
    updateModel: vi.fn(),
  },
  presence: {
    busyUserId: null,
    presenceMenuUserId: null,
    setPresenceMenuUserId: vi.fn(),
    getLiveSessionMinutes: () => null,
    formatMinutesLabel: (minutes) => `${minutes}m`,
    getInitials: (firstName, lastName) => `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase(),
  },
  actions: {
    openProfile: vi.fn(),
    openDelayDetails: vi.fn(),
    runAction: vi.fn(),
    revokeStaff: vi.fn(),
  },
  ...overrides,
})

describe("StaffTeamBoardPanel", () => {
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

  async function renderPanel(props: StaffTeamBoardPanelProps) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root!.render(<StaffTeamBoardPanel {...props} />)
    })
    return container
  }

  it("renders nothing when staff ops are hidden", async () => {
    const node = await renderPanel(createProps({ showStaffOps: false }))

    expect(node.textContent).not.toContain("Team board")
  })

  it("renders skeletons while loading", async () => {
    const node = await renderPanel(
      createProps({
        data: {
          loading: true,
          rows: [],
          payrollRows: [],
        },
      })
    )

    expect(node.textContent).toContain("Team board")
    expect(node.querySelectorAll(".shimmer").length).toBe(6)
  })

  it("renders empty state when no staff rows", async () => {
    const node = await renderPanel(
      createProps({
        data: {
          loading: false,
          rows: [],
          payrollRows: [],
        },
      })
    )

    expect(node.textContent).toContain("No staff users found.")
  })

  it("fires submitSearch on form submit and refresh on button click", async () => {
    const submitSearch = vi.fn()
    const refresh = vi.fn()
    const node = await renderPanel(
      createProps({
        search: {
          query: "alex",
          setQuery: vi.fn(),
          submitSearch,
          refresh,
        },
      })
    )

    const form = node.querySelector("form") as HTMLFormElement
    expect(form).toBeTruthy()
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    })
    expect(submitSearch).toHaveBeenCalledTimes(1)

    const refreshButton = Array.from(node.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Refresh")
    ) as HTMLButtonElement
    await act(async () => {
      refreshButton.click()
    })
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it("updates the category filter via desktop pills", async () => {
    const setCategoryFilter = vi.fn()
    const node = await renderPanel(
      createProps({
        filters: { categoryFilter: "all", setCategoryFilter },
      })
    )

    const allButton = Array.from(node.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "All"
    ) as HTMLButtonElement
    await act(async () => {
      allButton.click()
    })
    expect(setCategoryFilter).toHaveBeenCalledWith("all")
  })

  it("opens the profile when a manageable row is clicked", async () => {
    const openProfile = vi.fn()
    const node = await renderPanel(
      createProps({
        actions: {
          openProfile,
          openDelayDetails: vi.fn(),
          runAction: vi.fn(),
          revokeStaff: vi.fn(),
        },
      })
    )

    const card = node.querySelector("article article") as HTMLElement
    expect(card).toBeTruthy()
    await act(async () => {
      card.click()
    })
    expect(openProfile).toHaveBeenCalledTimes(1)
    expect(openProfile).toHaveBeenCalledWith(expect.objectContaining({ id: "user-1" }))
  })

  it("denies row click when canManageTarget returns false and does not open profile", async () => {
    const openProfile = vi.fn()
    const onPermissionDenied = vi.fn()
    const node = await renderPanel(
      createProps({
        permissions: {
          canManageTarget: () => false,
          currentUserId: "admin-1",
          onPermissionDenied,
        },
        actions: {
          openProfile,
          openDelayDetails: vi.fn(),
          runAction: vi.fn(),
          revokeStaff: vi.fn(),
        },
      })
    )

    const card = node.querySelector("article article") as HTMLElement
    await act(async () => {
      card.click()
    })
    expect(openProfile).not.toHaveBeenCalled()
    expect(onPermissionDenied).toHaveBeenCalledTimes(1)
  })

  it("invokes runAction for lock/ban toggles and revokeStaff for Remove", async () => {
    const runAction = vi.fn()
    const revokeStaff = vi.fn()
    const node = await renderPanel(
      createProps({
        actions: {
          openProfile: vi.fn(),
          openDelayDetails: vi.fn(),
          runAction,
          revokeStaff,
        },
      })
    )

    const buttons = Array.from(node.querySelectorAll("button"))
    const lockButton = buttons.find((button) => button.textContent?.trim() === "Lock") as HTMLButtonElement
    const banButton = buttons.find((button) => button.textContent?.trim() === "Ban") as HTMLButtonElement
    const removeButton = buttons.find((button) => button.textContent?.trim() === "Remove") as HTMLButtonElement

    await act(async () => {
      lockButton.click()
    })
    await act(async () => {
      banButton.click()
    })
    await act(async () => {
      removeButton.click()
    })

    expect(runAction).toHaveBeenCalledTimes(2)
    expect(runAction).toHaveBeenNthCalledWith(1, "user-1", "lock")
    expect(runAction).toHaveBeenNthCalledWith(2, "user-1", "ban")
    expect(revokeStaff).toHaveBeenCalledWith("user-1")
  })

  it("disables Remove for the current user even when manageable", async () => {
    const node = await renderPanel(
      createProps({
        permissions: {
          canManageTarget: () => true,
          currentUserId: "user-1",
          onPermissionDenied: vi.fn(),
        },
      })
    )

    const removeButton = Array.from(node.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Remove"
    ) as HTMLButtonElement
    expect(removeButton.disabled).toBe(true)
  })

  it("invokes updateModel when payroll-model select changes", async () => {
    const updateModel = vi.fn()
    const node = await renderPanel(
      createProps({
        payrollModels: {
          options: [paymentModelOption],
          loading: false,
          error: null,
          actionByUserId: {},
          updateModel,
        },
      })
    )

    const select = node.querySelector("select[value]") as HTMLSelectElement | null
    // First select in payroll model card; locate by option list
    const payrollSelect = Array.from(node.querySelectorAll("select")).find((element) =>
      Array.from(element.options).some((option) => option.textContent?.includes("Set to School Default"))
    ) as HTMLSelectElement | null
    expect(payrollSelect).toBeTruthy()
    const target = payrollSelect ?? select
    if (!target) throw new Error("No payroll select")
    await act(async () => {
      target.value = "model-default"
      target.dispatchEvent(new Event("change", { bubbles: true }))
    })
    expect(updateModel).toHaveBeenCalledWith("user-1", "model-default")
  })
})
