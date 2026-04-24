# Payroll Flow Integrity Report

**Change**: `payroll-flow-integrity-audit`
**Authored**: 2026-04-16
**Pipeline**: explore → propose → design → spec → tasks → apply → verify
**Artifact store**: engram (pli-saas-app) + openspec (`openspec/changes/payroll-flow-integrity-audit/`)

This report is the formal deliverable of the payroll flow integrity audit. It consolidates evidence for the 5 historical payroll fixes, documents one obsolete fix, records new regression coverage, and carries forward three out-of-scope risks for separate change tracking.

---

## Executive Summary

| Fix | Disposition | Status |
|-----|-------------|--------|
| #1 — Stale cache (`cache: "no-store"`) | present-and-now-tested | ✅ PASS |
| #2 — Partial-load resilience | present-and-tested | ✅ PASS |
| #3 — 403 tolerance on change-requests slice | closed-as-obsolete | ⓘ N/A |
| #4 — Next 15 `await params` signature | present-and-audited | ✅ PASS |
| #5 — Overflow-safe rendering (`min-w-0` + `break-all`) | present-and-now-tested | ✅ PASS |

**Audit result**: PASS. All 5 fixes have a clear disposition. All in-scope tests are green.

---

## Per-Fix Detail

### Fix #1 — Stale cache (`cache: "no-store"`)

- **Disposition**: present-and-now-tested
- **Status**: ✅ PASS
- **Evidence**:
  - Config panel: `components/front/staff/payroll/StaffPaymentMethodConfigPanel.tsx:176` — `requestOptions.cache = "no-store"` on the shared GET options for `/payment-methods`, `/payment-models`, `/currencies`.
  - Admin client (payment models): `components/front/staff/StaffUsersAdminClient.tsx:2593-2596` — `fetch("/api/staff/payroll/payment-models", { headers, cache: "no-store" })`.
  - Admin client (change requests): `components/front/staff/StaffUsersAdminClient.tsx:2937-2940` — `fetch("/api/staff/payroll/change-requests", { headers, cache: "no-store" })`.
- **Tests**:
  - `tests/front/staff-payment-method-config-panel.test.tsx`:
    - "shows configured methods and resolves default method names from the methods payload" — asserts `cache: "no-store"` on `/payment-methods` and `/payment-models`.
    - "fetches currencies with cache: no-store" — **NEW** (added by this change) — asserts `cache: "no-store"` on `/currencies`.
  - `tests/front/staff-users-admin-client-fetch-cache.test.tsx` — **NEW FILE** (added by this change):
    - "fetchPayrollModelOptions GET /payment-models uses cache: no-store"
    - "fetchPaymentChangeRequests GET /change-requests uses cache: no-store"
    - "does not leave any payroll GET fetch without cache: no-store" — catch-all guard; iterates every `fetch("/api/staff/payroll/...")` in the source and verifies `cache: "no-store"` (excluding calls with explicit `method: POST/PATCH/DELETE/PUT`).
- **Gaps filled by this change**:
  - Added `/currencies` no-store assertion in the panel test (previously missing).
  - Added full source-level regression coverage for `StaffUsersAdminClient` payroll fetches (previously zero coverage).

---

### Fix #2 — Partial-load resilience

- **Disposition**: present-and-tested
- **Status**: ✅ PASS
- **Evidence**:
  - `components/front/staff/payroll/StaffPaymentMethodConfigPanel.tsx:179-224` — `loadSlice` loads each endpoint independently; only successful slices are written to state (`setMethods`, `setModels`, `setCurrencies`). One failing slice does NOT clear the others.
- **Tests**:
  - `tests/front/staff-payment-method-config-panel.test.tsx`:
    - "keeps successful slices populated when one config request fails" — simulates a 500 on `/currencies` and asserts methods + models still render, with a partial-error banner ("Currencies unavailable").
- **Known limitations** (documented, not bugs):
  - When multiple slices fail simultaneously, only the first error is surfaced. Aggregate error UI is out of scope.
  - A 200 response with a malformed payload (`items` not an array) is treated as an empty slice with no error surfaced. Hardening is out of scope.

---

### Fix #3 — 403 tolerance on change-requests slice

- **Disposition**: **closed-as-obsolete**
- **Status**: ⓘ N/A
- **Rationale**: The original fix was a 403-tolerance layer in `StaffPaymentMethodConfigPanel` that treated a 403 response on `/change-requests` as `items: []` rather than a global panel error. A subsequent refactor removed the `change-requests` slice from the config panel entirely. The requirement no longer applies to this component.
- **Replacement requirement**: "Config panel does NOT fetch change-requests" — covered by existing test in `tests/front/staff-payment-method-config-panel.test.tsx` ("does not request payment change approvals from payroll config").
- **Non-goal**: this audit does NOT port the 403-tolerance behavior to the active approvals flow in `StaffUsersAdminClient.fetchPaymentChangeRequests`. That flow uses its own auth-failure handling via `handleStaffAuthFailure` and a global-error path for non-auth failures. Any change to its error model is explicitly out of scope.

---

### Fix #4 — Next 15 `await params` signature

