# Course Promotions

## Goal

Add a reusable, server-authoritative Promotions step to the course wizard and use it for the October 2026 delivered-Heritage-pin benefit on the new Thursday Bachata and Sunday Cuban Salsa courses.

## Contract

- A course may own multiple promotions.
- Promotions support fixed-price and percentage pricing.
- Each promotion selects purchase-date or class-date windows in `America/New_York`.
- Initial audiences are everyone and delivered Heritage pin holders.
- Channels are independently selectable for public booking, profile, and trusted kiosk.
- Applicable packages take precedence; otherwise exactly one eligible price, the lowest, wins.
- Promotion labels may be public, but final price appears only after server-side identity and entitlement validation.
- Heritage promotion: US$15 fixed price, class dates from 2026-10-01 through 2026-10-31, delivered pin only, public booking and profile, for Thursday 21:10 Bachata Beginners and Sunday 17:00 Cuban Salsa — Absolute Beginners.
- Medal audiences remain future extension points until their earning authority exists.

## Tasks

- [x] 1. Reconcile the course-promotions and Heritage specifications, including migration and precedence rules.
  - Status: done
  - Checks: spec consistency, stale-contract grep, `git diff --check`, 381 changed lines
  - Commit: `6b18db1d`
- [x] 2. Add the typed promotion model, normalization, persistence contract, and server-side price resolver with focused tests.
  - Status: done
  - Checks: 23 focused tests, typecheck, `git diff --check`, 330 changed lines
  - Commit: `efa23ee4`
- [ ] 3. Add the dedicated Promotions wizard step, migrate the dormant special-discount controls, and cover UI behavior.
  - Status: omitted from the scoped production release; the public server-authoritative path does not depend on the editor.
  - Checks: not applicable to this release branch
  - Commit: not ported
- [x] 4. Integrate promotion labels and authoritative pricing into public booking, profile, and trusted checkout paths.
  - Status: done in the source chain; the scoped production port continues through the authoritative public-pricing fixes.
  - Checks: source chain passed focused checkout/booking/profile tests, typecheck, lint, and diff checks.
  - Commit: source `fadaf866`; production port `3fdad602`
- [x] 5. Prepare the Heritage promotion and reversible catalog rollout for the two new courses and package applicability.
  - Status: rollout documentation ported; remote application remains separately gated.
  - Checks: source dry-run, backup, environment proof, and rollback evidence retained.
  - Commit: source `63edf837`
- [ ] 6. Run independent verification, native review if enabled, slice PRs below 400 changed lines, deploy, request any required catalog-mutation authorization, and perform live checks.
  - Status: pending for the production release.
  - Checks: CI-equivalent verification, review evidence, deployment readiness, and live HTTP/catalog/price evidence.
  - Commit: pending

## Constraints

- Target branch: `codex/develop`.
- Every PR must remain below 400 changed lines, link `#539`, and carry exactly one `type:*` label.
- Preserve exact-phone ownership, first-purchase pricing, package reservation/consumption, remote cash restrictions, and campaign geography.
- Do not mutate Railway, Clerk, or any remote catalog without explicit authorization after dry-run evidence.
- Do not touch historical `Purchase.name = Nee saw` or unrelated identities/databases.

## Evidence

- Historical aggregate branch: `feat/course-promotions`
- Delivery tracker branch: `feat/course-promotions-chain` at cached `origin/codex/develop`
- Corrected delivery tip: `docs/course-promotions-rollout-chain`
- Slice order: contract → rules → editor → checkout → rollout
- Draft PRs: `#603` → `#604` → `#605` → `#606` → `#607`
- Each PR links approved issue `#539`, has exactly one `type:*` label, and excludes `.atl/skill-registry.md`
- Tracker PR remains deferred while its branch intentionally matches `codex/develop`
- Worktree: `/Users/marianobarrionuevo/WebstormProjects/PLI-Saas-App-worktrees/course-promotions-05-rollout`
