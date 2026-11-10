// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { TerminalChargeBuilderModal } from "@/components/front/staff/terminal-charge-builder/TerminalChargeBuilderModal"
import { PaymentStudentCard } from "@/components/front/staff/cards/PaymentStudentCard"
import { ProfileStudentCard } from "@/components/front/staff/cards/ProfileStudentCard"
import { CARD_VARIANT_CONFIGS, buildHistoryStudentCard } from "@/components/front/staff/historyCardAggregates"
import type { PaymentRow } from "@/components/front/staff/staffAdminTypes"
import { TERMINAL_CHARGE_POLL_MS, type TerminalChargeView } from "@/lib/terminal-charges/contract"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const charge = (overrides: Partial<TerminalChargeView> = {}): TerminalChargeView => ({
  id: "chg_1", terminalName: "Samsung front desk", payerName: "Ana Perez", status: "pending", totalCents: 23456, currency: "usd", expiresAt: "2026-11-03T18:10:00.000Z",
  items: [{ id: "item_1", kind: "free_amount", label: "Extra classes", amountCents: 23456 }], ...overrides,
})
const row = (overrides: Partial<PaymentRow>) => ({
  id: "pur_1", userId: "user_1", courseSlug: "salsa", courseTitle: "Salsa On1", customerName: "Ana Perez", amount: 2000, currency: "usd", paymentChannel: "cash",
  paymentStatus: "pending", settlementStatus: "pending", classDate: "2026-11-03", classTime: "19:00", attendanceId: null, createdAt: "2026-11-03T15:00:00.000Z",
  pointsBalance: 0, pointsHistory: [], activePackage: null, heritagePin: null, checkInStatus: "none", ...overrides,
}) as PaymentRow
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

let root: Root
let container: HTMLDivElement
let calls: Array<{ url: string; method: string; body: unknown }>
let server: { create: () => Response; status: () => Response; cancel: () => Response }

const flush = () => act(async () => {
  await vi.advanceTimersByTimeAsync(0)
})
const advance = (ms: number) => act(async () => {
  await vi.advanceTimersByTimeAsync(ms)
})
const text = () => container.textContent ?? ""
const button = (label: string) => Array.from(container.querySelectorAll("button")).find((candidate) => candidate.textContent?.trim() === label || candidate.getAttribute("aria-label") === label)
const click = async (label: string) => {
  await act(async () => button(label)?.click())
  await flush()
}
const type = async (label: string, value: string) => {
  const input = Array.from(container.querySelectorAll("label")).find((candidate) => candidate.textContent?.startsWith(label))!.querySelector("input")!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value)
    input.dispatchEvent(new Event("input", { bubbles: true }))
  })
}
const choose = async (label: string, value: string) => {
  const select = Array.from(container.querySelectorAll("label")).find((candidate) => candidate.textContent?.startsWith(label))!.querySelector("select")!
  await act(async () => {
    select.value = value
    select.dispatchEvent(new Event("change", { bubbles: true }))
  })
}
const sentItems = () => calls.filter((call) => call.method === "POST" && call.url === "/api/staff/terminal-charges").map((call) => (call.body as { items: unknown }).items)
const statusPolls = () => calls.filter((call) => call.url === "/api/staff/terminal-charges/chg_1").length

const render = async (element: React.ReactElement) => {
  container = document.body.appendChild(document.createElement("div"))
  root = createRoot(container)
  await act(async () => root.render(element))
  await flush()
}
const renderModal = (props: { openPayments?: PaymentRow[]; onClose?: () => void; onPaid?: () => void } = {}) =>
  render(<TerminalChargeBuilderModal payerUserId="user_1" payerName="Ana Perez" openPayments={[]} onClose={() => undefined} onPaid={() => undefined} {...props} />)
