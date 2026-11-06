import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createFakeDb, seedBasics, type FakeDb } from "./fakeDb"
import { TERMINAL_CHARGE_CARRIER_COURSE_SLUG, TERMINAL_CHARGE_FREE_AMOUNT_COURSE_SLUG, TERMINAL_CHARGE_FREE_AMOUNT_MAX_CENTS, TERMINAL_CHARGE_MAX_ITEMS, TERMINAL_CHARGE_TTL_MS } from "@/lib/terminal-charges/contract"

const holder = vi.hoisted(() => ({ db: null as unknown as FakeDb }))
const mocks = vi.hoisted(() => ({
  baseAuth: vi.fn(), terminalAuth: vi.fn(), issue: vi.fn(), constructEvent: vi.fn(), retrieve: vi.fn(), cancel: vi.fn(),
  claim: vi.fn(), audit: vi.fn(), stripeSecret: vi.fn(), syncPackage: vi.fn(), syncAttendance: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ get prisma() { return holder.db } }))
vi.mock("@/lib/security/staff-portal-auth", () => ({ authorizeStaffPortalBaseRequest: (...args: unknown[]) => mocks.baseAuth(...args) }))
vi.mock("@/lib/security/staff-terminal", () => ({ authorizeStaffTerminalSession: (...args: unknown[]) => mocks.terminalAuth(...args) }))
vi.mock("@/lib/stripe/prepared-native-purchase", () => ({ issuePreparedNativePurchase: (...args: unknown[]) => mocks.issue(...args), PreparedNativePurchaseError: class extends Error {} }))
vi.mock("@/lib/security/rate-limit", () => ({ buildRateLimitKey: vi.fn(() => "key"), consumeRateLimit: vi.fn(() => ({ ok: true })), getClientIp: vi.fn(() => "127.0.0.1") }))
vi.mock("@/lib/audit/student-data-audit", () => ({ writeStudentDataAudit: (...args: unknown[]) => mocks.audit(...args) }))
vi.mock("next/headers", () => ({ headers: vi.fn(async () => ({ get: (name: string) => (name === "stripe-signature" ? "sig" : null) })) }))
vi.mock("@clerk/nextjs/server", () => ({ clerkClient: vi.fn() }))
vi.mock("@/lib/users", () => ({ upsertUserByIdentifiers: vi.fn() }))
vi.mock("@/lib/packages", () => ({
  syncPackagePurchaseFromPaidPurchase: (...args: unknown[]) => mocks.syncPackage(...args),
  revokeUnusedInternalPackagePurchaseTx: vi.fn(), reservePackageCreditForAttendance: vi.fn(), reservePackageCreditForAttendanceTx: vi.fn(),
}))
vi.mock("@/lib/catalog-courses", () => ({
  getCatalogCourseBySlug: vi.fn(async (slug: string) => slug === "salsa"
    ? { slug, title: "Salsa On1", enrollment: { services: [{ id: "dropin", label: "Drop-in", price: 20 }], packages: [{ id: "ten-pack", label: "10 classes", price: 150 }], addons: [] } }
    : null),
}))
vi.mock("@/lib/bookings", () => ({ syncScheduledAttendanceFromPurchase: (...args: unknown[]) => mocks.syncAttendance(...args) }))
vi.mock("@/lib/points/service", () => ({ awardPointsFromRule: vi.fn() }))
vi.mock("@/lib/stripe/webhook-event-store", () => ({
  claimStripeWebhookEvent: (...args: unknown[]) => mocks.claim(...args),
  completeStripeWebhookEvent: vi.fn(), markStripeWebhookEventFailed: vi.fn(), markStripeWebhookEventManualResolutionTx: vi.fn(), touchStripeWebhookEventHeartbeat: vi.fn(),
}))
vi.mock("stripe", () => ({
  default: class Stripe {
    constructor(secret: string) { mocks.stripeSecret(secret) }
    webhooks = { constructEvent: (...args: unknown[]) => mocks.constructEvent(...args) }
    paymentIntents = { retrieve: (...args: unknown[]) => mocks.retrieve(...args), cancel: (...args: unknown[]) => mocks.cancel(...args) }
  },
}))

