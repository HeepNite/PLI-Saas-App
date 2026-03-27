import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuth = vi.fn()
const mockClerkClient = vi.fn()
const mockUpsertUser = vi.fn()
const mockGetStudentPinStatus = vi.fn()
const mockVerifyStudentPinHash = vi.fn()
const mockReplacePermanentStudentPin = vi.fn()
const mockClearStudentPinLockout = vi.fn()
const mockWriteStudentPinAudit = vi.fn()

const mockPrisma = {
  studentPinCredential: {
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(),
}

vi.mock("@clerk/nextjs/server", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

vi.mock("@/lib/users", () => ({
  upsertUserByIdentifiers: (...args: unknown[]) => mockUpsertUser(...args),
}))

vi.mock("@/lib/security/student-pin", () => ({
  isStudentPinLifecycleEnabled: () => true,
  assertStudentPinConfirmation: (nextPin: string, confirmPin: string) => {
    if (!/^\d{4}$/.test(nextPin)) return { status: 400, error: "PIN must be exactly 4 digits." }
    if (nextPin !== confirmPin) return { status: 400, error: "PIN confirmation does not match." }
    return null
  },
  getStudentPinStatus: (...args: unknown[]) => mockGetStudentPinStatus(...args),
  verifyStudentPinHash: (...args: unknown[]) => mockVerifyStudentPinHash(...args),
  replacePermanentStudentPin: (...args: unknown[]) => mockReplacePermanentStudentPin(...args),
  clearStudentPinLockout: (...args: unknown[]) => mockClearStudentPinLockout(...args),
  isLockedCredential: (credential: { lockedAt: Date | null; failedAttempts: number }) =>
    Boolean(credential.lockedAt || credential.failedAttempts >= 5),
}))

vi.mock("@/lib/security/student-pin-audit", () => ({
  STUDENT_PIN_AUDIT_ACTIONS: {
    RESET: "reset",
    RECOVERY_RESET: "recovery_reset",
  },
  writeStudentPinAudit: (...args: unknown[]) => mockWriteStudentPinAudit(...args),
}))

describe("profile PIN route", () => {
  const usersApi = { getUser: vi.fn() }

  beforeEach(() => {
    mockAuth.mockReset()
    mockClerkClient.mockReset()
    mockUpsertUser.mockReset()
    mockGetStudentPinStatus.mockReset()
    mockVerifyStudentPinHash.mockReset()
    mockReplacePermanentStudentPin.mockReset()
    mockClearStudentPinLockout.mockReset()
    mockWriteStudentPinAudit.mockReset()
    mockPrisma.studentPinCredential.findUnique.mockReset()
    mockPrisma.$transaction.mockReset()

    mockClerkClient.mockResolvedValue({ users: usersApi })
    usersApi.getUser.mockResolvedValue({
      firstName: "Test",
      lastName: "User",
      primaryEmailAddress: { emailAddress: "test@example.com" },
      primaryPhoneNumber: { phoneNumber: "+1 555 555 5555" },
    })
    mockUpsertUser.mockResolvedValue({ id: "db_user" })
    mockGetStudentPinStatus.mockResolvedValue({ enabled: true, enrolled: true, locked: false, needsEnrollment: false, permanent: { status: "active", failedAttempts: 0, lockedAt: null, lastVerifiedAt: null }, provisional: { active: false, expiresAt: null } })
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => Promise<unknown>) => callback(mockPrisma))
  })

  it("returns PIN status for authenticated students", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    const { GET } = await import("@/app/api/profile/pin/route")
    const res = await GET(new Request("http://localhost/api/profile/pin"))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ enabled: true, enrolled: true })
  })

  it("resets PIN with the current PIN", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    mockPrisma.studentPinCredential.findUnique.mockResolvedValue({
      id: "cred_1",
      lockedAt: null,
      failedAttempts: 0,
      pinHash: "hash",
      pinLookupDigest: "digest",
    })
    mockVerifyStudentPinHash.mockResolvedValue(true)

    const { PUT } = await import("@/app/api/profile/pin/route")
    const res = await PUT(
      new Request("http://localhost/api/profile/pin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin: "1234", nextPin: "5678", confirmPin: "5678" }),
      })
    )

    expect(res.status).toBe(200)
    expect(mockReplacePermanentStudentPin).toHaveBeenCalled()
    expect(mockClearStudentPinLockout).toHaveBeenCalled()
    expect(mockWriteStudentPinAudit).toHaveBeenCalled()
  })

  it("allows recovery reset without current PIN", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    mockPrisma.studentPinCredential.findUnique.mockResolvedValue(null)

    const { PUT } = await import("@/app/api/profile/pin/route")
    const res = await PUT(
      new Request("http://localhost/api/profile/pin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nextPin: "5678", confirmPin: "5678" }),
      })
    )

    expect(res.status).toBe(200)
    expect(mockVerifyStudentPinHash).not.toHaveBeenCalled()
  })
})
