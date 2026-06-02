// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import StaffProfileViewPanel from "@/components/front/staff/StaffProfileViewPanel"
import type {
  ProfileRequestFormState,
  SelfProfileSnapshot,
  StaffPaymentForm,
  StaffRequestRow,
  StaffRequestSummary,
  StaffUserRow,
} from "@/components/front/staff/staffAdminTypes"

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type StaffProfileViewPanelProps = React.ComponentProps<typeof StaffProfileViewPanel>

const resolvedSelfProfile: SelfProfileSnapshot = {
  firstName: "Jane",
  lastName: "Staff",
  imageUrl: "",
  location: "Austin",
  role: "staff",
  category: "teacher",
  paymentPreference: "zelle",
  assignedPaymentPreference: "zelle",
  paymentInfo: null,
  metrics: {
    performanceRating: 4.2,
    performanceReviewsCount: 6,
    performanceReviewCycleDays: 30,
    payrollHoursWorked: 22.5,
    payrollHourlyRate: 5000,
    payrollStatus: "pending",
    payrollPaydayWeekday: 5,
  },
  presence: {
    online: true,
    authOnline: true,
    lastSignInAt: null,
    staffLastCheckInAt: null,
    status: "online",
  },
  teaching: {
    teacherCourseSlugs: ["bachata"],
    teacherWeekdays: [1, 3],
    teacherShiftStart: "10:00",
    teacherShiftEnd: "18:00",
  },
}

