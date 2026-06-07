import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizePortalBase = vi.fn()
const mockRandomInt = vi.fn()
const mockIssueProvisionalStudentPin = vi.fn()
const mockReplacePermanentStudentPin = vi.fn()
const mockClearStudentPinLockout = vi.fn()
const mockUnlockStudentPinCredentials = vi.fn()
const mockGetStudentPinStatus = vi.fn()
const mockWriteStudentPinAudit = vi.fn()

vi.mock("crypto", () => ({
  randomInt: (...args: unknown[]) => mockRandomInt(...args),
}))

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(),
}

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeStaffPortalBaseRequest: (...args: unknown[]) => mockAuthorizePortalBase(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

vi.mock("@/lib/security/student-pin", () => ({
  StudentPinConflictError: class StudentPinConflictError extends Error {
    code = "PIN_ALREADY_IN_USE"

    constructor(message = "PIN already in use by another student. Please choose a different PIN.") {
      super(message)
      this.name = "StudentPinConflictError"
    }
  },
  isStudentPinLifecycleEnabled: () => true,
  isStudentPinFormatValid: (value: string) => /^\d{4}$/.test(value),
  isStudentPinConflictError: (error: unknown) =>
    Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "PIN_ALREADY_IN_USE"),
  issueProvisionalStudentPin: (...args: unknown[]) => mockIssueProvisionalStudentPin(...args),
  replacePermanentStudentPin: (...args: unknown[]) => mockReplacePermanentStudentPin(...args),
  clearStudentPinLockout: (...args: unknown[]) => mockClearStudentPinLockout(...args),
  unlockStudentPinCredentials: (...args: unknown[]) => mockUnlockStudentPinCredentials(...args),
  getStudentPinStatus: (...args: unknown[]) => mockGetStudentPinStatus(...args),
}))

vi.mock("@/lib/security/student-pin-audit", () => ({
  STUDENT_PIN_AUDIT_ACTIONS: {
    ISSUE_PROVISIONAL: "issue_provisional",
    RESET: "reset",
    UNLOCKED: "unlocked",
    STAFF_DENIED: "staff_denied",
  },
  writeStudentPinAudit: (...args: unknown[]) => mockWriteStudentPinAudit(...args),
}))

