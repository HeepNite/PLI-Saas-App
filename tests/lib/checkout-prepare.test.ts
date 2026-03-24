import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockAuth, mockClerkClient, mockVerifyToken } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockClerkClient: vi.fn(),
  mockVerifyToken: vi.fn(),
}))

vi.mock("@clerk/nextjs/server", () => ({
  auth: mockAuth,
  clerkClient: mockClerkClient,
}))

vi.mock("@clerk/backend", () => ({
  verifyToken: mockVerifyToken,
}))

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

describe("prepareCheckoutAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyToken.mockResolvedValue({ data: {} })
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

    const { prepareCheckoutAccount } = await import("@/lib/checkout")

    const result = await prepareCheckoutAccount(new Request("http://localhost/checkout"), {})

    expect("status" in result).toBe(false)
    if ("status" in result) throw new Error("Expected prepared checkout account")
    expect(result.account.hasAvatar).toBe(false)
    expect(result.account.created).toBe(false)
    expect(result.account.clerkUserId).toBe(clerkUser.id)
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
})
