// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useStaffPayrollAdmin } from "@/components/front/staff/useStaffPayrollAdmin"
import type { SelfProfileSnapshot, StaffUserRow } from "@/components/front/staff/staffAdminTypes"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type HookState = ReturnType<typeof useStaffPayrollAdmin>

const baseRow = (overrides: Partial<StaffUserRow> = {}): StaffUserRow => ({
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
  payrollHoursWorked: 10,
  payrollHourlyRate: 20,
  payrollStatus: "pending",
  payrollPaydayWeekday: 5,
  payrollDelayEntries: [{ id: "delay-1", dateLabel: "Jun 1", expectedTime: "09:00", actualTime: "09:05", delayMinutes: 5 }],
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

const profile = (overrides: Partial<SelfProfileSnapshot> = {}): SelfProfileSnapshot => ({
  firstName: "Jane",
  lastName: "Doe",
  imageUrl: "",
  location: "Austin",
  role: "staff",
  category: "teacher",
  paymentPreference: null,
  assignedPaymentPreference: null,
  paymentInfo: null,
  metrics: {
    performanceRating: null,
    performanceReviewsCount: null,
    performanceReviewCycleDays: null,
    payrollHoursWorked: null,
    payrollHourlyRate: null,
    payrollStatus: null,
    payrollPaydayWeekday: null,
  },
  presence: {
    online: false,
    authOnline: false,
    lastSignInAt: null,
    staffLastCheckInAt: null,
    status: null,
  },
  teaching: {
    teacherCourseSlugs: [],
    teacherWeekdays: [],
    teacherShiftStart: "",
    teacherShiftEnd: "",
  },
  ...overrides,
})

function HookHarness({ rows, onState }: { rows: StaffUserRow[]; onState: (state: HookState) => void }) {
  const state = useStaffPayrollAdmin({ rows, nowTs: 1_700_000_600_000, currentUserId: "staff-1", resolvedSelfProfile: profile() })
  onState(state)
  return <div>{state.payrollRows.length}</div>
}

describe("useStaffPayrollAdmin", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null
  let latestState: HookState | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    latestState = null
    vi.useRealTimers()
  })

  async function renderHookHarness(rows: StaffUserRow[] = [baseRow()]) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root!.render(<HookHarness rows={rows} onState={(state) => { latestState = state }} />))
    return latestState!
  }

  it("derives payroll rows and summary from staff rows", async () => {
    vi.setSystemTime(new Date("2026-06-06T12:00:00.000Z"))
    const state = await renderHookHarness([
      baseRow(),
      baseRow({ id: "staff-2", firstName: "Paid", lastName: "User", payrollStatus: "paid", payrollHoursWorked: 4, payrollHourlyRate: 25, payrollPaydayWeekday: 3 }),
    ])

    expect(state.payrollRows[0]).toMatchObject({ amountCents: 20000, paydayLabel: "Friday", status: "pending" })
    expect(state.payrollSummary.total).toBe(30000)
    expect(state.payrollSummary.pending).toBe(20000)
    expect(state.payrollSummary.paid).toBe(10000)
    expect(state.payrollSummary.fridayCount).toBe(1)
    expect(state.payrollSummary.exceptions).toEqual([{ id: "staff-2", name: "Paid User", dayLabel: "Wednesday" }])
  })

  it("derives live session minutes for rows and current profile", async () => {
    const state = await renderHookHarness()

    expect(state.getLiveSessionMinutes(baseRow())).toBe(10)
    expect(state.selfLiveSessionMinutes).toBe(10)
    expect(state.getLiveSessionMinutes(baseRow({ online: false }))).toBeNull()
  })

  it("opens and closes payroll delay details", async () => {
    const state = await renderHookHarness()

    await act(async () => {
      state.openDelayDetails(state.payrollRows[0])
    })
    expect(latestState!.delayModal).toMatchObject({ totalDelayMinutes: 5, lateDays: 1 })

    await act(async () => {
      latestState!.closeDelayDetails()
    })
    expect(latestState!.delayModal).toBeNull()
  })
})
