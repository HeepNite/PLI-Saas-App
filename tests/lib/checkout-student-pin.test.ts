import { beforeEach, describe, expect, it, vi } from "vitest"

const mockTransaction = vi.fn()
const mockReplacePermanentStudentPin = vi.fn()
const mockWriteStudentPinAudit = vi.fn()
const mockUpsertUserByIdentifiers = vi.fn()
const mockStudentPinCredentialFindFirst = vi.fn()

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
  clerkClient: vi.fn(),
}))

vi.mock("@clerk/backend", () => ({
  verifyToken: vi.fn(),
}))

vi.mock("@/lib/checkin/kiosk-session", () => ({
  resolveTerminalKioskSession: vi.fn(),
}))

vi.mock("@/lib/security/staff-terminal", () => ({
  authorizeStaffTerminalSession: vi.fn(),
}))

vi.mock("@/lib/clerk-users", () => ({
  ensureClerkUser: vi.fn(),
  findClerkUserByIdentifiers: vi.fn(),
  resolveAvatarState: vi.fn(() => ({ hasAvatar: false, needsRefresh: false })),
  updateClerkUserIfMissing: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockTransaction(...args),
    // Pre-check uniqueness gate runs against the top-level client before the
    // transaction; return no conflict so the transaction path is exercised.
    studentPinCredential: {
      findFirst: (...args: unknown[]) => mockStudentPinCredentialFindFirst(...args),
    },
  },
}))

vi.mock("@/lib/security/student-pin", async () => {
  const actual = await vi.importActual<typeof import("@/lib/security/student-pin")>("@/lib/security/student-pin")
  return {
    ...actual,
    isStudentPinLifecycleEnabled: () => true,
    replacePermanentStudentPin: (...args: unknown[]) => mockReplacePermanentStudentPin(...args),
  }
})

vi.mock("@/lib/security/student-pin-audit", () => ({
  STUDENT_PIN_AUDIT_ACTIONS: {
    ENROLLED: "enrolled",
  },
  writeStudentPinAudit: (...args: unknown[]) => mockWriteStudentPinAudit(...args),
}))

vi.mock("@/lib/users", () => ({
  upsertUserByIdentifiers: (...args: unknown[]) => mockUpsertUserByIdentifiers(...args),
}))

describe("enrollStudentPinForCheckout", () => {
  beforeEach(() => {
    vi.resetModules()
    mockTransaction.mockReset()
    mockReplacePermanentStudentPin.mockReset()
    mockWriteStudentPinAudit.mockReset()
    mockUpsertUserByIdentifiers.mockReset()

    mockUpsertUserByIdentifiers.mockResolvedValue({ id: "db_user" })
    mockStudentPinCredentialFindFirst.mockReset()
    mockStudentPinCredentialFindFirst.mockResolvedValue(null)
    mockTransaction.mockImplementation(async (callback: (tx: object) => Promise<unknown>) => callback({}))
  })

  it("returns a 409 when the chosen PIN is already active for another student", async () => {
    const { StudentPinConflictError } = await import("@/lib/security/student-pin")
    const { enrollStudentPinForCheckout: enroll } = await import("@/lib/checkout")

    mockReplacePermanentStudentPin.mockRejectedValueOnce(new StudentPinConflictError())

    await expect(
      enroll({
        serviceId: "new-student",
        resolvedClerkUserId: "clerk_user",
        resolvedEmail: "student@example.com",
        phoneNormalized: "5551112222",
        name: "Student Example",
        studentPin: "1234",
        studentPinConfirm: "1234",
      })
    ).resolves.toEqual({
      status: 409,
      error: "PIN already in use by another student. Please choose a different PIN.",
    })

    expect(mockWriteStudentPinAudit).not.toHaveBeenCalled()
  })

  it.each([
    {
      name: "when the new-student checkout omits PIN fields",
      input: {
        serviceId: "new-student",
        resolvedClerkUserId: "clerk_user",
        resolvedEmail: "student@example.com",
        phoneNormalized: "5551112222",
        name: "Student Example",
      },
      expected: {
        status: 400,
        error: "PIN must be exactly 4 digits.",
      },
    },
    {
      name: "when the PIN confirmation is invalid",
      input: {
        serviceId: "new-student",
        resolvedClerkUserId: "clerk_user",
        resolvedEmail: "student@example.com",
        phoneNormalized: "5551112222",
        name: "Student Example",
        studentPin: "1234",
        studentPinConfirm: "4321",
      },
      expected: {
        status: 400,
        error: "PIN confirmation does not match.",
      },
    },
  ])("returns a 400 %s", async ({ input, expected }) => {
    const { enrollStudentPinForCheckout: enroll } = await import("@/lib/checkout")

    await expect(enroll(input)).resolves.toEqual(expected)

    expect(mockUpsertUserByIdentifiers).not.toHaveBeenCalled()
    expect(mockTransaction).not.toHaveBeenCalled()
    expect(mockReplacePermanentStudentPin).not.toHaveBeenCalled()
    expect(mockWriteStudentPinAudit).not.toHaveBeenCalled()
  })
})
