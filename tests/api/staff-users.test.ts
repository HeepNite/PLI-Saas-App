import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizePortal = vi.fn()
const mockClerkClient = vi.fn()

const usersApi = {
  getUserList: vi.fn(),
  updateUser: vi.fn(),
  updateUserMetadata: vi.fn(),
  getUser: vi.fn(),
  lockUser: vi.fn(),
  unlockUser: vi.fn(),
  banUser: vi.fn(),
  unbanUser: vi.fn(),
}

const invitationsApi = {
  createInvitation: vi.fn(),
}

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeStaffPortalRequest: (...args: unknown[]) => mockAuthorizePortal(...args),
}))

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

describe("staff users routes", () => {
  beforeEach(() => {
    mockAuthorizePortal.mockReset()
    mockClerkClient.mockReset()
    usersApi.getUserList.mockReset()
    usersApi.updateUser.mockReset()
    usersApi.updateUserMetadata.mockReset()
    usersApi.getUser.mockReset()
    usersApi.lockUser.mockReset()
    usersApi.unlockUser.mockReset()
    usersApi.banUser.mockReset()
    usersApi.unbanUser.mockReset()
    invitationsApi.createInvitation.mockReset()

    mockClerkClient.mockResolvedValue({ users: usersApi, invitations: invitationsApi })
    mockAuthorizePortal.mockResolvedValue({ ok: true, userId: "staff_1", role: "admin" })
  })

  it("GET returns 401 when portal auth fails", async () => {
    mockAuthorizePortal.mockResolvedValue({ ok: false, status: 401, error: "Invalid key" })
    const { GET } = await import("@/app/api/staff/users/route")
    const res = await GET(new Request("http://localhost/api/staff/users"))
    expect(res.status).toBe(401)
  })

  it("GET returns staff users only", async () => {
    usersApi.getUserList.mockResolvedValue({
      data: [
        {
          id: "u_staff",
          firstName: "Ana",
          lastName: "Staff",
          emailAddresses: [{ emailAddress: "ana@example.com" }],
          publicMetadata: { role: "staff" },
          banned: false,
          locked: false,
          createdAt: Date.now(),
          lastSignInAt: Date.now(),
        },
        {
          id: "u_member",
          firstName: "Pepe",
          lastName: "Member",
          emailAddresses: [{ emailAddress: "pepe@example.com" }],
          publicMetadata: { role: "member" },
          banned: false,
          locked: false,
          createdAt: Date.now(),
          lastSignInAt: Date.now(),
        },
      ],
    })

    const { GET } = await import("@/app/api/staff/users/route")
    const res = await GET(new Request("http://localhost/api/staff/users"))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.items).toHaveLength(1)
    expect(data.items[0].id).toBe("u_staff")
    expect(data.items[0].category).toBe("guest")
  })

  it("GET can filter by category", async () => {
    usersApi.getUserList.mockResolvedValue({
      data: [
        {
          id: "u_front",
          firstName: "Ana",
          lastName: "Desk",
          emailAddresses: [{ emailAddress: "ana@example.com" }],
          publicMetadata: { role: "staff", staffCategory: "front_desk" },
          banned: false,
          locked: false,
          createdAt: Date.now(),
          lastSignInAt: Date.now(),
        },
        {
          id: "u_teacher",
          firstName: "Profe",
          lastName: "One",
          emailAddresses: [{ emailAddress: "profe@example.com" }],
          publicMetadata: { role: "staff", staffCategory: "teacher" },
          banned: false,
          locked: false,
          createdAt: Date.now(),
          lastSignInAt: Date.now(),
        },
      ],
    })

    const { GET } = await import("@/app/api/staff/users/route")
    const res = await GET(new Request("http://localhost/api/staff/users?category=teacher"))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.items).toHaveLength(1)
    expect(data.items[0].id).toBe("u_teacher")
  })

  it("POST promotes existing user", async () => {
    usersApi.getUserList.mockResolvedValueOnce({
      data: [
        {
          id: "u_existing",
          firstName: "Ana",
          lastName: "Old",
          publicMetadata: {},
        },
      ],
    })
    usersApi.updateUser.mockResolvedValue({
      id: "u_existing",
      firstName: "Ana",
      lastName: "New",
      emailAddresses: [{ emailAddress: "ana@example.com" }],
      publicMetadata: { role: "staff" },
      banned: false,
      locked: false,
      createdAt: Date.now(),
      lastSignInAt: null,
    })

    const { POST } = await import("@/app/api/staff/users/route")
    const req = new Request("http://localhost/api/staff/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "ana@example.com", role: "staff", lastName: "New" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.mode).toBe("promoted_existing")
    expect(usersApi.updateUser).toHaveBeenCalled()
  })

  it("POST creates invitation when user does not exist", async () => {
    usersApi.getUserList.mockResolvedValueOnce({ data: [] })
    invitationsApi.createInvitation.mockResolvedValue({
      id: "inv_1",
      emailAddress: "newstaff@example.com",
      status: "pending",
      createdAt: Date.now(),
    })

    const { POST } = await import("@/app/api/staff/users/route")
    const req = new Request("http://localhost/api/staff/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "newstaff@example.com", role: "staff" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.mode).toBe("invited")
    expect(invitationsApi.createInvitation).toHaveBeenCalled()
  })

  it("POST stores teacher guest sub-category metadata on invitations", async () => {
    usersApi.getUserList.mockResolvedValueOnce({ data: [] })
    invitationsApi.createInvitation.mockResolvedValue({
      id: "inv_teacher",
      emailAddress: "teacher@example.com",
      status: "pending",
      createdAt: Date.now(),
    })

    const { POST } = await import("@/app/api/staff/users/route")
    const req = new Request("http://localhost/api/staff/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "teacher@example.com", role: "staff", category: "guest", subCategory: "teacher" }),
    })
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(invitationsApi.createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        publicMetadata: expect.objectContaining({
          role: "staff",
          staffCategory: "guest",
          staffSubCategory: "teacher",
        }),
      })
    )
  })

  it("POST stores front-desk guest sub-category metadata and uses the log-in redirect", async () => {
    usersApi.getUserList.mockResolvedValueOnce({ data: [] })
    invitationsApi.createInvitation.mockResolvedValue({
      id: "inv_front_desk",
      emailAddress: "frontdesk@example.com",
      status: "pending",
      createdAt: Date.now(),
    })

    const { POST } = await import("@/app/api/staff/users/route")
    const req = new Request("http://localhost/api/staff/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "frontdesk@example.com", role: "staff", category: "guest", subCategory: "front_desk" }),
    })
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(invitationsApi.createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        publicMetadata: expect.objectContaining({
          role: "staff",
          staffCategory: "guest",
          staffSubCategory: "front_desk",
        }),
        redirectUrl: "http://localhost/staff/log-in",
      })
    )
  })

  it("POST invitations always redirect to /staff/log-in", async () => {
    usersApi.getUserList.mockResolvedValueOnce({ data: [] })
    invitationsApi.createInvitation.mockResolvedValue({
      id: "inv_redirect",
      emailAddress: "redirect@example.com",
      status: "pending",
      createdAt: Date.now(),
    })

    const { POST } = await import("@/app/api/staff/users/route")
    const req = new Request("http://localhost/api/staff/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "redirect@example.com", role: "staff" }),
    })
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(invitationsApi.createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ redirectUrl: "http://localhost/staff/log-in" })
    )
  })

  it("PATCH set_role updates metadata", async () => {
    usersApi.getUser.mockResolvedValue({ id: "u_1", publicMetadata: {} })
    usersApi.updateUserMetadata.mockResolvedValue({
      id: "u_1",
      publicMetadata: { role: "admin" },
      banned: false,
      locked: false,
    })

    const { PATCH } = await import("@/app/api/staff/users/[userId]/route")
    const req = new Request("http://localhost/api/staff/users/u_1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_role", role: "admin" }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ userId: "u_1" }) })
    expect(res.status).toBe(200)
    expect(usersApi.updateUserMetadata).toHaveBeenCalled()
  })

  it("PATCH set_category updates metadata", async () => {
    usersApi.getUser.mockResolvedValue({ id: "u_1", publicMetadata: { role: "staff" } })
    usersApi.updateUserMetadata.mockResolvedValue({
      id: "u_1",
      publicMetadata: { role: "staff", staffCategory: "manager" },
      banned: false,
      locked: false,
    })

    const { PATCH } = await import("@/app/api/staff/users/[userId]/route")
    const req = new Request("http://localhost/api/staff/users/u_1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_category", category: "manager" }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ userId: "u_1" }) })
    expect(res.status).toBe(200)
    expect(usersApi.updateUserMetadata).toHaveBeenCalled()
  })

  it("DELETE blocks self staff removal", async () => {
    const { DELETE } = await import("@/app/api/staff/users/[userId]/route")
    const req = new Request("http://localhost/api/staff/users/staff_1", { method: "DELETE" })
    const res = await DELETE(req, { params: Promise.resolve({ userId: "staff_1" }) })
    expect(res.status).toBe(400)
  })
})
