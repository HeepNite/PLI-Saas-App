// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import StudentDataOverrideModal from "@/components/front/staff/StudentDataOverrideModal"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type Props = React.ComponentProps<typeof StudentDataOverrideModal>

const createProps = (overrides: Partial<Props> = {}): Props => ({
  open: true,
  onClose: vi.fn(),
  studentId: "student-1",
  studentName: "Jane Doe",
  currentRole: "staff",
  onSuccess: vi.fn(),
  ...overrides,
})

/** Routes fetch calls by URL substring so each test only needs to describe what matters. */
function routedFetchMock(routes: Record<string, () => { ok: boolean; status: number; json: () => Promise<unknown> }>) {
  return vi.fn((url: string, _init?: RequestInit) => {
    const match = Object.keys(routes).find((key) => url.includes(key))
    if (!match) {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true, data: {} }) })
    }
    return Promise.resolve(routes[match]())
  })
}

type FetchCall = [string, RequestInit | undefined]
const bodyOf = (call: FetchCall | undefined): Record<string, unknown> => {
  if (!call?.[1]?.body) throw new Error("Expected a fetch call with a JSON body")
  return JSON.parse(call[1].body as string)
}

/**
 * React tracks the native input/select value setter to detect changes, so
 * directly assigning `.value` and dispatching a plain event is a no-op for
 * controlled elements. Go through the native setter (same trick RTL's
 * `fireEvent` uses internally) so React's onChange actually fires.
 */
function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const prototype = Object.getPrototypeOf(element)
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value")
  descriptor?.set?.call(element, value)
  element.dispatchEvent(new Event(element.tagName === "SELECT" ? "change" : "input", { bubbles: true }))
}

