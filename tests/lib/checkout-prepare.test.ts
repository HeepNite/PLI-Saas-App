import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  mockAuth,
  mockAuthorizeStaffTerminalSession,
  mockClerkClient,
  mockCreateCheckoutExactAccountDependencies,
  mockEnsureExactAccountIdentity,
  mockLookupPreparedCheckoutContext,
  mockReadExactSnapshot,
  mockResolveExactIdentity,
  mockVerifyToken,
  mockResolveTerminalKioskSession,
  mockTouchKioskIdentificationSession,
  mockUpsertUserByIdentifiers,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockAuthorizeStaffTerminalSession: vi.fn(),
  mockClerkClient: vi.fn(),
  mockCreateCheckoutExactAccountDependencies: vi.fn(),
  mockEnsureExactAccountIdentity: vi.fn(),
  mockLookupPreparedCheckoutContext: vi.fn(),
  mockReadExactSnapshot: vi.fn(),
  mockResolveExactIdentity: vi.fn(),
  mockVerifyToken: vi.fn(),
  mockResolveTerminalKioskSession: vi.fn(),
  mockTouchKioskIdentificationSession: vi.fn(),
  mockUpsertUserByIdentifiers: vi.fn(),
}))

// Persisting the DB user is not under test here and requires a database.
// Mock it so the new-user / staff→student paths don't hit real prisma.
vi.mock("@/lib/users", () => ({
  upsertUserByIdentifiers: mockUpsertUserByIdentifiers,
}))

vi.mock("@/lib/checkout/exact-identity-adapters", () => ({
  createCheckoutExactAccountDependencies: mockCreateCheckoutExactAccountDependencies,
}))

vi.mock("@/lib/checkout/identity-safety", () => ({
  ensureExactAccountIdentity: mockEnsureExactAccountIdentity,
  resolveExactIdentity: mockResolveExactIdentity,
}))

vi.mock("@clerk/nextjs/server", () => ({
  auth: mockAuth,
  clerkClient: mockClerkClient,
}))

vi.mock("@clerk/backend", () => ({
  verifyToken: mockVerifyToken,
}))

vi.mock("@/lib/phone", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/phone")>()
  return { ...actual, parseServerPhoneInput(input: string) {
    const digits = input.replace(/\D/g, "")
    return actual.parseServerPhoneInput(/^1555\d{7}$/.test(digits) ? `+1202555${digits.slice(-4)}` : input)
  } }
})
vi.mock("@/lib/checkin/kiosk-session", () => ({
  resolveTerminalKioskSession: mockResolveTerminalKioskSession,
  touchKioskIdentificationSession: mockTouchKioskIdentificationSession,
}))

vi.mock("@/lib/security/staff-terminal", () => ({
  authorizeStaffTerminalSession: mockAuthorizeStaffTerminalSession,
}))

vi.mock("@/lib/checkout/prepared-context", async () => {
  const actual = await vi.importActual<typeof import("@/lib/checkout/prepared-context")>("@/lib/checkout/prepared-context")
  return {
    ...actual,
    lookupPreparedCheckoutContext: mockLookupPreparedCheckoutContext,
  }
})

type MockClerkUser = {
  id: string
  hasImage: boolean
  firstName: string | null
  lastName: string | null
  primaryEmailAddress: { emailAddress: string }
  primaryPhoneNumber: { phoneNumber: string }
  primaryPhoneNumberId: string | null
  phoneNumbers: Array<{
    id: string
    phoneNumber: string
    verification?: { status?: string }
  }>
}

const makeClerkUser = (overrides: Partial<MockClerkUser> = {}): MockClerkUser => ({
  id: "user_default",
  hasImage: false,
  firstName: "Test",
  lastName: "User",
  primaryEmailAddress: { emailAddress: "test@example.com" },
  primaryPhoneNumber: { phoneNumber: "+1 555 000 1111" },
  primaryPhoneNumberId: "pn_default",
  phoneNumbers: [
    {
      id: "pn_default",
      phoneNumber: "+15550001111",
      verification: { status: "verified" },
    },
  ],
  ...overrides,
})

const makeClerkClient = () => ({
  users: {
    getUser: vi.fn(),
    getUserList: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
  },
  phoneNumbers: {
    createPhoneNumber: vi.fn(),
  },
})