const selfProfileRow: StaffUserRow = {
  id: "self-id",
  paymentModelId: null,
  email: "self@example.com",
  phone: "",
  avatarUrl: "",
  location: "Austin",
  hasPin: false,
  firstName: "Jane",
  lastName: "Staff",
  role: "staff",
  category: "teacher",
  payrollHoursWorked: null,
  payrollHourlyRate: null,
  payrollStatus: "pending",
  payrollPaydayWeekday: null,
  payrollDelayEntries: [],
  performanceRating: 4.2,
  performanceReviewsCount: 6,
  performanceReviewCycleDays: 30,
  teacherType: "lead",
  teacherAssignedUserId: "self-id",
  teacherRecurrenceUnit: "month",
  teacherRecurrenceInterval: 1,
  teacherCourseSlugs: ["bachata"],
  teacherWeekdays: [1, 3],
  teacherShiftStart: "10:00",
  teacherShiftEnd: "18:00",
  teacherWeeklyHours: 16,
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

const profilePaymentForm: StaffPaymentForm = {
  paymentPreference: "zelle",
  cbu: "",
  alias: "",
  accountHolder: "",
  mercadoPagoId: "",
  bankName: "",
  routingNumber: "",
  accountNumber: "",
  zelleId: "jane@example.com",
  venmoUser: "",
  accountType: "",
}

const profileRequestForm: ProfileRequestFormState = {
  type: "STAFF_SCHEDULE_CHANGE",
  message: "Need Friday off",
  startDate: "2026-06-01",
  endDate: "2026-06-02",
  preferredShift: "",
  consultTopic: "",
}

const requestsSummary: StaffRequestSummary = {
  total: 4,
  pending: 2,
  inReview: 1,
  approved: 1,
  rejected: 0,
}

const sampleRequest: StaffRequestRow = {
  id: "req-1",
  type: "STAFF_SCHEDULE_CHANGE",
  status: "PENDING",
  message: "Swap Tuesday shift",
  meta: {},
  createdAt: "2026-05-12T10:00:00.000Z",
  updatedAt: "2026-05-12T10:00:00.000Z",
  resolvedAt: null,
  user: { id: "self-id", name: "Jane Staff", email: "self@example.com", phone: "" },
}

const createProps = (
  overrides: Partial<StaffProfileViewPanelProps> = {},
): StaffProfileViewPanelProps => ({
  isProfileView: true,
  resolvedSelfProfile,
  selfProfileRow,
  selfProfileLoading: false,
  selfIsOnline: true,
  selfLiveSessionMinutes: 42,
  selfPerformanceScore: 87,
  selfRecommendations: ["Keep great attendance", "Aim for 30 bonus hours"],
  profilePaymentExpanded: false,
  profilePaymentSummaryCards: [
    { label: "Zelle ID", value: "jane@example.com" },
  ],
  profilePaymentForm,
  profilePaymentSaving: false,
  profilePaymentError: null,
  profilePaymentSuccess: null,
  profileScheduleMonth: new Date(2026, 4, 1),
  profileScheduleMonthLabel: "May 2026",
  profileCalendarCells: [
    { day: 1, dateKey: "2026-05-01", inMonth: true },
    { day: 2, dateKey: "2026-05-02", inMonth: true },
  ],
  selfScheduleEntries: [
    {
      id: "profile-schedule-2026-05-04-0",
      dateKey: "2026-05-04",
      title: "Bachata Basics",
      timeLabel: "10:00 AM - 6:00 PM",
    },
  ],
  selfScheduleByDay: {
    "2026-05-04": [
      {
        id: "profile-schedule-2026-05-04-0",
        dateKey: "2026-05-04",
        title: "Bachata Basics",
        timeLabel: "10:00 AM - 6:00 PM",
      },
    ],
  },
  selfCalendarGoogleHref: "https://calendar.google.com/calendar/render",
  selfCalendarIcsDataUri: "data:text/calendar;base64,QkVHSU4=",
  profileRequestForm,
  profileRequestSubmitting: false,
  profileRequestError: null,
  profileRequestSuccess: null,
  profileRequestStatusFilter: "all",
  selectedProfileRequestType: {
    value: "STAFF_SCHEDULE_CHANGE",
    label: "Schedule change",
    hint: "Use this for shift swaps",
  },
  requestsSummary,
  requestsLoading: false,
  staffRequests: [sampleRequest],
  setProfilePaymentExpanded: vi.fn(),
  setProfilePaymentError: vi.fn(),
  setProfilePaymentSuccess: vi.fn(),
  setProfilePaymentForm: vi.fn(),
  setProfileScheduleMonth: vi.fn(),
  setProfileRequestForm: vi.fn(),
  setProfileRequestStatusFilter: vi.fn(),
  openProfileModal: vi.fn(),
  saveProfilePaymentInfo: vi.fn((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
  }),
  submitProfileRequest: vi.fn((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
  }),
  getInitials: vi.fn(() => "JS"),
  formatDurationLabel: vi.fn((minutes: number) => `${minutes}m`),
  formatIsoDate: vi.fn(() => "2026-05-12"),
  ...overrides,
})

describe("StaffProfileViewPanel", () => {
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

  async function renderPanel(props: StaffProfileViewPanelProps) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root!.render(<StaffProfileViewPanel {...props} />)
    })
    return container
  }

  it("renders nothing when profile view is hidden", async () => {
    const node = await renderPanel(createProps({ isProfileView: false }))

    expect(node.textContent).not.toContain("Employee profile")
  })

  it("renders profile header, metrics, schedule and recommendations", async () => {
    const node = await renderPanel(createProps())

    expect(node.textContent).toContain("Employee profile")
    expect(node.textContent).toContain("Jane Staff")
    expect(node.textContent).toContain("Performance score")
    expect(node.textContent).toContain("87")
    expect(node.textContent).toContain("May 2026")
    expect(node.textContent).toContain("Keep great attendance")
    expect(node.textContent).toContain("Swap Tuesday shift")
    expect(node.textContent).toContain("Working 42m")
  })

  it("opens profile modal when Edit my profile is clicked", async () => {
    const openProfileModal = vi.fn()
    const node = await renderPanel(createProps({ openProfileModal }))

    const editButton = Array.from(node.querySelectorAll("button")).find(
      (button) => button.textContent === "Edit my profile",
    )
    expect(editButton).toBeDefined()
    await act(async () => {
      editButton!.click()
    })

    expect(openProfileModal).toHaveBeenCalledWith(selfProfileRow)
  })

  it("wires schedule month navigation callbacks", async () => {
    const setProfileScheduleMonth = vi.fn()
    const node = await renderPanel(createProps({ setProfileScheduleMonth }))

    const prevBtn = node.querySelector<HTMLButtonElement>(
      'button[aria-label="Previous month"]',
    )
    const nextBtn = node.querySelector<HTMLButtonElement>(
      'button[aria-label="Next month"]',
    )

    await act(async () => {
      prevBtn!.click()
      nextBtn!.click()
    })

    expect(setProfileScheduleMonth).toHaveBeenCalledTimes(2)
  })

  it("submits profile request via form callback", async () => {
    const submitProfileRequest = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
    })
    const node = await renderPanel(createProps({ submitProfileRequest }))

    const form = Array.from(node.querySelectorAll("form")).find((element) =>
      Array.from(element.querySelectorAll("button")).some(
        (btn) => btn.textContent === "Send request",
      ),
    )
    expect(form).toBeDefined()
    await act(async () => {
      form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    })

    expect(submitProfileRequest).toHaveBeenCalledTimes(1)
  })

  it("toggles payment expanded with toggle handlers and reveals form", async () => {
    const setProfilePaymentExpanded = vi.fn()
    const setProfilePaymentError = vi.fn()
    const setProfilePaymentSuccess = vi.fn()
    const node = await renderPanel(
      createProps({
        setProfilePaymentExpanded,
        setProfilePaymentError,
        setProfilePaymentSuccess,
      }),
    )

    const toggleButton = Array.from(node.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Edit payment details"),
    )
    expect(toggleButton).toBeDefined()

    await act(async () => {
      toggleButton!.click()
    })

    expect(setProfilePaymentExpanded).toHaveBeenCalledTimes(1)
    expect(setProfilePaymentError).toHaveBeenCalledWith(null)
    expect(setProfilePaymentSuccess).toHaveBeenCalledWith(null)
  })

  it("submits payment info when expanded form is shown", async () => {
    const saveProfilePaymentInfo = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
    })
    const node = await renderPanel(
      createProps({ profilePaymentExpanded: true, saveProfilePaymentInfo }),
    )

    const submitButton = Array.from(node.querySelectorAll("button[type='submit']")).find(
      (button) => button.textContent === "Save information",
    )
    expect(submitButton).toBeDefined()
    const form = submitButton!.closest("form")!
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    })

    expect(saveProfilePaymentInfo).toHaveBeenCalledTimes(1)
  })

  it("shows requests loading skeletons when requests are loading", async () => {
    const node = await renderPanel(
      createProps({ requestsLoading: true, staffRequests: [] }),
    )

    const skeletons = node.querySelectorAll("[class*='shimmer']")
    expect(skeletons.length).toBeGreaterThan(0)
    expect(node.textContent).not.toContain("No requests yet.")
  })

  it("shows empty state when there are no requests", async () => {
    const node = await renderPanel(
      createProps({ requestsLoading: false, staffRequests: [] }),
    )

    expect(node.textContent).toContain("No requests yet.")
  })
})
