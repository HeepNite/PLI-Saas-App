import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), clerkClient: vi.fn(), kioskAuth: vi.fn(), resolveSession: vi.fn(), touchSession: vi.fn(),
  terminalAuth: vi.fn(), localFindMany: vi.fn(), localFindUnique: vi.fn(), localUpsert: vi.fn(), legacyUpsert: vi.fn(),
}))

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth, clerkClient: mocks.clerkClient }))
vi.mock("@clerk/backend", () => ({ verifyToken: vi.fn() }))
vi.mock("@/lib/security/kiosk-customer-auth", () => ({ resolveKioskCustomerClerkAuth: mocks.kioskAuth }))
vi.mock("@/lib/checkin/kiosk-session", () => ({
  resolveTerminalKioskSession: mocks.resolveSession, touchKioskIdentificationSession: mocks.touchSession,
}))
vi.mock("@/lib/security/staff-terminal", () => ({ authorizeStaffTerminalSession: mocks.terminalAuth }))
vi.mock("@/lib/prisma", () => ({ prisma: { user: {
  findMany: mocks.localFindMany, findUnique: mocks.localFindUnique, upsert: mocks.localUpsert,
} } }))
vi.mock("@/lib/users", () => ({ upsertUserByIdentifiers: mocks.legacyUpsert }))

const user = (id: string, email: string, phone: string) => ({
  id, hasImage: false, firstName: "Test", lastName: "Student",
  primaryEmailAddress: { emailAddress: email }, primaryPhoneNumber: { phoneNumber: phone },
  primaryPhoneNumberId: `phone_${id}`,
  phoneNumbers: [{ id: `phone_${id}`, phoneNumber: phone, verification: { status: "verified" } }],
})
type User = ReturnType<typeof user>
const client = () => ({ users: {
  getUser: vi.fn(), getUserList: vi.fn(), createUser: vi.fn(), updateUser: vi.fn(),
}, phoneNumbers: { createPhoneNumber: vi.fn() } })
type Client = ReturnType<typeof client>
const expectNoWrites = (clerk: Client) => {
  expect([clerk.users.createUser, clerk.users.updateUser, clerk.phoneNumbers.createPhoneNumber,
    mocks.localUpsert, mocks.legacyUpsert].map((write) => write.mock.calls.length)).toEqual([0, 0, 0, 0, 0])
}
const authenticate = (clerk: Client, authenticated: User) => {
  clerk.users.getUser.mockResolvedValue(authenticated); mocks.auth.mockResolvedValue({ userId: authenticated.id })
  mocks.clerkClient.mockResolvedValue(clerk)
}
const connect = (clerk: Client, emailMatches: User[], phoneMatches: User[], localMatches: Array<{ id: string; clerkId: string | null }> = []) => {
  clerk.users.getUserList.mockImplementation(async (filter: { emailAddress?: string[] }) => {
    const data = filter.emailAddress ? emailMatches : phoneMatches
    return { data, totalCount: data.length }
  })
  mocks.localFindMany.mockImplementation(async () => localMatches)
}
const session = (phone: string, clerkId: string | null = "clerk_student") => ({ ok: true, session: {
  id: "kiosk_session", user: { id: "local_student", clerkId, email: "student@example.com", phone, name: "Test Student" },
} })
const prepare = async (input: Record<string, string> = {}, options: Record<string, unknown>) => {
  const { prepareCheckoutAccount } = await import("@/lib/checkout")
  return prepareCheckoutAccount(new Request("http://localhost"), input, options)
}

