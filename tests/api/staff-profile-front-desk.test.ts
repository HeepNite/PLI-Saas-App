/**
 * Tests for front-desk student operational edit permissions on the
 * staff/users/[userId]/profile route.
 *
 * Covers:
 * - front_desk PATCH allowed for student (non-staff) target with operational fields
 * - front_desk PATCH rejected for staff-management-only fields
 * - front_desk PATCH rejected when target user is a staff member
 * - front_desk GET allowed for student (non-staff) target
 * - front_desk GET rejected for staff target
 * - StudentDataAudit written when operational profile field is changed
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizePortalBase = vi.fn()
const mockClerkClient = vi.fn()
const mockSyncStaffAccountFromClerkUser = vi.fn()
const mockCreateStaffRoleAudit = vi.fn()
const mockWriteStudentDataAudit = vi.fn()

const mockPrisma = {
  staffAccount: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}

const usersApi = {
  getUser: vi.fn(),
  updateUser: vi.fn(),
  updateUserMetadata: vi.fn(),
}

const sessionsApi = {
  getSessionList: vi.fn(),
}

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeStaffPortalBaseRequest: (...args: unknown[]) => mockAuthorizePortalBase(...args),
}))

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

vi.mock("@/lib/security/rate-limit", () => ({
  buildRateLimitKey: vi.fn(() => "staff-profile-front-desk"),
  consumeRateLimit: vi.fn(() => ({ ok: true })),
  getClientIp: vi.fn(() => "127.0.0.1"),
}))

vi.mock("@/lib/audit/student-data-audit", () => ({
  writeStudentDataAudit: (...args: unknown[]) => mockWriteStudentDataAudit(...args),
}))

vi.mock("@/lib/security/staff-account-sync", () => ({
  createStaffRoleAudit: (...args: unknown[]) => mockCreateStaffRoleAudit(...args),
  extractStaffRoleSnapshot: vi.fn(() => ({ role: null, category: null })),
  syncStaffAccountFromClerkUser: (...args: unknown[]) => mockSyncStaffAccountFromClerkUser(...args),
}))

// A student (no staff role in publicMetadata)
const studentUser = {
  id: "student_99",
  firstName: "Maria",
  lastName: "Student",
  imageUrl: "",
  lastSignInAt: null,
  publicMetadata: { staffProfile: { city: "Old City" } },
  privateMetadata: {},
}

// A staff member target
const staffUser = {
  id: "staff_other",
  firstName: "Juan",
  lastName: "Staff",
  imageUrl: "",
  lastSignInAt: null,
  publicMetadata: { role: "staff", staffCategory: "teacher", staffProfile: {} },
  privateMetadata: {},
}

// Front-desk auth result
const frontDeskAuth = {
  ok: true,
  status: 200,
  userId: "front_desk_1",
  role: "staff",
  category: "front_desk",
  staffName: "Ana Desk",
}

describe("profile route – front-desk student operational edit permissions", () => {
  beforeEach(() => {
    mockAuthorizePortalBase.mockReset()
    mockClerkClient.mockReset()
    mockSyncStaffAccountFromClerkUser.mockReset()
    mockCreateStaffRoleAudit.mockReset()
    mockWriteStudentDataAudit.mockReset()
    mockPrisma.staffAccount.findUnique.mockReset()
    mockPrisma.staffAccount.update.mockReset()
    usersApi.getUser.mockReset()
    usersApi.updateUser.mockReset()
    usersApi.updateUserMetadata.mockReset()
    sessionsApi.getSessionList.mockReset()

    mockAuthorizePortalBase.mockResolvedValue(frontDeskAuth)
    mockClerkClient.mockResolvedValue({ users: usersApi, sessions: sessionsApi })
    usersApi.getUser.mockResolvedValue(studentUser)
    usersApi.updateUser.mockResolvedValue(studentUser)
    usersApi.updateUserMetadata.mockImplementation(
      async (_userId: string, p: { publicMetadata?: unknown; privateMetadata?: unknown }) => ({
        ...studentUser,
        publicMetadata: p.publicMetadata ?? studentUser.publicMetadata,
        privateMetadata: p.privateMetadata ?? studentUser.privateMetadata,
      })
    )
    sessionsApi.getSessionList.mockResolvedValue({ data: [] })
    mockSyncStaffAccountFromClerkUser.mockResolvedValue(undefined)
    mockCreateStaffRoleAudit.mockResolvedValue(undefined)
    mockWriteStudentDataAudit.mockResolvedValue(undefined)
    mockPrisma.staffAccount.findUnique.mockResolvedValue(null)
    mockPrisma.staffAccount.update.mockResolvedValue({ paymentPreference: null, paymentInfo: null })
  })

  it("GET succeeds for a student target when caller is front-desk", async () => {
    const { GET } = await import("@/app/api/staff/users/[userId]/profile/route")
    const res = await GET(
      new Request("http://localhost/api/staff/users/student_99/profile"),
      { params: Promise.resolve({ userId: "student_99" }) }
    )
    expect(res.status).toBe(200)
  })

  it("GET is blocked when front-desk tries to access a staff member profile", async () => {
    usersApi.getUser.mockResolvedValue(staffUser)
    sessionsApi.getSessionList.mockResolvedValue({ data: [] })
    const { GET } = await import("@/app/api/staff/users/[userId]/profile/route")
    const res = await GET(
      new Request("http://localhost/api/staff/users/staff_other/profile"),
      { params: Promise.resolve({ userId: "staff_other" }) }
    )
    expect(res.status).toBe(403)
  })

  it("PATCH succeeds for operational student fields when caller is front-desk", async () => {
    const { PATCH } = await import("@/app/api/staff/users/[userId]/profile/route")
    const res = await PATCH(
      new Request("http://localhost/api/staff/users/student_99/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: "Maria", lastName: "Actualizada" }),
      }),
      { params: Promise.resolve({ userId: "student_99" }) }
    )
    expect(res.status).toBe(200)
  })

  it("PATCH is blocked when front-desk attempts to change role", async () => {
    const { PATCH } = await import("@/app/api/staff/users/[userId]/profile/route")
    const res = await PATCH(
      new Request("http://localhost/api/staff/users/student_99/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "admin" }),
      }),
      { params: Promise.resolve({ userId: "student_99" }) }
    )
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toContain('"role"')
  })

  it("PATCH is blocked when front-desk attempts to change category", async () => {
    const { PATCH } = await import("@/app/api/staff/users/[userId]/profile/route")
    const res = await PATCH(
      new Request("http://localhost/api/staff/users/student_99/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: "front_desk" }),
      }),
      { params: Promise.resolve({ userId: "student_99" }) }
    )
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toContain('"category"')
  })

  it("PATCH is blocked when front-desk attempts to change pin", async () => {
    const { PATCH } = await import("@/app/api/staff/users/[userId]/profile/route")
    const res = await PATCH(
      new Request("http://localhost/api/staff/users/student_99/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "1234" }),
      }),
      { params: Promise.resolve({ userId: "student_99" }) }
    )
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toContain('"pin"')
  })

  it("PATCH is blocked when front-desk targets a staff user account", async () => {
    usersApi.getUser.mockResolvedValue(staffUser)
    const { PATCH } = await import("@/app/api/staff/users/[userId]/profile/route")
    const res = await PATCH(
      new Request("http://localhost/api/staff/users/staff_other/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: "Juan" }),
      }),
      { params: Promise.resolve({ userId: "staff_other" }) }
    )
    expect(res.status).toBe(403)
  })

  it("PATCH writes StudentDataAudit for operational field changes with actor info", async () => {
    const { PATCH } = await import("@/app/api/staff/users/[userId]/profile/route")
    const res = await PATCH(
      new Request("http://localhost/api/staff/users/student_99/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: "Nuevo", city: "Buenos Aires" }),
      }),
      { params: Promise.resolve({ userId: "student_99" }) }
    )
    expect(res.status).toBe(200)
    expect(mockWriteStudentDataAudit).toHaveBeenCalled()
    const calls = mockWriteStudentDataAudit.mock.calls
    const auditFields = calls.map((c: unknown[]) => (c[0] as { field: string }).field)
    expect(auditFields).toContain("profile.firstName")
    expect(auditFields).toContain("profile.city")
    // All audit calls must reference the acting staff user
    for (const call of calls) {
      const params = call[0] as { staffClerkId: string; staffName: string; targetUserId: string; entity: string }
      expect(params.staffClerkId).toBe("front_desk_1")
      expect(params.staffName).toBe("Ana Desk")
      expect(params.targetUserId).toBe("student_99")
      expect(params.entity).toBe("profile")
    }
    expect(mockWriteStudentDataAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        field: "profile.city",
        valueBefore: "Old City",
        valueAfter: "Buenos Aires",
      })
    )
  })

  it("PATCH does not write StudentDataAudit when caller edits their own profile", async () => {
    // Self-request: userId matches auth userId
    mockAuthorizePortalBase.mockResolvedValue({ ...frontDeskAuth, userId: "student_99" })
    usersApi.getUser.mockResolvedValue(studentUser)
    const { PATCH } = await import("@/app/api/staff/users/[userId]/profile/route")
    const res = await PATCH(
      new Request("http://localhost/api/staff/users/student_99/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: "Self" }),
      }),
      { params: Promise.resolve({ userId: "student_99" }) }
    )
    expect(res.status).toBe(200)
    expect(mockWriteStudentDataAudit).not.toHaveBeenCalled()
  })
})
