// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import StaffCourseScheduleStep from "@/components/front/staff/StaffCourseScheduleStep"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type Props = React.ComponentProps<typeof StaffCourseScheduleStep>

const createProps = (overrides: Partial<Props> = {}): Props => ({
  visible: true,
  schoolLoading: false,
  isSpecialEventCourse: false,
  courseForm: {
    slug: "salsa-basics",
    title: "Salsa Basics",
    kind: "course",
    category: "Salsa",
    description: "Intro class",
    previewImageUrl: "https://example.com/cover.jpg",
    previewVideoUrl: "https://example.com/video.mp4",
    dropInPriceCents: "20",
    firstClassPriceCents: "15",
    level: "Beginner",
    durationMinutes: "55",
    location: "54 Coles St",
    defaultRoomId: "",
    publicationMode: "publish_now",
    launchDate: "",
    specialDiscountType: "none",
    specialDiscountCustomLabel: "",
    specialDiscountPrice: "",
    availableTimesCsv: "",
    active: true,
  },
  setCourseForm: vi.fn(),
  courseRecurringWeekdays: [1],
  toggleCourseRecurringWeekday: vi.fn(),
  courseMirrorEnabled: false,
  setCourseMirrorEnabled: vi.fn(),
  courseMirrorWeekdays: [],
  setCourseMirrorWeekdays: vi.fn(),
  toggleCourseMirrorWeekday: vi.fn(),
  courseScheduleDate: "2026-06-15",
  setCourseScheduleDate: vi.fn(),
  courseScheduleDates: [],
  setCourseScheduleDates: vi.fn(),
  quickScheduleTimes: ["09:00", "10:00", "11:00", "12:00"],
  editingQuickTimeIndex: null,
  quickTimeDraft: "",
  setQuickTimeDraft: vi.fn(),
  setEditingQuickTimeIndex: vi.fn(),
  startEditingQuickTime: vi.fn(),
  commitQuickTimeEdit: vi.fn(),
  courseScheduleTime: "09:00",
  setCourseScheduleTime: vi.fn(),
  scheduleTimePickerOpen: false,
  setScheduleTimePickerOpen: vi.fn(),
  scheduleTimePickerRef: React.createRef<HTMLDivElement>(),
  scheduleTimeOptions: ["09:00", "10:00", "11:00"],
  scheduleSlotTimeUsage: new Map([["09:00", 4]]),
  scheduleTimeCourseUsage: new Map([["10:00", 2]]),
  addCourseScheduleSlot: vi.fn(),
  removeCourseScheduleSlot: vi.fn(),
  courseScheduleSlots: [{ weekday: 1, time: "09:00", recurring: true }],
  regularScheduleWarningMessage: null,
  courseRepeatAllMonth: true,
  setCourseRepeatAllMonth: vi.fn(),
  courseRecurrenceMode: "indefinite",
  setCourseRecurrenceMode: vi.fn(),
  courseRecurrenceEndsAt: "",
  setCourseRecurrenceEndsAt: vi.fn(),
  ...overrides,
})

describe("StaffCourseScheduleStep", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    vi.restoreAllMocks()
  })

  async function renderStep(props: Props) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root!.render(<StaffCourseScheduleStep {...props} />))
    return container
  }

  it("returns null when hidden", async () => {
    const node = await renderStep(createProps({ visible: false }))

    expect(node.textContent).toBe("")
  })

  it("renders the weekly schedule builder and wires primary actions", async () => {
    const props = createProps()
    const node = await renderStep(props)

    expect(node.textContent).toContain("1) Select days")
    expect(node.textContent).toContain("Repeat this slot on other days")
    expect(node.textContent).toContain("3) Time slot for selected days")
    expect(node.textContent).toContain("4) Repetition and validity")
    expect(node.textContent).toContain("Every Mon · 9:00 AM")

    await act(async () => {
      node.querySelectorAll("button")[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      Array.from(node.querySelectorAll("button")).find((button) => button.textContent?.includes("Add slot"))?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    expect(props.toggleCourseRecurringWeekday).toHaveBeenCalledWith(0)
    expect(props.addCourseScheduleSlot).toHaveBeenCalledTimes(1)
  })

  it("renders special event dates and adds the selected date", async () => {
    const props = createProps({ isSpecialEventCourse: true })
    const node = await renderStep(props)

    expect(node.textContent).toContain("Special event mode")
    expect(node.textContent).toContain("Event dates")
    expect(node.textContent).toContain("Time slot for event dates")

    await act(async () => {
      Array.from(node.querySelectorAll("button")).find((button) => button.textContent === "Add date")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    expect(props.setCourseScheduleDates).toHaveBeenCalledOnce()
    expect(props.setCourseScheduleDate).toHaveBeenCalledWith("")
  })

  it("renders launch-date publication controls from the extracted form state", async () => {
    const props = createProps({
      courseForm: {
        ...createProps().courseForm,
        publicationMode: "launch_date",
        launchDate: "2026-07-01",
      },
    })
    const node = await renderStep(props)
    const publicationSelect = node.querySelector<HTMLSelectElement>('select[name="coursePublicationMode"]')
    const launchDateInput = node.querySelector<HTMLInputElement>('input[name="courseLaunchDate"]')

    expect(publicationSelect?.value).toBe("launch_date")
    expect(launchDateInput?.value).toBe("2026-07-01")
  })
})
