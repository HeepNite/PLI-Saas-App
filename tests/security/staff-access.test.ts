import { describe, expect, it } from "vitest"
import {
  canAccessStaffPortalSection,
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
})
