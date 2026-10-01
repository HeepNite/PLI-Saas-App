import { afterEach, describe, expect, it, vi } from "vitest"

const { mockFindUnique, mockUpsert } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpsert: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: mockFindUnique,
      upsert: mockUpsert,
    },
  },
}))

import { createCheckoutExactAccountDependencies } from "@/lib/checkout/exact-identity-adapters"

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe("checkout exact identity adapters", () => {
  it("persists a guarded Clerk fictional phone accepted by server validation", async () => {
    vi.stubEnv("VERCEL_ENV", "preview")
    vi.stubEnv("VERCEL_GIT_COMMIT_REF", "codex/develop")
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_example")
    mockFindUnique.mockResolvedValue(null)
    mockUpsert.mockResolvedValue({ id: "local-123", clerkId: "clerk-123" })

    const dependencies = createCheckoutExactAccountDependencies({ users: {} } as never)

    await expect(dependencies.upsertLocalIdentity({
      clerkId: "clerk-123",
      email: "student@example.com",
      phone: "+15555550123",
      name: "Test Student",
    })).resolves.toEqual({ id: "local-123", clerkId: "clerk-123" })

    expect(mockUpsert).toHaveBeenCalledWith({
      where: { clerkId: "clerk-123" },
      update: { name: "Test Student" },
      create: {
        clerkId: "clerk-123",
        email: "student@example.com",
        name: "Test Student",
        phone: "15555550123",
      },
    })
  })
})