type Row = Record<string, unknown>
const meta = (row: Row) => (row.metadata || {}) as Row
const terminal = (id: string) => ({ ok: true, sessionId: `session_${id}`, terminal: { id, slug: id, name: id, location: null, defaultCourseSlug: null, active: true } })
const staff = (role: string, category: string | null) => ({ ok: true, userId: "clerk_desk", role, category, subCategory: null, staffName: "Desk" })
const free = (amountCents: unknown, description: unknown = "Balance") => ({ kind: "free_amount", amountCents, description })
const params = (id: string) => ({ params: Promise.resolve({ id }) })
const req = (body?: unknown) => new Request("http://localhost/x", { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) })

const api = {
  create: async (items: unknown[], terminalId = "terminal_a", payerUserId = "payer_1") =>
    (await import("@/app/api/staff/terminal-charges/route")).POST(req({ terminalId, payerUserId, items })),
  get: async (id: string) => (await import("@/app/api/staff/terminal-charges/[id]/route")).GET(new Request("http://localhost/x"), params(id)),
  cancel: async (id: string) => (await import("@/app/api/staff/terminal-charges/[id]/cancel/route")).POST(req(), params(id)),
  pending: async () => (await import("@/app/api/staff/terminal/charges/pending/route")).GET(new Request("http://localhost/x")),
  prepare: async (id: string) => (await import("@/app/api/staff/terminal/charges/[id]/prepare/route")).POST(req(), params(id)),
  result: async (id: string, outcome: unknown) => (await import("@/app/api/staff/terminal/charges/[id]/result/route")).POST(req({ outcome }), params(id)),
}
const createCharge = async (items: unknown[] = [free(3500)]) => {
  const response = await api.create(items)
  expect(response.status).toBe(201)
  return (await response.json()).charge.id as string
}
const createAndPrepare = async (items?: unknown[]) => {
  const id = await createCharge(items)
  expect((await api.prepare(id)).status).toBe(200)
  return id
}
const chargeRow = () => holder.db.tables.staffTerminalCharge[0]
const carrierRow = () => holder.db.tables.purchase.find((row) => meta(row).lineKind === "carrier")!
const debtRow = () => holder.db.tables.purchase.find((row) => row.id === "debt_1")!
const children = () => holder.db.tables.purchase.filter((row) => meta(row).lineKind && meta(row).lineKind !== "carrier")

