import { describe, expect, it } from "vitest"
import { api, chargeRow, createCharge, free, holder, type Row } from "./setup"
import { TERMINAL_CHARGE_FREE_AMOUNT_MAX_CENTS, TERMINAL_CHARGE_MAX_ITEMS, TERMINAL_CHARGE_TTL_MS } from "@/lib/terminal-charges/contract"

describe("staff panel routes", () => {
  it.each([
    ["a zero amount", [free(0)]], ["a negative amount", [free(-500)]], ["a fractional amount", [free(10.5)]], ["a string amount", [free("500")]],
    ["an amount over the max", [free(TERMINAL_CHARGE_FREE_AMOUNT_MAX_CENTS + 1)]], ["a blank description", [free(500, "  ")]],
    ["a too long description", [free(500, "x".repeat(201))]], ["an unknown kind", [{ kind: "package", packageId: "ten-pack" }]],
    ["no items", []], ["too many items", Array.from({ length: TERMINAL_CHARGE_MAX_ITEMS + 1 }, () => free(100))],
  ])("rejects %s with 400 and creates nothing", async (_label, items) => {
    expect((await api.create(items)).status).toBe(400)
    expect(holder.db.tables.staffTerminalCharge).toHaveLength(0)
  })

  it("accepts a free amount at the max, using its trimmed description as the line label", async () => {
    const response = await api.create([free(TERMINAL_CHARGE_FREE_AMOUNT_MAX_CENTS, " Extra classes ")])
    const { charge } = await response.json()
    expect(charge).toEqual(expect.objectContaining({ status: "pending", totalCents: TERMINAL_CHARGE_FREE_AMOUNT_MAX_CENTS, terminalName: "Samsung", payerName: "Pat Payer" }))
    expect(charge.items).toEqual([expect.objectContaining({ kind: "free_amount", label: "Extra classes", amountCents: TERMINAL_CHARGE_FREE_AMOUNT_MAX_CENTS })])
    expect(Date.parse(charge.expiresAt) - (chargeRow().createdAt as Date).getTime()).toBeGreaterThanOrEqual(TERMINAL_CHARGE_TTL_MS - 1000)
  })

  it("rejects an unknown tablet or payer with 404", async () => {
    expect((await api.create([free(100)], "terminal_x")).status).toBe(404)
    expect((await api.create([free(100)], "terminal_a", "ghost")).status).toBe(404)
  })

  it("prices outstanding items on the server and refuses settled, foreign or duplicate ones", async () => {
    holder.db.tables.purchase.push(
      { id: "paid_1", userId: "payer_1", courseSlug: "salsa", amount: 2000, status: "paid", metadata: { paymentChannel: "cash", settlementStatus: "paid" } },
      { id: "foreign_1", userId: "other_1", courseSlug: "salsa", amount: 2000, status: "pending", metadata: { paymentChannel: "cash" } },
    )
    const response = await api.create([{ kind: "outstanding", outstandingPurchaseId: "debt_1", amountCents: 1 }, { kind: "outstanding", outstandingAttendanceId: "att_1" }])
    expect((await response.json()).charge.items.map((item: Row) => item.amountCents)).toEqual([2000, 2000])
    for (const items of [[{ kind: "outstanding", outstandingPurchaseId: "paid_1" }], [{ kind: "outstanding", outstandingPurchaseId: "foreign_1" }], [{ kind: "outstanding", outstandingPurchaseId: "debt_1" }, { kind: "outstanding", outstandingPurchaseId: "debt_1" }]]) {
      expect((await api.create(items, "terminal_b")).status).toBe(400)
    }
  })

  it("prices a package and a guest class from the catalog, ignoring client amounts", async () => {
    const pkg = { kind: "package", beneficiaryUserId: "other_1", courseSlug: "salsa", packageId: "ten-pack", amountCents: 1 }
    for (const bad of [{ ...pkg, packageId: "nope" }, { ...pkg, beneficiaryUserId: "ghost" }, { kind: "guest_class", courseSlug: "nope" }, { kind: "guest_class", courseSlug: "salsa", guestName: "x".repeat(81) }]) {
      expect((await api.create([bad], "terminal_b")).status).toBe(400)
    }
    await createCharge([pkg, { kind: "guest_class", courseSlug: "salsa", guestName: " Maria ", amountCents: 1 }])
    expect(chargeRow().totalCents).toBe(17000)
    expect(holder.db.tables.staffTerminalChargeItem).toEqual([
      expect.objectContaining({ kind: "package", beneficiaryUserId: "other_1", courseSlug: "salsa", packageId: "ten-pack", amountCents: 15000 }),
      expect.objectContaining({ kind: "guest_class", beneficiaryUserId: "payer_1", courseSlug: "salsa", guestName: "Maria", amountCents: 2000 }),
    ])
  })

  it("refuses a debt already in another tablet's active charge, and frees it once that charge ends (M1)", async () => {
    await createCharge([{ kind: "outstanding", outstandingPurchaseId: "debt_1" }])
    const response = await api.create([{ kind: "outstanding", outstandingPurchaseId: "debt_1" }], "terminal_b")
    expect([response.status, (await response.json()).error]).toEqual([409, "That debt is already in another charge"])
    chargeRow().status = "cancelled"
    expect((await api.create([{ kind: "outstanding", outstandingPurchaseId: "debt_1" }], "terminal_b")).status).toBe(201)
  })

  it("treats an attendance debt and its open linked purchase as the same debt across and within charges", async () => {
    holder.db.tables.purchase.push({ id: "linked_1", userId: "payer_1", courseSlug: "salsa", amount: 1500, status: "pending", metadata: { paymentChannel: "cash", settlementStatus: "pending" } })
    holder.db.tables.attendance[0].metadata = { purchaseId: "linked_1" }
    const twice = await api.create([{ kind: "outstanding", outstandingPurchaseId: "linked_1" }, { kind: "outstanding", outstandingAttendanceId: "att_1" }])
    expect([twice.status, (await twice.json()).error]).toEqual([400, "Outstanding item is listed twice"])
    await createCharge([{ kind: "outstanding", outstandingPurchaseId: "linked_1" }])
    const other = await api.create([{ kind: "outstanding", outstandingAttendanceId: "att_1" }], "terminal_b")
    expect([other.status, (await other.json()).error]).toEqual([409, "That debt is already in another charge"])
  })

  it("charges an attendance debt at its open linked purchase's amount, else the drop-in price (M3)", async () => {
    holder.db.tables.purchase.push({ id: "linked_1", userId: "payer_1", courseSlug: "salsa", amount: 1500, status: "pending", metadata: { paymentChannel: "cash", settlementStatus: "pending" } })
    holder.db.tables.attendance[0].metadata = { purchaseId: "linked_1" }
    await createCharge([{ kind: "outstanding", outstandingAttendanceId: "att_1" }])
    expect(chargeRow().totalCents).toBe(1500)
  })
})