describe("checkout exact identity integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ userId: null })
    mocks.kioskAuth.mockResolvedValue(null)
    mocks.terminalAuth.mockResolvedValue({ ok: true })
    mocks.localFindUnique.mockResolvedValue(null)
  })

  it("accepts parser-confirmed US legacy digits and touches only after exact coherence", async () => {
    const student = user("clerk_student", "student@example.com", "+12025550123")
    const clerk = client()
    connect(clerk, [student], [student], [{ id: "local_student", clerkId: student.id }])
    mocks.clerkClient.mockResolvedValue(clerk)
    mocks.resolveSession.mockResolvedValue(session("2025550123"))

    const result = await prepare({}, { photoContext: "kiosk_terminal", kioskSessionToken: "kiosk_session" })

    expect("status" in result).toBe(false)
    expect(mocks.resolveSession).toHaveBeenCalledWith("kiosk_session", { terminalAuth: undefined, touch: false })
    expect(mocks.touchSession).toHaveBeenCalledOnce()
    expect(mocks.touchSession.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.localFindMany.mock.invocationCallOrder.at(-1)!)
  })

  it("rejects an unlinked Canadian NANP number before touch", async () => {
    const clerk = client()
    mocks.clerkClient.mockResolvedValue(clerk)
    mocks.resolveSession.mockResolvedValue(session("4165550123", null))

    const result = await prepare({}, { photoContext: "kiosk_terminal", kioskSessionToken: "kiosk_session" })

    expect(result).toMatchObject({ status: 409 })
    expect(clerk.users.getUserList).not.toHaveBeenCalled()
    expect(mocks.localFindMany).not.toHaveBeenCalled()
    expect(mocks.touchSession).not.toHaveBeenCalled()
  })

  it.each([["UK", "442071838750", "+442071838750"], ["Canadian", "14165550123", "+14165550123"]])(
    "recovers a linked %s digits-only identity from exact Clerk E.164", async (_country, localPhone, e164) => {
      const student = user("clerk_student", "student@example.com", e164)
      const clerk = client()
      clerk.users.getUser.mockResolvedValue(student)
      connect(clerk, [student], [student], [{ id: "local_student", clerkId: student.id }])
      mocks.clerkClient.mockResolvedValue(clerk)
      mocks.resolveSession.mockResolvedValue(session(localPhone))

      const result = await prepare({}, { photoContext: "kiosk_terminal", kioskSessionToken: "kiosk_session" })

      expect("status" in result).toBe(false)
      expect(clerk.users.getUser).toHaveBeenCalledWith(student.id)
      expect(mocks.touchSession).toHaveBeenCalledOnce()
    },
  )

  it("rejects split new-student Clerk identity before mutation", async () => {
    const clerk = client()
    connect(clerk, [user("clerk_email", "student@example.com", "+12025550124")], [user("clerk_phone", "other@example.com", "+12025550123")])
    mocks.clerkClient.mockResolvedValue(clerk)

    const result = await prepare({ email: "student@example.com", phone: "+12025550123" }, { photoContext: "qr_phone", serviceId: "new-student" })

    expect(result).toMatchObject({ status: 409 })
    expect(clerk.users.createUser).not.toHaveBeenCalled()
    expect(mocks.localUpsert).not.toHaveBeenCalled()
    expect(mocks.legacyUpsert).not.toHaveBeenCalled()
  })

  it.each([
    ["invalid", () => ({ email: "auth@example.com", phone: "not-a-phone" })],
    ["non-geographic", () => ({ email: "auth@example.com", phone: "+80012345678" })],
    ["parser-error", () => ({ email: "auth@example.com", get phone(): string { throw new Error("unavailable") } })],
  ])("rejects authenticated %s phone input before any write", async (_case, input) => {
    const authenticated = user("clerk_auth", "auth@example.com", "+12025550123")
    const clerk = client(); authenticate(clerk, authenticated)
    const result = await prepare(input(), {})
    expect(result).toMatchObject({ status: 400 })
    expectNoWrites(clerk)
  })
  it("reuses a coherent authenticated exact identity with zero writes", async () => {
    const authenticated = user("clerk_auth", "auth@example.com", "+12025550123")
    const clerk = client()
    connect(clerk, [authenticated], [authenticated], [{ id: "local_auth", clerkId: authenticated.id }])
    authenticate(clerk, authenticated)
    const result = await prepare({ email: "auth@example.com", phone: "+12025550123" }, {})
    expect(result).toMatchObject({ resolvedUserId: authenticated.id, account: { created: false } })
    expect(clerk.users.getUserList).toHaveBeenCalledTimes(2)
    expect(mocks.localFindMany).toHaveBeenCalledTimes(2)
    expectNoWrites(clerk)
  })
  it("creates an unauthenticated identity only after complete reads and validates the returned identity", async () => {
    const created = user("clerk_created", "new@example.com", "+12025550123")
    const local = { id: "local_created", clerkId: created.id }
    const clerk = client()
    let clerkState: User | null = null
    let localState: typeof local | null = null
    clerk.users.getUserList.mockImplementation(async () => {
      const data = clerkState ? [clerkState] : []; return { data, totalCount: data.length }
    })
    clerk.users.createUser.mockImplementation(async () => (clerkState = created))
    mocks.localFindMany.mockImplementation(async () => localState ? [localState] : [])
    mocks.localUpsert.mockImplementation(async () => (localState = local))
    mocks.clerkClient.mockResolvedValue(clerk)
    const result = await prepare({ email: "new@example.com", phone: "+12025550123" }, {})
    expect(result).toMatchObject({ resolvedUserId: created.id, account: { clerkUserId: created.id, created: true } })
    expect(clerk.users.createUser.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.localFindMany.mock.invocationCallOrder[1])
    expect(mocks.localUpsert).toHaveBeenCalledOnce()
    expect(mocks.legacyUpsert).not.toHaveBeenCalled()
  })
  it("rejects a deferred split identity after complete reads with zero writes", async () => {
    const clerk = client()
    connect(clerk, [user("clerk_email", "student@example.com", "+12025550124")],
      [user("clerk_phone", "other@example.com", "+12025550123")])
    mocks.clerkClient.mockResolvedValue(clerk)
    const result = await prepare({ email: "student@example.com", phone: "+12025550123" }, {
      allowExistingAccountLookup: true, deferUserCreation: true,
    })
    expect(result).toMatchObject({ status: 409 })
    expect(clerk.users.getUserList).toHaveBeenCalledTimes(2)
    expect(mocks.localFindMany).toHaveBeenCalledTimes(2)
    expectNoWrites(clerk)
  })
  it("isolates authenticated staff identity in qr_phone new-student checkout", async () => {
    const staff = user("clerk_staff", "staff@example.com", "+12025550999")
    const student = user("clerk_student", "student@example.com", "+12025550123")
    const clerk = client()
    clerk.users.getUser.mockResolvedValue(staff)
    connect(clerk, [student], [student], [{ id: "local_student", clerkId: student.id }])
    mocks.auth.mockResolvedValue({ userId: staff.id })
    mocks.clerkClient.mockResolvedValue(clerk)

    const result = await prepare({ email: "student@example.com", phone: "+12025550123" }, { photoContext: "qr_phone", serviceId: "new-student" })

    expect("status" in result).toBe(false)
    if ("status" in result) throw new Error(result.error)
    expect([result.userId, result.resolvedUserId, result.clerkUser?.id]).toEqual([null, student.id, student.id])
    expect(clerk.users.updateUser).not.toHaveBeenCalled()
    expect(clerk.phoneNumbers.createPhoneNumber).not.toHaveBeenCalled()
  })

  it("keeps deferred new-student preparation mutation-free", async () => {
    const staff = user("clerk_staff", "staff@example.com", "+12025550999")
    const clerk = client()
    clerk.users.getUser.mockResolvedValue(staff)
    mocks.auth.mockResolvedValue({ userId: staff.id })
    mocks.clerkClient.mockResolvedValue(clerk)

    const result = await prepare({ email: "student@example.com", phone: "+12025550123" }, {
      photoContext: "qr_phone", serviceId: "new-student", deferUserCreation: true,
    })

    expect("status" in result).toBe(false)
    expect([clerk.users.getUserList, clerk.users.createUser, clerk.users.updateUser, clerk.phoneNumbers.createPhoneNumber,
      mocks.localFindMany, mocks.localUpsert, mocks.legacyUpsert].every((mutation) => mutation.mock.calls.length === 0)).toBe(true)
  })
})
