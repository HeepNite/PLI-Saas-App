# Profile Promotion Quote Preload

## Goal

Keep authenticated profile promotion validation server-authoritative while preventing the Packages screen from rendering until its quote is ready, so the first visible Drop-in and Summary prices are already discounted.

## Confirmed Behavior Gap

- `/client-profile` now resolves the correct authoritative Heritage price, but the Packages screen briefly shows `Updating price` while the quote request completes.
- Authentication identifies the profile user, but current entitlement, promotion, occurrence, and checkout shape still require server validation.
- The user selected modal-only behavior: date tiles remain unchanged; Packages becomes visible only after the applicable quote is ready.

## Contract

- Keep the existing authenticated profile quote request as the single source; do not duplicate pricing logic in `ProfilePageClient` or date tiles.
- For quote-eligible profile Drop-in, render a modal-level loading state instead of Packages until the quote is ready.
- On quote failure, show a clear retry state; retry must reuse the same bounded request path and avoid parallel requests.
- The first visible Packages render must show the authoritative quote, not `Updating price` or local `$20`.
- Package/ineligible/public/kiosk flows retain their current immediate rendering.
- Final `/api/profile/checkout/session` independently revalidates and remains payment authority.

## Tasks

- [x] 1. Reconcile the active course-promotions spec with modal-only quote preload and retry behavior.
  - Status: complete
  - Verification: independent contract review and `git diff --check` passed.
  - Evidence: date tiles remain unchanged; EnrollModal keeps sole quote ownership; eligible Packages waits for readiness; retry is serialized/stale-safe; non-profile flows and final session authority remain unchanged.
- [x] 2. Gate eligible profile Packages on quote readiness and add bounded retry behavior.
  - Status: complete
  - Method: test-first (RED → GREEN → refactor)
  - RED: the modal gate module did not exist, retry was unavailable, and the anti-stale readiness contract was absent.
  - GREEN: modal-level loading/error/retry, one-request retry serialization, request-ID/unmount guards, package bypass, and payload-subject readiness all pass focused coverage.
  - Verification: 110-test preload regression and typecheck passed for the initial slice; 72 focused and 84 adjacent tests plus typecheck passed for the anti-stale follow-up; both diffs passed `git diff --check`.
  - Commits: `cb03097d09ce2396b66801643134a011386dc864` (162 lines) and `f9fe3ae3e89096e30e73b963f6306857c8657278` (83 lines).
  - Native review: `review-120c9255980a8aa3` approved the preload and identified an informational stale-quote risk; `review-8db522b40bf86caa` approved the separate anti-stale follow-up. Both approvals were acknowledged and burned.
- [ ] 3. Run regression, native review, and prepare bounded delivery candidates.
  - Status: in progress
  - Verification: focused suites, typecheck, scoped lint, production build, `git diff --check`

## Constraints

- Base: `origin/codex/develop@1de889ac4894a097e2562e399e74467f23731bf3`.
- Branch: `fix/profile-promotion-quote-preload`.
- Worktree: `/Users/marianobarrionuevo/WebstormProjects/PLI-Saas-App-worktrees/profile-promotion-quote-preload`.
- Keep every work unit and prospective PR below 400 changed lines; use approved issue `#539` and exactly one `type:*` label if later published.
- No push, PR, merge, manual deploy, Stripe creation, payment completion, catalog mutation, or database mutation without separate authorization.

## Evidence

- User confirmed the desired behavior: do not add prices to date tiles; resolve the authenticated profile quote when opening booking and show Packages only when the quote is ready.
- Existing quote effect already owns Clerk token refresh, authoritative payload, request IDs, stale-result rejection, and unmount cleanup.
