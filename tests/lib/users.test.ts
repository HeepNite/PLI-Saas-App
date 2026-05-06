import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))

import { upsertUserByIdentifiers } from "@/lib/users"

describe("upsertUserByIdentifiers", () => {
  beforeEach(() => {
    mockPrisma.user.findUnique.mockReset()
    mockPrisma.user.findMany.mockReset()
    mockPrisma.user.update.mockReset()
    mockPrisma.user.create.mockReset()
  })

  it("syncs DB name when canonical Clerk name changed", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "db_user_1",
      clerkId: "clerk_1",
      email: "jhon@example.com",
      name: "John Doe",
      phone: "15550100",
      stripeCustomerId: null,
    })
    mockPrisma.user.findMany.mockResolvedValue([])
    mockPrisma.user.update.mockResolvedValue({ id: "db_user_1", name: "jhon doe" })

    await upsertUserByIdentifiers({
      clerkId: "clerk_1",
      email: "jhon@example.com",
      name: "jhon doe",
    })

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "db_user_1" },
      data: { name: "jhon doe" },
    })
  })

  it("does not overwrite populated DB name without Clerk identity", async () => {
    const existing = {
      id: "db_user_2",
      clerkId: null,
      email: "legacy@example.com",
      name: "Legacy Name",
      phone: null,
      stripeCustomerId: null,
    }
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.findMany.mockResolvedValue([existing])

    const result = await upsertUserByIdentifiers({
      email: "legacy@example.com",
      name: "Purchase Snapshot Name",
    })

    expect(mockPrisma.user.update).not.toHaveBeenCalled()
    expect(result).toEqual(existing)
  })

  it("links unlinked phone match and applies canonical Clerk identity", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: "db_user_phone",
        clerkId: null,
        email: "g@g.com",
        name: "Gabriela Barrionuevo",
        phone: "15512603078",
        stripeCustomerId: null,
      },
    ])
    mockPrisma.user.update.mockResolvedValue({ id: "db_user_phone" })

    await upsertUserByIdentifiers({
      clerkId: "user_3DHTPo9hz5rmWEpETAPVYcReLAe",
      email: "jhon@doe.com",
      name: "Jhon doe",
      phone: "+1 (551) 260-3078",
    })

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "db_user_phone" },
      data: {
        clerkId: "user_3DHTPo9hz5rmWEpETAPVYcReLAe",
        email: "jhon@doe.com",
        name: "Jhon doe",
      },
    })
  })

  it("does not overwrite a row linked to different clerkId", async () => {
    const linkedToDifferentClerk = {
      id: "db_user_conflict",
      clerkId: "clerk_other",
      email: "taken@example.com",
      name: "Taken User",
      phone: "15512603078",
      stripeCustomerId: null,
    }

    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.findMany.mockResolvedValue([linkedToDifferentClerk])

    const result = await upsertUserByIdentifiers({
      clerkId: "clerk_new",
      phone: "+1 (551) 260-3078",
      email: "new@example.com",
      name: "New Name",
    })

    expect(mockPrisma.user.update).not.toHaveBeenCalled()
    expect(result).toEqual(linkedToDifferentClerk)
  })
})