const mockExactAccount = (clerkIdentity: MockClerkUser, outcome: "created" | "reused" = "reused") => {
  mockEnsureExactAccountIdentity.mockResolvedValue({ ok: true, outcome, clerkIdentity,
    localIdentity: { id: `local_${clerkIdentity.id}`, clerkId: clerkIdentity.id } })
  mockCreateCheckoutExactAccountDependencies.mockImplementation((_client, creation) => {
    if (outcome === "created") creation.occurred = true
    return { readSnapshot: mockReadExactSnapshot }
  })
}
describe("prepareCheckoutAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyToken.mockResolvedValue({ data: {} })
    mockResolveTerminalKioskSession.mockReset()
    mockAuthorizeStaffTerminalSession.mockReset()
    mockLookupPreparedCheckoutContext.mockReset()
    mockReadExactSnapshot.mockReset()
    mockResolveExactIdentity.mockReset()
    mockEnsureExactAccountIdentity.mockReset()
    mockCreateCheckoutExactAccountDependencies.mockReturnValue({ readSnapshot: mockReadExactSnapshot })
    mockUpsertUserByIdentifiers.mockResolvedValue({ id: "db_user_prepare" })
  })

  it("returns hasAvatar true for an authenticated user with an avatar", async () => {
    const clerkUser = makeClerkUser({
      id: "user_auth_avatar",
      hasImage: true,
    })
    const client = makeClerkClient()

    client.users.getUser.mockImplementation(async (userId: string) => {
      expect(userId).toBe(clerkUser.id)
      return clerkUser
    })
    client.users.getUserList.mockResolvedValue({ data: [] })
    mockAuth.mockResolvedValue({ userId: clerkUser.id })
    mockClerkClient.mockResolvedValue(client)
    mockExactAccount(clerkUser)

    const { prepareCheckoutAccount } = await import("@/lib/checkout")

    const result = await prepareCheckoutAccount(new Request("http://localhost/checkout"), {})

    expect("status" in result).toBe(false)
    if ("status" in result) throw new Error("Expected prepared checkout account")
    expect(result.account.hasAvatar).toBe(true)
    expect(result.account.created).toBe(false)
    expect(result.account.clerkUserId).toBe(clerkUser.id)
  })

  it("returns hasAvatar false for an authenticated user without an avatar", async () => {
    const clerkUser = makeClerkUser({
      id: "user_auth_no_avatar",
      hasImage: false,
    })
    const client = makeClerkClient()

    client.users.getUser.mockImplementation(async (userId: string) => {
      expect(userId).toBe(clerkUser.id)
      return clerkUser
    })
    client.users.getUserList.mockResolvedValue({ data: [] })
    mockAuth.mockResolvedValue({ userId: clerkUser.id })
    mockClerkClient.mockResolvedValue(client)
    mockExactAccount(clerkUser)

    const { prepareCheckoutAccount } = await import("@/lib/checkout")

    const result = await prepareCheckoutAccount(new Request("http://localhost/checkout"), {})

    expect("status" in result).toBe(false)
    if ("status" in result) throw new Error("Expected prepared checkout account")
    expect(result.account.hasAvatar).toBe(false)
    expect(result.account.created).toBe(false)
    expect(result.account.clerkUserId).toBe(clerkUser.id)
  })

  it("does not update the ambient Clerk profile during kiosk new-student preparation", async () => {
    const ambientUser = makeClerkUser({
      id: "ambient_kiosk_user",
      firstName: null,
      lastName: null,
      primaryPhoneNumber: { phoneNumber: "" },
      primaryPhoneNumberId: null,
      phoneNumbers: [],
    })
    const client = makeClerkClient()

    client.users.getUser.mockResolvedValue(ambientUser)
    client.users.getUserList.mockResolvedValue({ data: [] })
    mockAuth.mockResolvedValue({ userId: ambientUser.id })
    mockClerkClient.mockResolvedValue(client)

    const { prepareCheckoutAccount } = await import("@/lib/checkout")

    const result = await prepareCheckoutAccount(
      new Request("http://localhost/checkout"),
      {
        email: "student@example.com",
        firstName: "New",
        lastName: "Student",
        phone: "+1 202 555 0123",
      },
      {
        photoContext: "kiosk_terminal",
        allowExistingAccountLookup: true,
        serviceId: "new-student",
        deferUserCreation: true,
      }
    )

    expect("status" in result).toBe(false)
    expect(client.users.updateUser).not.toHaveBeenCalled()
    expect(client.phoneNumbers.createPhoneNumber).not.toHaveBeenCalled()
  })

  it("delegates signed-in profile completion to exact account resolution", async () => {
    const signedInUser = makeClerkUser({
      id: "signed_in_user",
      firstName: null,
      lastName: null,
      primaryPhoneNumber: { phoneNumber: "" },
      primaryPhoneNumberId: null,
      phoneNumbers: [],
    })
    const client = makeClerkClient()

    client.users.getUser.mockResolvedValue(signedInUser)
    mockAuth.mockResolvedValue({ userId: signedInUser.id })
    mockClerkClient.mockResolvedValue(client)
    mockExactAccount(signedInUser)

    const { prepareCheckoutAccount } = await import("@/lib/checkout")

    const result = await prepareCheckoutAccount(new Request("http://localhost/checkout"), {
      firstName: "Signed",
      lastName: "Customer",
      phone: "+1 555 444 5555",
    })

    expect("status" in result).toBe(false)
    expect(mockEnsureExactAccountIdentity).toHaveBeenCalledWith(expect.objectContaining({
      phone: "+12025555555", firstName: "Signed", lastName: "Customer" }), expect.anything())
  })

  it("returns hasAvatar true when an existing user is found by identifiers", async () => {
    const existingUser = makeClerkUser({
      id: "user_lookup_avatar",
      hasImage: true,
      primaryEmailAddress: { emailAddress: "lookup@example.com" },
      primaryPhoneNumber: { phoneNumber: "+1 555 000 2222" },
      phoneNumbers: [
        {
          id: "pn_lookup",
          phoneNumber: "+15550002222",
          verification: { status: "verified" },
        },
      ],
      primaryPhoneNumberId: "pn_lookup",
    })
    const client = makeClerkClient()

    client.users.getUser.mockResolvedValue(existingUser)
    client.users.getUserList.mockImplementation(async (params?: { emailAddress?: string[] }) => {
      if (params?.emailAddress?.includes("lookup@example.com")) {
        return { data: [existingUser] }
      }
      return { data: [] }
    })
    mockAuth.mockResolvedValue({ userId: null })
    mockClerkClient.mockResolvedValue(client)
    mockExactAccount(existingUser)

    const { prepareCheckoutAccount } = await import("@/lib/checkout")

    const result = await prepareCheckoutAccount(
      new Request("http://localhost/checkout"),
      {
        email: "lookup@example.com",
        phone: "+1 555 000 2222",
      },
      { allowExistingAccountLookup: true }
    )

    expect("status" in result).toBe(false)
    if ("status" in result) throw new Error("Expected prepared checkout account")
    expect(result.account.hasAvatar).toBe(true)
    expect(result.account.created).toBe(false)
    expect(result.account.clerkUserId).toBe(existingUser.id)
  })

  it("does not refresh Clerk when identifier lookup returns an explicit avatar state", async () => {
    const existingUser = makeClerkUser({
      id: "user_lookup_explicit_avatar",
      hasImage: true,
      primaryEmailAddress: { emailAddress: "explicit@example.com" },
      primaryPhoneNumber: { phoneNumber: "+1 555 000 4444" },
      phoneNumbers: [
        {
          id: "pn_explicit",
          phoneNumber: "+15550004444",
          verification: { status: "verified" },
        },
      ],
      primaryPhoneNumberId: "pn_explicit",
    })
    const client = makeClerkClient()

    client.users.getUserList.mockImplementation(async (params?: { emailAddress?: string[] }) => {
      if (params?.emailAddress?.includes("explicit@example.com")) {
        return { data: [existingUser] }
      }
      return { data: [] }
    })
    mockAuth.mockResolvedValue({ userId: null })
    mockClerkClient.mockResolvedValue(client)
    mockExactAccount(existingUser)

    const { prepareCheckoutAccount } = await import("@/lib/checkout")

    const result = await prepareCheckoutAccount(
      new Request("http://localhost/checkout"),
      {
        email: "explicit@example.com",
        phone: "+1 555 000 4444",
      },
      { allowExistingAccountLookup: true }
    )

    expect("status" in result).toBe(false)
    if ("status" in result) throw new Error("Expected prepared checkout account")
    expect(client.users.getUser).not.toHaveBeenCalled()
    expect(result.account.hasAvatar).toBe(true)
    expect(result.account.created).toBe(false)
    expect(result.account.clerkUserId).toBe(existingUser.id)
  })

  it("refreshes Clerk once when identifier lookup returns an ambiguous avatar state", async () => {
    const ambiguousUser = {
      ...makeClerkUser({
        id: "user_lookup_ambiguous_avatar",
        primaryEmailAddress: { emailAddress: "ambiguous@example.com" },
        primaryPhoneNumber: { phoneNumber: "+1 555 000 5555" },
        phoneNumbers: [
          {
            id: "pn_ambiguous",
            phoneNumber: "+15550005555",
            verification: { status: "verified" },
          },
        ],
        primaryPhoneNumberId: "pn_ambiguous",
      }),
      hasImage: "unknown",
    } as unknown as MockClerkUser
    const refreshedUser = makeClerkUser({
      id: ambiguousUser.id,
      hasImage: true,
      primaryEmailAddress: { emailAddress: "ambiguous@example.com" },
      primaryPhoneNumber: { phoneNumber: "+1 555 000 5555" },
      phoneNumbers: [
        {
          id: "pn_ambiguous",
          phoneNumber: "+15550005555",
          verification: { status: "verified" },
        },
      ],
      primaryPhoneNumberId: "pn_ambiguous",
    })
    const client = makeClerkClient()

    client.users.getUser.mockImplementation(async (userId: string) => {
      expect(userId).toBe(ambiguousUser.id)
      return refreshedUser
    })
    client.users.getUserList.mockImplementation(async (params?: { emailAddress?: string[] }) => {
      if (params?.emailAddress?.includes("ambiguous@example.com")) {
        return { data: [ambiguousUser] }
      }
      return { data: [] }
    })
    mockAuth.mockResolvedValue({ userId: null })
    mockClerkClient.mockResolvedValue(client)
    mockExactAccount(ambiguousUser)

    const { prepareCheckoutAccount } = await import("@/lib/checkout")

    const result = await prepareCheckoutAccount(
      new Request("http://localhost/checkout"),
      {
        email: "ambiguous@example.com",
        phone: "+1 555 000 5555",
      },
      { allowExistingAccountLookup: true }
    )

    expect("status" in result).toBe(false)
    if ("status" in result) throw new Error("Expected prepared checkout account")
    expect(client.users.getUser).toHaveBeenCalledTimes(1)
    expect(result.clerkUser).toBe(refreshedUser)
    expect(result.account.hasAvatar).toBe(true)
    expect(result.account.created).toBe(false)
    expect(result.account.clerkUserId).toBe(refreshedUser.id)
  })

  it("returns hasAvatar false when a new user is created", async () => {
    const createdUser = makeClerkUser({
      id: "user_created_no_avatar",
      hasImage: false,
      primaryEmailAddress: { emailAddress: "new@example.com" },
      primaryPhoneNumber: { phoneNumber: "+1 555 000 3333" },
      phoneNumbers: [
        {
          id: "pn_created",
          phoneNumber: "+15550003333",
          verification: { status: "unverified" },
        },
      ],
      primaryPhoneNumberId: "pn_created",
    })
    const client = makeClerkClient()

    client.users.getUser.mockResolvedValue(createdUser)
    client.users.getUserList.mockResolvedValue({ data: [] })
    client.users.createUser.mockResolvedValue(createdUser)
    mockAuth.mockResolvedValue({ userId: null })
    mockClerkClient.mockResolvedValue(client)
    mockExactAccount(createdUser, "created")

    const { prepareCheckoutAccount } = await import("@/lib/checkout")

    const result = await prepareCheckoutAccount(
      new Request("http://localhost/checkout"),
      {
        email: "new@example.com",
        firstName: "New",
        lastName: "Student",
        phone: "+1 555 000 3333",
      },
      { allowExistingAccountLookup: true }
    )

    expect("status" in result).toBe(false)
    if ("status" in result) throw new Error("Expected prepared checkout account")
    expect(result.account.hasAvatar).toBe(false)
    expect(result.account.created).toBe(true)
    expect(result.account.clerkUserId).toBe(createdUser.id)
  })

  it("ignores staff Clerk auth in kiosk checkout and falls back to kiosk identity", async () => {
    const staffUser = makeClerkUser({
      id: "staff_user_1",
      firstName: "Owner",
      lastName: "Account",
      primaryEmailAddress: { emailAddress: "owner@example.com" },
      primaryPhoneNumber: { phoneNumber: "+1 555 999 0000" },
      phoneNumbers: [
        {
          id: "pn_owner",
          phoneNumber: "+15559990000",
          verification: { status: "verified" },
        },
      ],
      primaryPhoneNumberId: "pn_owner",
    }) as MockClerkUser & {
      publicMetadata: { role: string }
      privateMetadata: Record<string, never>
      unsafeMetadata: Record<string, never>
    }
    staffUser.publicMetadata = { role: "owner" }
    staffUser.privateMetadata = {}
    staffUser.unsafeMetadata = {}

    const client = makeClerkClient()
    client.users.getUser.mockResolvedValue(staffUser)
    mockAuth.mockResolvedValue({ userId: staffUser.id })
    mockClerkClient.mockResolvedValue(client)
    mockResolveTerminalKioskSession.mockResolvedValue({
      ok: true,
      session: {
        user: {
          id: "db_kiosk_user_1",
          clerkId: "customer_clerk_1",
          email: "student@example.com",
          phone: "+1 202 555 0123",
          name: "Student Example",
        },
      },
    })
    mockResolveExactIdentity.mockReturnValue({
      kind: "reused",
      clerkIdentity: { id: "customer_clerk_1" },
      localIdentity: { id: "db_kiosk_user_1", clerkId: "customer_clerk_1" },
    })

    const { prepareCheckoutAccount } = await import("@/lib/checkout")

    const result = await prepareCheckoutAccount(
      new Request("http://localhost/checkout"),
      {},
      {
        photoContext: "kiosk_terminal",
        kioskSessionToken: "kiosk_session_1",
      }
    )

    expect("status" in result).toBe(false)
    if ("status" in result) throw new Error("Expected prepared checkout account")
    expect(mockResolveTerminalKioskSession).toHaveBeenCalledWith("kiosk_session_1", {
      terminalAuth: undefined,
      touch: false,
    })
    expect(mockTouchKioskIdentificationSession).toHaveBeenCalledOnce()
    expect(result.userId).toBeNull()
    expect(result.resolvedUserId).toBe("customer_clerk_1")
    expect(result.identity).toMatchObject({
      resolvedEmail: "student@example.com",
      phoneNormalized: "12025550123",
    })
    expect(result.account).toMatchObject({
      clerkUserId: "customer_clerk_1",
      requiresSignIn: false,
      created: false,
      hasAvatar: true,
    })
  })

  it("prepares checkout from kiosk session instead of an active customer Clerk session", async () => {
    const activeClerkUser = makeClerkUser({
      id: "melanie_clerk_1",
      firstName: "Melanie",
      lastName: "Padilla",
      primaryEmailAddress: { emailAddress: "melanie@example.com" },
      primaryPhoneNumber: { phoneNumber: "+1 555 000 9999" },
    })
    const client = makeClerkClient()
    client.users.getUser.mockResolvedValue(activeClerkUser)
    mockAuth.mockResolvedValue({ userId: activeClerkUser.id })
    mockClerkClient.mockResolvedValue(client)
    mockResolveTerminalKioskSession.mockResolvedValue({
      ok: true,
      session: {
        user: {
          id: "jhon_db_1",
          clerkId: "jhon_clerk_1",
          email: "jhon@doe.com",
          phone: "+1 202 555 0124",
          name: "Jhon Doe",
        },
      },
    })
    mockResolveExactIdentity.mockReturnValue({
      kind: "reused",
      clerkIdentity: { id: "jhon_clerk_1" },
      localIdentity: { id: "jhon_db_1", clerkId: "jhon_clerk_1" },
    })

    const { prepareCheckoutAccount } = await import("@/lib/checkout")

    const result = await prepareCheckoutAccount(
      new Request("http://localhost/checkout"),
      {},
      {
        photoContext: "kiosk_terminal",
        kioskSessionToken: "jhon_kiosk_session",
      }
    )

    expect("status" in result).toBe(false)
    if ("status" in result) throw new Error("Expected prepared checkout account")
    expect(mockResolveTerminalKioskSession).toHaveBeenCalledWith("jhon_kiosk_session", {
      terminalAuth: undefined,
      touch: false,
    })
    expect(mockTouchKioskIdentificationSession).toHaveBeenCalledOnce()
    expect(result.userId).toBeNull()
    expect(result.resolvedUserId).toBe("jhon_clerk_1")
    expect(result.identity).toMatchObject({
      resolvedEmail: "jhon@doe.com",
      phoneNormalized: "12025550124",
    })
    expect(result.account).toMatchObject({
      clerkUserId: "jhon_clerk_1",
      requiresSignIn: false,
      created: false,
      hasAvatar: true,
    })
  })

  it("does not leak staff clerkUser into new-student prepareOnly when no kiosk session exists", async () => {
    const staffUser = makeClerkUser({
      id: "staff_user_leak_guard",
      firstName: "Staff",
      lastName: "Member",
      primaryEmailAddress: { emailAddress: "staff@example.com" },
      primaryPhoneNumber: { phoneNumber: "+1 555 999 1111" },
      phoneNumbers: [
        {
          id: "pn_staff",
          phoneNumber: "+15559991111",
          verification: { status: "verified" },
        },
      ],
      primaryPhoneNumberId: "pn_staff",
    })

    const client = makeClerkClient()
    client.users.getUser.mockResolvedValue(staffUser)
    client.users.getUserList.mockResolvedValue({ data: [] })
    mockAuth.mockResolvedValue({ userId: staffUser.id })
    mockClerkClient.mockResolvedValue(client)

    const { prepareCheckoutAccount } = await import("@/lib/checkout")

    const result = await prepareCheckoutAccount(
      new Request("http://localhost/checkout"),
      {
        email: "newstudent@example.com",
        phone: "+1 202 555 0123",
      },
      {
        photoContext: "kiosk_terminal",
        allowExistingAccountLookup: true,
        serviceId: "new-student",
        deferUserCreation: true,
      }
    )

    expect("status" in result).toBe(false)
    if ("status" in result) throw new Error("Expected prepared checkout account, got error: " + result.error)

    // The critical assertions: staff session must NOT leak into prepared account
    expect(result.userId).toBeNull()
    expect(result.clerkUser).toBeNull()
    expect(result.resolvedUserId).toBeNull()
    expect(result.account.clerkUserId).toBeNull()
    expect(result.account.hasAvatar).toBe(false)
    expect(result.account.requiresSignIn).toBe(false)

    // Identity should come from form data, not staff session
    expect(result.identity.resolvedEmail).toBe("newstudent@example.com")
    expect(result.identity.phoneNormalized).toBe("12025550123")
  })

  it("does not leak blocked-staff clerkUser into new-student prepareOnly", async () => {
    const staffUser = makeClerkUser({
      id: "staff_blocked_leak",
      firstName: "Admin",
      lastName: "User",
      primaryEmailAddress: { emailAddress: "admin@example.com" },
      primaryPhoneNumber: { phoneNumber: "+1 555 888 0000" },
      phoneNumbers: [
        {
          id: "pn_admin",
          phoneNumber: "+15558880000",
          verification: { status: "verified" },
        },
      ],
      primaryPhoneNumberId: "pn_admin",
    }) as MockClerkUser & {
      publicMetadata: { role: string }
      privateMetadata: Record<string, never>
      unsafeMetadata: Record<string, never>
    }
    staffUser.publicMetadata = { role: "staff" }
    staffUser.privateMetadata = {}
    staffUser.unsafeMetadata = {}

    const client = makeClerkClient()
    client.users.getUser.mockResolvedValue(staffUser)
    client.users.getUserList.mockResolvedValue({ data: [] })
    mockAuth.mockResolvedValue({ userId: staffUser.id })
    mockClerkClient.mockResolvedValue(client)

    const { prepareCheckoutAccount } = await import("@/lib/checkout")

    const result = await prepareCheckoutAccount(
      new Request("http://localhost/checkout"),
      {
        email: "brandnew@example.com",
        phone: "+1 202 555 0124",
      },
      {
        photoContext: "kiosk_terminal",
        allowExistingAccountLookup: true,
        serviceId: "new-student",
        deferUserCreation: true,
      }
    )

    expect("status" in result).toBe(false)
    if ("status" in result) throw new Error("Expected prepared checkout account, got error: " + result.error)

    // Even with blocked staff role, staff session must NOT leak
    expect(result.userId).toBeNull()
    expect(result.clerkUser).toBeNull()
    expect(result.resolvedUserId).toBeNull()
    expect(result.account.clerkUserId).toBeNull()
    expect(result.account.hasAvatar).toBe(false)
    expect(result.identity.resolvedEmail).toBe("brandnew@example.com")
    expect(result.identity.phoneNormalized).toBe("12025550124")
  })

  it("full checkout with staff session resolves to STUDENT identity, not staff", async () => {
    const staffUser = makeClerkUser({
      id: "staff_user_full_checkout",
      firstName: "Staff",
      lastName: "Member",
      primaryEmailAddress: { emailAddress: "staff@example.com" },
      primaryPhoneNumber: { phoneNumber: "+1 555 999 1111" },
      phoneNumbers: [
        {
          id: "pn_staff",
          phoneNumber: "+15559991111",
          verification: { status: "verified" },
        },
      ],
      primaryPhoneNumberId: "pn_staff",
    })

    // Student's Clerk user (created during prepareOnly in Task 5)
    const studentClerkUser = makeClerkUser({
      id: "student_clerk_from_prepareonly",
      firstName: "New",
      lastName: "Student",
      primaryEmailAddress: { emailAddress: "newstudent@example.com" },
      primaryPhoneNumber: { phoneNumber: "+1 202 555 0123" },
      phoneNumbers: [
        {
          id: "pn_student",
          phoneNumber: "+12025550123",
          verification: { status: "verified" },
        },
      ],
      primaryPhoneNumberId: "pn_student",
    })

    const client = makeClerkClient()
    client.users.getUser.mockResolvedValue(staffUser)
    // findClerkUserByIdentifiers uses getUserList — return the student
    client.users.getUserList.mockImplementation(async (params?: { emailAddress?: string[] }) => {
      if (params?.emailAddress?.includes("newstudent@example.com")) {
        return { data: [studentClerkUser] }
      }
      return { data: [] }
    })
    mockAuth.mockResolvedValue({ userId: staffUser.id })
    mockClerkClient.mockResolvedValue(client)
    mockEnsureExactAccountIdentity.mockResolvedValue({
      ok: true,
      outcome: "reused",
      clerkIdentity: studentClerkUser,
      localIdentity: { id: "local_student", clerkId: studentClerkUser.id },
    })

    const { prepareCheckoutAccount } = await import("@/lib/checkout")

    const result = await prepareCheckoutAccount(
      new Request("http://localhost/checkout"),
      {
        email: "newstudent@example.com",
        phone: "+1 202 555 0123",
      },
      {
        photoContext: "kiosk_terminal",
        allowExistingAccountLookup: true,
        serviceId: "new-student",
        // deferUserCreation is FALSE — this is the full checkout path
      }
    )

    expect("status" in result).toBe(false)
    if ("status" in result) throw new Error("Expected prepared checkout account, got error: " + result.error)

    // resolvedUserId must be the student's, not the staff's
    expect(result.resolvedUserId).toBe("student_clerk_from_prepareonly")
    expect(result.resolvedUserId).not.toBe(staffUser.id)

    // Identity must come from form data (student), not staff session
    expect(result.identity.resolvedEmail).toBe("newstudent@example.com")
    expect(result.identity.phoneNormalized).toBe("12025550123")

    // account.clerkUserId must be the student's
    expect(result.account.clerkUserId).toBe("student_clerk_from_prepareonly")
    expect(result.account.created).toBe(false)
  })

  it("full checkout with staff session creates student Clerk user if not found", async () => {
    const staffUser = makeClerkUser({
      id: "staff_user_create_student",
      firstName: "Staff",
      lastName: "Member",
      primaryEmailAddress: { emailAddress: "staff@example.com" },
      primaryPhoneNumber: { phoneNumber: "+1 555 999 1111" },
      phoneNumbers: [
        {
          id: "pn_staff2",
          phoneNumber: "+15559991111",
          verification: { status: "verified" },
        },
      ],
      primaryPhoneNumberId: "pn_staff2",
    })

    const createdStudent = makeClerkUser({
      id: "student_clerk_created",
      firstName: "New",
      lastName: "Student",
      primaryEmailAddress: { emailAddress: "brandnew2@example.com" },
      primaryPhoneNumber: { phoneNumber: "+1 202 555 0124" },
      phoneNumbers: [
        {
          id: "pn_created_student",
          phoneNumber: "+12025550124",
          verification: { status: "unverified" },
        },
      ],
      primaryPhoneNumberId: "pn_created_student",
    })

    const client = makeClerkClient()
    client.users.getUser.mockResolvedValue(staffUser)
    // No existing student found
    client.users.getUserList.mockResolvedValue({ data: [] })
    // ensureClerkUser creates the student
    client.users.createUser.mockResolvedValue(createdStudent)
    mockAuth.mockResolvedValue({ userId: staffUser.id })
    mockClerkClient.mockResolvedValue(client)
    mockEnsureExactAccountIdentity.mockResolvedValue({
      ok: true,
      outcome: "created",
      clerkIdentity: createdStudent,
      localIdentity: { id: "local_created_student", clerkId: createdStudent.id },
    })

    const { prepareCheckoutAccount } = await import("@/lib/checkout")

    const result = await prepareCheckoutAccount(
      new Request("http://localhost/checkout"),
      {
        email: "brandnew2@example.com",
        firstName: "New",
        lastName: "Student",
        phone: "+1 202 555 0124",
      },
      {
        photoContext: "kiosk_terminal",
        allowExistingAccountLookup: true,
        serviceId: "new-student",
        // deferUserCreation is FALSE — full checkout path
      }
    )

    expect("status" in result).toBe(false)
    if ("status" in result) throw new Error("Expected prepared checkout account, got error: " + result.error)

    // resolvedUserId must be the newly created student's, not the staff's
    expect(result.resolvedUserId).toBe("student_clerk_created")
    expect(result.resolvedUserId).not.toBe(staffUser.id)

    // Identity must come from form data
    expect(result.identity.resolvedEmail).toBe("brandnew2@example.com")
    expect(result.identity.phoneNormalized).toBe("12025550124")

    // The student's Clerk user should be resolved
    expect(result.clerkUser).not.toBeNull()
    expect(result.clerkUser?.id).toBe("student_clerk_created")

    // account.clerkUserId must be the student's
    expect(result.account.clerkUserId).toBe("student_clerk_created")
  })
})

