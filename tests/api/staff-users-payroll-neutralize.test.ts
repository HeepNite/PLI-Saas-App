import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizePortal = vi.fn()
const mockAuthorizeBasePortal = vi.fn()
const mockClerkClient = vi.fn()

const usersApi = {
  getUser: vi.fn(),
  updateUserMetadata: vi.fn(),
  getUserList: vi.fn(),
}

const sessionsApi = {
  getSessionList: vi.fn(),
  revokeSession: vi.fn().mockResolvedValue({}),
}

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeStaffPortalRequest: (...args: unknown[]) => mockAuthorizePortal(...args),
  authorizeStaffPortalBaseRequest: (...args: unknown[]) => mockAuthorizeBasePortal(...args),
}))

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

// Mock staff-account-sync so we don't hit DB
vi.mock("@/lib/security/staff-account-sync", () => ({
  syncStaffAccountFromClerkUser: vi.fn().mockResolvedValue(undefined),
  createStaffRoleAudit: vi.fn().mockResolvedValue(undefined),
  extractStaffRoleSnapshot: vi.fn().mockReturnValue({ role: "staff", category: "guest" }),
}))

// Mock prisma for profile/list routes
vi.mock("@/lib/prisma", () => ({
  prisma: {
    staffAccount: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}))

// Mock staff-access for profile route
vi.mock("@/lib/security/staff-access", () => ({
  canAccessStaffPortalSection: vi.fn().mockReturnValue(true),
}))

describe("force_logout payroll neutralization (R7/D7)", () => {
  beforeEach(() => {
    mockAuthorizePortal.mockReset()
    mockClerkClient.mockReset()
    usersApi.getUser.mockReset()
    usersApi.updateUserMetadata.mockReset()
    sessionsApi.getSessionList.mockReset()
    sessionsApi.revokeSession.mockReset()
    mockClerkClient.mockResolvedValue({ users: usersApi, sessions: sessionsApi })
    mockAuthorizePortal.mockResolvedValue({ ok: true, userId: "admin_1", role: "admin" })
  })

  // RED: This test MUST FAIL before production change — force_logout currently mutates hoursWorked
  it("force_logout does NOT compute or increment publicMetadata.staffPayroll.hoursWorked", async () => {
    const now = Date.now()
    const fiveHoursAgo = new Date(now - 5 * 60 * 60 * 1000).toISOString()

    // User has a 5-hour-old check-in and 10 hours previously worked
    usersApi.getUser.mockResolvedValue({
      id: "u_1",
      publicMetadata: {
        role: "staff",
        staffPayroll: { hoursWorked: 10, hourlyRate: 15 },
      },
      privateMetadata: {
        staffLastCheckInAt: fiveHoursAgo,
        staffPresenceStatus: "online",
      },
      banned: false,
      locked: false,
    })

    // Revoke sessions succeeds
    sessionsApi.getSessionList.mockResolvedValue({ data: [{ id: "sess_1" }] })

    // updateMetadata returns the updated user — we capture what was passed
    usersApi.updateUserMetadata.mockImplementation(
      (_userId: string, payload: { publicMetadata?: Record<string, unknown> }) => {
        return Promise.resolve({
          id: "u_1",
          publicMetadata: payload.publicMetadata ?? {},
          privateMetadata: {},
          banned: false,
          locked: false,
        })
      }
    )

    const { PATCH } = await import("@/app/api/staff/users/[userId]/route")
    const req = new Request("http://localhost/api/staff/users/u_1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "force_logout" }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ userId: "u_1" }) })
    expect(res.status).toBe(200)

    // Verify what was passed to updateUserMetadata
    expect(usersApi.updateUserMetadata).toHaveBeenCalledTimes(1)
    const updateCall = usersApi.updateUserMetadata.mock.calls[0]
    const updatePayload = updateCall[1]

    // CRITICAL: publicMetadata.staffPayroll.hoursWorked must remain unchanged (10)
    // The legacy code would add ~5 session hours → 15. That MUST NOT happen.
    const payrollMeta = updatePayload.publicMetadata.staffPayroll as Record<string, unknown>
    expect(payrollMeta.hoursWorked).toBe(10)
  })

  // TRIANGULATE: different scenario — no existing hoursWorked
  it("force_logout preserves absent hoursWorked as-is (no synthetic zero injection)", async () => {
    usersApi.getUser.mockResolvedValue({
      id: "u_2",
      publicMetadata: {
        role: "staff",
        // No staffPayroll at all
      },
      privateMetadata: {
        staffLastCheckInAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
      banned: false,
      locked: false,
    })

    sessionsApi.getSessionList.mockResolvedValue({ data: [] })

    let capturedPayload: Record<string, unknown> = {}
    usersApi.updateUserMetadata.mockImplementation(
      (_userId: string, payload: { publicMetadata?: Record<string, unknown> }) => {
        capturedPayload = payload.publicMetadata ?? {}
        return Promise.resolve({
          id: "u_2",
          publicMetadata: capturedPayload,
          privateMetadata: {},
          banned: false,
          locked: false,
        })
      }
    )

    const { PATCH } = await import("@/app/api/staff/users/[userId]/route")
    const req = new Request("http://localhost/api/staff/users/u_2", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "force_logout" }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ userId: "u_2" }) })
    expect(res.status).toBe(200)

    // staffPayroll must not be injected if it wasn't there before
    expect(capturedPayload).not.toHaveProperty("staffPayroll")
  })

  // TRIANGULATE: force_logout still clears session/presence metadata correctly (end of group)
  it("force_logout still sets privateMetadata presence fields (offline, checkOut, forceLogoutAt)", async () => {
    usersApi.getUser.mockResolvedValue({
      id: "u_3",
      publicMetadata: { role: "staff" },
      privateMetadata: {
        staffLastCheckInAt: new Date(Date.now() - 3_600_000).toISOString(),
        staffPresenceStatus: "online",
      },
      banned: false,
      locked: false,
    })

    sessionsApi.getSessionList.mockResolvedValue({ data: [{ id: "s1" }] })

    let capturedPayload: { publicMetadata?: Record<string, unknown>; privateMetadata?: Record<string, unknown> } = {}
    usersApi.updateUserMetadata.mockImplementation(
      (_userId: string, payload: { publicMetadata?: Record<string, unknown>; privateMetadata?: Record<string, unknown> }) => {
        capturedPayload = payload
        return Promise.resolve({
          id: "u_3",
          publicMetadata: payload.publicMetadata ?? {},
          privateMetadata: payload.privateMetadata ?? {},
          banned: false,
          locked: false,
        })
      }
    )

    const { PATCH } = await import("@/app/api/staff/users/[userId]/route")
    const req = new Request("http://localhost/api/staff/users/u_3", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "force_logout" }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ userId: "u_3" }) })
    expect(res.status).toBe(200)

    const privMeta = capturedPayload.privateMetadata as Record<string, unknown>
    expect(privMeta.staffPresenceStatus).toBe("offline")
    expect(privMeta.staffLastCheckInAt).toBeNull()
    expect(typeof privMeta.staffLastCheckOutAt).toBe("string")
    expect(typeof privMeta.staffForceLogoutAt).toBe("string")
    expect(typeof privMeta.staffPresenceUpdatedAt).toBe("string")
  })
})

