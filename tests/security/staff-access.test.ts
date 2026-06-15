import { describe, expect, it } from "vitest"
import {
  canAccessStaffPortalSection,
  canOperateStudentEdits,
  hasExplicitStaffPermission,
  resolveStaffPortalSections,
} from "@/lib/security/staff-access"

describe("staff access helpers", () => {
  it("keeps front-desk staff scoped to student and terminal areas", () => {
    expect(resolveStaffPortalSections("staff", "front_desk")).toEqual(["students", "terminals", "profile"])
    expect(canAccessStaffPortalSection("staff", "front_desk", "students")).toBe(true)
    expect(canAccessStaffPortalSection("staff", "front_desk", "settings")).toBe(false)
  })

  it("grants student PIN operations to the explicit front-desk recovery roles", () => {
    expect(hasExplicitStaffPermission("owner", null, "studentPinOps")).toBe(true)
    expect(hasExplicitStaffPermission("admin", "manager", "studentPinOps")).toBe(true)
    expect(hasExplicitStaffPermission("staff", "front_desk", "studentPinOps")).toBe(true)
    expect(hasExplicitStaffPermission("admin", "front_desk", "studentPinOps")).toBe(false)
    expect(hasExplicitStaffPermission("staff", "teacher", "studentPinOps")).toBe(false)
  })

  it("delegates guest teachers to the teacher portal sections", () => {
    expect(resolveStaffPortalSections("staff", "guest", "teacher")).toEqual(["teacher_dashboard", "profile"])
  })

  it("delegates guest front-desk staff to the front-desk portal sections", () => {
    expect(resolveStaffPortalSections("staff", "guest", "front_desk")).toEqual(["students", "terminals", "profile"])
  })

  it("falls back to profile-only access for guests without a sub-category", () => {
    expect(resolveStaffPortalSections("staff", "guest")).toEqual(["profile"])
  })

  it("delegates guest managers to the manager fallback sections", () => {
    expect(resolveStaffPortalSections("staff", "guest", "manager")).toEqual(["profile"])
  })

  describe("canOperateStudentEdits", () => {
    it("allows owner and admin unconditionally", () => {
      expect(canOperateStudentEdits("owner", null)).toBe(true)
      expect(canOperateStudentEdits("owner", "partner")).toBe(true)
      expect(canOperateStudentEdits("admin", "manager")).toBe(true)
      expect(canOperateStudentEdits("admin", null)).toBe(true)
    })

    it("allows staff with front_desk category", () => {
      expect(canOperateStudentEdits("staff", "front_desk")).toBe(true)
    })

    it("allows guest staff with front_desk sub-category", () => {
      expect(canOperateStudentEdits("staff", "guest", "front_desk")).toBe(true)
    })

    it("denies staff with non-front-desk categories", () => {
      expect(canOperateStudentEdits("staff", "teacher")).toBe(false)
      expect(canOperateStudentEdits("staff", "guest")).toBe(false)
      expect(canOperateStudentEdits("staff", "guest", "teacher")).toBe(false)
      expect(canOperateStudentEdits("staff", "guest", "manager")).toBe(false)
      expect(canOperateStudentEdits("staff", null)).toBe(false)
    })

    it("denies null or undefined role", () => {
      expect(canOperateStudentEdits(null, "front_desk")).toBe(false)
      expect(canOperateStudentEdits(undefined, "front_desk")).toBe(false)
    })
  })
})