- **Disposition**: present-and-audited
- **Status**: ✅ PASS
- **Evidence**:
  - Static audit: `scripts/audit-payroll-params.sh` — **NEW FILE** (added by this change). Scans every dynamic route file under `app/api/staff/payroll/**/[*]/route.ts` and fails if any route declares its params without the `Promise<{...}>` shape.
- **Audit script result** (2026-04-16):
  ```
  Auditing 9 dynamic payroll route file(s) for Next 15 params signature...
  PASS: All 9 dynamic payroll route(s) use Promise<> params.
    ✓ app/api/staff/payroll/change-requests/[requestId]/route.ts
    ✓ app/api/staff/payroll/entries/[entryId]/accept-partial/route.ts
    ✓ app/api/staff/payroll/entries/[entryId]/pay/route.ts
    ✓ app/api/staff/payroll/entries/[entryId]/propose-partial/route.ts
    ✓ app/api/staff/payroll/entries/[entryId]/reject-partial/route.ts
    ✓ app/api/staff/payroll/entries/[entryId]/reverse/route.ts
    ✓ app/api/staff/payroll/entries/[entryId]/route.ts
    ✓ app/api/staff/payroll/payment-methods/[methodId]/route.ts
    ✓ app/api/staff/payroll/payment-models/[modelId]/route.ts
  ```
- **Tests** (indirect coverage):
  - `tests/api/staff-payroll-change-requests.test.ts` invokes handlers with `{ params: Promise.resolve(...) }`, implicitly validating the signature.
  - `tests/api/staff-users-payroll-phase2.test.ts` similarly invokes with Promise params (suite passes the handler-signature portion; see out-of-scope notes for the unrelated failures in the same file).
- **Gaps filled by this change**: added a permanent static-analysis guard (`audit-payroll-params.sh`) that can be wired into CI / pre-commit to catch future regressions without requiring per-route unit tests.

---

### Fix #5 — Overflow-safe rendering (`min-w-0` + `break-all`)

- **Disposition**: present-and-now-tested
- **Status**: ✅ PASS
- **Evidence**:
  - `components/front/staff/payroll/StaffPaymentMethodConfigPanel.tsx:554-556` — the key/value config row wraps the value `<span>` with `className="min-w-0 break-all text-right font-mono"`. The parent row uses `className="flex min-w-0 ..."`.
- **Tests**:
  - `tests/front/staff-payment-method-config-panel.test.tsx`:
    - "renders config values with overflow-safe classes (min-w-0 and break-all)" — **NEW** (added by this change). Renders the panel with a payment method whose `configJson.accountAlias` is a 200-character unbroken string, locates the value `<span>` in the DOM, and asserts both `min-w-0` and `break-all` are present on its `className`.
- **Gaps filled by this change**: added the regression UI test that was previously missing.

---

## Test Run Summary

**Command executed**:
```
npx vitest run \
  tests/front/staff-payment-method-config-panel.test.tsx \
  tests/front/staff-users-admin-client-fetch-cache.test.tsx \
  tests/api/staff-payroll-payment-methods.test.ts \
  tests/api/staff-payroll-payment-models.test.ts \
  tests/api/staff-payroll-payment-models-auth.test.ts \
  tests/api/staff-payroll-change-requests.test.ts \
  tests/api/staff-users-payroll-phase2.test.ts
```

**Result**:
- Test Files: **6 passed / 1 failed (7 total)**
- Tests: **55 passed / 2 failed (57 total)**
- Duration: 519 ms

**Failing tests** (both **OUT OF SCOPE** for this change — see risk register below):
1. `tests/api/staff-users-payroll-phase2.test.ts` > `PATCH /api/staff/users/[userId]/profile — payment validation` > "rejects direct_deposit with missing routingNumber" — expected 422, received 200.
2. `tests/api/staff-users-payroll-phase2.test.ts` > `PATCH /api/staff/users/[userId]/profile — payment validation` > "rejects zelle when no zelleId or venmoUser is provided but other fields are present" — expected 422, received 200.

**Audit pass criterion** (from the approved proposal and spec):
> "Targeted payroll Vitest suite is green, excluding the 2 known out-of-scope failing profile-payment tests."

**Assessment**: ✅ **PASS** — all in-scope tests are green; the two excluded failures were anticipated and documented as out-of-scope prior to execution.

---

## Audit Script Result (Fix #4)

Captured verbatim in the Fix #4 section above. Script exit code: **0**.

---

## Files Created / Modified by this Change

| File | Action | Purpose |
|------|--------|---------|
| `tests/front/staff-payment-method-config-panel.test.tsx` | Modified | Added currencies no-store assertion + overflow classes regression test (2 new `it(...)` blocks) |
| `tests/front/staff-users-admin-client-fetch-cache.test.tsx` | Created | Source-level regression coverage for `StaffUsersAdminClient` payroll fetches |
| `scripts/audit-payroll-params.sh` | Created | Static-analysis guard for Next 15 `await params` signature across payroll dynamic routes |
| `docs/specs/payroll-flow-integrity-audit/integrity-report.md` | Created | This document |
| `openspec/changes/payroll-flow-integrity-audit/proposal.md` | Created | SDD proposal artifact |
| `openspec/changes/payroll-flow-integrity-audit/design.md` | Created | SDD design artifact |
| `openspec/changes/payroll-flow-integrity-audit/specs/payroll-integrity/spec.md` | Created | SDD delta spec artifact |
| `openspec/changes/payroll-flow-integrity-audit/tasks.md` | Created | SDD task breakdown artifact |

