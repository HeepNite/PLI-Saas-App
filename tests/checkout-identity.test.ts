import { describe, expect, it, vi } from "vitest"
import { createSafeClerkMutation, ensureExactAccountIdentity, resolveExactIdentity, type ExactAccountDependencies, type ExactIdentitySnapshot } from "@/lib/checkout/identity-safety"
import { parseServerPhoneInput } from "@/lib/phone"
type ClerkIdentity = { id: string }
type LocalIdentity = { id: string; clerkId: string | null }
const clerkA = { id: "clerk-a" }
const clerkB = { id: "clerk-b" }
const localA = { id: "local-a", clerkId: "clerk-a" }
const localB = { id: "local-b", clerkId: "clerk-b" }
const snapshot = (values: Partial<ExactIdentitySnapshot<ClerkIdentity, LocalIdentity>> = {}) => ({
  clerkEmailMatches: [],
  clerkPhoneMatches: [],
  localEmailMatches: [],
  localPhoneMatches: [],
  ...values,
}) satisfies ExactIdentitySnapshot<ClerkIdentity, LocalIdentity>
const makeDependencies = (
  overrides: Partial<ExactAccountDependencies<ClerkIdentity, LocalIdentity>> = {},
) => ({
  parsePhone: parseServerPhoneInput,
  readSnapshot: vi.fn().mockResolvedValue(snapshot()),
  mutateClerkAfterExactRead: vi.fn().mockResolvedValue(clerkA),
  upsertLocalIdentity: vi.fn().mockResolvedValue(localA),
  ...overrides,
}) satisfies ExactAccountDependencies<ClerkIdentity, LocalIdentity>
const contact = {
  email: "Student@Example.com",
  phone: "+12025550123",
  name: "Test Student",
}
const clerkOnly = snapshot({ clerkEmailMatches: [clerkA], clerkPhoneMatches: [clerkA] })
const splitClerk = snapshot({ clerkEmailMatches: [clerkA], clerkPhoneMatches: [clerkB] })
const incompatibleLocal = snapshot({ ...clerkOnly, localEmailMatches: [localB], localPhoneMatches: [localB] })
const unavailable = { ok: false, code: "CONTACT_DETAILS_UNAVAILABLE" } as const
const invalidContact = { ok: false, code: "INVALID_CONTACT" } as const
describe("exact checkout identity resolution", () => {
  it.each([
    ["split Clerk identities", snapshot({ clerkEmailMatches: [clerkA], clerkPhoneMatches: [clerkB] })],
    ["multiple exact Clerk identities", snapshot({ clerkEmailMatches: [clerkA, clerkB], clerkPhoneMatches: [clerkA] })],
    ["split local identities", snapshot({ localEmailMatches: [localA], localPhoneMatches: [localB] })],
    ["multiple exact local identities", snapshot({ localEmailMatches: [localA, localB], localPhoneMatches: [localA] })],
    [
      "incompatible Clerk and local linkage",
      snapshot({
        clerkEmailMatches: [clerkA],
        clerkPhoneMatches: [clerkA],
        localEmailMatches: [localB],
        localPhoneMatches: [localB],
      }),
    ],
  ])("rejects %s without selecting a first result", (_case, identitySnapshot) => {
    expect(resolveExactIdentity(identitySnapshot)).toEqual({ kind: "conflict" })
  })

  it("reuses one coherent local-linked Clerk identity with zero writes", async () => {
    const coherent = snapshot({ ...clerkOnly, localEmailMatches: [localA], localPhoneMatches: [localA] })
    const dependencies = makeDependencies({
      readSnapshot: vi.fn().mockResolvedValue(coherent),
    })
    await expect(ensureExactAccountIdentity(contact, dependencies)).resolves.toMatchObject({
      ok: true,
      outcome: "reused",
      clerkIdentity: clerkA,
      localIdentity: localA,
    })
    expect(dependencies.mutateClerkAfterExactRead).not.toHaveBeenCalled()
    expect(dependencies.upsertLocalIdentity).not.toHaveBeenCalled()
  })

  it("injects a split identity inside the real Clerk create return window", async () => {
    let current = snapshot()
    const users = { createUser: vi.fn(async () => {
      current = splitClerk
      return clerkA
    }) }
    const dependencies = makeDependencies({
      readSnapshot: vi.fn(async () => current),
      mutateClerkAfterExactRead: createSafeClerkMutation(users, vi.fn()),
    })
    await expect(ensureExactAccountIdentity(contact, dependencies)).resolves.toEqual(unavailable)
    expect(users.createUser).toHaveBeenCalledOnce()
    expect(dependencies.readSnapshot).toHaveBeenCalledTimes(2)
    expect(dependencies.upsertLocalIdentity).not.toHaveBeenCalled()
  })

  it("injects mismatched linkage inside the real Prisma upsert return window", async () => {
    let current = snapshot()
    const upsertLocalIdentity = vi.fn(async () => {
      current = incompatibleLocal
      return localB
    })
    const dependencies = makeDependencies({
      readSnapshot: vi.fn(async () => current),
      mutateClerkAfterExactRead: vi.fn(async () => {
        current = clerkOnly
        return clerkA
      }),
      upsertLocalIdentity,
    })
    await expect(ensureExactAccountIdentity(contact, dependencies)).resolves.toEqual(unavailable)
    expect(upsertLocalIdentity).toHaveBeenCalledOnce()
    expect(dependencies.readSnapshot).toHaveBeenCalledTimes(3)
  })

  it.each(["mutateClerkAfterExactRead", "upsertLocalIdentity"] as const)(
    "rereads complete exact identity after a %s uniqueness race",
    async (mutation) => {
      const coherentClerk = clerkOnly
      const coherentLocal = snapshot({ ...coherentClerk, localEmailMatches: [localA], localPhoneMatches: [localA] })
      const states = mutation === "mutateClerkAfterExactRead"
        ? [snapshot(), coherentClerk, coherentClerk, coherentLocal]
        : [snapshot(), coherentClerk, coherentLocal]
      const dependencies = makeDependencies({
        readSnapshot: vi.fn().mockImplementation(async () => states.shift()!),
      })
      vi.mocked(dependencies[mutation]).mockRejectedValueOnce(new Error("unique constraint"))
      await expect(ensureExactAccountIdentity(contact, dependencies)).resolves.toMatchObject({ ok: true })
    },
  )

  it.each(["clerk", "prisma"] as const)(
    "rejects a conflicting exact reread after a %s uniqueness error",
    async (window) => {
      let current = snapshot()
      const createUser = vi.fn(async () => {
        current = window === "clerk" ? splitClerk : clerkOnly
        if (window === "clerk") throw new Error("unique constraint")
        return clerkA
      })
      const upsertLocalIdentity = vi.fn(async () => {
        current = incompatibleLocal
        throw new Error("unique constraint")
      })
      const dependencies = makeDependencies({
        readSnapshot: vi.fn(async () => current),
        mutateClerkAfterExactRead: createSafeClerkMutation({ createUser }, vi.fn()),
        upsertLocalIdentity,
      })
      await expect(ensureExactAccountIdentity(contact, dependencies)).resolves.toEqual(unavailable)
      expect(upsertLocalIdentity).toHaveBeenCalledTimes(window === "prisma" ? 1 : 0)
      expect(dependencies.readSnapshot).toHaveBeenCalledTimes(window === "prisma" ? 3 : 2)
    },
  )

  it.each(["not-a-phone", "+80012345678"])(
    "rejects invalid or non-geographic input %s before identity mutation",
    async (phone) => {
      const dependencies = makeDependencies()
      await expect(ensureExactAccountIdentity({ ...contact, phone }, dependencies)).resolves.toEqual(invalidContact)
      expect(dependencies.readSnapshot).not.toHaveBeenCalled()
      expect(dependencies.mutateClerkAfterExactRead).not.toHaveBeenCalled()
      expect(dependencies.upsertLocalIdentity).not.toHaveBeenCalled()
    },
  )

  it("fails closed when the parser throws", async () => {
    const dependencies = makeDependencies({
      parsePhone: vi.fn(() => { throw new Error("metadata unavailable") }),
    })
    await expect(ensureExactAccountIdentity(contact, dependencies)).resolves.toEqual(invalidContact)
    expect(dependencies.readSnapshot).not.toHaveBeenCalled()
    expect(dependencies.mutateClerkAfterExactRead).not.toHaveBeenCalled()
    expect(dependencies.upsertLocalIdentity).not.toHaveBeenCalled()
  })

  it("passes only canonical exact Clerk and local lookup values", async () => {
    const dependencies = makeDependencies()
    await ensureExactAccountIdentity(contact, dependencies)
    expect(dependencies.readSnapshot).toHaveBeenCalledWith({
      email: "student@example.com",
      phone: {
        e164: "+12025550123",
        digitCandidates: ["12025550123", "2025550123"],
      },
    })
  })

  it("uses a Clerk mutation primitive with no identifier lookup capability", async () => {
    const unsafeEmailOnlyLookup = vi.fn()
    const users = {
      createUser: vi.fn().mockResolvedValue(clerkA),
      getUserList: unsafeEmailOnlyLookup,
    }
    const updateExisting = vi.fn()
    const mutate = createSafeClerkMutation(users, updateExisting)
    await expect(mutate(null, contact)).resolves.toBe(clerkA)
    expect(unsafeEmailOnlyLookup).not.toHaveBeenCalled()
  })
})
