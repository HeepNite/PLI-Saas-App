# Tasks: Payroll Flow Integrity Audit

Authored by the orchestrator (Opción B override) after `sdd-spec-turbo` and `sdd-tasks-turbo` agents failed silently on 2026-04-16. Content derives from the approved proposal, spec, and design.

---

## Group 1 — Test gap: currencies no-store assertion

- [x] T01 Inspect existing panel test to locate fetch-assertion pattern
      - File(s): `tests/front/staff-payment-method-config-panel.test.tsx`
      - Depends on: none
      - Done when: the existing pattern for asserting `cache: "no-store"` on `/payment-methods` and `/payment-models` is identified and documented in this task's notes.

- [x] T02 Add assertion that `/api/staff/payroll/currencies` GET uses `cache: "no-store"`
      - File(s): `tests/front/staff-payment-method-config-panel.test.tsx`
      - Depends on: T01
      - Done when: the test file contains a new assertion verifying the currencies call includes `cache: "no-store"` in its options.

## Group 2 — Test gap: overflow classes regression

- [x] T03 Add regression `it(...)` asserting value container has `min-w-0` and `break-all` classes
      - File(s): `tests/front/staff-payment-method-config-panel.test.tsx`
      - Depends on: T01
      - Done when: the test renders the panel with at least one payment method with config key/value pairs, queries the value container (by data-testid or DOM structure), and asserts both classes are present in its `className`.

- [x] T04 Run panel test file to confirm green for Group 1 + Group 2 additions
      - Command: `npx vitest run tests/front/staff-payment-method-config-panel.test.tsx`
      - Depends on: T02, T03
      - Done when: all tests in the file pass, including the two new assertions.

## Group 3 — New test file: StaffUsersAdminClient fetch cache

- [x] T05 Create `tests/front/staff-users-admin-client-fetch-cache.test.tsx`
      - File(s): `tests/front/staff-users-admin-client-fetch-cache.test.tsx` (new)
      - Depends on: none
      - Done when: the new file exists with a vitest suite that mocks global `fetch` and asserts `cache: "no-store"` is set on both `/api/staff/payroll/payment-models` and `/api/staff/payroll/change-requests` GET calls originating from `StaffUsersAdminClient`. Per design: do NOT do a full render of the 12k-line component. Use a minimal render that triggers only the relevant fetches, or invoke the fetch callbacks directly if they are exported.

- [x] T06 Run the new test file to confirm green
      - Command: `npx vitest run tests/front/staff-users-admin-client-fetch-cache.test.tsx`
      - Depends on: T05
      - Done when: the new test file passes.

## Group 4 — Audit script for Next 15 params signature

- [x] T07 Create `scripts/audit-payroll-params.sh`
      - File(s): `scripts/audit-payroll-params.sh` (new)
      - Depends on: none
      - Done when: the file exists, is executable (`chmod +x`), and contains the audit script from `design.md` that scans `app/api/staff/payroll/**/route.ts` for the old non-Promise `params:` signature and exits non-zero on any match.

- [x] T08 Run the audit script once and capture output
      - Command: `bash scripts/audit-payroll-params.sh`
      - Depends on: T07
      - Done when: the script exits 0 (no old-signature matches) and its stdout is captured for the integrity report.

## Group 5 — Targeted test baseline

- [x] T09 Run the targeted payroll Vitest suite
      - Command: `npx vitest run tests/front/staff-payment-method-config-panel.test.tsx tests/front/staff-users-admin-client-fetch-cache.test.tsx tests/api/staff-payroll-payment-methods.test.ts tests/api/staff-payroll-payment-models.test.ts tests/api/staff-payroll-payment-models-auth.test.ts tests/api/staff-payroll-change-requests.test.ts tests/api/staff-users-payroll-phase2.test.ts`
      - Depends on: T04, T06
      - Done when: 6/7 files pass. The 1 expected failure in `tests/api/staff-users-payroll-phase2.test.ts` (profile-payment 422 vs 200) is acknowledged and its exact failure output captured for the integrity report.

## Group 6 — Integrity report authoring

- [x] T10 Create `docs/specs/payroll-flow-integrity-audit/` directory
      - Command: `mkdir -p docs/specs/payroll-flow-integrity-audit`
      - Depends on: none
      - Done when: the directory exists.

- [x] T11 Author `docs/specs/payroll-flow-integrity-audit/integrity-report.md`
      - File(s): `docs/specs/payroll-flow-integrity-audit/integrity-report.md` (new)
      - Depends on: T04, T06, T08, T09, T10
      - Done when: the file exists with all sections populated using evidence from Groups 1–5:
        - Executive summary table (pass/fail per fix).
        - Per-fix detail (status, evidence file:line, test reference, gaps filled).
        - Test run summary (exact command + result from T09).
        - Audit script result from T08.
        - Out-of-scope risks appendix (the three carried-forward risks).

## Group 7 — Final verification handoff

- [x] T12 Summarize completed work for the verify phase
      - File(s): none (handoff summary)
      - Depends on: T11
      - Done when: a summary lists all files created/modified, links to the integrity report, and explicitly notes which requirements from `spec.md` are satisfied.
