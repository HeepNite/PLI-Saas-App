import { beforeEach, describe, expect, it, vi } from "vitest"

const mockClerkClient = vi.fn()
const usersApi = { getUserList: vi.fn() }

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

describe("lib/security/staff-roster: school-scoped minimal staff roster", () => {
  beforeEach(() => {
    mockClerkClient.mockReset()
    usersApi.getUserList.mockReset()
    mockClerkClient.mockResolvedValue({ users: usersApi })
  })

  it("returns ONLY staff scoped to the requested schoolId, with minimal fields (id, displayName, role)", async () => {
    usersApi.getUserList.mockResolvedValue({
      data: [
        {
          id: "staff_1",
          firstName: "Ana",
          lastName: "Desk",
          primaryEmailAddress: { emailAddress: "ana@example.com" },
          publicMetadata: { role: "staff", schoolId: "school_a" },
          privateMetadata: {},
        },
        {
          id: "staff_2",
          firstName: "Beto",
          lastName: "Otro",
          publicMetadata: { role: "staff", schoolId: "school_b" },
          privateMetadata: {},
        },
        {
          id: "not_staff_1",
          firstName: "NoRole",
          publicMetadata: { schoolId: "school_a" },
          privateMetadata: {},
        },
      ],
    })

    const { listStaffRosterForSchool } = await import("@/lib/security/staff-roster")
    const roster = await listStaffRosterForSchool("school_a")

    expect(roster).toEqual([{ id: "staff_1", displayName: "Ana Desk", role: "staff" }])
  })

  it("returns an EMPTY roster for an empty schoolId — never an unscoped list", async () => {
    const { listStaffRosterForSchool } = await import("@/lib/security/staff-roster")
    const roster = await listStaffRosterForSchool("")

    expect(roster).toEqual([])
    expect(usersApi.getUserList).not.toHaveBeenCalled()
  })

  it("paginates through multiple pages of the Clerk user list", async () => {
    const pageOne = Array.from({ length: 100 }, (_, i) => ({
      id: `staff_${i}`,
      firstName: `Staff${i}`,
      publicMetadata: { role: "staff", schoolId: "school_a" },
      privateMetadata: {},
    }))
    const pageTwo = [
      {
        id: "staff_last",
        firstName: "Last",
        publicMetadata: { role: "staff", schoolId: "school_a" },
        privateMetadata: {},
      },
    ]
    usersApi.getUserList.mockResolvedValueOnce({ data: pageOne }).mockResolvedValueOnce({ data: pageTwo })

    const { listStaffRosterForSchool } = await import("@/lib/security/staff-roster")
    const roster = await listStaffRosterForSchool("school_a")

    expect(roster).toHaveLength(101)
    expect(roster.some((entry) => entry.id === "staff_last")).toBe(true)
  })
})
