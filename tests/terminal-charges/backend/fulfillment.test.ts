import { describe, expect, it, vi } from "vitest"
import { carrierRow, chargeRow, children, createAndPrepare, debtRow, deliver, free, holder, meta, mocks, paid, type Row } from "./setup"
import { TERMINAL_CHARGE_FREE_AMOUNT_COURSE_SLUG } from "@/lib/terminal-charges/contract"

describe("Stripe webhook for a carrier", () => {
  it("fans a paid carrier out per item: debts settled in place, attendance debt and free amount recorded", async () => {
    const id = await createAndPrepare([{ kind: "outstanding", outstandingPurchaseId: "debt_1" }, { kind: "outstanding", outstandingAttendanceId: "att_1" }, free(6500, "Extra classes")])
    expect(carrierRow().amount).toBe(10500)
    expect((await paid()).status).toBe(200)
    expect(chargeRow()).toEqual(expect.objectContaining({ status: "paid", resolvedAt: expect.any(Date) }))
    expect(carrierRow()).toEqual(expect.objectContaining({ status: "paid", stripePaymentIntentId: "pi_charge_1" }))
    expect(meta(debtRow())).toEqual(expect.objectContaining({ settlementStatus: "paid", paymentChannel: "card", settledPaymentIntentId: "pi_charge_1", staffChargeId: id }))
    const [attendanceChild, freeChild] = children()
    expect(attendanceChild).toEqual(expect.objectContaining({ userId: "payer_1", amount: 2000, status: "paid", courseSlug: "salsa" }))
    expect(meta(holder.db.tables.attendance[0]).purchaseId).toBe(attendanceChild.id)
    expect(freeChild).toEqual(expect.objectContaining({ amount: 6500, status: "paid", courseSlug: TERMINAL_CHARGE_FREE_AMOUNT_COURSE_SLUG }))
    expect(meta(freeChild)).toEqual(expect.objectContaining({ description: "Extra classes", carrierPurchaseId: carrierRow().id }))
    expect(holder.db.tables.staffTerminalChargeItem.map((item) => item.resultPurchaseId)).toEqual(["debt_1", attendanceChild.id, freeChild.id])
    expect(mocks.syncAttendance).not.toHaveBeenCalled()
  })

  it("fans a package out to its beneficiary with the package sync, and a guest class under the payer with no attendance (D2)", async () => {
    holder.db.tables.packagePlan.push({ id: "plan_10", key: "ten-pack", label: "10 classes", totalCredits: 10, isUnlimited: false, cadence: null, makeUps: 1, validDays: 90 })
    await createAndPrepare([{ kind: "package", beneficiaryUserId: "other_1", courseSlug: "salsa", packageId: "ten-pack" }, { kind: "guest_class", courseSlug: "salsa", guestName: "Maria" }])
    expect((await paid()).status).toBe(200)
    expect((await paid()).status).toBe(200)
    const [pkgChild, guestChild] = children()
    expect(children()).toHaveLength(2)
    // The board shows a purchase's own contact fields, so the package carries its owner's, not the payer's.
    expect(pkgChild).toEqual(expect.objectContaining({ userId: "other_1", packageId: "ten-pack", courseSlug: "salsa", amount: 15000, status: "paid", name: "Other", email: null, phone: null }))
    expect(meta(pkgChild)).toEqual(expect.objectContaining({ lineKind: "package", packageId: "ten-pack", packageTotalCredits: "10", packageValidDays: "90", carrierPurchaseId: carrierRow().id }))
    expect(mocks.syncPackage).toHaveBeenCalledTimes(1)
    expect(mocks.syncPackage).toHaveBeenCalledWith(expect.objectContaining({ tx: holder.db, packagePlanId: "plan_10", userId: "other_1", purchaseId: pkgChild.id }))
    // Same record the drop-in flow produces, so reports and the board's drop-in filter count it.
    expect(guestChild).toEqual(expect.objectContaining({ userId: "payer_1", courseSlug: "salsa", amount: 2000, status: "paid", serviceId: "dropin", email: "pat@example.com" }))
    expect(meta(guestChild)).toEqual(expect.objectContaining({ lineKind: "guest_class", guestItem: "true", guestName: "Maria" }))
    expect(holder.db.tables.attendance.filter((row) => meta(row).purchaseId)).toHaveLength(0)
    expect(holder.db.tables.user).toHaveLength(2)
  })

  it("is idempotent when the same paid event is delivered again", async () => {
    await createAndPrepare([free(500)])
    await paid()
    await paid()
    expect(children()).toHaveLength(1)
  })

  it("records the money of a debt already settled elsewhere without touching it again", async () => {
    await createAndPrepare([{ kind: "outstanding", outstandingPurchaseId: "debt_1" }])
    Object.assign(debtRow(), { status: "paid", metadata: { paymentChannel: "cash", settlementStatus: "paid" } })
    await paid()
    expect(meta(debtRow())).toEqual({ paymentChannel: "cash", settlementStatus: "paid" })
    expect(meta(children()[0])).toEqual(expect.objectContaining({ outstandingPurchaseId: "debt_1", outstandingAlreadySettled: "true" }))
  })

  it("records a zero-amount debt at the charged drop-in price so revenue equals what was collected", async () => {
    debtRow().amount = 0
    await createAndPrepare([{ kind: "outstanding", outstandingPurchaseId: "debt_1" }])
    await paid()
    expect(debtRow()).toEqual(expect.objectContaining({ status: "paid", amount: 2000 }))
    expect(carrierRow().amount).toBe(2000)
  })

  it.each([
    ["retries once and settles when an unrelated write touched the debt (F3)", { updatedAt: new Date(Date.now() + 60_000) }, "card"],
    ["records the money when a concurrent write settled the debt (F3)", { status: "paid", updatedAt: new Date(Date.now() + 60_000), metadata: { paymentChannel: "cash", settlementStatus: "paid" } }, "cash"],
  ])("%s", async (_label, concurrentWrite, channel) => {
    await createAndPrepare([{ kind: "outstanding", outstandingPurchaseId: "debt_1" }])
    const findUnique = (holder.db.purchase as { findUnique: ReturnType<typeof vi.fn> }).findUnique
    const read = findUnique.getMockImplementation() as (args: unknown) => Promise<unknown>
    findUnique.mockImplementation(async (args: { where: { id?: string } }) => {
      const result = await read(args)
      if (args.where.id === "debt_1") {
        Object.assign(debtRow(), concurrentWrite) // lands right after the settlement read it
        findUnique.mockImplementation(read)
      }
      return result
    })
    expect((await paid()).status).toBe(200)
    expect(meta(debtRow()).paymentChannel).toBe(channel)
    expect(children()).toHaveLength(channel === "card" ? 0 : 1)
  })

  it("fails closed instead of recording money for an item it cannot fulfill", async () => {
    await createAndPrepare([free(500)])
    holder.db.tables.staffTerminalChargeItem[0].kind = "dropin_credits"
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    expect((await paid()).status).toBe(500)
    expect(children()).toHaveLength(0)
  })

  it("replays the debt settlement side effects when a delivery failed after commit", async () => {
    Object.assign(debtRow(), { packageId: "ten-pack", metadata: { ...meta(debtRow()), packageId: "ten-pack" } })
    await createAndPrepare([{ kind: "outstanding", outstandingPurchaseId: "debt_1" }])
    const run = holder.db.$transaction.getMockImplementation() as (callback: unknown) => Promise<unknown>
    let inTransaction = false
    holder.db.$transaction.mockImplementation(async (callback: unknown) => {
      inTransaction = true
      try { return await run(callback) } finally { inTransaction = false }
    })
    const findUnique = (holder.db.purchase as { findUnique: ReturnType<typeof vi.fn> }).findUnique
    const read = findUnique.getMockImplementation() as (args: unknown) => Promise<unknown>
    findUnique.mockImplementation(async (args: { where: { id?: string } }) => {
      if (!inTransaction && args.where.id === "debt_1") {
        findUnique.mockImplementation(read)
        throw new Error("connection reset")
      }
      return read(args)
    })
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    expect((await paid()).status).toBe(500)
    expect(debtRow().status).toBe("paid")
    expect((await paid()).status).toBe(200)
    expect(mocks.syncPackage).toHaveBeenCalledWith(expect.objectContaining({ purchaseId: "debt_1", source: "cash" }))
    expect(children()).toHaveLength(0)
  })

  it("still fulfills an ordinary prepared native purchase without touching staff charges", async () => {
    const purchase: Row = {
      id: "kiosk_1", userId: "payer_1", courseSlug: "salsa", courseTitle: "Salsa", amount: 2000, currency: "usd", status: "pending", idempotencyKey: "native-m2-prepared:ctx:abc",
      metadata: { courseSlug: "salsa", courseTitle: "Salsa", serviceId: "dropin", date: "2026-11-03", time: "19:00", paymentSurface: "native_m2_prepare" }, stripePaymentIntentId: null, packageId: null,
    }
    holder.db.tables.purchase.push(purchase)
    expect((await paid("evt_kiosk", purchase)).status).toBe(200)
    expect(purchase.status).toBe("paid")
    expect(mocks.syncAttendance).toHaveBeenCalledWith(expect.objectContaining({ purchaseId: "kiosk_1" }))
    expect((holder.db.staffTerminalCharge as { findUnique: ReturnType<typeof vi.fn> }).findUnique).not.toHaveBeenCalled()
  })
})
