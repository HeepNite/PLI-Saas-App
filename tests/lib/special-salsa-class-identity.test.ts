import { describe, expect, it, vi } from "vitest"

vi.mock("@clerk/nextjs/server", () => ({ clerkClient: vi.fn() }))
vi.mock("@/lib/clerk-users", () => ({ ensureClerkUser: vi.fn(), updateClerkUserIfMissing: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: {} }))
vi.mock("@/lib/users", () => ({ upsertUserByIdentifiers: vi.fn() }))

import { resolveSpecialClassIdentity } from "@/lib/checkout/special-class-identity"

const clerkUser = (id: string) => ({
  id,
  firstName: "Ada",
  lastName: "Lovelace",
  primaryEmailAddress: { emailAddress: "ada@example.com" },
  primaryPhoneNumber: { phoneNumber: "+12015550123" },
  primaryPhoneNumberId: "phone_1",
  phoneNumbers: [{ id: "phone_1", phoneNumber: "+12015550123" }],
})

type LocalUser = { id: string; clerkId?: string | null; stripeCustomerId?: string | null }

const buildDependencies = (emailMatch: string | null, phoneMatch: string | null, localUser?: LocalUser) => {
  const users = {
    getUserList: vi.fn(async (query: { emailAddress?: string[]; phoneNumber?: string[] }) => ({
      data: query.emailAddress
        ? emailMatch ? [clerkUser(emailMatch)] : []
        : phoneMatch ? [clerkUser(phoneMatch)] : [],
    })),
    createUser: vi.fn(async () => clerkUser("clerk_new")),
    updateUser: vi.fn(),
  }
  const upsertLocalUser = vi.fn(async ({ clerkId }: { clerkId?: string }) => localUser ?? ({
    id: "db_user_1",
    clerkId,
    stripeCustomerId: null,
  }))
  return { users, upsertLocalUser }
}

const contact = {
  name: "Ada Lovelace",
  email: "ADA@example.com",
  phone: "+1 (201) 555-0123",
}

describe("special salsa class identity", () => {
  it("silently links matching email and phone without creating a Clerk session", async () => {
    const deps = buildDependencies("clerk_existing", "clerk_existing")
    const result = await resolveSpecialClassIdentity(contact, deps)

    expect(result).toMatchObject({ ok: true, clerkUserId: "clerk_existing", dbUserId: "db_user_1" })
    expect(deps.users.createUser).not.toHaveBeenCalled()
    expect(Object.hasOwn(deps.users, "createSession")).toBe(false)
  })

  it("reuses a one-identifier match and fills only missing Clerk profile fields", async () => {
    const deps = buildDependencies("clerk_existing", null)
    const result = await resolveSpecialClassIdentity(contact, deps)

    expect(result).toMatchObject({ ok: true, clerkUserId: "clerk_existing" })
    expect(deps.users.createUser).not.toHaveBeenCalled()
  })

  it("creates a passwordless customer and local user when neither identifier exists", async () => {
    const deps = buildDependencies(null, null)
    const result = await resolveSpecialClassIdentity(contact, deps)

    expect(result).toMatchObject({ ok: true, clerkUserId: "clerk_new", dbUserId: "db_user_1" })
    expect(deps.users.createUser).toHaveBeenCalledWith(expect.objectContaining({
      skipPasswordRequirement: true,
      emailAddress: ["ada@example.com"],
      phoneNumber: ["+12015550123"],
    }))
  })

  it("returns one generic conflict when email and phone resolve to different customers", async () => {
    const deps = buildDependencies("clerk_email", "clerk_phone")
    await expect(resolveSpecialClassIdentity(contact, deps)).resolves.toEqual({
      ok: false,
      code: "CONTACT_DETAILS_UNAVAILABLE",
    })
    expect(deps.upsertLocalUser).not.toHaveBeenCalled()
  })

  it("rejects invalid contact fields before Clerk lookup", async () => {
    const deps = buildDependencies(null, null)
    const findLocalUsers = vi.fn()
    await expect(resolveSpecialClassIdentity({ ...contact, phone: "Call +12015550123" }, { ...deps, findLocalUsers })).resolves.toEqual({
      ok: false,
      code: "INVALID_CONTACT",
    })
    expect(deps.users.getUserList).not.toHaveBeenCalled()
    expect(deps.users.createUser).not.toHaveBeenCalled()
    expect(deps.upsertLocalUser).not.toHaveBeenCalled()
    expect(findLocalUsers).not.toHaveBeenCalled()
  })

  it.each([
    ["Mexico", "+525512345678"],
    ["Argentina", "+5491123456789"],
  ])("uses canonical %s E.164 for Clerk and local identity", async (_country, phone) => {
    const deps = buildDependencies(null, null)
    const findLocalUsers = vi.fn(async () => [])

    await expect(resolveSpecialClassIdentity({ ...contact, phone }, { ...deps, findLocalUsers })).resolves.toMatchObject({
      ok: true,
      phone,
    })
    expect(deps.users.createUser).toHaveBeenCalledWith(expect.objectContaining({ phoneNumber: [phone] }))
    expect(findLocalUsers).toHaveBeenCalledWith(contact.email.toLowerCase(), expect.objectContaining({ e164: phone }))
  })

  it.each([
    ["null", { id: "db_user_1", clerkId: null }],
    ["omitted", { id: "db_user_1" }],
  ])("rejects a local user with %s Clerk linkage", async (_label, localUser) => {
    const deps = buildDependencies("clerk_existing", "clerk_existing", localUser)

    await expect(resolveSpecialClassIdentity(contact, deps)).resolves.toEqual({
      ok: false,
      code: "CONTACT_DETAILS_UNAVAILABLE",
    })
  })
})
