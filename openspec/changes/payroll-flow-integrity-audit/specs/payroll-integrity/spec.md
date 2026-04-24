# Delta Spec: payroll-integrity

Capability: `payroll-integrity`
Change: `payroll-flow-integrity-audit`
Scope: verification-only — no production behavior changes, only test coverage and audit artifacts.

---

## ADDED Requirements

### Requirement: Config panel does not fetch change-requests

The payroll config panel (`StaffPaymentMethodConfigPanel`) MUST NOT issue any request to `/api/staff/payroll/change-requests` during its lifecycle. This replaces the obsoleted fix #3 (which previously required tolerating `403` on that slice).

Rationale: the change-requests slice was removed from the config panel in a prior refactor. The active approvals flow now lives exclusively in `StaffUsersAdminClient.fetchPaymentChangeRequests`, which uses `handleStaffAuthFailure` for auth errors and is NOT in scope for this change.

#### Scenario: Panel mount issues zero change-requests requests

- WHEN `StaffPaymentMethodConfigPanel` mounts with any allowed role
- THEN no `fetch` call is made to any URL matching `/api/staff/payroll/change-requests`
- AND this is asserted by an existing regression test in `tests/front/staff-payment-method-config-panel.test.tsx` ("does not request payment change approvals from payroll config")

---

### Requirement: Integrity report artifact

Upon successful completion of this change (apply + verify phases), an integrity report MUST be produced at `docs/specs/payroll-flow-integrity-audit/integrity-report.md`. This report is the deliverable of the audit.

#### Scenario: Report content shape

- WHEN the archive phase runs
- THEN `docs/specs/payroll-flow-integrity-audit/integrity-report.md` exists
- AND it contains one section per historical fix with:
  - Status: one of `present-and-tested` | `present-and-now-tested` | `closed-as-obsolete`
  - Evidence: specific `file:line` references or test-name references
  - Gaps filled by this change (if any)
- AND it contains a "Test Run Summary" section with the exact Vitest command executed and a pass/fail count
- AND it contains an "Out-of-Scope Risks" appendix listing the three known risks carried forward (multi-tenant isolation, profile-payment test drift, capability asymmetry)

#### Scenario: Report is human-authored, not auto-generated

- The report is written by the apply phase sub-agent using a fixed template shape defined in `design.md`
- No tooling is introduced to auto-generate this report in this change

---

## MODIFIED Requirements

### Requirement: No-store on payroll config GETs

All GET requests in the payroll flow that feed user-visible state MUST use `cache: "no-store"` to bypass Next.js / HTTP caching and prevent stale reads after mutations. This requirement EXPANDS the prior scope (which only covered the config panel) to also include the staff users admin client.

#### Scenario: Config panel GETs use no-store

- WHEN `StaffPaymentMethodConfigPanel` mounts
- THEN the requests to `/api/staff/payroll/payment-methods`, `/api/staff/payroll/payment-models`, and `/api/staff/payroll/currencies` each include `cache: "no-store"` in their request options
- AND this is asserted by tests in `tests/front/staff-payment-method-config-panel.test.tsx`
- AND coverage for `/currencies` (previously missing) is ADDED as part of this change

#### Scenario: StaffUsersAdminClient GETs use no-store

- WHEN `StaffUsersAdminClient` fetches `/api/staff/payroll/payment-models` or `/api/staff/payroll/change-requests`
- THEN both GET calls include `cache: "no-store"`
- AND this is asserted by a new regression test (test file created by this change)

#### Scenario: Stale reads are never surfaced

- WHEN a mutation occurs (PATCH/POST) followed by a re-fetch of any of the above endpoints
- THEN the fresh response is rendered to the user, not a cached prior response

---

### Requirement: Partial-load resilience in config panel

The config panel MUST load its data slices independently. A failure in one slice MUST NOT clear the successfully loaded slices. A partial-error banner MUST be shown while successful data remains visible.

#### Scenario: Single slice failure preserves other slices

- GIVEN `StaffPaymentMethodConfigPanel` is mounting
- WHEN `/api/staff/payroll/currencies` returns a 500 while `/payment-methods` and `/payment-models` return 200
- THEN the methods and models lists render with their data
- AND a partial-error indicator is shown for the currencies slice
- AND no global "everything failed" banner is shown

#### Scenario: Multiple failures surface the first error (known limitation)

