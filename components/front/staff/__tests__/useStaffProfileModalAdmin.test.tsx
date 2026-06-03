// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useStaffProfileModalAdmin } from "@/components/front/staff/useStaffProfileModalAdmin"
import type { StaffUserRow } from "@/components/front/staff/staffAdminTypes"

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

testGlobal.IS_REACT_ACT_ENVIRONMENT = true

const createSampleRow = (overrides: Partial<StaffUserRow> = {}): StaffUserRow => ({
  id: "user-1",
  paymentModelId: null,
  email: "user@example.com",
  phone: "",
  avatarUrl: "",
  location: "Buenos Aires",
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
  ...overrides,
})

const createInput = (
  overrides: Partial<Parameters<typeof useStaffProfileModalAdmin>[0]> = {}
) => ({
  currentUserId: "user-1",
  ensureMinimumLoadingTime: vi.fn().mockResolvedValue(undefined),
  canAccessUsersNav: true,
  refreshRows: vi.fn().mockResolvedValue(undefined),
  refreshSelfProfile: vi.fn().mockResolvedValue(undefined),
  updateRowAvatar: vi.fn(),
  ...overrides,
})

type HookResult = ReturnType<typeof useStaffProfileModalAdmin>

describe("useStaffProfileModalAdmin", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null
  let captured: HookResult | null = null
  let currentInput: ReturnType<typeof createInput> = createInput()

  beforeEach(() => {
    if (!globalThis.window) {
      throw new Error("jsdom window is required")
    }
  })

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount()
      })
    }
    container?.remove()
    root = null
    container = null
    captured = null
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  async function renderHook(input = createInput()) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    currentInput = input

    function Harness() {
      captured = useStaffProfileModalAdmin(currentInput)
      return null
    }

    await act(async () => {
      root!.render(<Harness />)
    })

    return input
  }

  it("initialises modal closed with empty profile form", async () => {
    await renderHook()
    expect(captured!.profileModalOpen).toBe(false)
    expect(captured!.profileTarget).toBeNull()
    expect(captured!.profileLoading).toBe(false)
    expect(captured!.profileSaving).toBe(false)
    expect(captured!.profileHasPin).toBe(false)
    expect(captured!.profileCanEditRole).toBe(false)
    expect(captured!.profileForm.firstName).toBe("")
    expect(captured!.profileForm.gallery).toEqual([])
    expect(captured!.profileForm.pin).toBe("")
    expect(captured!.profileForm.clearPin).toBe(false)
  })

  it("openProfileModal hydrates the form from /api/staff/users/:id/profile", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          canEditRole: true,
          user: {
            firstName: "Jane",
            lastName: "Doe",
            role: "admin",
            category: "manager",
            imageUrl: "https://cdn.example/avatar.png",
            hasPin: true,
            profile: {
              birthDate: "1990-01-01",
              addressLine1: "Calle 1",
              addressLine2: "",
              city: "CABA",
              state: "CABA",
              postalCode: "1000",
              country: "AR",
              personalNote: "VIP",
              location: "HQ",
              gallery: ["a.png", "b.png", 42, null, "c.png"],
            },
          },
        }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await renderHook()
    await act(async () => {
      await captured!.openProfileModal(createSampleRow())
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/staff/users/user-1/profile",
      expect.objectContaining({ headers: { "Content-Type": "application/json" } })
    )
    expect(captured!.profileModalOpen).toBe(true)
    expect(captured!.profileCanEditRole).toBe(true)
    expect(captured!.profileHasPin).toBe(true)
    expect(captured!.profileForm.firstName).toBe("Jane")
    expect(captured!.profileForm.role).toBe("admin")
    expect(captured!.profileForm.category).toBe("manager")
    expect(captured!.profileForm.birthDate).toBe("1990-01-01")
    expect(captured!.profileForm.personalNote).toBe("VIP")
    expect(captured!.profileForm.location).toBe("HQ")
    expect(captured!.profileForm.gallery).toEqual(["a.png", "b.png", "c.png"])
    expect(captured!.profileTarget?.avatarUrl).toBe("https://cdn.example/avatar.png")
  })

  it("openProfileModal normalizes category for roles with a fixed category (owner ⇒ partner)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          canEditRole: true,
          user: {
            firstName: "Owen",
            lastName: "Ner",
            role: "owner",
            category: "guest",
            profile: {},
          },
        }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await renderHook()
    await act(async () => {
      await captured!.openProfileModal(createSampleRow({ role: "owner" }))
    })

    expect(captured!.profileForm.role).toBe("owner")
    expect(captured!.profileForm.category).toBe("partner")
  })

  it("updateProfileRole normalizes category when switching to a fixed-category role", async () => {
    await renderHook()
    await act(async () => {
      captured!.updateProfileField("category", "guest")
      captured!.updateProfileRole("admin")
    })
    expect(captured!.profileForm.role).toBe("admin")
    expect(captured!.profileForm.category).toBe("manager")
  })

  it("updateProfilePin sanitizes input to at most 4 digits", async () => {
    await renderHook()
    await act(async () => {
      captured!.updateProfilePin("ab12cd34ef56")
    })
    expect(captured!.profileForm.pin).toBe("1234")
  })

  it("updateProfileClearPin toggles clearPin flag", async () => {
    await renderHook()
    await act(async () => {
      captured!.updateProfileClearPin(true)
    })
    expect(captured!.profileForm.clearPin).toBe(true)
    await act(async () => {
      captured!.updateProfileClearPin(false)
    })
    expect(captured!.profileForm.clearPin).toBe(false)
  })

  it("clearProfileGallery empties the gallery and removeProfileGalleryImage removes by index", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          user: {
            firstName: "J",
            lastName: "D",
            role: "staff",
            category: "guest",
            profile: { gallery: ["a.png", "b.png", "c.png"] },
          },
        }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await renderHook()
    await act(async () => {
      await captured!.openProfileModal(createSampleRow())
    })
    expect(captured!.profileForm.gallery).toEqual(["a.png", "b.png", "c.png"])

    await act(async () => {
      captured!.removeProfileGalleryImage(1)
    })
    expect(captured!.profileForm.gallery).toEqual(["a.png", "c.png"])

    await act(async () => {
      captured!.clearProfileGallery()
    })
    expect(captured!.profileForm.gallery).toEqual([])
  })

  it("saveProfileModal posts the profile, runs refresh callbacks, and closes the modal", async () => {
    const fetchMock = vi
      .fn()
      // openProfileModal hydration
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            canEditRole: true,
            user: {
              firstName: "Jane",
              lastName: "Doe",
              role: "staff",
              category: "guest",
              hasPin: false,
              profile: {},
            },
          }),
      })
      // saveProfileModal PATCH
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            user: { role: "admin", category: "manager", hasPin: true },
          }),
      })
    vi.stubGlobal("fetch", fetchMock)

    const input = createInput()
    await renderHook(input)
    await act(async () => {
      await captured!.openProfileModal(createSampleRow())
    })

    await act(async () => {
      await captured!.saveProfileModal()
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(url).toBe("/api/staff/users/user-1/profile")
    expect(init.method).toBe("PATCH")
    expect(captured!.profileForm.role).toBe("admin")
    expect(captured!.profileForm.category).toBe("manager")
    expect(captured!.profileHasPin).toBe(true)
    expect(captured!.profileForm.pin).toBe("")
    expect(captured!.profileForm.clearPin).toBe(false)
    expect(input.refreshRows).toHaveBeenCalledTimes(1)
    expect(input.refreshSelfProfile).toHaveBeenCalledTimes(1)
    expect(captured!.profileModalOpen).toBe(false)
    expect(captured!.profileTarget).toBeNull()
  })

  it("saveProfileModal skips refreshRows when canAccessUsersNav is false and skips refreshSelfProfile when target is another user", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            user: { firstName: "J", lastName: "D", role: "staff", category: "guest", profile: {} },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ user: {} }),
      })
    vi.stubGlobal("fetch", fetchMock)

    const input = createInput({ canAccessUsersNav: false })
    await renderHook(input)
    await act(async () => {
      await captured!.openProfileModal(createSampleRow({ id: "other-user" }))
    })
    await act(async () => {
      await captured!.saveProfileModal()
    })

    expect(input.refreshRows).not.toHaveBeenCalled()
    expect(input.refreshSelfProfile).not.toHaveBeenCalled()
  })

  it("uploadProfileAvatar calls updateRowAvatar with the returned image url and sets success message", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            user: { firstName: "J", lastName: "D", role: "staff", category: "guest", profile: {} },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ imageUrl: "https://cdn.example/new-avatar.png" }),
      })
    vi.stubGlobal("fetch", fetchMock)

    const input = createInput()
    await renderHook(input)
    await act(async () => {
      await captured!.openProfileModal(createSampleRow())
    })

    const file = new File(["x"], "avatar.png", { type: "image/png" })
    await act(async () => {
      await captured!.uploadProfileAvatar(file)
    })

    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(url).toBe("/api/staff/users/user-1/avatar")
    expect(init.method).toBe("PATCH")
    expect(input.updateRowAvatar).toHaveBeenCalledWith("user-1", "https://cdn.example/new-avatar.png")
    expect(captured!.profileTarget?.avatarUrl).toBe("https://cdn.example/new-avatar.png")
    expect(captured!.profileSuccess).toBe("Avatar updated.")
  })

  it("closeProfileModal resets modal state without clearing the form", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          canEditRole: true,
          user: {
            firstName: "Jane",
            lastName: "Doe",
            role: "staff",
            category: "guest",
            profile: {},
          },
        }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await renderHook()
    await act(async () => {
      await captured!.openProfileModal(createSampleRow())
    })

    await act(async () => {
      captured!.closeProfileModal()
    })

    expect(captured!.profileModalOpen).toBe(false)
    expect(captured!.profileTarget).toBeNull()
    expect(captured!.profileError).toBeNull()
    expect(captured!.profileSuccess).toBeNull()
    expect(captured!.profileCanEditRole).toBe(false)
    expect(captured!.profileAvatarError).toBeNull()
    expect(captured!.profileGalleryUploading).toBe(false)
    expect(captured!.profileForm.firstName).toBe("Jane")
    expect(captured!.profileForm.lastName).toBe("Doe")
  })

  it("saveProfileModal keeps the modal open and skips refresh callbacks on non-OK responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            user: { firstName: "Jane", lastName: "Doe", role: "staff", category: "guest", profile: {} },
          }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: "Invalid profile" }),
      })
    vi.stubGlobal("fetch", fetchMock)

    const input = createInput()
    await renderHook(input)
    await act(async () => {
      await captured!.openProfileModal(createSampleRow())
    })

    await act(async () => {
      await captured!.saveProfileModal()
    })

    expect(captured!.profileError).toBe("Invalid profile")
    expect(captured!.profileModalOpen).toBe(true)
    expect(captured!.profileTarget?.id).toBe("user-1")
    expect(input.refreshRows).not.toHaveBeenCalled()
    expect(input.refreshSelfProfile).not.toHaveBeenCalled()
  })

  it("uploadProfileGalleryImages ignores duplicate URLs and stops at 6 images", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            user: {
              firstName: "Jane",
              lastName: "Doe",
              role: "staff",
              category: "guest",
              profile: { gallery: ["a.png", "b.png", "c.png", "d.png", "e.png"] },
            },
          }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ url: "c.png" }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ url: "f.png" }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ url: "g.png" }) })
    vi.stubGlobal("fetch", fetchMock)

    await renderHook()
    await act(async () => {
      await captured!.openProfileModal(createSampleRow())
    })

    const files = [
      new File(["x"], "duplicate.png", { type: "image/png" }),
      new File(["x"], "sixth.png", { type: "image/png" }),
      new File(["x"], "overflow.png", { type: "image/png" }),
    ]
    await act(async () => {
      await captured!.uploadProfileGalleryImages(files)
    })

    expect(captured!.profileForm.gallery).toEqual(["a.png", "b.png", "c.png", "d.png", "e.png", "f.png"])
  })
})
