# Weekday Booking Routes

## Outcome

Provide stable `/monday` through `/sunday` public booking URLs. Each page lists every active catalog class occurring on that New York weekday within the existing 90-day horizon, regardless of whether a promotion exists or has expired.

## Accepted Decisions

- Weekday pages are schedule-driven, not promotion-driven.
- Each route displays all active public-catalog classes for its weekday.
- Existing booking, identity, checkout, and promotion-pricing behavior remains authoritative after class selection.
- `/monday-salsa-beginner` redirects to `/monday`.
- Implement seven explicit static weekday route files; invalid weekday routes must not create a broad dynamic top-level catch-all.
- A weekday with no matching classes must render a deterministic empty state.

## Tasks

- [x] Reconcile the weekday-route behavior into the active shareable-booking specification and record the accepted implementation plan.
  - Check: requirements, resolve, design, tasks, and tracker agree on seven explicit static routes, New York weekday semantics, promotion independence, a deterministic empty state, and the legacy redirect.
  - Verification: independent structural review passed; scoped `git diff --check` reported no whitespace errors.
  - Commit: recorded by the task-closing work-unit commit.
- [ ] Implement weekday routes test-first with shared route configuration, weekday-only occurrence filtering, hidden floating chrome, and the legacy redirect.
  - RED: focused tests fail for all seven routes, multiple same-day classes, promotion-independent inclusion, chrome suppression, and redirect behavior.
  - GREEN: the smallest implementation satisfies those cases while reusing the canonical booking handoff.
  - Commit: pending explicit user authorization.
- [ ] Verify focused tests, typecheck/lint/diff checks, and a read-only local or deployed route smoke as applicable.
  - Runtime: confirm at least Monday and one additional weekday render only matching classes and preserve booking links.
  - Commit: pending explicit user authorization.

## Non-goals

- Changing promotion eligibility, pricing, or expiration.
- Changing Clerk, checkout, or payment behavior.
- Adding a staff route-management dashboard.
- Removing ordinary `/booking` discovery.

## Evidence

- Spec reconciliation (task 1): requirements, resolution, design, and implementation plan now agree that `/monday`–`/sunday` are stable New York weekday routes over the existing 90-day active public catalog, independent of promotion state; the legacy alias redirects and `/booking` remains unchanged. Task remains pending parent verification/completion.
- Base: `origin/codex/develop` at `4b5ddb150c9e50b5b5f5d670f96972850571cc10`.
- Worktree: `/Users/marianobarrionuevo/WebstormProjects/PLI-Saas-App-worktrees/weekday-booking-routes`.