describe("resolveCheckoutPreparation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockReset()
    mockAuth.mockResolvedValue({ userId: null })
    mockClerkClient.mockReset()
    mockClerkClient.mockResolvedValue(makeClerkClient())
    mockCreateCheckoutExactAccountDependencies.mockReturnValue({ readSnapshot: mockReadExactSnapshot })
    process.env.PREPARED_CHECKOUT_CONTEXT = "0"
    mockVerifyToken.mockResolvedValue({ data: {} })
    mockResolveTerminalKioskSession.mockResolvedValue({
      ok: true,
      session: {
        user: {
          id: "db_kiosk_user_1",
          clerkId: "customer_clerk_1",
          email: "student@example.com",
          phone: "+1 202 555 0123",
          name: "Student Example",
        },
      },
    })
    mockResolveExactIdentity.mockReturnValue({
      kind: "reused",
      clerkIdentity: { id: "customer_clerk_1" },
      localIdentity: { id: "db_kiosk_user_1", clerkId: "customer_clerk_1" },
    })
  })

  it("falls back to the existing preparation path when PREPARED_CHECKOUT_CONTEXT=0", async () => {
    const { PREPARED_CHECKOUT_FALLBACK_REASONS } = await import("@/lib/checkout/prepared-context")
    const { resolveCheckoutPreparation } = await import("@/lib/checkout")

    const result = await resolveCheckoutPreparation(
      new Request("http://localhost/api/checkout/intent"),
      {},
      {
        photoContext: "kiosk_terminal",
        allowExistingAccountLookup: true,
        kioskSessionToken: "kiosk_session_1",
        validation: {
          courseSlug: "salsa-femenina-matutina",
          date: "2026-02-24",
          time: "11:00",
          durationMinutes: 60,
        },
      }
    )

    expect("status" in result).toBe(false)
    if ("status" in result) throw new Error("Expected checkout preparation result")

    expect(result).toMatchObject({
      source: "fallback",
      fallbackReason: PREPARED_CHECKOUT_FALLBACK_REASONS.disabled,
      terminalAuth: null,
      preparedAccount: {
        resolvedUserId: "customer_clerk_1",
      },
    })
    expect(mockAuthorizeStaffTerminalSession).not.toHaveBeenCalled()
    expect(mockLookupPreparedCheckoutContext).not.toHaveBeenCalled()
    expect(mockResolveTerminalKioskSession).toHaveBeenCalledWith("kiosk_session_1", {
      terminalAuth: undefined,
      touch: false,
    })
  })
})