describe("staff student PIN route", () => {
  beforeEach(() => {
    mockAuthorizePortalBase.mockReset()
    mockRandomInt.mockReset()
    mockIssueProvisionalStudentPin.mockReset()
    mockReplacePermanentStudentPin.mockReset()
    mockClearStudentPinLockout.mockReset()
    mockUnlockStudentPinCredentials.mockReset()
    mockGetStudentPinStatus.mockReset()
    mockWriteStudentPinAudit.mockReset()
    mockPrisma.user.findUnique.mockReset()
    mockPrisma.$transaction.mockReset()

    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => Promise<unknown>) => callback(mockPrisma))
    mockRandomInt.mockReturnValue(2468)
    mockGetStudentPinStatus.mockResolvedValue({
      enabled: true,
      enrolled: false,
      locked: false,
      needsEnrollment: true,
      requiresRegeneration: false,
      permanent: { status: null, failedAttempts: 0, lockedAt: null, lastVerifiedAt: null },
      provisional: { active: true, expiresAt: "2026-03-26T23:59:59.999Z" },
    })
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "student_1",
      email: "student@example.com",
      name: "Student Example",
      studentPinCredentials: [],
    })
  })

  it("audits and denies staff without student PIN permission", async () => {
    mockAuthorizePortalBase.mockResolvedValue({ ok: true, userId: "staff_1", role: "staff", category: "teacher" })

    const { POST } = await import("@/app/api/staff/users/[userId]/pin/route")
    const res = await POST(
      new Request("http://localhost/api/staff/users/student_1/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "issue_provisional", reason: "Walk-in recovery before class" }),
      }),
      { params: Promise.resolve({ userId: "student_1" }) }
    )

    expect(res.status).toBe(403)
    expect(mockWriteStudentPinAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "student_1",
        action: "staff_denied",
        result: "denied",
        actorClerkId: "staff_1",
      })
    )
    expect(mockIssueProvisionalStudentPin).not.toHaveBeenCalled()
  })

  it("issues a provisional PIN for authorized front-desk staff", async () => {
    mockAuthorizePortalBase.mockResolvedValue({ ok: true, userId: "staff_2", role: "staff", category: "front_desk" })
    mockIssueProvisionalStudentPin.mockResolvedValue({ expiresAt: new Date("2026-03-26T23:59:59.999Z") })

    const { POST } = await import("@/app/api/staff/users/[userId]/pin/route")
    const res = await POST(
      new Request("http://localhost/api/staff/users/student_1/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "issue_provisional",
          reason: "Legacy student needs same-day kiosk access",
          provisionalPin: "2468",
        }),
      }),
      { params: Promise.resolve({ userId: "student_1" }) }
    )

    expect(res.status).toBe(200)
    expect(mockIssueProvisionalStudentPin).toHaveBeenCalledWith(
      mockPrisma,
      expect.objectContaining({ userId: "student_1", nextPin: "2468" })
    )
    expect(mockClearStudentPinLockout).toHaveBeenCalledWith(mockPrisma, "student_1")
    expect(mockWriteStudentPinAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "student_1",
        action: "issue_provisional",
        result: "success",
        actorClerkId: "staff_2",
        credentialKind: "provisional",
      })
    )

    const data = await res.json()
    expect(data).toMatchObject({
      ok: true,
      provisionalPin: "2468",
      provisionalPinMasked: "**68",
      expiresAt: "2026-03-26T23:59:59.999Z",
    })
  })

  it("resets a permanent PIN for authorized front-desk staff", async () => {
    mockAuthorizePortalBase.mockResolvedValue({ ok: true, userId: "staff_2", role: "staff", category: "front_desk" })
    mockReplacePermanentStudentPin.mockResolvedValue({ id: "perm_1" })
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "student_1",
      email: "student@example.com",
      name: "Student Example",
      studentPinCredentials: [{ kind: "permanent", status: "locked", expiresAt: null }],
    })

    const { POST } = await import("@/app/api/staff/users/[userId]/pin/route")
    const res = await POST(
      new Request("http://localhost/api/staff/users/student_1/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset_permanent",
          reason: "In-person recovery after repeated kiosk lockouts",
          nextPin: "1357",
        }),
      }),
      { params: Promise.resolve({ userId: "student_1" }) }
    )

    expect(res.status).toBe(200)
    expect(mockReplacePermanentStudentPin).toHaveBeenCalledWith(
      mockPrisma,
      expect.objectContaining({ userId: "student_1", nextPin: "1357" })
    )
    expect(mockClearStudentPinLockout).toHaveBeenCalledWith(mockPrisma, "student_1")
    expect(mockWriteStudentPinAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "student_1",
        action: "reset",
        result: "success",
        actorClerkId: "staff_2",
        credentialKind: "permanent",
      })
    )

    const data = await res.json()
    expect(data).toMatchObject({
      ok: true,
      permanentPin: "1357",
      permanentPinMasked: "**57",
    })
  })

  it("unlocks locked student PIN credentials for authorized managers", async () => {
    mockAuthorizePortalBase.mockResolvedValue({ ok: true, userId: "admin_1", role: "admin", category: "manager" })
    mockUnlockStudentPinCredentials.mockResolvedValue(1)
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "student_1",
      email: "student@example.com",
      name: "Student Example",
      studentPinCredentials: [{ kind: "permanent", status: "locked", expiresAt: null }],
    })

    const { POST } = await import("@/app/api/staff/users/[userId]/pin/route")
    const res = await POST(
      new Request("http://localhost/api/staff/users/student_1/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unlock",
          reason: "Verified identity at front desk after lockout",
        }),
      }),
      { params: Promise.resolve({ userId: "student_1" }) }
    )

    expect(res.status).toBe(200)
    expect(mockUnlockStudentPinCredentials).toHaveBeenCalledWith(mockPrisma, "student_1")
    expect(mockClearStudentPinLockout).not.toHaveBeenCalled()
    expect(mockWriteStudentPinAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "student_1",
        action: "unlocked",
        result: "success",
        actorClerkId: "admin_1",
      })
    )

    const data = await res.json()
    expect(data).toMatchObject({
      ok: true,
      unlockedCredentialCount: 1,
    })
  })

  it("retries auto-generated provisional PINs when a collision is detected", async () => {
    mockAuthorizePortalBase.mockResolvedValue({ ok: true, userId: "staff_2", role: "staff", category: "front_desk" })
    mockRandomInt
      .mockReturnValueOnce(1234)
      .mockReturnValueOnce(5678)

    const collision = new Error("PIN already in use by another student. Please choose a different PIN.") as Error & {
      code: string
    }
    collision.code = "PIN_ALREADY_IN_USE"

    mockIssueProvisionalStudentPin
      .mockRejectedValueOnce(collision)
      .mockResolvedValueOnce({ expiresAt: new Date("2026-03-26T23:59:59.999Z") })

    const { POST } = await import("@/app/api/staff/users/[userId]/pin/route")
    const res = await POST(
      new Request("http://localhost/api/staff/users/student_1/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "issue_provisional",
          reason: "Legacy student needs same-day kiosk access",
        }),
      }),
      { params: Promise.resolve({ userId: "student_1" }) }
    )

    expect(res.status).toBe(200)
    expect(mockIssueProvisionalStudentPin).toHaveBeenNthCalledWith(
      1,
      mockPrisma,
      expect.objectContaining({ userId: "student_1", nextPin: "1234" })
    )
    expect(mockIssueProvisionalStudentPin).toHaveBeenNthCalledWith(
      2,
      mockPrisma,
      expect.objectContaining({ userId: "student_1", nextPin: "5678" })
    )

    const data = await res.json()
    expect(data).toMatchObject({
      provisionalPin: "5678",
      provisionalPinMasked: "**78",
    })
  })

  it("returns a deployment error when student PIN tables are missing before loading credentials", async () => {
    mockAuthorizePortalBase.mockResolvedValue({ ok: true, userId: "staff_2", role: "staff", category: "front_desk" })
    mockPrisma.user.findUnique.mockRejectedValue({
      name: "PrismaClientKnownRequestError",
      code: "P2021",
    })

    const { POST } = await import("@/app/api/staff/users/[userId]/pin/route")
    const res = await POST(
      new Request("http://localhost/api/staff/users/student_1/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "issue_provisional",
          reason: "Legacy student needs same-day kiosk access",
        }),
      }),
      { params: Promise.resolve({ userId: "student_1" }) }
    )

    expect(res.status).toBe(503)
    await expect(res.json()).resolves.toMatchObject({
      error: expect.stringContaining("20260326090000_add_student_pin_lifecycle"),
    })
  })

  it("returns a deployment error when student PIN tables are missing during issuance", async () => {
    mockAuthorizePortalBase.mockResolvedValue({ ok: true, userId: "staff_2", role: "staff", category: "front_desk" })
    mockPrisma.$transaction.mockRejectedValue({
      name: "PrismaClientKnownRequestError",
      code: "P2022",
    })

    const { POST } = await import("@/app/api/staff/users/[userId]/pin/route")
    const res = await POST(
      new Request("http://localhost/api/staff/users/student_1/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "issue_provisional",
          reason: "Legacy student needs same-day kiosk access",
        }),
      }),
      { params: Promise.resolve({ userId: "student_1" }) }
    )

    expect(res.status).toBe(503)
    await expect(res.json()).resolves.toMatchObject({
      error: expect.stringContaining("not deployed in this environment"),
    })
  })
})
