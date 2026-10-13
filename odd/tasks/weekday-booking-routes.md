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
  - Commit: `7313aab3` (`docs(booking): specify weekday booking routes`).
- [x] Implement weekday routes test-first with shared route configuration, weekday-only occurrence filtering, hidden floating chrome, and the legacy redirect.
  - RED: focused tests failed as expected for missing route configuration, weekday chrome suppression, and legacy redirect behavior.
  - GREEN: 30 focused tests passed, including all seven actual static route modules, multiple same-day classes, promotion-independent inclusion, deterministic empty state, and canonical `bookingSource=public_booking` handoff.
  - Verification: independent implementation review and scoped whitespace checks passed with no blockers.
  - Commit: `eb4c1aea` (`feat(booking): add weekday class routes`).
- [x] Verify focused tests, typecheck/lint/diff checks, and a read-only local or deployed route smoke as applicable.
  - Checks: 30 focused tests, project typecheck, focused ESLint, and base diff whitespace check passed.
  - Runtime: deterministic Playwright smoke confirmed Monday/Tuesday isolation, canonical booking handoff, legacy redirect, and ordinary `/booking`; all non-loopback requests were blocked.
  - Environment notes: standalone Prisma validation was skipped after confirming it only lacked `DATABASE_URL`; qrcode resolution and project typecheck passed.
  - Commit: `2a2e0c62` (`docs(odd): record weekday route verification`).

## Delivery Tasks

- [x] Create a conforming issue, obtain explicit approval for that exact issue, and record its stable URL.
  - Issue #631: `https://github.com/HeepNite/PLI-Saas-App/issues/631` (`status:approved`, read-back confirmed).
- [ ] Slice the feature once into two stacked PRs to `codex/develop`, each within the 400-line review budget, with exactly one `type:feature` label and clean immediate-base diffs.
  - PR 1: accepted spec plus shared weekday route configuration/filtering, booking-page support, chrome policy, and core tests.
  - PR 2: seven static routes, legacy redirect, route/UI tests, and final ODD evidence; targets PR 1 until it merges.
- [ ] Merge both PRs sequentially only after required checks pass, verify the Vercel dev deployment, and smoke `/monday`, `/tuesday`, `/monday-salsa-beginner`, and `/booking` without creating users, reservations, checkout sessions, or payments.

## Delivery Strategy

- Strategy: stacked PRs to `codex/develop`, selected by the user.
- Review budget: 400 changed lines per PR; no `size:exception` planned.
- Existing native review: implementation tree approved as `review-3edc9911722349f6`; delivery slices still require exact-candidate review as applicable.

## Non-goals

- Changing promotion eligibility, pricing, or expiration.
- Changing Clerk, checkout, or payment behavior.
- Adding a staff route-management dashboard.
- Removing ordinary `/booking` discovery.

## Evidence

- Spec reconciliation (task 1): requirements, resolution, design, and implementation plan agree that `/monday`–`/sunday` are stable New York weekday routes over the existing 90-day active public catalog, independent of promotion state; the legacy alias redirects and `/booking` remains unchanged.
- Base: `origin/codex/develop` at `4b5ddb150c9e50b5b5f5d670f96972850571cc10`.
- Worktree: `/Users/marianobarrionuevo/WebstormProjects/PLI-Saas-App-worktrees/weekday-booking-routes`.
- Task 2 implementation evidence: explicit static weekday pages consume the shared weekday configuration; weekday selection filters the existing bounded occurrence set without inspecting promotion labels; the legacy route redirects to `/monday`; all weekday routes suppress floating chrome; focused tests exercise each static page plus the canonical public booking handoff and pass 30 tests; independent verification and whitespace checks pass.
- Task 3 runtime evidence: local fixture-backed `/monday` and `/tuesday` pages rendered only matching weekday classes; `/monday-salsa-beginner` redirected; `/booking` rendered both fixture classes; selected Monday booking preserved `enroll`, `qrBooking`, date, time, duration, and `bookingSource=public_booking`; no external request was permitted.
