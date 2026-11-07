import { describe, expect, it, vi } from "vitest"
import { api, carrierRow, chargeRow, createCharge, free, holder, intentFor, meta, mocks } from "./setup"
import { TERMINAL_CHARGE_CARRIER_COURSE_SLUG, TERMINAL_CHARGE_TTL_MS } from "@/lib/terminal-charges/contract"

describe("staff panel routes", () => {
  it("never shows the payer's email as the name on the tablet (P2)", async () => {
    holder.db.tables.user[0].name = null
    await createCharge()
    expect((await (await api.pending()).json()).charge.payerName).toBe("Customer")
  })

  it("allows one active charge per tablet", async () => {
    await createCharge()
    expect((await api.create([free(500)])).status).toBe(409)
    expect((await api.create([free(500)], "terminal_b")).status).toBe(201)
  })

  it("expires a pending charge lazily after the TTL and frees the tablet", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    const id = await createCharge()
    vi.setSystemTime(Date.now() + TERMINAL_CHARGE_TTL_MS + 1)
    expect((await (await api.get(id)).json()).charge).toEqual(expect.objectContaining({ status: "expired", resolvedAt: expect.any(String) }))
    expect((await api.create([free(500)])).status).toBe(201)
  })
})

describe("tablet routes", () => {
  it("prepare creates one carrier the native prepared-attempt pipeline accepts, bound to this session", async () => {
    const id = await createCharge()
    expect(await (await api.prepare(id)).json()).toEqual({ preparedPurchaseReference: "prepared_reference", state: "prepared" })
    expect(holder.db.tables.purchase.filter((row) => meta(row).lineKind === "carrier")).toHaveLength(1)
    expect(carrierRow()).toEqual(expect.objectContaining({ userId: "payer_1", status: "pending", amount: 3500, courseSlug: TERMINAL_CHARGE_CARRIER_COURSE_SLUG }))
    expect(chargeRow()).toEqual(expect.objectContaining({ status: "collecting", carrierPurchaseId: carrierRow().id }))
    expect(mocks.issue).toHaveBeenCalledWith({ purchaseId: carrierRow().id, terminalId: "terminal_a", sessionId: "session_terminal_a" })
    await expect(intentFor("requires_payment_method")).resolves.toBeTruthy()
  })

  it("hands the charge back to pending when no reference can be issued, and never prepares a cancelled one", async () => {
    mocks.issue.mockRejectedValue(new Error("unavailable"))
    const id = await createCharge()
    expect((await api.prepare(id)).status).toBe(409)
    expect(chargeRow().status).toBe("pending")
    chargeRow().status = "cancelled"
    expect((await api.prepare(id)).status).toBe(409)
  })
})
