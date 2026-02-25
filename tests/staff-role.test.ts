import { describe, expect, it } from "vitest"
import {
  extractStaffRoleFromClaims,
  extractStaffRoleFromMetadata,
  extractStaffRoleFromUserMetadata,
  hasStaffRoleInClaims,
  hasStaffRoleInMetadata,
  hasStaffRoleInUserMetadata,
  isStaffAdminRole,
} from "@/lib/security/staff-role"

describe("staff role helpers", () => {
  it("accepts role in metadata (string or array)", () => {
    expect(hasStaffRoleInMetadata({ role: "staff" })).toBe(true)
    expect(hasStaffRoleInMetadata({ roles: ["member", "Owner"] })).toBe(true)
    expect(hasStaffRoleInMetadata({ role: "student" })).toBe(false)
  })

  it("reads role from session claims metadata", () => {
    expect(hasStaffRoleInClaims({ metadata: { role: "admin" } })).toBe(true)
    expect(hasStaffRoleInClaims({ public_metadata: { roles: ["staff"] } })).toBe(true)
    expect(hasStaffRoleInClaims({ public_metadata: { role: "member" } })).toBe(false)
    expect(extractStaffRoleFromClaims({ metadata: { role: "owner" } })).toBe("owner")
  })

  it("reads role from user metadata variants", () => {
    expect(hasStaffRoleInUserMetadata({ publicMetadata: { role: "owner" } })).toBe(true)
    expect(hasStaffRoleInUserMetadata({ privateMetadata: { roles: ["staff"] } })).toBe(true)
    expect(hasStaffRoleInUserMetadata({ unsafeMetadata: { role: "user" } })).toBe(false)
    expect(extractStaffRoleFromUserMetadata({ privateMetadata: { role: "admin" } })).toBe("admin")
  })

  it("normalizes role priority and admin checks", () => {
    expect(extractStaffRoleFromMetadata({ roles: ["staff", "owner"] })).toBe("owner")
    expect(isStaffAdminRole("owner")).toBe(true)
    expect(isStaffAdminRole("admin")).toBe(true)
    expect(isStaffAdminRole("staff")).toBe(false)
  })
})