describe("profile payrollHoursWorked deprecation (R7)", () => {
  beforeEach(() => {
    mockClerkClient.mockReset()
    mockAuthorizeBasePortal.mockReset()
    mockClerkClient.mockResolvedValue({ users: usersApi, sessions: sessionsApi })
    mockAuthorizeBasePortal.mockResolvedValue({ ok: true, userId: "admin_1", role: "admin", category: "manager" })
    usersApi.getUser.mockReset()
    sessionsApi.getSessionList.mockReset()
  })

  // RED: profile endpoint must NOT return metrics.payrollHoursWorked from legacy metadata
  it("GET profile does NOT return payrollHoursWorked in metrics (deprecated authoritative field)", async () => {
    usersApi.getUser.mockResolvedValue({
      id: "u_profile",
      firstName: "Ana",
      lastName: "Staff",
      publicMetadata: {
        role: "staff",
        staffPayroll: { hoursWorked: 42.5, hourlyRate: 20 },
      },
      privateMetadata: {},
      banned: false,
      locked: false,
      lastSignInAt: Date.now(),
    })
    sessionsApi.getSessionList.mockResolvedValue({ data: [{ id: "sess_1" }] })

    const { GET } = await import("@/app/api/staff/users/[userId]/profile/route")
    const req = new Request("http://localhost/api/staff/users/u_profile/profile")
    const res = await GET(req, { params: Promise.resolve({ userId: "u_profile" }) })
    expect(res.status).toBe(200)
    const data = await res.json()

    // payrollHoursWorked must NOT appear as an authoritative number from metadata
    expect(data.user.metrics.payrollHoursWorked).toBeNull()
  })

  // TRIANGULATE: even when metadata has hoursWorked=0, it must still return null
  it("GET profile returns null payrollHoursWorked even when metadata has 0", async () => {
    usersApi.getUser.mockResolvedValue({
      id: "u_profile_zero",
      firstName: "Bob",
      lastName: "Zero",
      publicMetadata: {
        role: "staff",
        staffPayroll: { hoursWorked: 0, hourlyRate: 15 },
      },
      privateMetadata: {},
      banned: false,
      locked: false,
      lastSignInAt: Date.now(),
    })
    sessionsApi.getSessionList.mockResolvedValue({ data: [] })

    const { GET } = await import("@/app/api/staff/users/[userId]/profile/route")
    const req = new Request("http://localhost/api/staff/users/u_profile_zero/profile")
    const res = await GET(req, { params: Promise.resolve({ userId: "u_profile_zero" }) })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.user.metrics.payrollHoursWorked).toBeNull()
  })
})

