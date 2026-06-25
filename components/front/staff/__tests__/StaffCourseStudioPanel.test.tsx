// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import StaffCourseStudioPanel from "@/components/front/staff/StaffCourseStudioPanel"
import type { CourseFormState } from "@/components/front/staff/staffAdminTypes"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type Props = React.ComponentProps<typeof StaffCourseStudioPanel>

const dispatch = <T,>() => vi.fn() as React.Dispatch<React.SetStateAction<T>>

const courseForm: CourseFormState = {
  slug: "salsa-basics",
  title: "Salsa Basics",
  kind: "course",
  category: "Salsa",
  description: "Intro class",
  previewImageUrl: "",
  previewVideoUrl: "",
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
}

const createProps = (overrides: Partial<Props> = {}): Props => ({
  wizard: {
    activeEntity: "courses",
    step: 0,
    totalSteps: 7,
    enabledContext: { courseEditingSlug: "salsa-basics" },
    onPrevious: vi.fn(),
    onNext: vi.fn(),
  },
  form: {
    onSubmit: vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault()),
    courseImageInputRef: React.createRef<HTMLInputElement>(),
    courseVideoInputRef: React.createRef<HTMLInputElement>(),
    courseFormFieldsRef: React.createRef<HTMLDivElement>(),
    onLocalImageChange: vi.fn(),
    onLocalVideoChange: vi.fn(),
  },
  isSpecialEventCourse: false,
  mainInfo: {
    courseForm,
    setCourseForm: dispatch<CourseFormState>(),
    courseSlugConflict: { exists: false, existingTitle: null, suggestion: null },
    courseRoomOptions: [],
    roomById: {},
    onUseSlugSuggestion: vi.fn(),
    onEditExistingCourse: vi.fn(),
  },
  pricing: {
    courseEditingSlug: "salsa-basics",
    courseForm,
    setCourseForm: dispatch<CourseFormState>(),
  },
  media: {
    courseEditingSlug: "salsa-basics",
    courseForm,
    setCourseForm: dispatch<CourseFormState>(),
    courseMediaUploading: null,
    courseLocalVideoName: null,
    courseLocalImageName: null,
  },
  schedule: {
    schoolLoading: false,
    courseForm,
    setCourseForm: dispatch<CourseFormState>(),
    courseRecurringWeekdays: [],
    toggleCourseRecurringWeekday: vi.fn(),
    courseMirrorEnabled: false,
    setCourseMirrorEnabled: dispatch<boolean>(),
    courseMirrorWeekdays: [],
    setCourseMirrorWeekdays: dispatch<number[]>(),
    toggleCourseMirrorWeekday: vi.fn(),
    courseScheduleDate: "",
    setCourseScheduleDate: dispatch<string>(),
    courseScheduleDates: [],
    setCourseScheduleDates: dispatch<string[]>(),
    quickScheduleTimes: ["09:00"],
    editingQuickTimeIndex: null,
    quickTimeDraft: "",
    setQuickTimeDraft: dispatch<string>(),
    setEditingQuickTimeIndex: dispatch<number | null>(),
    startEditingQuickTime: vi.fn(),
    commitQuickTimeEdit: vi.fn(),
    courseScheduleTime: "09:00",
    setCourseScheduleTime: dispatch<string>(),
    scheduleTimePickerOpen: false,
    setScheduleTimePickerOpen: dispatch<boolean>(),
    scheduleTimePickerRef: React.createRef<HTMLDivElement>(),
    scheduleTimeOptions: ["09:00"],
    scheduleSlotTimeUsage: new Map(),
    scheduleTimeCourseUsage: new Map(),
    addCourseScheduleSlot: vi.fn(),
    removeCourseScheduleSlot: vi.fn(),
    courseScheduleSlots: [],
    regularScheduleWarningMessage: null,
    courseRepeatAllMonth: false,
    setCourseRepeatAllMonth: dispatch<boolean>(),
    courseRecurrenceMode: "indefinite",
    setCourseRecurrenceMode: dispatch<"indefinite" | "until_date">(),
    courseRecurrenceEndsAt: "",
    setCourseRecurrenceEndsAt: dispatch<string>(),
  },
  links: {
    courseEditingSlug: "salsa-basics",
    schoolCourses: [],
    courseLinkError: null,
    courseLinkSuccess: null,
    courseLinkForm: { courseSlugB: "", dropInConsecutiveCents: "", packageHolderConsecutiveCents: "", active: true },
    setCourseLinkForm: dispatch(),
    courseLinkSaving: false,
    courseLinkEditingId: null,
    courseLinksAsA: [],
    courseLinksAsB: [],
    onSaveCourseLink: vi.fn(),
    onResetCourseLinkForm: vi.fn(),
    onToggleCourseLinkActive: vi.fn(),
    onEditCourseLink: vi.fn(),
    onDeleteCourseLink: vi.fn(),
    formatUsdInputLabel: (value) => `$${value}`,
    centsToUsdInput: (cents) => String(cents ?? 0),
  },
  preview: {
    schoolLoading: false,
    courseForm,
    selectedCourseKindLabel: "Course",
    selectedCourseKindReviewLabel: "Course",
    courseReviewVariants: [],
    reviewPreviewHover: null,
    setReviewPreviewHover: dispatch<"home" | "single" | null>(),
    previewVideoSource: "",
    isEmbedPreviewVideo: false,
    previewMediaUrl: null,
    previewEditorHref: "/courses/salsa-basics",
    defaultRoomName: "None",
    scheduleTimes: [],
    scheduleCalendarValues: [],
    formatUsdInputLabel: (value) => `$${value}`,
    formatClockLabel: (value) => value,
    getCourseScheduleDateTooltip: () => undefined,
    getCourseScheduleDateTone: () => undefined,
  },
  publish: {
    courseEditingSlug: "salsa-basics",
    previewPublicHref: "/courses/salsa-basics",
    schoolBusy: null,
    courseMediaUploading: null,
    onCopyCourseLink: vi.fn(),
    onShareCourse: vi.fn(),
    onResetCourseBuilder: vi.fn(),
  },
  ...overrides,
})

