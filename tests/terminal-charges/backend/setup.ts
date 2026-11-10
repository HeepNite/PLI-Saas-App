// Shared setup for the staff terminal charge backend tests: module mocks, fixtures and route helpers.
import { afterEach, beforeEach, expect, vi } from "vitest"
import { createFakeDb, seedBasics, type FakeDb } from "./fakeDb"
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

export type Row = Record<string, unknown>
export const meta = (row: Row) => (row.metadata || {}) as Row
export const terminal = (id: string) => ({ ok: true, sessionId: `session_${id}`, terminal: { id, slug: id, name: id, location: null, defaultCourseSlug: null, active: true } })
export const staff = (role: string, category: string | null) => ({ ok: true, userId: "clerk_desk", role, category, subCategory: null, staffName: "Desk" })
export const free = (amountCents: unknown, description: unknown = "Balance") => ({ kind: "free_amount", amountCents, description })
const params = (id: string) => ({ params: Promise.resolve({ id }) })
const req = (body?: unknown) => new Request("http://localhost/x", { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) })

export const api = {
  create: async (items: unknown[], terminalId = "terminal_a", payerUserId = "payer_1") =>
    (await import("@/app/api/staff/terminal-charges/route")).POST(req({ terminalId, payerUserId, items })),
  get: async (id: string) => (await import("@/app/api/staff/terminal-charges/[id]/route")).GET(new Request("http://localhost/x"), params(id)),
  cancel: async (id: string) => (await import("@/app/api/staff/terminal-charges/[id]/cancel/route")).POST(req(), params(id)),
  pending: async () => (await import("@/app/api/staff/terminal/charges/pending/route")).GET(new Request("http://localhost/x")),
  prepare: async (id: string) => (await import("@/app/api/staff/terminal/charges/[id]/prepare/route")).POST(req(), params(id)),
  result: async (id: string, outcome: unknown) => (await import("@/app/api/staff/terminal/charges/[id]/result/route")).POST(req({ outcome }), params(id)),
}
export const createCharge = async (items: unknown[] = [free(3500)]) => {
  const response = await api.create(items)
  expect(response.status).toBe(201)
  return (await response.json()).charge.id as string
}
export const createAndPrepare = async (items?: unknown[]) => {
  const id = await createCharge(items)
  expect((await api.prepare(id)).status).toBe(200)
  return id
}
export const chargeRow = () => holder.db.tables.staffTerminalCharge[0]
export const carrierRow = () => holder.db.tables.purchase.find((row) => meta(row).lineKind === "carrier")!
export const debtRow = () => holder.db.tables.purchase.find((row) => row.id === "debt_1")!
export const children = () => holder.db.tables.purchase.filter((row) => meta(row).lineKind && meta(row).lineKind !== "carrier")

/** A PaymentIntent exactly as the tablet's prepared attempt creates it for `purchase`. */
export const intentFor = async (status: string, purchase: Row = carrierRow()) => {
  const proof = await import("@/lib/stripe/prepared-native-payment")
  const prepared = { id: purchase.id as string, userId: purchase.userId as string, amount: purchase.amount as number, currency: purchase.currency as string, idempotencyKey: purchase.idempotencyKey as string, fulfillmentMetadata: proof.preparedNativeFulfillmentMetadata(purchase.metadata) }
  const ticket = proof.issuePreparedNativePaymentAttempt({ terminalId: "terminal_a", sessionId: "session_a" }, { readerId: "tmr_fixture", purchase: prepared })
  return {
    id: "pi_charge_1", object: "payment_intent", livemode: true, status, amount: prepared.amount, amount_received: status === "succeeded" ? prepared.amount : 0, currency: "usd",
    customer: null, receipt_email: null, payment_method_types: ["card_present"], metadata: proof.preparedNativePaymentMetadata(ticket, prepared), canceled_at: null, last_payment_error: null,
  }
}
export const deliver = async (type: string, status: string, eventId = "evt_1", purchase?: Row) => {
  const event = { id: eventId, type, livemode: true, created: Math.floor(Date.now() / 1000), data: { object: await intentFor(status, purchase) } }
  if (!holder.db.tables.stripeWebhookEvent.some((row) => row.eventId === eventId)) holder.db.tables.stripeWebhookEvent.push({ id: `swe_${eventId}`, eventId, status: "processing" })
  mocks.constructEvent.mockReturnValue(event)
  return (await import("@/app/api/stripe/webhook/route")).POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: "signed" }))
}
export const paid = (eventId?: string, purchase?: Row) => deliver("payment_intent.succeeded", "succeeded", eventId, purchase)
export const bindIntent = () => { carrierRow().stripePaymentIntentId = "pi_charge_1" }

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv("INTERNAL_PURCHASE_ATTEMPT_SECRET", "fixture-signing-secret-at-least-32-bytes")
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test")
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test")
  vi.stubEnv("TERMINAL_CHARGE_TERMINALS", " samsung , ipad ")
  holder.db = createFakeDb()
  seedBasics(holder.db)
  holder.db.tables.purchase.push({
    id: "debt_1", userId: "payer_1", courseSlug: "salsa", courseTitle: "Salsa", amount: 2000, currency: "usd", status: "pending",
    metadata: { paymentChannel: "cash", settlementStatus: "pending" }, stripePaymentIntentId: null, packageId: null, createdAt: new Date("2026-11-02T23:00:00Z"), updatedAt: new Date("2026-11-02T23:00:00Z"),
  })
  holder.db.tables.attendance.push({ id: "att_1", userId: "payer_1", metadata: {}, packageUsage: null, session: { courseSlug: "salsa", title: "Salsa", startsAt: new Date("2026-11-02T23:00:00Z") } })
  for (const mock of Object.values(mocks)) mock.mockReset()
  mocks.baseAuth.mockResolvedValue(staff("owner", null))
  mocks.terminalAuth.mockResolvedValue(terminal("terminal_a"))
  mocks.issue.mockResolvedValue("prepared_reference")
  mocks.claim.mockResolvedValue("claimed")
  mocks.syncPackage.mockImplementation(async ({ purchaseId }: { purchaseId: string }) => ({ id: `pp_${purchaseId}` }))
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

// vi.hoisted values cannot be exported where they are declared.
export { holder, mocks }
