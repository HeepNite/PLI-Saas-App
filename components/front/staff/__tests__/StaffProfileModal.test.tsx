// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import StaffProfileModal, { type StaffProfileModalProps } from "@/components/front/staff/StaffProfileModal"

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

testGlobal.IS_REACT_ACT_ENVIRONMENT = true

const createProps = (overrides: Partial<StaffProfileModalProps> = {}): StaffProfileModalProps => ({
  profileModalOpen: true,
  profileTarget: {
    id: "user-1",
    paymentModelId: null,
    email: "jane@example.com",
    phone: "",
    avatarUrl: "",
    location: "HQ",
    hasPin: false,
    firstName: "Jane",
    lastName: "Doe",
    role: "staff",
    category: "guest",
    payrollHoursWorked: null,
    payrollHourlyRate: null,
    payrollStatus: null,
    payrollPaydayWeekday: null,
    payrollDelayEntries: [],
    performanceRating: null,
    performanceReviewsCount: null,
    performanceReviewCycleDays: null,
    teacherType: "full_time",
    teacherAssignedUserId: "",
    teacherRecurrenceUnit: "month",
    teacherRecurrenceInterval: null,
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
    createdAt: Date.now(),
    lastSignInAt: null,
  },
  profileLoading: false,
  profileSaving: false,
  profileError: null,
  profileSuccess: null,
  profileHasPin: false,
  profileCanEditRole: true,
  profileAvatarUploading: false,
  profileAvatarError: null,
  profileGalleryUploading: false,
  profileForm: {
    firstName: "Jane",
    lastName: "Doe",
    role: "staff",
    category: "guest",
    birthDate: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    personalNote: "",
    location: "HQ",
    gallery: [],
    pin: "",
    clearPin: false,
  },
  setProfileForm: vi.fn(),
  openProfileModal: vi.fn(),
  closeProfileModal: vi.fn(),
  saveProfileModal: vi.fn().mockResolvedValue(undefined),
  uploadProfileAvatar: vi.fn().mockResolvedValue(undefined),
  uploadProfileGalleryImages: vi.fn().mockResolvedValue(undefined),
  updateProfileField: vi.fn(),
  updateProfileRole: vi.fn(),
  clearProfileGallery: vi.fn(),
  removeProfileGalleryImage: vi.fn(),
  updateProfilePin: vi.fn(),
  updateProfileClearPin: vi.fn(),
  assignableRoles: ["admin", "staff"],
  ...overrides,
})

describe("StaffProfileModal", () => {
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

  async function renderModal(props: StaffProfileModalProps) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root!.render(<StaffProfileModal {...props} />)
    })
    return container
  }

  it("renders nothing when closed", async () => {
    const node = await renderModal(createProps({ profileModalOpen: false }))

    expect(node.textContent).not.toContain("Staff profile")
    expect(node.querySelector('[aria-label="Close profile editor"]')).toBeNull()
  })

  it("renders the profile editor shell when open", async () => {
    const node = await renderModal(createProps())

    expect(node.textContent).toContain("Edit Jane Doe")
    expect(node.textContent).toContain("Upload photo")
    expect(node.querySelector('[aria-label="Close profile editor"]')).not.toBeNull()
  })

  it("renders only the assignable roles provided by the container", async () => {
    const node = await renderModal(createProps({ assignableRoles: ["admin", "staff"] }))
    const roleOptions = Array.from(node.querySelectorAll('select[name="profileRole"] option')).map((option) => option.textContent)

    expect(roleOptions).toEqual(["Admin (GM)", "Staff"])
  })
})
