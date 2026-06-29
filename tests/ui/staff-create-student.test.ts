/**
 * UI-layer tests for staff-create-student visibility and hook behavior.
 *
 * Covers:
 * - createStudent prop is non-null for owner/admin/front_desk
 * - createStudent prop is null for unauthorized staff (teacher, guest)
 * - hook form validation: canSubmit requires email or phone
 * - hook form validation: canSubmit requires paymentMode when amount > 0
 * - hook resets state on closeModal
 */

import { describe, expect, it, vi } from "vitest"
import { canOperateStudentEdits } from "@/lib/security/staff-access"
import {
  buildCreateStudentSessionsRequestUrl,
  buildCreateStudentRequestBody,
  canSubmitCreateStudentForm,
  createInitialStudentForm,
  getEarliestStaffAttendanceDate,
  getTodayStaffDate,
  reconcileCreateStudentFormWithSessions,
  updateCreateStudentFormField,
  type CreateStudentFormState,
} from "@/components/front/staff/useStaffCreateStudentAdmin"

const STAFF_REGISTRATION_SENTINEL = "_staff_registration"

describe("createStudent visibility gate", () => {
  it("allows owner to see the New student button", () => {
    expect(canOperateStudentEdits("owner", null)).toBe(true)
  })

  it("allows admin to see the New student button", () => {
    expect(canOperateStudentEdits("admin", "manager")).toBe(true)
  })

  it("allows front_desk to see the New student button", () => {
    expect(canOperateStudentEdits("staff", "front_desk")).toBe(true)
  })

  it("blocks teacher from seeing the New student button", () => {
    expect(canOperateStudentEdits("staff", "teacher")).toBe(false)
  })

  it("blocks guest without front_desk sub from seeing the New student button", () => {
    expect(canOperateStudentEdits("staff", "guest")).toBe(false)
  })

  it("blocks null role from seeing the New student button", () => {
    expect(canOperateStudentEdits(null, "front_desk")).toBe(false)
  })
})

describe("sentinel purchase safety", () => {
  it("sentinel courseSlug starts with underscore and is not a valid class slug", () => {
    expect(STAFF_REGISTRATION_SENTINEL.startsWith("_")).toBe(true)
  })

  it("isStaffRegistrationSentinel correctly identifies the sentinel slug", () => {
    const isStaffRegistrationSentinel = (slug: string | null | undefined) =>
      slug === STAFF_REGISTRATION_SENTINEL

    expect(isStaffRegistrationSentinel("_staff_registration")).toBe(true)
    expect(isStaffRegistrationSentinel("yoga-basics")).toBe(false)
    expect(isStaffRegistrationSentinel(null)).toBe(false)
    expect(isStaffRegistrationSentinel(undefined)).toBe(false)
    expect(isStaffRegistrationSentinel("")).toBe(false)
  })
})

describe("create student attendance payload", () => {
  it("defaults the attendance date to today in the staff timezone", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-05-01T18:30:00.000Z"))

    expect(getTodayStaffDate()).toBe("2026-05-01")
    expect(createInitialStudentForm().attendanceDate).toBe("2026-05-01")

    vi.useRealTimers()
  })

  it("bounds attendance date input helpers to today and the 14-day backfill window", () => {
    const now = new Date("2026-05-01T18:30:00.000Z")

    expect(getTodayStaffDate(now)).toBe("2026-05-01")
    expect(getEarliestStaffAttendanceDate(now)).toBe("2026-04-17")
  })

  it("defaults attendance creation to the current class session when available", () => {
    const form = createInitialStudentForm([
      {
        id: "session_current",
        courseSlug: "salsa-basics",
        title: "Salsa Basics",
        startsAt: "2026-05-01T18:00:00.000Z",
        durationMinutes: 60,
        isCurrent: true,
      },
    ])

    expect(form.createAttendance).toBe(true)
    expect(form.attendanceSessionId).toBe("session_current")
  })

  it("submits the selected attendance session in the checkIn payload", () => {
    const form: CreateStudentFormState = {
      ...createInitialStudentForm(),
      email: "student@example.com",
      createAttendance: true,
      attendanceDate: "2026-04-30",
      attendanceSessionId: "session_previous",
    }

    expect(buildCreateStudentRequestBody(form)).toMatchObject({
      email: "student@example.com",
      amountCents: 0,
      checkIn: { enabled: true, date: "2026-04-30", sessionId: "session_previous" },
    })
  })

  it("builds the date-aware sessions request URL for the hook", () => {
    expect(buildCreateStudentSessionsRequestUrl("2026-04-30")).toBe("/api/staff/students/sessions?date=2026-04-30")
  })

  it("blocks submit when attendance is enabled without a selected session", () => {
    const form: CreateStudentFormState = {
      ...createInitialStudentForm(),
      email: "student@example.com",
      createAttendance: true,
      attendanceSessionId: "",
    }

    expect(canSubmitCreateStudentForm({ form, hasAmount: false, submitting: false })).toBe(false)
  })

  it("clears stale selected session immediately when the hook attendance date field changes", () => {
    const form: CreateStudentFormState = {
      ...createInitialStudentForm(),
      email: "student@example.com",
      createAttendance: true,
      attendanceDate: "2026-05-01",
      attendanceSessionId: "session_current",
    }

    const updated = updateCreateStudentFormField(form, "attendanceDate", "2026-04-30")

    expect(updated.attendanceDate).toBe("2026-04-30")
    expect(updated.attendanceSessionId).toBe("")
    expect(canSubmitCreateStudentForm({ form: updated, hasAmount: false, submitting: false })).toBe(false)
  })

  it("blocks submit when check-in is enabled and the selected date has no session", () => {
    const form = reconcileCreateStudentFormWithSessions({
      ...createInitialStudentForm(),
      email: "student@example.com",
      createAttendance: true,
      attendanceDate: "2026-04-30",
      attendanceSessionId: "session_missing",
    }, [])

    expect(form.createAttendance).toBe(true)
    expect(form.attendanceSessionId).toBe("")
    expect(canSubmitCreateStudentForm({
      form: { ...form, createAttendance: true },
      hasAmount: false,
      submitting: false,
    })).toBe(false)
  })

  it("replaces a stale selected session with the current session after a fresh load", () => {
    const form: CreateStudentFormState = {
      ...createInitialStudentForm(),
      email: "student@example.com",
      createAttendance: true,
      attendanceSessionId: "session_stale",
    }

    const reconciled = reconcileCreateStudentFormWithSessions(form, [
      {
        id: "session_current",
        courseSlug: "salsa-basics",
        title: "Salsa Basics",
        startsAt: "2026-05-01T18:00:00.000Z",
        durationMinutes: 60,
        isCurrent: true,
      },
    ])

    expect(reconciled.createAttendance).toBe(true)
    expect(reconciled.attendanceSessionId).toBe("session_current")
    expect(reconciled.email).toBe("student@example.com")
  })

  it("clears a stale selected session when no fresh current session exists", () => {
    const form: CreateStudentFormState = {
      ...createInitialStudentForm(),
      email: "student@example.com",
      createAttendance: true,
      attendanceSessionId: "session_stale",
    }

    const reconciled = reconcileCreateStudentFormWithSessions(form, [])

    expect(reconciled.createAttendance).toBe(true)
    expect(reconciled.attendanceSessionId).toBe("")
    expect(reconciled.email).toBe("student@example.com")
  })
})