describe("staff list payrollHoursWorked deprecation (R7)", () => {
  beforeEach(() => {
    mockClerkClient.mockReset()
    mockAuthorizePortal.mockReset()
    mockClerkClient.mockResolvedValue({ users: usersApi, sessions: sessionsApi })
    mockAuthorizePortal.mockResolvedValue({ ok: true, userId: "admin_1", role: "admin" })
    usersApi.getUserList.mockReset()
    sessionsApi.getSessionList.mockReset()
  })

  // RED: list endpoint must NOT return payrollHoursWorked from legacy metadata
  it("GET staff list does NOT return payrollHoursWorked from legacy metadata", async () => {
    usersApi.getUserList.mockResolvedValue({
      data: [
        {
          id: "u_list",
          firstName: "Carla",
          lastName: "List",
          emailAddresses: [{ emailAddress: "carla@example.com" }],
          publicMetadata: {
            role: "staff",
            staffPayroll: { hoursWorked: 30, hourlyRate: 18 },
          },
          privateMetadata: {},
          banned: false,
          locked: false,
          createdAt: Date.now(),
          lastSignInAt: Date.now(),
        },
      ],
    })
    sessionsApi.getSessionList.mockResolvedValue({ data: [{ id: "sess_1" }] })

    const { GET } = await import("@/app/api/staff/users/route")
    const res = await GET(new Request("http://localhost/api/staff/users"))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.items).toHaveLength(1)
    // payrollHoursWorked must be null — not 30 from metadata
    expect(data.items[0].payrollHoursWorked).toBeNull()
  })

  // TRIANGULATE: user with no payroll metadata still returns null
  it("GET staff list returns null payrollHoursWorked when no payroll metadata exists", async () => {
    usersApi.getUserList.mockResolvedValue({
      data: [
        {
          id: "u_no_payroll",
          firstName: "Dan",
          lastName: "NoPayroll",
          emailAddresses: [{ emailAddress: "dan@example.com" }],
          publicMetadata: { role: "staff" },
          privateMetadata: {},
          banned: false,
          locked: false,
          createdAt: Date.now(),
          lastSignInAt: Date.now(),
        },
      ],
    })
    sessionsApi.getSessionList.mockResolvedValue({ data: [] })

    const { GET } = await import("@/app/api/staff/users/route")
    const res = await GET(new Request("http://localhost/api/staff/users"))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.items).toHaveLength(1)
    expect(data.items[0].payrollHoursWorked).toBeNull()
  })
})