const sendFreeAmount = async () => {
  await type("Amount", "70")
  await type("Description", "Extra classes")
  await click("Send to tablet")
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-11-03T18:00:00.000Z"))
  calls = []
  server = { create: () => json({ charge: charge() }, 201), status: () => json({ charge: charge() }), cancel: () => json({ charge: charge({ status: "cancelled" }) }) }
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, method: init?.method ?? "GET", body: typeof init?.body === "string" ? JSON.parse(init.body) : null })
    if (url === "/api/staff/terminals") return json({ items: [{ id: "term_a", name: "Samsung front desk", active: true }, { id: "term_old", name: "Retired", active: false }] })
    if (url === "/api/catalog/courses") return json({ courses: [{ slug: "salsa", title: "Salsa On1", enrollment: { services: [], packages: [{ id: "ten-pack", label: "10 classes", price: 150 }] } }] })
    if (url === "/api/staff/terminal-charges") return server.create()
    if (url.endsWith("/cancel")) return server.cancel()
    if (url === "/api/staff/terminal-charges/chg_1") return server.status()
    return json({}, 404)
  }))
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("TerminalChargeBuilderModal", () => {
  it("offers only active tablets and sends checked pending rows by purchase or attendance id, without amounts", async () => {
    await renderModal({ openPayments: [row({}), row({ id: "att-att_9", attendanceId: "att_9", courseTitle: "Bachata" })] })
    expect(Array.from(container.querySelector("select")!.options).map((option) => option.value)).toEqual(["term_a"])
    for (const checkbox of Array.from(container.querySelectorAll<HTMLInputElement>("input[type=checkbox]"))) await act(async () => checkbox.click())
    await click("Send to tablet")
    expect(sentItems()).toEqual([[{ kind: "outstanding", outstandingPurchaseId: "pur_1" }, { kind: "outstanding", outstandingAttendanceId: "att_9" }]])
  })

  it.each([
    ["", "", "Pick a pending item or enter an amount."],
    ["0", "Debt", "Enter an amount greater than $0."],
    ["2000.01", "Debt", "Enter an amount up to $2000."],
    ["70", "", "Description is required."],
  ])("validates the free amount %j / %j before sending", async (amount, description, error) => {
    await renderModal()
    await type("Amount", amount)
    await type("Description", description)
    await click("Send to tablet")
    expect(text()).toContain(error)
    expect(sentItems()).toHaveLength(0)
  })

  it("sends a free amount in cents with its description and shows the server's total and countdown", async () => {
    await renderModal()
    await sendFreeAmount()
    expect(sentItems()).toEqual([[{ kind: "free_amount", amountCents: 7000, description: "Extra classes" }]])
    expect(text()).toContain("Waiting on Samsung front desk")
    expect(text()).toContain("10:00 left")
    expect(text()).toContain("Total: $234.56")
  })

  it("adds a package for the student and a guest class with the friend's name, without amounts", async () => {
    await renderModal()
    await click("Add package")
    expect(text()).toContain("Pick a course and a package.")
    await choose("Course", "salsa")
    await choose("Package", "ten-pack")
    await click("Add package")
    await type("Friend's name", " Maria ")
    await click("Add guest class")
    expect(text()).toContain("10 classes — Salsa On1")
    expect(text()).toContain("Guest class — Salsa On1 · Maria")
    await click("Send to tablet")
    expect(sentItems()).toEqual([[
      { kind: "package", beneficiaryUserId: "user_1", courseSlug: "salsa", packageId: "ten-pack" },
      { kind: "guest_class", courseSlug: "salsa", guestName: "Maria" },
    ]])
  })

  it("shows the server error when the charge cannot be created", async () => {
    server.create = () => json({ error: "This tablet already has a charge in progress" }, 409)
    await renderModal()
    await sendFreeAmount()
    expect(text()).toContain("This tablet already has a charge in progress")
    expect(button("Send to tablet")).toBeDefined()
  })

  it("polls until a final status and refreshes the board once when paid", async () => {
    const onPaid = vi.fn()
    await renderModal({ onPaid })
    await sendFreeAmount()
    server.status = () => json({ charge: charge({ status: "collecting" }) })
    await advance(TERMINAL_CHARGE_POLL_MS)
    expect(text()).toContain("Customer is paying")
    server.status = () => json({ charge: charge({ status: "paid" }) })
    await advance(TERMINAL_CHARGE_POLL_MS)
    const polls = statusPolls()
    await advance(TERMINAL_CHARGE_POLL_MS * 3)
    expect([text().includes("Paid"), statusPolls(), onPaid.mock.calls.length]).toEqual([true, polls, 1])
  })

  it("cancels a charge, and shows the server's reason when the cancel is refused", async () => {
    await renderModal()
    await sendFreeAmount()
    server.cancel = () => json({ error: "Card is being processed" }, 409)
    await click("Cancel charge")
    expect(text()).toContain("Card is being processed")
    server.cancel = () => json({ charge: charge({ status: "cancelled" }) })
    await click("Cancel charge")
    expect(text()).toContain("Cancelled")
    expect(button("Cancel charge")).toBeUndefined()
  })

  it("warns after 3 failed polls, backs off, and stops on 404", async () => {
    await renderModal()
    await sendFreeAmount()
    server.status = () => json({ error: "boom" }, 500)
    await advance(3_000)
    await advance(6_000)
    expect([statusPolls(), text().includes("Can't reach the server")]).toEqual([2, false])
    await advance(12_000)
    expect([statusPolls(), text().includes("Can't reach the server")]).toEqual([3, true])
    server.status = () => json({ error: "gone" }, 404)
    await advance(15_000)
    expect(text()).toContain("This charge can't be loaded (404)")
    await advance(60_000)
    expect(statusPolls()).toBe(4)
  })

  it("counts a status request that hangs past 8 s as a failed poll", async () => {
    await renderModal()
    await sendFreeAmount()
    const routed = globalThis.fetch
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => String(input) === "/api/staff/terminal-charges/chg_1"
      ? new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))))
      : routed(input, init)))
    for (const ms of [3_000, 8_000, 6_000, 8_000, 12_000]) await advance(ms) // poll delay, then the 8 s timeout
    expect(text()).not.toContain("Can't reach the server")
    await advance(8_000)
    expect(text()).toContain("Can't reach the server")
  })

  it("asks before closing while the charge is running and refreshes the board once on close", async () => {
    const onClose = vi.fn()
    const onPaid = vi.fn()
    await renderModal({ onClose, onPaid })
    await sendFreeAmount()
    await click("Close charge dialog")
    expect(text()).toContain("The charge is still running on Samsung front desk. Close anyway?")
    await click("Keep open")
    expect(onClose).not.toHaveBeenCalled()
    await click("Close charge dialog")
    await click("Close anyway")
    expect([onClose.mock.calls.length, onPaid.mock.calls.length]).toEqual([1, 1])
  })
})