**Production code changes**: **zero**. No component, API route, security helper, or Prisma schema was modified. The only net-new code is test files, an audit shell script, and documentation.

---

## Out-of-Scope Risks Carried Forward

These three concerns were surfaced during exploration but were explicitly kept out of scope of this audit. They MUST be tracked as separate changes.

### RISK-1 (HIGH) — Multi-tenant isolation bug in change-requests APIs

- **Issue**: `GET /api/staff/payroll/change-requests` returns all requests without scoping by `schoolId`. `PATCH /api/staff/payroll/change-requests/[requestId]` updates by id without verifying the request belongs to the caller's school.
- **Impact**: In a multi-school deployment (not currently in production — the business model today is 1 owner = 1 school with branches), an owner of school A could in principle read or approve/reject change requests belonging to school B. **Not exploitable in the current tenancy model, but the code-level invariant does not hold.**
- **Recommendation**: open a separate high-priority change (`payroll-change-requests-school-scoping` or similar) that adds a `schoolId` filter to the GET list query and an ownership check to the PATCH handler, with API tests covering a cross-school access attempt.

### RISK-2 (MEDIUM) — Profile payment validation test drift

- **Issue**: Two tests in `tests/api/staff-users-payroll-phase2.test.ts` assert `422` on `PATCH /api/staff/users/[userId]/profile` when sending invalid direct_deposit or zelle payment payloads, but the handler currently returns `200`.
- **Impact**: Either the backend validation was relaxed without updating the tests, or the tests were written for a validation layer that was never implemented. Either way the contract between tests and handler is out of sync, which masks real validation gaps.
- **Recommendation**: open a separate medium-priority change to (a) decide whether the handler SHOULD reject these payloads with 422, and (b) align the implementation and tests accordingly.

### RISK-3 (LOW) — Capability asymmetry

- **Issue**: `StaffPaymentMethodConfigPanel` is rendered only for `owner` in `StaffUsersAdminClient`, but the backend route `GET /api/staff/payroll/payment-models` accepts both `owner` and `admin+manager` via `authorizeStaffPortalRequest`. The frontend is strictly more restrictive than the backend.
- **Impact**: No immediate functional impact — the surface is simply not reachable from the UI for managers today. However, the backend grants a capability that has no UI consumer, which is unnecessary attack surface.
- **Recommendation**: either (a) tighten the backend to owner-only (if managers are not expected to have access), or (b) open the UI gate to managers (if they should). Not urgent; triage during the next security/auth review cycle.

---

## Deferred (Nice-to-Have) Items

Surfaced during exploration but not proposed as separate changes:

- **Lazy-load `/change-requests` slice**: currently fetched on `StaffUsersAdminClient` mount; could be deferred until the Requests section is visible.
- **GET handler on `app/api/staff/payroll/payment-models/[modelId]/route.ts`**: the route currently exposes PATCH only; adding GET would symmetrize the contract.
- **Playwright E2E for payroll**: no end-to-end coverage exists today for the full owner-config → staff-request → owner-approve flow.

---

## Verification Against Spec (self-check)

| Requirement (from `spec.md`) | Status |
|------------------------------|--------|
| MODIFIED — No-store on payroll config GETs (panel + admin client) | ✅ Covered — see Fix #1 |
| MODIFIED — Partial-load resilience in config panel | ✅ Covered — see Fix #2 |
| REMOVED — 403 tolerance in config panel for change-requests | ✅ Documented as closed-as-obsolete — see Fix #3 |
| ADDED — Config panel does not fetch change-requests | ✅ Covered by existing test — see Fix #3 replacement |
| MODIFIED — Next 15 await params across payroll dynamic routes | ✅ Covered by audit script — see Fix #4 |
| MODIFIED — Overflow-safe rendering in config panel | ✅ Covered by new test — see Fix #5 |
| ADDED — Integrity report artifact | ✅ This document |

All spec requirements are satisfied. Ready for archive.

---

## Addendum — Pipeline Notes

This SDD cycle was completed under infrastructure stress: the `sdd-spec-turbo` and `sdd-tasks-turbo` sub-agents (backed by `opencode/mimo-v2-pro-free` and `opencode/glm-5-free` respectively) returned silent errors (7 ms exits with no output) on every delegation attempt during the run on 2026-04-16. With user consent, the orchestrator executed the spec, tasks, apply, and report authoring phases directly inline using the content already produced by the successful explore / propose / design phases. No decisions were taken beyond those already documented in those upstream artifacts. The orchestrator did NOT modify any production code.

Planned follow-up: replace the `free` model tier for `sdd-spec-turbo` and `sdd-tasks-turbo` with a more reliable model before the next SDD cycle.