describe("StaffCourseStudioPanel", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    vi.restoreAllMocks()
  })

  async function renderPanel(props: Props) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root!.render(<StaffCourseStudioPanel {...props} />))
    return container
  }

  it("returns null outside the courses entity", async () => {
    const node = await renderPanel(createProps({ wizard: { ...createProps().wizard, activeEntity: "rooms" } }))

    expect(node.textContent).toBe("")
  })

  it("renders the current step title and navigation", async () => {
    const props = createProps({ wizard: { ...createProps().wizard, step: 1 } })
    const node = await renderPanel(props)

    expect(node.textContent).toContain("Prices and discounts")
    expect(node.textContent).toContain("Step 2 of 7")

    await act(async () => {
      Array.from(node.querySelectorAll("button")).find((button) => button.textContent === "Next →")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      Array.from(node.querySelectorAll("button")).find((button) => button.textContent === "← Previous")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    expect(props.wizard.onNext).toHaveBeenCalledWith(props.wizard.enabledContext)
    expect(props.wizard.onPrevious).toHaveBeenCalledWith(props.wizard.enabledContext)
  })

  it("keeps draft schedule and preview steps available before the course is persisted", async () => {
    const draftProps = createProps({
      wizard: { ...createProps().wizard, step: 3, enabledContext: { courseEditingSlug: null } },
      links: { ...createProps().links, courseEditingSlug: null },
      pricing: { ...createProps().pricing, courseEditingSlug: null },
      media: { ...createProps().media, courseEditingSlug: null },
      publish: { ...createProps().publish, courseEditingSlug: null },
    })
    const node = await renderPanel(draftProps)

    expect(node.textContent).toContain("Schedule builder")
    expect(node.textContent).not.toContain("Create the course first to configure this step.")
  })
})
