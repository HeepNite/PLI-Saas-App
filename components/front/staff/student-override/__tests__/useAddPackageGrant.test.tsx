// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useAddPackageGrant } from "@/components/front/staff/student-override/useAddPackageGrant"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type HookResult = ReturnType<typeof useAddPackageGrant>

describe("useAddPackageGrant", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null
  let captured: HookResult | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    captured = null
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  async function renderHook(studentId = "student-1", onGranted = vi.fn()) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)

    function Harness() {
      captured = useAddPackageGrant({ studentId, onGranted })
      return null
    }

    await act(async () => {
      root!.render(<Harness />)
    })
    return { onGranted }
  }

  it("submits the expected payload with a generated idempotency key", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ ok: true, data: { purchaseId: "purchase-1", settlementStatus: "pending" } }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const { onGranted } = await renderHook()

    await act(async () => {
      captured!.setSelectedPlanId("plan-1")
      captured!.setReason("Front desk cash sale")
    })
    await act(async () => {
      captured!.submit()
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("/api/staff/students/student-1/packages")
    expect(init.method).toBe("POST")
    const body = JSON.parse(init.body)
    expect(body.packagePlanId).toBe("plan-1")
    expect(body.reason).toBe("Front desk cash sale")
    expect(body.confirmDuplicate).toBe(false)
    expect(typeof body.idempotencyKey).toBe("string")
    expect(body.idempotencyKey.length).toBeGreaterThan(0)

    expect(captured!.state).toBe("success")
    expect(captured!.grantedPurchaseId).toBe("purchase-1")
    expect(onGranted).toHaveBeenCalledTimes(1)
  })

  it("requires a plan and a reason before submitting", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await renderHook()

    await act(async () => {
      captured!.submit()
    })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(captured!.errorMessage).toBe("Select a package plan.")

    await act(async () => {
      captured!.setSelectedPlanId("plan-1")
    })
    await act(async () => {
      captured!.submit()
    })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(captured!.errorMessage).toBe("Reason is required.")
  })

  it("on a DUPLICATE_ACTIVE_PACKAGE response, surfaces the existing package and re-submits with the SAME idempotency key when confirmed", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: () =>
          Promise.resolve({
            error: "Student already has an active package for this plan.",
            code: "DUPLICATE_ACTIVE_PACKAGE",
            existing: { id: "pkg-existing", label: "Unlimited Monthly", expiresAt: "2026-08-01T00:00:00.000Z" },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ ok: true, data: { purchaseId: "purchase-2", settlementStatus: "pending" } }),
      })
    vi.stubGlobal("fetch", fetchMock)

    await renderHook()

    await act(async () => {
      captured!.setSelectedPlanId("plan-1")
      captured!.setReason("Renewal at front desk")
    })
    await act(async () => {
      captured!.submit()
    })

    expect(captured!.state).toBe("duplicate")
    expect(captured!.duplicate).toEqual({
      id: "pkg-existing",
      label: "Unlimited Monthly",
      expiresAt: "2026-08-01T00:00:00.000Z",
    })

    const firstKey = JSON.parse(fetchMock.mock.calls[0][1].body).idempotencyKey

    await act(async () => {
      captured!.confirmDuplicateAndResubmit()
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(secondBody.confirmDuplicate).toBe(true)
    expect(secondBody.idempotencyKey).toBe(firstKey)
    expect(captured!.state).toBe("success")
    expect(captured!.grantedPurchaseId).toBe("purchase-2")
  })

  it("generates a fresh idempotency key when the plan changes after a completed attempt", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ ok: true, data: { purchaseId: "purchase-1", settlementStatus: "pending" } }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await renderHook()

    await act(async () => {
      captured!.setSelectedPlanId("plan-1")
      captured!.setReason("First grant")
    })
    await act(async () => {
      captured!.submit()
    })
    const firstKey = JSON.parse(fetchMock.mock.calls[0][1].body).idempotencyKey

    // Starting a new attempt (changing the plan) must not reuse the previous key.
    await act(async () => {
      captured!.setSelectedPlanId("plan-2")
      captured!.setReason("Second grant")
    })
    await act(async () => {
      captured!.submit()
    })
    const secondKey = JSON.parse(fetchMock.mock.calls[1][1].body).idempotencyKey

    expect(secondKey).not.toBe(firstKey)
  })

  it("maps 403 and 400 errors to clear messages", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: "Forbidden" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: "expiresAt must be in the future." }),
      })
    vi.stubGlobal("fetch", fetchMock)

    await renderHook()

    await act(async () => {
      captured!.setSelectedPlanId("plan-1")
      captured!.setReason("Reason one")
    })
    await act(async () => {
      captured!.submit()
    })
    expect(captured!.state).toBe("error")
    expect(captured!.errorMessage).toBe("You don't have permission to grant packages.")

    await act(async () => {
      captured!.setSelectedPlanId("plan-2")
      captured!.setReason("Reason two")
    })
    await act(async () => {
      captured!.submit()
    })
    expect(captured!.state).toBe("error")
    expect(captured!.errorMessage).toBe("expiresAt must be in the future.")
  })

  it("converts a date-only expiresAt to end-of-local-day so a today/near-future date never becomes a past UTC instant", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ ok: true, data: { purchaseId: "purchase-1", settlementStatus: "pending" } }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await renderHook()

    const today = new Date()
    const todayDateOnly = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`

    await act(async () => {
      captured!.setSelectedPlanId("plan-1")
      captured!.setReason("Renewal today")
      captured!.setExpiresAt(todayDateOnly)
    })
    await act(async () => {
      captured!.submit()
    })

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    // Sent as end-of-LOCAL-day, not UTC midnight, so it must be strictly
    // in the future relative to "now" even for negative-UTC-offset zones
    // (e.g. America/New_York).
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now())
    // Local-time parse of "T23:59:59" (no explicit UTC "Z"/offset in the
    // literal we build) must resolve to the same calendar day, hour 23.
    expect(new Date(`${todayDateOnly}T23:59:59`).toISOString()).toBe(body.expiresAt)
  })

  it("guards against re-entrancy: a second submit call while already submitting does not fire a second request", async () => {
    let resolveFetch: ((value: unknown) => void) | null = null
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve
        })
    )
    vi.stubGlobal("fetch", fetchMock)

    await renderHook()

    await act(async () => {
      captured!.setSelectedPlanId("plan-1")
      captured!.setReason("Front desk cash sale")
    })

    await act(async () => {
      captured!.submit()
      captured!.submit()
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(captured!.state).toBe("submitting")

    await act(async () => {
      resolveFetch?.({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ ok: true, data: { purchaseId: "purchase-1", settlementStatus: "pending" } }),
      })
    })
  })

  it("stale-response guard: an in-flight response for an abandoned attempt does not clobber fresher state", async () => {
    let resolveFirst: ((value: unknown) => void) | null = null
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve
          })
      )
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ ok: true, data: { purchaseId: "purchase-2", settlementStatus: "pending" } }),
      })
    vi.stubGlobal("fetch", fetchMock)

    await renderHook()

    await act(async () => {
      captured!.setSelectedPlanId("plan-1")
      captured!.setReason("First attempt")
    })
    await act(async () => {
      captured!.submit()
    })
    expect(captured!.state).toBe("submitting")

    // Field change while in flight regenerates the idempotency key,
    // abandoning the first attempt, then a fresh submit fires.
    await act(async () => {
      captured!.setReason("Second attempt, different reason")
    })
    await act(async () => {
      captured!.submit()
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(captured!.state).toBe("success")
    expect(captured!.grantedPurchaseId).toBe("purchase-2")

    // The abandoned first request now resolves — it must NOT clobber the
    // already-successful fresher state.
    await act(async () => {
      resolveFirst?.({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: "expiresAt must be in the future." }),
      })
    })

    expect(captured!.state).toBe("success")
    expect(captured!.grantedPurchaseId).toBe("purchase-2")
    expect(captured!.errorMessage).toBeNull()
  })

  it("reset clears all fields and the idempotency key", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ ok: true, data: { purchaseId: "purchase-1", settlementStatus: "pending" } }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await renderHook()

    await act(async () => {
      captured!.setSelectedPlanId("plan-1")
      captured!.setExpiresAt("2026-09-01")
      captured!.setReason("Grant")
    })
    await act(async () => {
      captured!.submit()
    })
    expect(captured!.state).toBe("success")

    await act(async () => {
      captured!.reset()
    })

    expect(captured!.selectedPlanId).toBe("")
    expect(captured!.expiresAt).toBe("")
    expect(captured!.reason).toBe("")
    expect(captured!.state).toBe("idle")
    expect(captured!.grantedPurchaseId).toBeNull()
  })
})
