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
vi.mock("@/lib/security/rate-limit", () => ({ buildRateLimitKey: vi.fn(() => "key"), consumeRateLimit: vi.fn(() => ({ ok: true })), getClientIp: vi.fn(() => "127.0.0.1") }))
vi.mock("@/lib/audit/student-data-audit", () => ({ writeStudentDataAudit: (...args: unknown[]) => mocks.audit(...args) }))
vi.mock("@/lib/catalog-courses", () => ({
  getCatalogCourseBySlug: vi.fn(async (slug: string) => slug === "salsa"
    ? { slug, title: "Salsa On1", enrollment: { services: [{ id: "dropin", label: "Drop-in", price: 20 }], packages: [{ id: "ten-pack", label: "10 classes", price: 150 }], addons: [] } }
    : null),
}))

export type Row = Record<string, unknown>
export const meta = (row: Row) => (row.metadata || {}) as Row
export const terminal = (id: string) => ({ ok: true, sessionId: `session_${id}`, terminal: { id, slug: id, name: id, location: null, defaultCourseSlug: null, active: true } })
export const staff = (role: string, category: string | null) => ({ ok: true, userId: "clerk_desk", role, category, subCategory: null, staffName: "Desk" })
export const free = (amountCents: unknown, description: unknown = "Balance") => ({ kind: "free_amount", amountCents, description })
export const params = (id: string) => ({ params: Promise.resolve({ id }) })
export const req = (body?: unknown) => new Request("http://localhost/x", { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) })

export const api = {
  create: async (items: unknown[], terminalId = "terminal_a", payerUserId = "payer_1") =>
    (await import("@/app/api/staff/terminal-charges/route")).POST(req({ terminalId, payerUserId, items })),
  get: async (id: string) => (await import("@/app/api/staff/terminal-charges/[id]/route")).GET(new Request("http://localhost/x"), params(id)),
}
export const createCharge = async (items: unknown[] = [free(3500)]) => {
  const response = await api.create(items)
  expect(response.status).toBe(201)
  return (await response.json()).charge.id as string
}
export const chargeRow = () => holder.db.tables.staffTerminalCharge[0]

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
