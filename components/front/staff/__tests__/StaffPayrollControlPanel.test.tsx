// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import StaffPayrollControlPanel from "@/components/front/staff/StaffPayrollControlPanel"
import type { PayrollStaffRow, StaffUserRow } from "@/components/front/staff/staffAdminTypes"

vi.mock("@/components/front/staff/payroll/StaffPaymentMethodConfigPanel", () => ({
  default: () => <div data-testid="payment-method-config">Payment method config</div>,
}))

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type StaffPayrollControlPanelProps = React.ComponentProps<typeof StaffPayrollControlPanel>

const baseStaffRow = (overrides: Partial<StaffUserRow> = {}): StaffUserRow => ({
  id: "staff-1",
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
  staffLastCheckInAt: 1_700_000_000_000,
  createdAt: 1,
  lastSignInAt: null,
  ...overrides,
})

const basePayrollRow = (overrides: Partial<PayrollStaffRow> = {}): PayrollStaffRow => ({
  userId: "staff-1",
  name: "Jane Doe",
  role: "staff",
  category: "teacher",
  hoursWorked: 2,
  hourlyRate: 5000,
  amountCents: 10000,
  status: "pending",
  delayDays: 2,
  paydayWeekday: 5,
  paydayLabel: "Friday",
  dueDateLabel: "Today",
  delayEntries: [],
  ...overrides,
})

const createProps = (overrides: Partial<StaffPayrollControlPanelProps> = {}): StaffPayrollControlPanelProps => ({
  showStaffOps: true,
  currentRole: "owner",
  payrollRows: [basePayrollRow()],
  payrollSummary: {
    total: 10000,
    paidCount: 1,
    pendingCount: 1,
    pending: 10000,
    fridayCount: 1,
    exceptions: [{ id: "staff-1", name: "Jane Doe", dayLabel: "Friday" }],
    maxDelay: 2,
  },
  rowById: { "staff-1": baseStaffRow() },
  busyUserId: null,
  formatMoney: (amount) => `$${(amount / 100).toFixed(2)}`,
  formatMinutesLabel: (minutes) => `${minutes}m`,
  getLiveSessionMinutes: () => 30,
  openDelayDetails: vi.fn(),
  openPendingPayments: vi.fn(),
  runAction: vi.fn().mockResolvedValue(undefined),
  ...overrides,
})

describe("StaffPayrollControlPanel", () => {
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

  async function renderPanel(props: StaffPayrollControlPanelProps) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root!.render(<StaffPayrollControlPanel {...props} />)
    })
    return container
  }

  it("renders nothing when staff ops are hidden", async () => {
    const node = await renderPanel(createProps({ showStaffOps: false }))

    expect(node.textContent).not.toContain("Staff payment control")
  })

  it("renders the empty payroll state", async () => {
    const node = await renderPanel(createProps({ payrollRows: [] }))

    expect(node.textContent).toContain("No payroll rows available yet.")
  })

  it("renders payroll rows with stored and live hours", async () => {
    const node = await renderPanel(createProps())

    expect(node.textContent).toContain("Jane Doe")
    expect(node.textContent).toContain("Teachers · Pay day: Friday")
    expect(node.textContent).toContain("2.5h")
    expect(node.textContent).toContain("Live +30m")
    expect(node.textContent).toContain("$100.00")
  })

  it("opens delay details from status and delay controls", async () => {
    const openDelayDetails = vi.fn()
    const node = await renderPanel(createProps({ openDelayDetails }))
    const pendingButton = Array.from(node.querySelectorAll("button")).find((button) => button.textContent === "Pending")
    const delayButton = Array.from(node.querySelectorAll("button")).find((button) => button.textContent === "2d late")

    await act(async () => {
      pendingButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      delayButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    expect(openDelayDetails).toHaveBeenCalledTimes(2)
  })

  it("opens pending payments from the summary pay action", async () => {
    const openPendingPayments = vi.fn()
    const node = await renderPanel(createProps({ openPendingPayments }))
    const payButton = Array.from(node.querySelectorAll("button")).find((button) => button.textContent === "Pay")

    await act(async () => {
      payButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    expect(openPendingPayments).toHaveBeenCalledTimes(1)
  })

  it("runs force logout when the source row is online and checked in", async () => {
    const runAction = vi.fn().mockResolvedValue(undefined)
    const node = await renderPanel(createProps({ runAction }))
    const logoutButton = Array.from(node.querySelectorAll("button")).find((button) => button.textContent === "Log out")

    await act(async () => {
      logoutButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    expect(runAction).toHaveBeenCalledWith("staff-1", "force_logout")
  })

  it("only renders payment method config for owners", async () => {
    const ownerNode = await renderPanel(createProps({ currentRole: "owner" }))

    expect(ownerNode.textContent).toContain("Payment method config")

    await act(async () => {
      root?.unmount()
    })
    root = null
    ownerNode.remove()

    const staffNode = await renderPanel(createProps({ currentRole: "staff" }))

    expect(staffNode.textContent).not.toContain("Payment method config")
  })
})