describe("PaymentStudentCard charge on tablet action", () => {
  const renderCard = (currentRole: string, currentCategory: string | null) => {
    const props = {
      student: buildHistoryStudentCard([row({})]), cardVariant: CARD_VARIANT_CONFIGS.daily, selectedPaymentIds: [], usersWithAuditEntries: new Set<string>(),
      currentRole, currentCategory, formatMoney: (cents: number) => `$${cents / 100}`, paymentsLoading: false, onRefreshPaymentsBoard: () => undefined,
    }
    return render(<PaymentStudentCard {...(props as unknown as React.ComponentProps<typeof PaymentStudentCard>)} />)
  }

  // Owner, admin and staff/front_desk charge; managers do not yet.
  it.each([["owner", null, true], ["admin", null, true], ["staff", "front_desk", true], ["staff", "teacher", false], ["staff", "manager", false], ["staff", null, false]])(
    "%s/%s sees the action: %s",
    async (role, category, visible) => {
      await renderCard(role, category)
      expect(Boolean(button("Charge on tablet"))).toBe(visible)
    },
  )

  it("opens the builder with the student as payer", async () => {
    await renderCard("owner", null)
    await click("Charge on tablet")
    expect(text()).toContain("Charge on tablet")
    expect(button("Send to tablet")).toBeDefined()
  })
})

// Search results show students without recent payments as profile cards; staff must be able to charge them too.
describe("ProfileStudentCard charge on tablet action", () => {
  it("opens the builder for a student without recent payments", async () => {
    const student = {
      source: "profile", key: "profile-user_1", userId: "user_1", displayName: "Elvira Gutierrez", email: "elvira@example.com", phone: null,
      avatarUrl: null, registeredAt: "2026-05-09T12:00:00.000Z", checkInStatus: "none", latestClassAttended: null, latestCheckInAt: null,
      lastPayment: null, lastCourse: null, paymentStatus: null, activePackage: null, remainingCredits: null, outstandingBalance: null,
      pinStatus: "none", heritagePin: null, cashSettlement: null, pendingSettlement: null, pointsBalance: 0,
    }
    const props = { student, selectedPaymentIds: [], usersWithAuditEntries: new Set<string>(), currentRole: "owner", currentCategory: null, paymentsLoading: false, onRefreshPaymentsBoard: () => undefined }
    await render(<ProfileStudentCard {...(props as unknown as React.ComponentProps<typeof ProfileStudentCard>)} />)
    await click("Charge on tablet")
    expect(button("Send to tablet")).toBeDefined()
  })
})
