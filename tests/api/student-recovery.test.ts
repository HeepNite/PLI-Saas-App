import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorize = vi.fn()
const mockIssueDraft = vi.fn()
const mockLookupDraft = vi.fn()
const mockIssueTicket = vi.fn()
const mockNormalizeCode = vi.fn()

vi.mock("@/lib/security/staff-portal-auth", () => ({ authorizeStudentOperationalRequest: (...args: unknown[]) => mockAuthorize(...args) }))
vi.mock("@/lib/student-recovery", () => ({
  issueRecoveryDraft: (...args: unknown[]) => mockIssueDraft(...args),
  lookupRecoveryDraft: (...args: unknown[]) => mockLookupDraft(...args),
  issueRecoveryTicket: (...args: unknown[]) => mockIssueTicket(...args),
  normalizeRecoveryCode: (...args: unknown[]) => mockNormalizeCode(...args),
}))
vi.mock("@/lib/phone", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/phone")>()
  return { ...actual, parseServerPhoneInput: (value: string) => {
    if (value === "parser-exception") throw new Error("metadata unavailable")
    return actual.parseServerPhoneInput(value)
  } }
})
const post = (url: string, body: unknown) => new Request(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })

describe("student recovery API boundaries", () => {
  beforeEach(() => {
    vi.resetModules()
    for (const mock of [mockAuthorize, mockIssueDraft, mockLookupDraft, mockIssueTicket, mockNormalizeCode]) mock.mockReset()
    mockNormalizeCode.mockImplementation((value) => typeof value === "string" && /^(?:PLI-\d{4}|[A-Z0-9]{12})$/.test(value) ? value : null)
  })

  it("returns only the opaque draft code to the student", async () => {
    mockIssueDraft.mockResolvedValue("PLI-1234")
    const { POST } = await import("@/app/api/checkin/qr/new-student/recovery-draft/route")
    const response = await POST(post("http://localhost/recovery", { phone: "+1 202 555 0123", email: "student@example.com", name: "Student", source: "qr_mobile" }))
    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ code: "PLI-1234" })
    expect(mockIssueDraft).toHaveBeenCalledWith(
      { phone: "+12025550123", email: "student@example.com", name: "Student" },
      "qr_mobile",
    )
  })

  it("rejects invalid and non-geographic phones before recovery persistence", async () => {
    const { POST } = await import("@/app/api/checkin/qr/new-student/recovery-draft/route")

    for (const phone of ["not-a-phone", "+80012345678", "parser-exception"]) {
      const response = await POST(post("http://localhost/recovery", { phone, source: "qr_mobile" }))
      expect(response.status).toBe(400)
    }
    expect(mockIssueDraft).not.toHaveBeenCalled()
  })

  it.each([
    ["Owner", { ok: true, userId: "owner", role: "owner", category: null, staffName: "Owner" }, 200],
    ["Admin", { ok: true, userId: "admin", role: "admin", category: null, staffName: "Admin" }, 200],
    ["Front Desk", { ok: true, userId: "front-desk", role: "staff", category: "front_desk", staffName: "Desk" }, 200],
    ["Teacher", { ok: false, status: 403, error: "Insufficient role" }, 404],
  ])("allows %s according to student operations authorization", async (_role, auth, expectedStatus) => {
    mockAuthorize.mockResolvedValue(auth)
    mockLookupDraft.mockResolvedValue({ id: "draft", phone: "+15551234567", email: "student@example.com", name: "Student" })
    const { POST } = await import("@/app/api/staff/students/recovery/lookup/route")
    const response = await POST(post("http://localhost/recovery", { code: "ABCDEFGHIJKL" }))

    expect(response.status).toBe(expectedStatus)
    if (expectedStatus === 404) expect(mockLookupDraft).not.toHaveBeenCalled()
    else expect(mockLookupDraft).toHaveBeenCalledWith("ABCDEFGHIJKL")
  })

  it("denies a teacher before draft disclosure with the same unavailable response", async () => {
    mockAuthorize.mockResolvedValue({ ok: false, status: 403, error: "Insufficient role" })
    const { POST } = await import("@/app/api/staff/students/recovery/lookup/route")
    const response = await POST(post("http://localhost/recovery", { code: "ABCDEFGHIJKL" }))
    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: "Recovery code is unavailable." })
    expect(mockLookupDraft).not.toHaveBeenCalled()
  })

  it("requires both staff confirmations before ticket issuance", async () => {
    mockAuthorize.mockResolvedValue({ ok: true, userId: "front-desk", role: "staff", category: "front_desk", staffName: "Desk" })
    const { POST } = await import("@/app/api/staff/students/recovery/ticket/route")
    const response = await POST(post("http://localhost/recovery", { draftId: "draft", noSmsConfirmed: true, phoneValidated: false }))
    expect(response.status).toBe(400)
    expect(mockIssueTicket).not.toHaveBeenCalled()
  })

  it("issues a ticket only after an authorized dual confirmation", async () => {
    mockAuthorize.mockResolvedValue({ ok: true, userId: "front-desk", role: "staff", category: "front_desk", staffName: "Desk" })
    mockIssueTicket.mockResolvedValue({ token: "ABCDEFGHIJKL" })
    const { POST } = await import("@/app/api/staff/students/recovery/ticket/route")
    const response = await POST(post("http://localhost/recovery", { draftId: "draft", noSmsConfirmed: true, phoneValidated: true }))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ticket: "ABCDEFGHIJKL" })
    expect(mockIssueTicket).toHaveBeenCalledWith("draft", "front-desk")
  })

  it("does not issue a ticket when the atomic draft transition was already claimed", async () => {
    mockAuthorize.mockResolvedValue({ ok: true, userId: "front-desk", role: "staff", category: "front_desk", staffName: "Desk" })
    mockIssueTicket.mockResolvedValue(null)
    const { POST } = await import("@/app/api/staff/students/recovery/ticket/route")
    const response = await POST(post("http://localhost/recovery", { draftId: "draft", noSmsConfirmed: true, phoneValidated: true }))
    expect(response.status).toBe(400)
    expect(mockIssueTicket).toHaveBeenCalledWith("draft", "front-desk")
  })
})
