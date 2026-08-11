import { beforeEach, describe, expect, it, vi } from "vitest"

const mockPrisma = {
  studentRecoveryDraft: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
  studentRecoveryTicket: { create: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
}

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))

describe("student recovery", () => {
  beforeEach(() => {
    vi.resetModules()
    for (const delegate of [mockPrisma.studentRecoveryDraft, mockPrisma.studentRecoveryTicket]) {
      for (const method of Object.values(delegate)) method.mockReset()
    }
    mockPrisma.$transaction.mockReset()
    mockPrisma.studentRecoveryDraft.updateMany.mockResolvedValue({ count: 0 })
    mockPrisma.studentRecoveryTicket.updateMany.mockResolvedValue({ count: 0 })
    mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockPrisma))
  })

  it("stores only a code hash when issuing a draft", async () => {
    mockPrisma.studentRecoveryDraft.create.mockResolvedValue({})
    const { issueRecoveryDraft } = await import("@/lib/student-recovery")
    const code = await issueRecoveryDraft({ phone: "+15551234567", email: "student@example.com", name: "Student" }, "qr_mobile")
    expect(code).toMatch(/^PLI-\d{4}$/)
    expect(mockPrisma.studentRecoveryDraft.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ codeHash: expect.any(String) }) }))
    expect(JSON.stringify(mockPrisma.studentRecoveryDraft.create.mock.calls)).not.toContain(code)
  })

  it("normalizes whitespace and case for staff-entered draft codes", async () => {
    const { normalizeRecoveryCode } = await import("@/lib/student-recovery")
    expect(normalizeRecoveryCode(" pli-1234 ")).toBe("PLI-1234")
    expect(normalizeRecoveryCode("PLI-12345")).toBeNull()
    expect(normalizeRecoveryCode("PLI-12A4")).toBeNull()
    expect(normalizeRecoveryCode(" abc-def_ghij ")).toBe("ABC-DEF_GHIJ")
  })

  it("retries draft issuance after a code-hash collision", async () => {
    mockPrisma.studentRecoveryDraft.create
      .mockRejectedValueOnce({ code: "P2002" })
      .mockResolvedValueOnce({})
    const { issueRecoveryDraft } = await import("@/lib/student-recovery")

    await expect(issueRecoveryDraft({ phone: "+15551234567" }, "qr_mobile")).resolves.toMatch(/^PLI-\d{4}$/)
    expect(mockPrisma.studentRecoveryDraft.create).toHaveBeenCalledTimes(2)
  })

  it("atomically claims a draft before minting its only ticket", async () => {
    let claimCount = 0
    mockPrisma.studentRecoveryDraft.updateMany.mockImplementation(({ data }) => {
      if (data.status !== "ticket_issued") return Promise.resolve({ count: 0 })
      claimCount += 1
      return Promise.resolve({ count: claimCount === 1 ? 1 : 0 })
    })
    mockPrisma.studentRecoveryTicket.create.mockResolvedValue({ correlationId: "correlation" })
    const { issueRecoveryTicket } = await import("@/lib/student-recovery")
    await expect(issueRecoveryTicket("draft", "staff")).resolves.toEqual(expect.objectContaining({ correlationId: "correlation" }))
    await expect(issueRecoveryTicket("draft", "staff")).resolves.toBeNull()
    expect(mockPrisma.studentRecoveryTicket.create).toHaveBeenCalledTimes(1)
    expect(mockPrisma.studentRecoveryDraft.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "draft", status: "issued" }),
      data: { status: "ticket_issued" },
    }))
  })

  it("scrubs expired credentials and identity fields", async () => {
    const { scrubExpiredRecoveryRecords } = await import("@/lib/student-recovery")
    const now = new Date("2026-08-10T15:00:00.000Z")
    await scrubExpiredRecoveryRecords(now)
    expect(mockPrisma.studentRecoveryTicket.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tokenHash: null, status: "expired" }) }))
    expect(mockPrisma.studentRecoveryDraft.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ codeHash: null, phone: null, email: null, name: null, status: "expired" }) }))
  })

  it("invalidates and scrubs a recovery draft and its outstanding ticket on cancellation", async () => {
    mockPrisma.studentRecoveryDraft.findUnique.mockResolvedValue({ id: "draft" })
    const { invalidateRecoveryDraft } = await import("@/lib/student-recovery")

    await expect(invalidateRecoveryDraft("ABCDEFGHIJKL")).resolves.toBe(true)
    expect(mockPrisma.studentRecoveryTicket.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ draftId: "draft" }),
      data: expect.objectContaining({ status: "invalidated", tokenHash: null }),
    }))
    expect(mockPrisma.studentRecoveryDraft.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "draft" }),
      data: expect.objectContaining({ status: "invalidated", codeHash: null, phone: null, email: null, name: null }),
    }))
  })

  it("invalidates and scrubs a staff-owned ticket when supervision ends", async () => {
    mockPrisma.studentRecoveryTicket.findFirst.mockResolvedValue({ id: "ticket", draftId: "draft" })
    mockPrisma.studentRecoveryTicket.updateMany.mockResolvedValue({ count: 1 })
    const { invalidateRecoveryTicket } = await import("@/lib/student-recovery")

    await expect(invalidateRecoveryTicket("ABCDEFGHIJKL", "front-desk")).resolves.toBe(true)
    expect(mockPrisma.studentRecoveryTicket.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "ticket" }),
      data: expect.objectContaining({ status: "invalidated", tokenHash: null }),
    }))
    expect(mockPrisma.studentRecoveryDraft.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "draft" }),
      data: expect.objectContaining({ status: "invalidated", codeHash: null, phone: null, email: null, name: null }),
    }))
  })

  it("invalidates a ticket when a different staff account attempts to continue it", async () => {
    const expiresAt = new Date(Date.now() + 60_000)
    mockPrisma.studentRecoveryTicket.findUnique.mockResolvedValue({
      id: "ticket", draftId: "draft", correlationId: "correlation", staffClerkId: "staff-a", status: "issued", expiresAt,
      draft: { phone: "+15551234567", status: "ticket_issued", expiresAt },
    })
    mockPrisma.studentRecoveryTicket.findFirst.mockResolvedValue({ id: "ticket", draftId: "draft" })
    mockPrisma.studentRecoveryTicket.updateMany.mockResolvedValue({ count: 1 })
    const { reserveRecoveryTicket } = await import("@/lib/student-recovery")

    await expect(reserveRecoveryTicket("ABCDEFGHIJKL", "staff-b")).resolves.toBeNull()
    expect(mockPrisma.studentRecoveryTicket.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "ticket" }),
      data: expect.objectContaining({ status: "invalidated", tokenHash: null }),
    }))
  })

  it("reserves a ticket without scrubbing it, then consumes it once after downstream success", async () => {
    const now = new Date(Date.now() + 60_000)
    mockPrisma.studentRecoveryTicket.findUnique.mockResolvedValue({
      id: "ticket", draftId: "draft", correlationId: "correlation", staffClerkId: "staff", status: "issued", expiresAt: now,
      draft: { phone: "+15551234567", status: "ticket_issued", expiresAt: now },
    })
    mockPrisma.studentRecoveryTicket.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 })
    mockPrisma.studentRecoveryTicket.update.mockResolvedValue({})
    mockPrisma.studentRecoveryDraft.updateMany.mockResolvedValue({ count: 1 })
    const { consumeRecoveryTicket, releaseRecoveryTicket, reserveRecoveryTicket } = await import("@/lib/student-recovery")
    const result = await reserveRecoveryTicket("ABCDEFGHIJKL")
    expect(result?.draft.phone).toBe("+15551234567")
    expect(mockPrisma.studentRecoveryTicket.update).not.toHaveBeenCalled()
    await releaseRecoveryTicket("ticket")
    expect(mockPrisma.studentRecoveryTicket.updateMany).toHaveBeenLastCalledWith({ where: { id: "ticket", status: "processing" }, data: { status: "issued" } })
    mockPrisma.studentRecoveryTicket.updateMany.mockResolvedValue({ count: 1 })
    await expect(consumeRecoveryTicket("ticket", "draft", mockPrisma as never)).resolves.toBe(true)
    expect(mockPrisma.studentRecoveryTicket.update).toHaveBeenCalledWith({ where: { id: "ticket" }, data: { tokenHash: null } })
    expect(mockPrisma.studentRecoveryDraft.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ codeHash: null, phone: null, email: null, name: null }) }))
    mockPrisma.studentRecoveryTicket.updateMany.mockResolvedValue({ count: 0 })
    await expect(consumeRecoveryTicket("ticket", "draft", mockPrisma as never)).resolves.toBe(false)
  })

  it("allows only one concurrent caller to reserve an issued ticket", async () => {
    const expiresAt = new Date(Date.now() + 60_000)
    mockPrisma.studentRecoveryTicket.findUnique.mockResolvedValue({
      id: "ticket", draftId: "draft", correlationId: "correlation", staffClerkId: "staff", status: "issued", expiresAt,
      draft: { phone: "+15551234567", status: "ticket_issued", expiresAt },
    })
    let reservationCount = 0
    mockPrisma.studentRecoveryTicket.updateMany.mockImplementation(({ data }) => {
      if (data.status !== "processing") return Promise.resolve({ count: 0 })
      reservationCount += 1
      return Promise.resolve({ count: reservationCount === 1 ? 1 : 0 })
    })
    const { reserveRecoveryTicket } = await import("@/lib/student-recovery")

    const reservations = await Promise.all([
      reserveRecoveryTicket("ABCDEFGHIJKL"),
      reserveRecoveryTicket("ABCDEFGHIJKL"),
    ])

    expect(reservations.filter(Boolean)).toHaveLength(1)
  })
})
