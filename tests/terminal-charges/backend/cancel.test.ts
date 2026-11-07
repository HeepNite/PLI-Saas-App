import { describe, expect, it, vi } from "vitest"
import { api, bindIntent, carrierRow, chargeRow, createAndPrepare, createCharge, free, holder, intentFor, mocks, staff, terminal } from "./setup"

describe("staff panel routes", () => {
  it.each([
    // Rollout: owner only; admin and staff/front_desk (D4) come back after the live tablet test.
    [staff("owner", null), 201], [staff("admin", null), 403], [staff("staff", "front_desk"), 403],
    [staff("staff", "teacher"), 403], [staff("staff", "manager"), 403], [{ ok: false, status: 401, error: "Unauthorized" }, 401],
  ])("gates create, read and cancel by role (%#)", async (auth, status) => {
    const id = await createCharge()
    mocks.baseAuth.mockResolvedValue(auth)
    expect((await api.create([free(100)], "terminal_b")).status).toBe(status)
    if (status !== 201) expect([(await api.get(id)).status, (await api.cancel(id)).status]).toEqual([status, status])
  })

  it("cancels a pending charge, audits create and cancel, and 404s an unknown charge", async () => {
    const id = await createCharge()
    expect((await (await api.cancel(id)).json()).charge.status).toBe("cancelled")
    expect(chargeRow()).toEqual(expect.objectContaining({ cancelledByUserId: "clerk_desk", failureReason: "cancelled_by_staff" }))
    for (const field of ["terminal_charge_create", "terminal_charge_cancel"]) {
      expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ field, staffClerkId: "clerk_desk", targetUserId: "payer_1", entityId: id }), expect.anything())
    }
    expect([(await api.get("nope")).status, (await api.cancel("nope")).status]).toEqual([404, 404])
  })
})

describe("tablet routes", () => {
  it("require a terminal session", async () => {
    mocks.terminalAuth.mockResolvedValue({ ok: false, reason: "missing" })
    expect([(await api.pending()).status, (await api.prepare("x")).status, (await api.result("x", "declined")).status]).toEqual([401, 401, 401])
  })

  it("show, prepare and report a charge only on its own tablet", async () => {
    const id = await createCharge()
    expect((await (await api.pending()).json()).charge).toEqual(expect.objectContaining({ id, totalCents: 3500 }))
    mocks.terminalAuth.mockResolvedValue(terminal("terminal_b"))
    expect((await (await api.pending()).json()).charge).toBeNull()
    expect([(await api.prepare(id)).status, (await api.result(id, "cancelled")).status]).toEqual([404, 404])
    expect(chargeRow().status).toBe("pending")
  })

  it("only charge on tablets listed in TERMINAL_CHARGE_TERMINALS (rollout gate)", async () => {
    const id = await createCharge()
    vi.stubEnv("TERMINAL_CHARGE_TERMINALS", "ipad")
    const refused = await api.create([free(100)], "terminal_a")
    expect([refused.status, await refused.json()]).toEqual([409, { error: "Charging is not enabled on this tablet" }])
    expect((await api.create([free(100)], "terminal_b")).status).toBe(201)
    expect((await (await api.pending()).json()).charge).toBeNull()
    const answers = [await api.prepare(id), await api.result(id, "cancelled")]
    expect(await Promise.all(answers.map(async (r) => [r.status, (await r.json()).error]))).toEqual([
      [409, "Charging is not enabled on this tablet"], [409, "Charging is not enabled on this tablet"],
    ])
    vi.stubEnv("TERMINAL_CHARGE_TERMINALS", "")
    expect((await api.create([free(100)], "terminal_b")).status).toBe(409)
  })

  it("lets the tablet cancel before collection, decline only while collecting, and never report paid", async () => {
    const id = await createCharge()
    expect((await api.result(id, "declined")).status).toBe(409)
    expect((await api.result(id, "paid")).status).toBe(400)
    expect((await (await api.result(id, "cancelled")).json()).charge.status).toBe("cancelled")
    expect(chargeRow().failureReason).toBe("cancelled_on_tablet")
    const second = await createAndPrepare()
    expect((await (await api.result(second, "declined")).json()).charge).toEqual(expect.objectContaining({ status: "declined", failureReason: "card_declined" }))
  })
})

