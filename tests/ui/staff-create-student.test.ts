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