describe("StudentDataOverrideModal — Add package (cash grant)", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  async function render(props: Props) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root!.render(<StudentDataOverrideModal {...props} />))
    return container
  }

  function clickTab(node: HTMLDivElement, label: string) {
    const tab = Array.from(node.querySelectorAll("button")).find((b) => b.textContent?.trim() === label)
    return act(async () => tab?.click())
  }

  function findButton(node: HTMLDivElement, text: string) {
    return Array.from(node.querySelectorAll("button")).find((b) => b.textContent?.includes(text))
  }

  it("fetches plans from the picker endpoint and renders them for a front-desk (staff-role) user", async () => {
    const fetchMock = routedFetchMock({
      "/packages/picker": () => ({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            ok: true,
            data: {
              items: [
                { id: "plan-1", key: "unlimited-monthly", label: "Unlimited Monthly", priceCents: 12000, totalCredits: null, validDays: 30, isUnlimited: true, courseSlug: "salsa", courseSlugs: ["salsa"] },
              ],
            },
          }),
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const node = await render(createProps())
    await clickTab(node, "Package")

    expect(node.textContent).toContain("Add package (cash, pending)")
    expect(node.textContent).toContain("Unlimited Monthly")
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/api/staff/school/packages/picker"))).toBe(true)
  })

  it("submits the grant with the plan, reason, and a generated idempotency key", async () => {
    const fetchMock = routedFetchMock({
      "/packages/picker": () => ({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            ok: true,
            data: { items: [{ id: "plan-1", key: "unlimited-monthly", label: "Unlimited Monthly", priceCents: 12000, totalCredits: null, validDays: 30, isUnlimited: true, courseSlug: "salsa", courseSlugs: ["salsa"] }] },
          }),
      }),
      "/student-1/packages": () => ({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ ok: true, data: { purchaseId: "purchase-1", settlementStatus: "pending" } }),
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const onSuccess = vi.fn()
    const node = await render(createProps({ onSuccess }))
    await clickTab(node, "Package")

    const select = node.querySelector("select") as HTMLSelectElement
    await act(async () => {
      setNativeValue(select, "plan-1")
    })

    const reasonField = Array.from(node.querySelectorAll("textarea")).find((t) =>
      t.getAttribute("placeholder")?.includes("cash package grant")
    ) as HTMLTextAreaElement
    await act(async () => {
      setNativeValue(reasonField, "Front desk cash sale")
    })

    const grantButton = findButton(node, "Grant cash package")
    await act(async () => grantButton?.click())

    const postCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("/student-1/packages") && call[1]?.method === "POST") as FetchCall | undefined
    expect(postCall).toBeTruthy()
    const body = bodyOf(postCall)
    expect(body.packagePlanId).toBe("plan-1")
    expect(body.reason).toBe("Front desk cash sale")
    expect(typeof body.idempotencyKey).toBe("string")

    expect(node.textContent).toContain("pending settlement")
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it("on a duplicate-active-package response, shows a confirm action that re-submits with confirmDuplicate and the same idempotency key", async () => {
    let postCallCount = 0
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes("/packages/picker")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              ok: true,
              data: { items: [{ id: "plan-1", key: "unlimited-monthly", label: "Unlimited Monthly", priceCents: 12000, totalCredits: null, validDays: 30, isUnlimited: true, courseSlug: "salsa", courseSlugs: ["salsa"] }] },
            }),
        })
      }
      if (url.includes("/student-1/packages") && init?.method === "POST") {
        postCallCount += 1
        if (postCallCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 409,
            json: () =>
              Promise.resolve({
                error: "Student already has an active package for this plan.",
                code: "DUPLICATE_ACTIVE_PACKAGE",
                existing: { id: "pkg-existing", label: "Unlimited Monthly", expiresAt: "2026-08-01T00:00:00.000Z" },
              }),
          })
        }
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve({ ok: true, data: { purchaseId: "purchase-2", settlementStatus: "pending" } }),
        })
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true, data: {} }) })
    })
    vi.stubGlobal("fetch", fetchMock)

    const node = await render(createProps())
    await clickTab(node, "Package")

    const select = node.querySelector("select") as HTMLSelectElement
    await act(async () => {
      setNativeValue(select, "plan-1")
    })
    const reasonField = Array.from(node.querySelectorAll("textarea")).find((t) =>
      t.getAttribute("placeholder")?.includes("cash package grant")
    ) as HTMLTextAreaElement
    await act(async () => {
      setNativeValue(reasonField, "Renewal at front desk")
    })

    await act(async () => findButton(node, "Grant cash package")?.click())

    expect(node.textContent).toContain("already has an active package")

    const firstPostCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("/student-1/packages") && call[1]?.method === "POST") as FetchCall | undefined
    const firstKey = bodyOf(firstPostCall).idempotencyKey

    const confirmButton = findButton(node, "Grant anyway")
    await act(async () => confirmButton?.click())

    const postCalls = fetchMock.mock.calls.filter((call) => String(call[0]).includes("/student-1/packages") && call[1]?.method === "POST") as FetchCall[]
    expect(postCalls).toHaveLength(2)
    const secondBody = bodyOf(postCalls[1])
    expect(secondBody.confirmDuplicate).toBe(true)
    expect(secondBody.idempotencyKey).toBe(firstKey)
    expect(node.textContent).toContain("pending settlement")
  })

  it("clears the grant form's plan, reason, and expiry when the modal switches to a different student while open", async () => {
    const fetchMock = routedFetchMock({
      "/packages/picker": () => ({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            ok: true,
            data: { items: [{ id: "plan-1", key: "unlimited-monthly", label: "Unlimited Monthly", priceCents: 12000, totalCredits: null, validDays: 30, isUnlimited: true, courseSlug: "salsa", courseSlugs: ["salsa"] }] },
          }),
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const props = createProps({ studentId: "student-1" })
    const node = await render(props)
    await clickTab(node, "Package")

    const select = node.querySelector("select") as HTMLSelectElement
    await act(async () => {
      setNativeValue(select, "plan-1")
    })
    const reasonField = Array.from(node.querySelectorAll("textarea")).find((t) =>
      t.getAttribute("placeholder")?.includes("cash package grant")
    ) as HTMLTextAreaElement
    await act(async () => {
      setNativeValue(reasonField, "Front desk cash sale")
    })

    expect((node.querySelector("select") as HTMLSelectElement).value).toBe("plan-1")

    // Simulate staff navigating from student-1 to student-2 without closing
    // the modal in between (same `open`, new `studentId`).
    await act(async () => {
      root!.render(<StudentDataOverrideModal {...props} studentId="student-2" />)
    })
    await clickTab(node, "Package")

    const selectAfter = node.querySelector("select") as HTMLSelectElement
    const reasonAfter = Array.from(node.querySelectorAll("textarea")).find((t) =>
      t.getAttribute("placeholder")?.includes("cash package grant")
    ) as HTMLTextAreaElement

    expect(selectAfter.value).toBe("")
    expect(reasonAfter.value).toBe("")
  })

  it("shows a clear error message for role rejection (403)", async () => {
    const fetchMock = routedFetchMock({
      "/packages/picker": () => ({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            ok: true,
            data: { items: [{ id: "plan-1", key: "unlimited-monthly", label: "Unlimited Monthly", priceCents: 12000, totalCredits: null, validDays: 30, isUnlimited: true, courseSlug: "salsa", courseSlugs: ["salsa"] }] },
          }),
      }),
      "/student-1/packages": () => ({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: "Forbidden" }),
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const node = await render(createProps())
    await clickTab(node, "Package")

    const select = node.querySelector("select") as HTMLSelectElement
    await act(async () => {
      setNativeValue(select, "plan-1")
    })
    const reasonField = Array.from(node.querySelectorAll("textarea")).find((t) =>
      t.getAttribute("placeholder")?.includes("cash package grant")
    ) as HTMLTextAreaElement
    await act(async () => {
      setNativeValue(reasonField, "Reason")
    })

    await act(async () => findButton(node, "Grant cash package")?.click())

    expect(node.textContent).toContain("You don't have permission to grant packages.")
  })
})