/** A PaymentIntent exactly as the tablet's prepared attempt creates it for `purchase`. */
const intentFor = async (status: string, purchase: Row = carrierRow()) => {
  const proof = await import("@/lib/stripe/prepared-native-payment")
  const prepared = { id: purchase.id as string, userId: purchase.userId as string, amount: purchase.amount as number, currency: purchase.currency as string, idempotencyKey: purchase.idempotencyKey as string, fulfillmentMetadata: proof.preparedNativeFulfillmentMetadata(purchase.metadata) }
  const ticket = proof.issuePreparedNativePaymentAttempt({ terminalId: "terminal_a", sessionId: "session_a" }, { readerId: "tmr_fixture", purchase: prepared })
  return {
    id: "pi_charge_1", object: "payment_intent", livemode: true, status, amount: prepared.amount, amount_received: status === "succeeded" ? prepared.amount : 0, currency: "usd",
    customer: null, receipt_email: null, payment_method_types: ["card_present"], metadata: proof.preparedNativePaymentMetadata(ticket, prepared), canceled_at: null, last_payment_error: null,
  }
}
const deliver = async (type: string, status: string, eventId = "evt_1", purchase?: Row) => {
  const event = { id: eventId, type, livemode: true, created: Math.floor(Date.now() / 1000), data: { object: await intentFor(status, purchase) } }
  if (!holder.db.tables.stripeWebhookEvent.some((row) => row.eventId === eventId)) holder.db.tables.stripeWebhookEvent.push({ id: `swe_${eventId}`, eventId, status: "processing" })
  mocks.constructEvent.mockReturnValue(event)
  return (await import("@/app/api/stripe/webhook/route")).POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: "signed" }))
}
const paid = (eventId?: string, purchase?: Row) => deliver("payment_intent.succeeded", "succeeded", eventId, purchase)
const bindIntent = () => { carrierRow().stripePaymentIntentId = "pi_charge_1" }

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv("INTERNAL_PURCHASE_ATTEMPT_SECRET", "fixture-signing-secret-at-least-32-bytes")
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test")
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test")
  holder.db = createFakeDb()
  seedBasics(holder.db)
  holder.db.tables.purchase.push({
    id: "debt_1", userId: "payer_1", courseSlug: "salsa", courseTitle: "Salsa", amount: 2000, currency: "usd", status: "pending",
    metadata: { paymentChannel: "cash", settlementStatus: "pending" }, stripePaymentIntentId: null, packageId: null, createdAt: new Date("2026-11-02T23:00:00Z"), updatedAt: new Date("2026-11-02T23:00:00Z"),
  })
  holder.db.tables.attendance.push({ id: "att_1", userId: "payer_1", metadata: {}, packageUsage: null, session: { courseSlug: "salsa", title: "Salsa", startsAt: new Date("2026-11-02T23:00:00Z") } })
  for (const mock of Object.values(mocks)) mock.mockReset()
  mocks.baseAuth.mockResolvedValue(staff("staff", "front_desk"))
  mocks.terminalAuth.mockResolvedValue(terminal("terminal_a"))
  mocks.issue.mockResolvedValue("prepared_reference")
  mocks.claim.mockResolvedValue("claimed")
  mocks.syncPackage.mockImplementation(async ({ purchaseId }: { purchaseId: string }) => ({ id: `pp_${purchaseId}` }))
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe("staff panel routes", () => {
  it.each([
    [staff("owner", null), 201], [staff("admin", null), 201], [staff("staff", "front_desk"), 201],
    [staff("staff", "teacher"), 403], [staff("staff", "manager"), 403], [{ ok: false, status: 401, error: "Unauthorized" }, 401],
  ])("gates create, read and cancel by role (%#)", async (auth, status) => {
    const id = await createCharge()
    mocks.baseAuth.mockResolvedValue(auth)
    expect((await api.create([free(100)], "terminal_b")).status).toBe(status)
    if (status !== 201) expect([(await api.get(id)).status, (await api.cancel(id)).status]).toEqual([status, status])
  })

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
    expect(Date.parse(charge.expiresAt) - Date.parse(charge.createdAt)).toBeGreaterThanOrEqual(TERMINAL_CHARGE_TTL_MS - 1000)
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

  it("charges an attendance debt at its open linked purchase's amount, else the drop-in price (M3)", async () => {
    holder.db.tables.purchase.push({ id: "linked_1", userId: "payer_1", courseSlug: "salsa", amount: 1500, status: "pending", metadata: { paymentChannel: "cash", settlementStatus: "pending" } })
    holder.db.tables.attendance[0].metadata = { purchaseId: "linked_1" }
    await createCharge([{ kind: "outstanding", outstandingAttendanceId: "att_1" }])
    expect(chargeRow().totalCents).toBe(1500)
  })

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

  it.each([
    ["payment_intent.canceled ends a collecting charge", "payment_intent.canceled", "canceled", "collecting", "cancelled"],
    ["payment_failed leaves it collecting: the PaymentIntent stays retryable (F2)", "payment_intent.payment_failed", "requires_payment_method", "collecting", "collecting"],
    ["a late cancel never overrides a paid charge", "payment_intent.canceled", "canceled", "paid", "paid"],
  ])("%s", async (_label, type, intentStatus, before, after) => {
    await createAndPrepare()
    chargeRow().status = before
    expect((await deliver(type, intentStatus)).status).toBe(200)
    expect((await deliver(type, intentStatus)).status).toBe(200)
    expect(chargeRow().status).toBe(after)
  })
})
