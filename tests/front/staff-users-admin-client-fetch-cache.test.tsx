// @vitest-environment jsdom

// Source-level regression test for StaffUsersAdminClient fetch cache behavior.
//
// Rationale: the component is ~12k lines with heavy dependencies, making a full
// jsdom render impractical. Instead, this test asserts the source code invariant:
// every payroll fetch must include `cache: "no-store"` in its options block.
// This guards against a regression where a developer removes the cache hint.
//
// Scope: Fix #1 (no-store GETs), requirement "StaffUsersAdminClient GETs use no-store".

import { readFileSync } from "node:fs"
import { join } from "node:path"
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useStaffDirectoryAdmin } from "@/components/front/staff/useStaffDirectoryAdmin"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type HookState = ReturnType<typeof useStaffDirectoryAdmin>
type HookHarnessState = HookState & { error: string | null }

const SOURCE_PATHS = [
  "components/front/staff/StaffUsersAdminClient.tsx",
  "components/front/staff/useStaffDirectoryAdmin.ts",
  "components/front/staff/useStaffRequestsAdmin.ts",
]

const source = SOURCE_PATHS
  .map((path) => readFileSync(join(process.cwd(), path), "utf8"))
  .join("\n")

function HookHarness({ onState }: { onState: (state: HookHarnessState) => void }) {
  const [error, setError] = React.useState<string | null>(null)
  const scheduleEventsByDay = React.useMemo(() => ({}), [])
  const ensureMinimumLoadingTime = React.useCallback(async () => undefined, [])
  const handleStaffAuthFailure = React.useCallback(() => false, [])
  const isInsideCriticalClassWindow = React.useCallback(() => false, [])
  const state = useStaffDirectoryAdmin({
    canAccessUsersNav: true,
    canManageClerkSync: false,
    shouldFetchClerkSyncHealth: false,
    scheduleEventsByDay,
    ensureMinimumLoadingTime,
    handleStaffAuthFailure,
    isInsideCriticalClassWindow,
    setError,
    enableAutoRefresh: false,
  })
  onState({ ...state, error })
  return <div>{state.rows.length}</div>
}

const jsonResponse = (body: unknown, ok = true, status = ok ? 200 : 500, headers = new Headers()) =>
  Promise.resolve({
    ok,
    status,
    headers,
    json: () => Promise.resolve(body),
  } as Response)

/**
 * Finds the fetch invocation for a given URL literal and returns the text of
 * its options block (the second argument to fetch). Returns null if not found.
 */
function extractFetchOptions(sourceCode: string, url: string): string | null {
  // Match: fetch("<url>", { ... })
  // The options block may span multiple lines; we capture up to the matching `}`.
  const pattern = new RegExp(
    `fetch\\(\\s*["'\`]${url.replace(/[/.]/g, "\\$&")}["'\`]\\s*,\\s*\\{([\\s\\S]*?)\\}\\s*\\)`,
    "m"
  )
  const match = sourceCode.match(pattern)
  return match ? match[1] : null
}

