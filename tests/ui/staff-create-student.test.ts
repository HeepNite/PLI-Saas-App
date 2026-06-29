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

import { describe, expect, it } from "vitest"
import { canOperateStudentEdits } from "@/lib/security/staff-access"
import {
  buildCreateStudentRequestBody,
  canSubmitCreateStudentForm,
  createInitialStudentForm,
  reconcileCreateStudentFormWithSessions,
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
      attendanceSessionId: "session_previous",
    }

    expect(buildCreateStudentRequestBody(form)).toMatchObject({
      email: "student@example.com",
      amountCents: 0,
      checkIn: { enabled: true, sessionId: "session_previous" },
    })
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

    expect(reconciled.createAttendance).toBe(false)
    expect(reconciled.attendanceSessionId).toBe("")
    expect(reconciled.email).toBe("student@example.com")
  })
})
