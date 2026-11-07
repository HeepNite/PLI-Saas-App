import { beforeEach, describe, expect, it, vi } from "vitest"
import { matchesWhere } from "./fakeDb"
import { buildOutstandingBalanceByUser, buildVerifyBalanceByUser, isOpenPurchase, isVerifyCardAttempt } from "@/app/api/staff/payments/shared"
import { TERMINAL_CHARGE_CARRIER_COURSE_SLUG as CARRIER_SLUG } from "@/lib/terminal-charges/contract"

// A charge carrier only transports the card payment: it is never revenue, debt, Verify or a board row.

type Row = Record<string, unknown>
const store = vi.hoisted(() => ({ purchases: [] as Row[] }))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    attendance: { findMany: vi.fn(async () => []) },
    purchase: { findMany: vi.fn(async ({ where, take }: { where: Row; take?: number }) => store.purchases.filter((row) => matchesWhere(row, where)).slice(0, take)) },
    user: { findMany: vi.fn(async () => [{ id: "payer_1", name: "Pat Payer", email: "pat@example.com", phone: "" }]), findUnique: vi.fn(async () => ({ id: "payer_1" })) },
    pointsLedger: { groupBy: vi.fn(async () => []) },
    packagePurchase: { findMany: vi.fn(async () => []) },
  },
}))
vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeStaffPortalSectionRequest: vi.fn(async () => ({ ok: true, userId: "clerk_owner", role: "owner" })),
  authorizeOwnerOrAdminRequest: vi.fn(async () => ({ ok: true, userId: "clerk_owner", role: "owner", category: null })),
}))
vi.mock("@/lib/security/rate-limit", () => ({ buildRateLimitKey: vi.fn(() => "key"), consumeRateLimit: vi.fn(() => ({ ok: true })), getClientIp: vi.fn(() => "127.0.0.1") }))
vi.mock("@/lib/audit/student-data-audit", () => ({ writeStudentDataAudit: vi.fn() }))
vi.mock("@/app/api/staff/payments/payments-request", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/api/staff/payments/payments-request")>()),
  HISTORY_MODE_TAKE_LIMIT: 2,
}))

const purchase = (id: string, overrides: Row = {}): Row => ({
  id, userId: "payer_1", amount: 2000, status: "paid", courseSlug: "salsa", createdAt: new Date("2026-11-03T18:00:00Z"),
  stripePaymentIntentId: null, stripeCheckoutSessionId: null, metadata: { date: "2026-11-03", time: "19:00" }, ...overrides,
})
const carrier = (status = "paid") => purchase("carrier_1", { amount: 8500, status, courseSlug: CARRIER_SLUG, metadata: { staffChargeId: "charge_1", lineKind: "carrier", paymentSurface: "native_m2_prepare" } })
const window = { todayNY: "2026-11-03", startOfTodayNY: new Date("2026-11-03T04:00:00Z"), endOfTodayNY: new Date("2026-11-04T03:59:59Z") } as never
const loadBoard = async (mode: "today" | "history") =>
  (await import("@/app/api/staff/payments/payments-loader-purchase")).loadStaffPaymentsPurchases({ mode, query: "", historyRange: { from: "2026-11-01", to: "2026-11-30" } } as never, window)

beforeEach(() => {
  vi.resetModules()
  store.purchases = []
})

describe("terminal charge carriers", () => {
  it("are left out of the monthly report while their children are counted", async () => {
    store.purchases = [carrier(), purchase("child_1", { amount: 8500, metadata: { staffChargeId: "charge_1", lineKind: "free_amount" } }), purchase("plain_1")]
    const response = await (await import("@/app/api/staff/reports/monthly/route")).GET(new Request("http://localhost/x?year=2026&month=11"))
    const [, row] = (await response.text()).trim().split("\n")
    expect(Number(row.split(",")[5])).toBe(10500)
  })

  it("are never debt or Verify, while ordinary pending cash and native attempts still are", () => {
    for (const status of ["pending", "failed", "canceled"]) {
      const row = carrier(status) as never
      expect([isOpenPurchase(row).isOpen, isVerifyCardAttempt(row), buildOutstandingBalanceByUser([row]).size, buildVerifyBalanceByUser([row]).size]).toEqual([false, false, 0, 0])
    }
    expect(isOpenPurchase(purchase("cash_1", { status: "pending", metadata: { paymentChannel: "cash" } }) as never).isOpen).toBe(true)
    expect(isVerifyCardAttempt(purchase("native_1", { status: "pending", metadata: { paymentSurface: "native_m2_prepare" } }) as never)).toBe(true)
  })

  it("are dropped from the board without hiding a history truncation (F6)", async () => {
    store.purchases = [purchase("p1"), carrier(), purchase("p2")]
    const history = await loadBoard("history")
    expect([history.historyTruncated, history.purchases.map((row) => row.id)]).toEqual([true, ["p1", "p2"]])
    store.purchases = [purchase("p1"), carrier()]
    expect((await loadBoard("today")).purchases.map((row) => row.id)).toEqual(["p1"])
  })

  it("are left out of a student's payment listing", async () => {
    store.purchases = [carrier(), purchase("plain_1")]
    const { GET } = await import("@/app/api/staff/students/[userId]/payments/route")
    const response = await GET(new Request("http://localhost/x"), { params: Promise.resolve({ userId: "payer_1" }) })
    expect(JSON.stringify(await response.json())).not.toContain("carrier_1")
  })
})