- WHEN two or more slices fail in the same load cycle
- THEN only the first failing slice's error is surfaced
- AND this is documented as an acknowledged limitation — no aggregate error UI is required by this change

#### Scenario: Malformed payload is silently ignored (known limitation)

- WHEN a slice returns `200` with a payload whose `items` field is not an array
- THEN the slice is treated as empty and no error is surfaced
- AND this is documented as an acknowledged limitation — hardening is out of scope

---

### Requirement: Next 15 await params signature across payroll dynamic routes

Every dynamic API route under `app/api/staff/payroll/**` MUST use the Next 15 signature `context: { params: Promise<...> }` with `await context.params`. The old Next 14 `{ params: {...} }` non-Promise signature MUST NOT appear in any payroll dynamic route.

#### Scenario: PATCH change-requests awaits params

- WHEN `PATCH /api/staff/payroll/change-requests/[requestId]` is invoked
- THEN the handler uses `await context.params` to extract `requestId`
- AND existing API tests in `tests/api/staff-payroll-change-requests.test.ts` and `tests/api/staff-users-payroll-phase2.test.ts` invoke the handler with `{ params: Promise.resolve(...) }`

#### Scenario: All payroll dynamic routes use the awaited pattern

- WHEN an audit script scans `app/api/staff/payroll/**/*.ts` for the old non-Promise params signature
- THEN zero matches are found
- AND the audit script is committed to the repo under the path defined in `design.md`
- AND CI/local verification can re-run the script to confirm integrity

---

### Requirement: Overflow-safe rendering in config panel

The key/value rows inside `StaffPaymentMethodConfigPanel` MUST render long adapter config values (token-like strings, long IDs) without forcing horizontal overflow of the panel container. The value container MUST carry the CSS classes `min-w-0` and `break-all`.

#### Scenario: Value container has overflow-safe classes

- WHEN `StaffPaymentMethodConfigPanel` renders a payment method with config key/value pairs
- THEN the element wrapping each value carries the classes `min-w-0` and `break-all`
- AND a new regression UI test (React Testing Library) asserts both classes are present on the value container

#### Scenario: Long unbroken value does not overflow parent width

- GIVEN a payment method with an adapter config value of 200 characters and no whitespace
- WHEN the panel renders that method
- THEN the class assertion in the regression test is sufficient evidence of overflow safety
- AND no full DOM layout / pixel measurement test is required

---

## REMOVED Requirements

### Requirement: Config panel tolerates 403 on change-requests slice

**Reason for removal**: the config panel no longer fetches `/api/staff/payroll/change-requests` at all. The original requirement ("if the change-requests slice returns 403, the panel should treat it as `items: []` and continue rendering other slices") was obsoleted by a refactor that removed the slice entirely from this component.

**Replacement**: the new ADDED requirement "Config panel does not fetch change-requests" (above) is the current invariant.

**Non-goal**: this change does NOT port any 403-tolerance behavior to `StaffUsersAdminClient.fetchPaymentChangeRequests`. That component's active flow uses `handleStaffAuthFailure` and a global-error path for non-auth failures, and is intentionally out of scope.

---

## Out-of-Scope (explicit)

These concerns were surfaced during exploration but are NOT addressed by this change. They are documented here so the integrity report can carry them forward.

- **Multi-tenant isolation bug in change-requests APIs** (HIGH)
  - `GET /api/staff/payroll/change-requests` does not scope results by school.
  - `PATCH /api/staff/payroll/change-requests/[requestId]` does not verify school ownership.
  - Tracked as a separate, higher-priority change.

- **Profile payment validation test drift** (MEDIUM)
  - Two tests in `tests/api/staff-users-payroll-phase2.test.ts` fail with expected `422` vs received `200` on `PATCH /api/staff/users/[userId]/profile`.
  - Tracked as a separate change. This audit's pass/fail excludes those two specific tests.

- **Capability asymmetry** (LOW / design concern)
  - UI renders the config panel for `owner` only.
  - Backend `GET /payment-models` accepts `owner` + `admin+manager`.
  - No functional impact observed; documented for future cleanup.

- **Other deferred items** (NICE TO HAVE)
  - Lazy-load of `change-requests` slice in `StaffUsersAdminClient`.
  - Adding GET handler to `payment-models/[modelId]` route.
  - Playwright E2E for the payroll flow.
