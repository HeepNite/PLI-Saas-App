import { describe, expect, it } from "vitest"

import { formatFreezeChecklist, generateFreezeList, type GrepRunner } from "@/scripts/generate-clerk-freeze-list"

const makeFakeGrep = (overrides: Partial<GrepRunner> = {}): GrepRunner => ({
  grepLines: () => [],
  grepFiles: () => [],
  ...overrides,
})

describe("generateFreezeList — direct app/api/** call sites", () => {
  it("lists a route file directly when the symbol is called inside app/api/**", () => {
    const grep = makeFakeGrep({
      grepLines: (needle) => {
        if (needle === "syncStaffAccountFromClerkUser") {
          return ["app/api/staff/sync/route.ts:36:      const account = await syncStaffAccountFromClerkUser(user, { source: \"staff_sync_backfill\" })"]
        }
        return []
      },
    })

    const findings = generateFreezeList(grep)

    expect(findings).toEqual([
      {
        routeFile: "app/api/staff/sync/route.ts",
        via: [{ symbol: "syncStaffAccountFromClerkUser", sourceFile: "app/api/staff/sync/route.ts" }],
      },
    ])
  })

  it("excludes the symbol's own declaration/export line, not just call sites", () => {
    const grep = makeFakeGrep({
      grepLines: (needle) => {
        if (needle === "syncStaffAccountFromClerkUser") {
          return ["lib/security/staff-account-sync.ts:172:export const syncStaffAccountFromClerkUser = async (user: ClerkStaffUser, options: SyncStaffAccountOptions = {}) => {"]
        }
        return []
      },
    })

    const findings = generateFreezeList(grep)

    expect(findings).toEqual([])
  })

  it("excludes matches under tests/", () => {
    const grep = makeFakeGrep({
      grepLines: (needle) => {
        if (needle === "ensureClerkUser") {
          return ["tests/lib/checkout.test.ts:10:  await ensureClerkUser(input)"]
        }
        return []
      },
    })

    const findings = generateFreezeList(grep)

    expect(findings).toEqual([])
  })
})

describe("generateFreezeList — one-hop resolution through lib/*.ts", () => {
  it("resolves a lib/*.ts call site to its app/api/** route importers", () => {
    const grep = makeFakeGrep({
      grepLines: (needle) => {
        if (needle === "ensureClerkUser") {
          return ["lib/checkout.ts:162:    const ensuredClerkUser = await ensureClerkUser({"]
        }
        return []
      },
      grepFiles: (needle, dir) => {
        if (needle === "@/lib/checkout" && dir === "app/api") {
          return ["app/api/checkout/cash/route.ts", "app/api/checkout/intent/route.ts"]
        }
        return []
      },
    })

    const findings = generateFreezeList(grep)

    expect(findings).toEqual([
      { routeFile: "app/api/checkout/cash/route.ts", via: [{ symbol: "ensureClerkUser", sourceFile: "lib/checkout.ts" }] },
      { routeFile: "app/api/checkout/intent/route.ts", via: [{ symbol: "ensureClerkUser", sourceFile: "lib/checkout.ts" }] },
    ])
  })

  it("does not resolve non-lib, non-route call sites (e.g. app pages) — out of scope for the one-hop rule", () => {
    const grep = makeFakeGrep({
      grepLines: (needle) => {
        if (needle === "syncStaffAccountFromClerkUser") {
          return ["app/staff/resolve/page.tsx:67:      await syncStaffAccountFromClerkUser(currentUser, { source: \"staff_resolve\" })"]
        }
        return []
      },
    })

    const findings = generateFreezeList(grep)

    expect(findings).toEqual([])
  })
})

describe("generateFreezeList — dedup and merge", () => {
  it("merges multiple symbols found in the same route file into one finding", () => {
    const grep = makeFakeGrep({
      grepLines: (needle) => {
        if (needle === "ensureClerkUser") {
          return ["app/api/staff/students/route.ts:434:    clerkUser = existingClerkUser || await ensureClerkUser({"]
        }
        if (needle === "client.invitations.createInvitation") {
          return ["app/api/staff/students/route.ts:174:    await client.invitations.createInvitation({"]
        }
        return []
      },
    })

    const findings = generateFreezeList(grep)

    expect(findings).toEqual([
      {
        routeFile: "app/api/staff/students/route.ts",
        via: [
          { symbol: "ensureClerkUser", sourceFile: "app/api/staff/students/route.ts" },
          { symbol: "client.invitations.createInvitation", sourceFile: "app/api/staff/students/route.ts" },
        ],
      },
    ])
  })

  it("sorts findings by route file path", () => {
    const grep = makeFakeGrep({
      grepLines: (needle) => {
        if (needle === "syncStaffAccountFromClerkUser") {
          return [
            "app/api/staff/users/route.ts:771:    await syncStaffAccountFromClerkUser(updated, { source: \"staff_portal_post\" })",
            "app/api/staff/bootstrap/route.ts:39:  await syncStaffAccountFromClerkUser(updated, { source: \"staff_bootstrap\" })",
          ]
        }
        return []
      },
    })

    const findings = generateFreezeList(grep)

    expect(findings.map((f) => f.routeFile)).toEqual(["app/api/staff/bootstrap/route.ts", "app/api/staff/users/route.ts"])
  })
})

describe("formatFreezeChecklist", () => {
  it("labels the output with the generation date and a REGENERATE reminder", () => {
    const output = formatFreezeChecklist(
      [{ routeFile: "app/api/staff/sync/route.ts", via: [{ symbol: "syncStaffAccountFromClerkUser", sourceFile: "app/api/staff/sync/route.ts" }] }],
      new Date("2026-07-17T12:00:00.000Z")
    )

    expect(output).toContain("generated 2026-07-17")
    expect(output).toContain("REGENERATE at cutover time")
    expect(output).toContain("- [ ] app/api/staff/sync/route.ts")
    expect(output).toContain("Total routes to freeze: 1")
  })

  it("annotates a via-lib finding with the source file, not just the route", () => {
    const output = formatFreezeChecklist(
      [{ routeFile: "app/api/checkout/cash/route.ts", via: [{ symbol: "ensureClerkUser", sourceFile: "lib/checkout.ts" }] }],
      new Date("2026-07-17T12:00:00.000Z")
    )

    expect(output).toContain("- ensureClerkUser (via lib/checkout.ts)")
  })
})
