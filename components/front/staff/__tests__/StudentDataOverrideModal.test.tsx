// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import StudentDataOverrideModal from "@/components/front/staff/StudentDataOverrideModal"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

const plan = { id: "plan-1", key: "unlimited", label: "Unlimited", priceCents: 12000, cadence: "monthly", totalCredits: null, isUnlimited: true }

describe("StudentDataOverrideModal cash package picker", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  async function renderModal(role: "owner" | "admin" | "staff", category: "front_desk" | "teacher" | "guest" = "front_desk", subCategory: "teacher" | null = null) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root!.render(<StudentDataOverrideModal open onClose={vi.fn()} studentId="student-1" studentName="Student One" currentRole={role} currentCategory={category} currentSubCategory={subCategory} />))
    return container
  }

  it("creates a pending cash package with one retry-stable idempotency key", async () => {
    let attempts = 0
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "POST") return Promise.resolve(new Response(JSON.stringify(++attempts === 1 ? { error: "DUPLICATE_ACTIVE_PACKAGE" } : { ok: true, data: { purchaseId: "purchase-1" } }), { status: attempts === 1 ? 409 : 201 }))
      if (url.includes("intent=grant")) return Promise.resolve(new Response(JSON.stringify({ ok: true, data: { plans: [plan] } })))
      return Promise.resolve(new Response(JSON.stringify({ courses: [], data: { sessions: [], packages: [] } })))
    })
    vi.stubGlobal("fetch", fetchMock)
    const node = await renderModal("staff")

    await act(async () => Array.from(node.querySelectorAll("button")).find((button) => button.textContent === "Package")!.dispatchEvent(new MouseEvent("click", { bubbles: true })))
    await act(async () => {})
    const planSelect = node.querySelector("select[name='cash-package-plan']") as HTMLSelectElement
    await act(async () => { planSelect.value = "plan-1"; planSelect.dispatchEvent(new Event("change", { bubbles: true })) })
    const reason = node.querySelector("textarea")!
    await act(async () => { const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set; setter?.call(reason, "Cash grant"); reason.dispatchEvent(new Event("input", { bubbles: true })) })
    await act(async () => Array.from(node.querySelectorAll("button")).find((button) => button.textContent === "Add cash package")!.dispatchEvent(new MouseEvent("click", { bubbles: true })))
    await act(async () => Array.from(node.querySelectorAll("button")).find((button) => button.textContent === "Confirm cash package")!.dispatchEvent(new MouseEvent("click", { bubbles: true })))
    await act(async () => {})
    expect(node.textContent).toContain("already has this active package")

    await act(async () => Array.from(node.querySelectorAll("button")).find((button) => button.textContent === "Add cash package")!.dispatchEvent(new MouseEvent("click", { bubbles: true })))
    await act(async () => Array.from(node.querySelectorAll("button")).find((button) => button.textContent === "Confirm cash package")!.dispatchEvent(new MouseEvent("click", { bubbles: true })))
    await act(async () => {})

    const grants = fetchMock.mock.calls.filter(([url, init]) => String(url).includes("/packages") && init?.method === "POST")
    expect(JSON.parse(String(grants[0][1]?.body))).toMatchObject({ packagePlanId: "plan-1", reason: "Cash grant" })
    expect(JSON.parse(String(grants[1][1]?.body)).idempotencyKey).toBe(JSON.parse(String(grants[0][1]?.body)).idempotencyKey)
    expect(node.textContent).toContain("pending cash payment")
  })

  it("hides the cash package picker for a legacy teacher category", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ courses: [] }))))
    const node = await renderModal("staff", "teacher")
    await act(async () => Array.from(node.querySelectorAll("button")).find((button) => button.textContent === "Package")!.dispatchEvent(new MouseEvent("click", { bubbles: true })))
    expect(node.querySelector("select[name='cash-package-plan']")).toBeNull()
  })

  it("hides the cash package picker for a normalized teacher category", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ courses: [] }))))
    const node = await renderModal("staff", "guest", "teacher")
    await act(async () => Array.from(node.querySelectorAll("button")).find((button) => button.textContent === "Package")!.dispatchEvent(new MouseEvent("click", { bubbles: true })))
    expect(node.querySelector("select[name='cash-package-plan']")).toBeNull()
  })
})
