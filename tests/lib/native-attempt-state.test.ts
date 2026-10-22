import { beforeEach, describe, expect, it, vi } from "vitest"

const findMany = vi.fn()
const findPrepared = vi.fn()
const findPreparedById = vi.fn()

vi.mock("@/lib/prisma", () => ({ prisma: { purchase: { findMany: (...args: unknown[]) => findMany(...args) }, preparedCheckoutContext: { findUnique: (...args: unknown[]) => findPreparedById(...args) } } }))
vi.mock("@/lib/checkout/prepared-context", () => ({
  buildPreparedCheckoutClassSlotKey: ({ courseSlug, date, time, durationMinutes }: Record<string, unknown>) => `${courseSlug}|${date}|${time}|${durationMinutes}`,
  findPreparedCheckoutContextForReconciliation: (...args: unknown[]) => findPrepared(...args),
}))

const selection = { courseSlug: "salsa", courseTitle: "Salsa", amount: 2500, currency: "usd", packageId: "", serviceId: "dropin", addons: ["shoes"], participants: 1, coupon: "PLI10", date: "2026-10-06", time: "20:10", durationMinutes: 60 }
const purchase = (status: string, stripePaymentIntentId: string | null = null, metadata: unknown = { paymentSurface: "native_m2_prepare", preparedContextId: "context_1" }) => ({ status, stripePaymentIntentId, metadata })

describe("native attempt state", () => {
  beforeEach(() => {
    findMany.mockReset(); findPrepared.mockReset(); findPreparedById.mockReset()
    findPrepared.mockResolvedValue({ id: "context_1", expiresAt: new Date("2000-01-01") })
    findPreparedById.mockResolvedValue({ id: "context_1" })
  })

  it.each([["absent", []], ["pending_without_payment", [purchase("pending")]], ["payment_unresolved", [purchase("pending", "pi_1")]], ["paid", [purchase("paid")]], ["rejected", [purchase("refunded")]]])("returns %s for bounded exact evidence", async (state, rows) => {
    findMany.mockResolvedValue(rows)
    const { getNativeAttemptState } = await import("@/lib/checkout/native-attempt-state")
    await expect(getNativeAttemptState({ userId: "resolved_user", terminalId: "terminal_1", kioskSessionId: "kiosk_session_1", selection })).resolves.toEqual({ state })
    const query = findMany.mock.calls[0]?.[0]
    expect(query).toEqual(expect.objectContaining({ where: expect.objectContaining({ userId: "resolved_user", courseSlug: "salsa", amount: 2500, currency: "usd", serviceId: "dropin", packageId: null, addonsCsv: "shoes", participants: 1, coupon: "PLI10" }) }))
    expect((query as { where: Record<string, unknown> }).where).not.toHaveProperty("createdAt")
  })

  it("requires the authenticated terminal, kiosk session, and exact normalized class slot, accepts expired context, and fails closed on ambiguity", async () => {
    findMany.mockResolvedValue([purchase("pending"), purchase("paid")])
    const { getNativeAttemptState } = await import("@/lib/checkout/native-attempt-state")
    await expect(getNativeAttemptState({ userId: "resolved_user", terminalId: "terminal_1", kioskSessionId: "kiosk_session_1", selection })).resolves.toEqual({ state: "payment_unresolved" })
    expect(findPrepared).toHaveBeenCalledWith({ id: "context_1", terminalId: "terminal_1", kioskSessionId: "kiosk_session_1", classSlotKey: "salsa|2026-10-06|20:10|60" })
  })

  it("does not reconcile a matching purchase through a different kiosk session", async () => {
    findMany.mockResolvedValue([purchase("pending")])
    findPrepared.mockResolvedValue(null)
    const { getNativeAttemptState } = await import("@/lib/checkout/native-attempt-state")
    await expect(getNativeAttemptState({ userId: "resolved_user", terminalId: "terminal_1", kioskSessionId: "other_kiosk_session", selection })).resolves.toEqual({ state: "absent" })
    expect(findPrepared).toHaveBeenCalledWith(expect.objectContaining({ kioskSessionId: "other_kiosk_session" }))
    expect(findPreparedById).toHaveBeenCalledWith({ where: { id: "context_1" }, select: { id: true } })
  })

  it.each([
    ["missing prepared-context proof", purchase("pending", null, null)],
    ["malformed prepared-context proof", purchase("pending", null, { paymentSurface: "native_m2_prepare", preparedContextId: 1 })],
    ["missing prepared context", purchase("pending")],
  ])("fails closed when a matching native purchase has %s", async (_case, row) => {
    findMany.mockResolvedValue([row])
    if (_case === "missing prepared context") {
      findPrepared.mockResolvedValue(null)
      findPreparedById.mockResolvedValue(null)
    }
    const { getNativeAttemptState } = await import("@/lib/checkout/native-attempt-state")
    await expect(getNativeAttemptState({ userId: "resolved_user", terminalId: "terminal_1", kioskSessionId: "kiosk_session_1", selection })).resolves.toEqual({ state: "payment_unresolved" })
  })
})