describe("cancelling a collecting charge (D5)", () => {
  it("cancels when the reader never created a payment and closes the carrier so it can't be collected", async () => {
    const id = await createAndPrepare()
    expect((await api.cancel(id)).status).toBe(200)
    expect(chargeRow()).toEqual(expect.objectContaining({ status: "cancelled", failureReason: "cancelled_by_staff" }))
    expect(carrierRow().status).toBe("failed")
    expect(mocks.retrieve).not.toHaveBeenCalled()
  })

  it("cancels the bound PaymentIntent with the tablet's live key and the prepared-cancel idempotency key", async () => {
    vi.stubEnv("STRIPE_INTERNAL_PURCHASE_LIVE_SECRET_KEY", "sk_live_internal")
    const id = await createAndPrepare()
    bindIntent()
    mocks.retrieve.mockResolvedValue(await intentFor("requires_payment_method"))
    mocks.cancel.mockResolvedValue(await intentFor("canceled"))
    expect((await api.cancel(id)).status).toBe(200)
    expect(mocks.stripeSecret).toHaveBeenCalledWith("sk_live_internal")
    expect(mocks.cancel).toHaveBeenCalledWith("pi_charge_1", {}, { idempotencyKey: "prepared-native-m2-cancel:v1:pi_charge_1" })
    expect([chargeRow().status, carrierRow().status]).toEqual(["cancelled", "canceled"])
  })

  it.each([["already canceled", false], ["canceled by a racing cancel", true]])("treats a PaymentIntent %s as cancelled", async (_label, race) => {
    const id = await createAndPrepare()
    bindIntent()
    mocks.retrieve.mockResolvedValueOnce(await intentFor(race ? "requires_payment_method" : "canceled")).mockResolvedValueOnce(await intentFor("canceled"))
    mocks.cancel.mockRejectedValue(new Error("payment_intent_unexpected_state"))
    expect((await api.cancel(id)).status).toBe(200)
    expect(mocks.cancel).toHaveBeenCalledTimes(race ? 1 : 0)
  })

  it.each([["succeeded", "Payment received, finishing up"], ["processing", "Card is being processed"]])("never cancels a %s PaymentIntent", async (status, error) => {
    const id = await createAndPrepare()
    bindIntent()
    mocks.retrieve.mockResolvedValue(await intentFor(status))
    const response = await api.cancel(id)
    expect([response.status, (await response.json()).error]).toEqual([409, error])
    expect(mocks.cancel).not.toHaveBeenCalled()
    expect(chargeRow().status).toBe("collecting")
  })

  it("refuses when the reader binds a payment between the Stripe check and the cancel (F1)", async () => {
    const id = await createAndPrepare()
    const run = holder.db.$transaction.getMockImplementation() as (callback: unknown) => Promise<unknown>
    holder.db.$transaction.mockImplementation(async (callback: unknown) => (bindIntent(), run(callback)))
    expect((await (await api.cancel(id)).json()).error).toBe("The card reader just started; try again")
    expect([chargeRow().status, carrierRow().status]).toEqual(["collecting", "pending"])
  })

  it("refuses when the reader binds a carrier between the Stripe check and the cancel (M4)", async () => {
    const id = await createCharge()
    Object.assign(chargeRow(), { status: "collecting", carrierPurchaseId: null })
    const run = holder.db.$transaction.getMockImplementation() as (callback: unknown) => Promise<unknown>
    holder.db.$transaction.mockImplementation(async (callback: unknown) => ((chargeRow().carrierPurchaseId = "carrier_late"), run(callback)))
    expect((await (await api.cancel(id)).json()).error).toBe("The card reader just started; try again")
    expect(chargeRow().status).toBe("collecting")
  })

  it("releases the carrier on a tablet decline, and refuses it while the payment succeeded (M2)", async () => {
    const id = await createAndPrepare()
    bindIntent()
    mocks.retrieve.mockResolvedValue(await intentFor("succeeded"))
    expect((await api.result(id, "declined")).status).toBe(409)
    expect(chargeRow().status).toBe("collecting")
    mocks.retrieve.mockResolvedValue(await intentFor("requires_payment_method"))
    mocks.cancel.mockResolvedValue(await intentFor("canceled"))
    expect((await api.result(id, "declined")).status).toBe(200)
    expect(mocks.cancel).toHaveBeenCalledWith("pi_charge_1", {}, { idempotencyKey: "prepared-native-m2-cancel:v1:pi_charge_1" })
    expect([chargeRow().status, chargeRow().failureReason, carrierRow().status]).toEqual(["declined", "card_declined", "canceled"])
  })

  it("routes a tablet cancel while collecting through the same Stripe check", async () => {
    const id = await createAndPrepare()
    bindIntent()
    mocks.retrieve.mockResolvedValue(await intentFor("succeeded"))
    expect((await api.result(id, "cancelled")).status).toBe(409)
    mocks.retrieve.mockResolvedValue(await intentFor("requires_payment_method"))
    mocks.cancel.mockResolvedValue(await intentFor("canceled"))
    expect((await api.result(id, "cancelled")).status).toBe(200)
    expect(chargeRow()).toEqual(expect.objectContaining({ status: "cancelled", failureReason: "cancelled_on_tablet" }))
  })
})
