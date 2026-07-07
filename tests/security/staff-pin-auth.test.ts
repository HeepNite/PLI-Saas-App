import { beforeEach, describe, expect, it, vi } from "vitest"
import { createHash } from "crypto"

const mockClerkClient = vi.fn()

const usersApi = {
  getUser: vi.fn(),
  getUserList: vi.fn(),
}

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

const hashPin = (pin: string) => {
  const salt = "salt"
  const hash = createHash("sha256")
    .update(`${pin}:${salt}:${process.env.CLERK_SECRET_KEY || "test-secret"}`)
    .digest("hex")
  return `${salt}:${hash}`
}

const buildUser = (overrides: Record<string, unknown> = {}) => ({
  id: "staff_1",
  firstName: "Ana",
  lastName: "Desk",
  primaryEmailAddress: { emailAddress: "ana@example.com" },
  publicMetadata: { role: "staff", staffCategory: "front_desk", schoolId: "school_a" },
  privateMetadata: { staffPinHash: hashPin("1234") },
  ...overrides,
})

describe("resolveStaffUserByPin (Phase 2 hardened resolver)", () => {
  beforeEach(() => {
    usersApi.getUser.mockReset()
    usersApi.getUserList.mockReset()
    mockClerkClient.mockReset()
    process.env.CLERK_SECRET_KEY = "test-secret"
    mockClerkClient.mockResolvedValue({ users: usersApi })
  })

  it("REQUIRES expectedSchoolId — rejects before any Clerk lookup when missing", async () => {
    const { resolveStaffUserByPin } = await import("@/lib/security/staff-pin-auth")

    const result = await resolveStaffUserByPin({
      pin: "1234",
      restrictToUserId: "staff_1",
      expectedSchoolId: "",
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(403)
    }
    expect(usersApi.getUser).not.toHaveBeenCalled()
  })

  it("enforces school scope BEFORE comparing the hash — mismatched school returns 403 even with a CORRECT pin", async () => {
    usersApi.getUser.mockResolvedValue(buildUser({ publicMetadata: { role: "staff", schoolId: "school_a" } }))

    const { resolveStaffUserByPin } = await import("@/lib/security/staff-pin-auth")

    const result = await resolveStaffUserByPin({
      pin: "1234", // the CORRECT pin — proves the 403 is not a miss/compare result
      restrictToUserId: "staff_1",
      expectedSchoolId: "school_b",
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(403)
      expect(result.error).toContain("school context")
    }
  })

  it("restrictToUserId scope: hit when school matches and pin is correct", async () => {
    usersApi.getUser.mockResolvedValue(buildUser({ publicMetadata: { role: "staff", schoolId: "school_a" } }))

    const { resolveStaffUserByPin } = await import("@/lib/security/staff-pin-auth")

    const result = await resolveStaffUserByPin({
      pin: "1234",
      restrictToUserId: "staff_1",
      expectedSchoolId: "school_a",
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.staff.user.id).toBe("staff_1")
    }
  })

  it("restrictToUserId scope: NEVER scans other users — only calls getUser for the restricted id", async () => {
    usersApi.getUser.mockResolvedValue(buildUser({ publicMetadata: { role: "staff", schoolId: "school_a" } }))

    const { resolveStaffUserByPin } = await import("@/lib/security/staff-pin-auth")

    await resolveStaffUserByPin({
      pin: "1234",
      restrictToUserId: "staff_1",
      expectedSchoolId: "school_a",
    })

    expect(usersApi.getUser).toHaveBeenCalledTimes(1)
    expect(usersApi.getUser).toHaveBeenCalledWith("staff_1")
    expect(usersApi.getUserList).not.toHaveBeenCalled()
  })

  it("ignores a legacy preferredUserId-shaped field — no such client-supplied bypass exists anymore", async () => {
    usersApi.getUser.mockResolvedValue(buildUser({ id: "staff_restricted", publicMetadata: { role: "staff", schoolId: "school_a" } }))

    const { resolveStaffUserByPin } = await import("@/lib/security/staff-pin-auth")

    const result = await resolveStaffUserByPin({
      pin: "1234",
      restrictToUserId: "staff_restricted",
      expectedSchoolId: "school_a",
      // @ts-expect-error preferredUserId is intentionally not part of the type anymore
      preferredUserId: "staff_other",
    })

    expect(result.ok).toBe(true)
    // Only the restricted id is ever looked up — the removed client-supplied
    // preferredUserId field cannot steer resolution to a different user.
    expect(usersApi.getUser).toHaveBeenCalledTimes(1)
    expect(usersApi.getUser).toHaveBeenCalledWith("staff_restricted")
  })

  it("scan-all mode (no restrictToUserId): school-scopes candidates BEFORE comparing hashes", async () => {
    usersApi.getUserList.mockResolvedValue({
      data: [
        buildUser({ id: "staff_out_of_school", publicMetadata: { role: "staff", schoolId: "school_b" } }),
        buildUser({ id: "staff_in_school", publicMetadata: { role: "staff", schoolId: "school_a" } }),
      ],
    })

    const { resolveStaffUserByPin } = await import("@/lib/security/staff-pin-auth")

    const result = await resolveStaffUserByPin({
      pin: "1234",
      expectedSchoolId: "school_a",
    })

    // Both candidates share the SAME valid pin hash. If school-scoping happened
    // AFTER (or not at all) the compare, this would be a 409 (multiple matches).
    // School-scoping BEFORE compare means only staff_in_school is ever compared.
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.staff.user.id).toBe("staff_in_school")
    }
  })

  it("scan-all mode: 401 invalid PIN when no in-school candidate matches", async () => {
    usersApi.getUserList.mockResolvedValue({
      data: [buildUser({ id: "staff_out_of_school", publicMetadata: { role: "staff", schoolId: "school_b" } })],
    })

    const { resolveStaffUserByPin } = await import("@/lib/security/staff-pin-auth")

    const result = await resolveStaffUserByPin({
      pin: "1234",
      expectedSchoolId: "school_a",
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(401)
    }
  })
})
