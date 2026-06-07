# Proposal: Payroll Flow Integrity Audit

## Intent

The intent of this change is to conduct a formal verification and audit of the 5 historical payroll fixes. This is not a new feature. The goal is to consolidate evidence that the fixes remain effective, add missing regression coverage where gaps exist, and produce a formal integrity report confirming system stability.

## Scope

### In Scope
- Verify fix #1 (stale cache `cache: "no-store"`) is applied and regression-tested across all payroll GET slices, including `/currencies`, `payment-models`, and `change-requests`.
- Verify fix #2 (partial-load resilience) is applied and tested in the config panel.
- Verify fix #4 (Next 15 `await params` signature) is applied across ALL payroll dynamic routes.
- Verify fix #5 (overflow `min-w-0 break-all`) is applied and add a regression UI test.
- Close fix #3 (403 tolerance) as obsolete.
- Fill test coverage gaps identified during exploration (e.g., no-store assertions for currencies/payment-models/change-requests, overflow UI test).
- Produce a formal integrity report summarizing the state of each fix.

### Out of Scope
- School-isolation bug in `change-requests` GET/PATCH (to be tracked as a separate high-priority change).
- Fixing the two failing profile-payment validation tests in `tests/api/staff-users-payroll-phase2.test.ts` (422 vs 200 drift).
- Lazy-load of the `change-requests` slice.
- Capability matrix realignment (owner-only UI vs owner+manager backend).
- Adding Playwright E2E coverage for payroll.
- Any refactor of `payment-models/[modelId]` route to add a GET endpoint.

## Capabilities

### New Capabilities
None

### Modified Capabilities
None

## Approach

This is an AUDIT change focused on verification and regression testing. No production code will be modified unless necessary to fill a regression test gap. Net-new code is restricted to adding regression tests for currently untested fixes. 

**Decision on Fix #3**: We will close fix #3 (403 tolerance in config panel) as "obsoleted by panel refactor" with no new work. The active approvals flow in `StaffUsersAdminClient` uses explicit auth-failure handling (`handleStaffAuthFailure`), so porting the 403-tolerance behavior would constitute unnecessary scope creep and diverge from current error handling patterns.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `tests/front/` | Modified | Add UI regression test for overflow and no-store assertions. |
| `tests/api/` | Modified | Add API tests asserting no-store behavior for missing endpoints. |
| `docs/specs/payroll-flow-integrity-audit/` | New | Integrity report (`integrity-report.md`) generated during archive. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Multi-tenant isolation bug in change-requests | High | Explicitly mark out-of-scope; track as a separate critical change. |
| Test drift in profile payment validation | Medium | Acknowledge failures; track as a separate follow-up task. |
| Capability asymmetry between UI and backend | Low | Document as a design consideration for future cleanup. |

## Rollback Plan

Revert the commits adding the new regression tests and remove the integrity report document if the audit needs to be aborted.

## Dependencies

- None

## Success Criteria

- [ ] All 5 fixes have a clear, documented disposition (present-and-tested, present-and-now-tested, or closed-as-obsolete).
- [ ] Targeted payroll Vitest suite is green, excluding the 2 known out-of-scope failing profile-payment tests.
- [ ] New regression tests are merged for previously identified gaps.
- [ ] Integrity report artifact is committed and finalized during the archive phase.