import { describe, expect, it, vi } from "vitest"

const { existing, user } = vi.hoisted(() => {
  const durableUser = {
    id: "db_user_1",
    clerkId: "clerk_1",
    email: "ada@example.com",
    name: "Ada Lovelace",
    phone: "12015550123",
    stripeCustomerId: "cus_original",
  }
  return {
    existing: durableUser,
    user: {
      findUnique: vi.fn().mockResolvedValue(durableUser),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      create: vi.fn(),
    },
  }
})

vi.mock("@/lib/prisma", () => ({ prisma: { user } }))

import { upsertUserByIdentifiers } from "@/lib/users"

describe("special class Stripe Customer persistence", () => {
  it("does not overwrite a durable Stripe Customer with a different webhook customer", async () => {
    const result = await upsertUserByIdentifiers({
      clerkId: "clerk_1",
      email: "ada@example.com",
      stripeCustomerId: "cus_different",
    })

    expect(user.update).not.toHaveBeenCalled()
    expect(result).toEqual(existing)
  })
})