describe("StaffUsersAdminClient fetch cache regression", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null
  let latestState: HookHarnessState | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    latestState = null
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  async function renderHookHarness() {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root!.render(<HookHarness onState={(state) => { latestState = state }} />))
    return latestState!
  }

  it("fetchPayrollModelOptions GET /payment-models uses cache: no-store", () => {
    const options = extractFetchOptions(source, "/api/staff/payroll/payment-models")
    expect(options, "fetch call to /api/staff/payroll/payment-models not found").toBeTruthy()
    expect(options).toMatch(/cache\s*:\s*["']no-store["']/)
  })

  it("fetchPaymentChangeRequests GET /change-requests uses cache: no-store", () => {
    const options = extractFetchOptions(source, "/api/staff/payroll/change-requests")
    expect(options, "fetch call to /api/staff/payroll/change-requests not found").toBeTruthy()
    expect(options).toMatch(/cache\s*:\s*["']no-store["']/)
  })

  it("does not leave any payroll GET fetch without cache: no-store", () => {
    // Catch-all guard: every GET-style fetch under /api/staff/payroll/* must
    // include cache: "no-store". POST/PATCH/DELETE calls that include a method
    // field are excluded because they are not subject to HTTP GET caching.
    const payrollFetchPattern = /fetch\(\s*["'`](\/api\/staff\/payroll\/[^"'`]+)["'`]\s*,\s*\{([\s\S]*?)\}\s*\)/g
    const offenders: string[] = []

    let match: RegExpExecArray | null
    while ((match = payrollFetchPattern.exec(source)) !== null) {
      const url = match[1]
      const options = match[2]
      const hasMethod = /method\s*:\s*["'`](POST|PATCH|DELETE|PUT)["'`]/i.test(options)
      const hasNoStore = /cache\s*:\s*["'`]no-store["'`]/.test(options)
      if (!hasMethod && !hasNoStore) {
        offenders.push(url)
      }
    }

    expect(offenders, `GET fetches without cache: "no-store": ${offenders.join(", ")}`).toEqual([])
  })

  it("preserves existing rows and surfaces non-blocking degraded status when staff users returns degraded 200 with no items", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-04T12:00:00.000Z"))
    vi.spyOn(Math, "random").mockReturnValue(0)
    let usersCallCount = 0
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input)
      if (url.includes("/api/staff/users") && !url.includes("payroll-model")) {
        usersCallCount += 1
        if (usersCallCount > 1) {
          return jsonResponse(
            {
              status: "degraded",
              presenceUnavailable: true,
              message: "Staff user presence is temporarily unavailable. Showing saved user rows.",
              items: [],
            },
            true,
            200,
            new Headers({ "Retry-After": "10" })
          )
        }
        return jsonResponse({ items: [{ id: "user-1", email: "ada@example.com", firstName: "Ada", lastName: "Teacher" }] })
      }
      if (url.includes("/api/staff/payroll/payment-models")) return jsonResponse({ items: [] })
      return jsonResponse({})
    })

    const state = await renderHookHarness()
    await act(async () => {
      await state.fetchRows(undefined, "all", { showLoader: false, enforceMinDelay: false })
    })

    expect(latestState!.rows).toEqual([{ id: "user-1", email: "ada@example.com", firstName: "Ada", lastName: "Teacher" }])
    expect(latestState!.directoryStatusMessage).toBe("Staff user presence is temporarily unavailable. Showing saved user rows.")
    expect(latestState!.error).toBeNull()
  })

  it("honors degraded staff users Retry-After backoff before fetching rows again", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-04T12:00:00.000Z"))
    vi.spyOn(Math, "random").mockReturnValue(0)
    let usersCallCount = 0
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input)
      if (url.includes("/api/staff/users") && !url.includes("payroll-model")) {
        usersCallCount += 1
        if (usersCallCount === 2) {
          return jsonResponse(
            { status: "degraded", presenceUnavailable: true, retryAfterSec: 10, items: [] },
            true,
            200,
            new Headers({ "Retry-After": "10" })
          )
        }
        return jsonResponse({ items: [{ id: `user-${usersCallCount}` }] })
      }
      if (url.includes("/api/staff/payroll/payment-models")) return jsonResponse({ items: [] })
      return jsonResponse({})
    })

    const state = await renderHookHarness()
    await act(async () => {
      await state.fetchRows(undefined, "all", { showLoader: false, enforceMinDelay: false })
    })
    expect(usersCallCount).toBe(2)

    await act(async () => {
      await latestState!.fetchRows(undefined, "all", { showLoader: false, enforceMinDelay: false })
    })
    expect(usersCallCount).toBe(2)

    vi.setSystemTime(new Date("2026-07-04T12:00:10.001Z"))
    await act(async () => {
      await latestState!.fetchRows(undefined, "all", { showLoader: false, enforceMinDelay: false })
    })

    expect(usersCallCount).toBe(3)
  })
})
