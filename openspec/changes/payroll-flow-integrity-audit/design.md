# Design: Payroll Flow Integrity Audit

## Technical Approach

This is a **verification-only** change. No production code is modified. The deliverable is (a) new/extended regression tests filling explored gaps, (b) an audit script for dynamic-route signature compliance, and (c) a manually authored integrity report. All verification maps back to the 5 historical fixes documented in the proposal.

## Verification Strategy

| Fix | Technique | What to check | Evidence source |
|-----|-----------|----------------|-----------------|
| #1 — `cache: "no-store"` | Test assertion + static grep | All payroll GET fetches include `cache: "no-store"` | Extend existing panel test; new `StaffUsersAdminClient` test; grep `components/front/staff/` |
| #2 — Partial-load resilience | Existing test (verify only) | Successful slices retained when one fails | `staff-payment-method-config-panel.test.tsx` — already passing |
| #3 — 403 tolerance | Existing test (verify only) | Panel does NOT fetch `change-requests`; fix is obsolete | `staff-payment-method-config-panel.test.tsx` — "does not request payment change approvals" already passing |
| #4 — `await params` (Next 15) | Audit script (grep) | All `app/api/staff/payroll/**/route.ts` dynamic routes use `Promise<{...}>` signature | One-liner grep; no test needed — 100% compliant per exploration |
| #5 — Overflow classes | Test assertion | `min-w-0` and `break-all` present in rendered config panel | Extend existing panel test |

## Architecture Decisions

| Decision | Alternatives | Rationale |
|----------|-------------|-----------|
| **New test file** for `StaffUsersAdminClient` no-store | Extend panel test file | Panel test covers `StaffPaymentMethodConfigPanel` only. `StaffUsersAdminClient` is a separate 12k-line component — its fetch behavior belongs in a dedicated test. Mixing concerns violates single-responsibility of test files. |
| **Grep audit script** for Fix #4 instead of unit test | Add per-route unit tests asserting `Promise<>` signature | All 9 dynamic payroll routes already use the correct signature. A grep one-liner catches regressions without 9 redundant test cases. Cost/benefit favors static analysis. |
| **Extend** panel test file for Fix #1 currencies + Fix #5 overflow | New test files | Same component, same test setup/mocks. Adding assertions to the existing describe block follows reuse-first rule. |
| **Close Fix #3** as obsolete, no new test | Write 403-tolerance test for approvals flow | The 403-tolerance was for the config panel which no longer fetches change-requests. The approvals flow in `StaffUsersAdminClient` uses `handleStaffAuthFailure` (different pattern). Testing that pattern is out of scope for this audit. |
| **Integrity report** authored manually in apply phase | Auto-generated from test output | Report requires human judgment for disposition labels and risk commentary. Template shape defined here; content filled during apply. |

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `tests/front/staff-payment-method-config-panel.test.tsx` | Modify | Add: (1) currencies `cache: "no-store"` assertion, (2) overflow class assertion (`min-w-0`, `break-all`) |
| `tests/front/staff-users-admin-client-fetch-cache.test.tsx` | Create | Targeted test: `fetchPayrollModelOptions` and `fetchPaymentChangeRequests` both use `cache: "no-store"` |
| `scripts/audit-payroll-params.sh` | Create | Grep one-liner: scan `app/api/staff/payroll/**/route.ts` for non-Promise params signature, exit 1 if found |
| `docs/specs/payroll-flow-integrity-audit/integrity-report.md` | Create | Manually authored during apply phase using template below |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (panel) | Currencies no-store; overflow classes | Extend `staff-payment-method-config-panel.test.tsx` — assert `fetch` called with `cache: "no-store"` for `/currencies`; assert `min-w-0` / `break-all` classes in rendered output |
| Unit (admin client) | `StaffUsersAdminClient` no-store on payroll fetches | New `staff-users-admin-client-fetch-cache.test.tsx` — mock `fetch`, render triggers, assert `cache: "no-store"` on `/payment-models` and `/change-requests` calls |
| Static audit | Next 15 `await params` compliance | `scripts/audit-payroll-params.sh` — `grep -rn 'params:' app/api/staff/payroll/**/route.ts | grep -v 'Promise<'` exits 0 (no matches = pass) |
| Existing (verify) | Partial-load, no-change-requests | Run existing test suite, confirm green |

### Audit Script (Fix #4)

```bash
#!/usr/bin/env bash
# Fail if any payroll dynamic route uses non-Promise params signature
matches=$(grep -rn 'params:' app/api/staff/payroll/*/route.ts app/api/staff/payroll/*/*/route.ts 2>/dev/null | grep -v 'Promise<' | grep -v '\.test\.')
if [ -n "$matches" ]; then
  echo "FAIL: Non-Promise params signature found:"
  echo "$matches"
  exit 1
fi
echo "PASS: All payroll dynamic routes use Promise<> params"
exit 0
```

### StaffUsersAdminClient Test Approach

The component is 12k+ lines. Full render is impractical. Test strategy: mock `fetch` at global level, extract and invoke the fetch callbacks directly (or render a minimal slice that triggers `fetchPayrollModelOptions` / `fetchPaymentChangeRequests`). Assert `cache: "no-store"` on the intercepted fetch calls.

## Integrity Report Template

Location: `docs/specs/payroll-flow-integrity-audit/integrity-report.md`

```markdown
# Payroll Flow Integrity Report

## Executive Summary
| Fix | Disposition | Status |
|-----|------------|--------|
| #1 — Stale cache | Present + tested | PASS/FAIL |
| #2 — Partial-load | Present + tested | PASS/FAIL |
| #3 — 403 tolerance | Closed as obsolete | N/A |
| #4 — await params | Present + audited | PASS/FAIL |
| #5 — Overflow | Present + tested | PASS/FAIL |

## Per-Fix Detail
### Fix #1 ...
- **Status**: ...
- **Evidence**: `file:line` references
- **Test**: test name + file

(repeat per fix)

## Out-of-Scope Risks Carried Forward
- Multi-tenant isolation in change-requests (HIGH)
- Test drift in profile payment validation (MEDIUM)
- Capability asymmetry owner-only UI vs owner+manager backend (LOW)

## Test Run Summary
- Command: `npx vitest run tests/front/staff-payment-method-config-panel.test.tsx tests/front/staff-users-admin-client-fetch-cache.test.tsx tests/api/staff-payroll-*.test.ts`
- Result: X passed, Y failed (list failures if any)
```

## Acceptance Decisions

- **Fix #3 is CLOSED as obsolete.** The original requirement (403-tolerant fetch in config panel) is removed. Replacement requirement: "panel does not fetch change-requests" — already covered by existing test. The active approvals flow in `StaffUsersAdminClient` is explicitly NOT in scope.

## Constraints and Non-Goals

- No production code changes (test-only + report + audit script).
- Do NOT touch school-isolation code path — tracked separately.
- Do NOT fix the 2 failing profile-payment tests (422 vs 200 drift) — tracked separately.
- Do NOT add Playwright E2E.
- Do NOT refactor `StaffPaymentMethodConfigPanel` beyond data-testids if strictly needed for assertions.

## Risk Register (Carried Forward)

| Risk | Severity | Tracking |
|------|----------|----------|
| Multi-tenant isolation bug in change-requests GET/PATCH | HIGH | Separate change required |
| Test drift in profile payment validation (422 vs 200) | MEDIUM | Separate change required |
| Capability asymmetry: owner-only UI vs owner+manager backend | LOW | Design concern, future cleanup |

## Migration / Rollout

No migration required. All changes are additive (tests + report + script).

## Open Questions

None — all decisions resolved during exploration and proposal phases.
