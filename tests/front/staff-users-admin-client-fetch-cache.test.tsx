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
import { describe, expect, it } from "vitest"

const SOURCE_PATHS = [
  "components/front/staff/StaffUsersAdminClient.tsx",
  "components/front/staff/useStaffDirectoryAdmin.ts",
  "components/front/staff/useStaffRequestsAdmin.ts",
]

const source = SOURCE_PATHS
  .map((path) => readFileSync(join(process.cwd(), path), "utf8"))
  .join("\n")

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
})
