# Kiosk real price display

## Objective

Every price the kiosk displays (landing course card, EnrollModal drop-in / first-class / package cards) matches what checkout charges.

## Problem

- `CourseCardPanel` hardcodes `$20 drop-in` / `$15 first time`.
- `StepPackages` hardcodes `"15"` (new-student / QR compact) and `dropInPrice ?? 20` (the router never passes `dropInPrice`).
- `useEnrollDerivedState.regularServicePrice` falls back `|| 20`.
- `formatEnrollmentOptionPrice` rounds to whole dollars (`$1.50` shows as `$2`).
- Example: `salsa-timba-in-new-york-2` costs $1 but the kiosk shows $20 / $15.

## Why

Charge source of truth is `course.enrollment.services` / `course.enrollment.packages` (built by `applyCourseServicePricing` from `CourseCatalog`) plus `scheduleRules.promotions` resolved by `resolveCoursePromotionPrice` (used by checkout via `resolveCoursePromotionCheckoutPricing`). The kiosk already loads those same catalog objects (`/api/catalog/courses`), so the display can read them directly.

## Scope / constraints (owner decisions)

- No periodic polling; terminal keeps fetching today's classes only on mount/reload (untouched).
- No new pricing math: reuse `enrollment.services`/`packages` and `resolveCoursePromotionPrice`.
- Promotion shown only on the channel where checkout applies it (`trusted_kiosk` = kiosk terminal flow). Display cannot know heritage-pin entitlement (identity-bound), so heritage-only promotions are not shown pre-identification.
- Missing price => render nothing, never a fake price.
- Quick Repeat unchanged (already uses server amount).
- TDD: strict (owner request). Runner: `npx vitest run`.

## Tasks

- [x] T1 Shared display helper `resolveCourseDisplayPrices` + price formatter showing cents when needed. Route: inline (2 small files).
- [x] T2 Landing card: `CourseCardPanel` renders real drop-in / first-time prices (+ promo price and label on kiosk) from the displayed catalog course. Route: inline.
- [x] T3 EnrollModal: `StepPackages` drop-in card uses selected service price (+ kiosk promo), router passes it, remove `"15"` / `?? 20`; `regularServicePrice` loses `|| 20` (null when missing). Route: inline.

## Acceptance criteria

- $1 course shows `$1` on the card and on the EnrollModal drop-in card; packages show their real price.
- Active kiosk promotion shows its price and label on the card and drop-in card.
- No hardcoded 20/15 in these displays; missing price renders nothing.

## Checks

- `npx vitest run tests/checkin` (+ new test files)
- `npx tsc --noEmit -p .`
- `npx eslint <changed files>`
- `npx next build`
- `git diff --check`

## Progress / evidence

- T1 `97389c36` feat(pricing): display price helper. RED: module missing + `$1.50` rendered `$2`; GREEN 15/15.
- T2 `ed6dfd2f` fix(kiosk): landing card. RED: 3 CourseCardPanel + 3 useCheckInDisplayData tests failed; GREEN. Prices flow `useCheckInDisplayData.checkInCardPrices` -> controller -> `CheckInQrShell` -> `CourseCardPanel prices`.
- T3 `6533982b` fix(kiosk): enroll modal. RED: 5 StepPackages/router + 1 derived-state + 3 helper tests failed; GREEN. Fallback popups now say "regular $X price" with exact cents, or "regular price" when unknown (test updated: $49.99 no longer rounded to $50).
- Checks: `npx vitest run tests/checkin tests/promotions tests/components` 87 files / 888 tests pass; full suite 3645 pass, 1 file fails only for missing DATABASE_URL (integration, environmental); `npx tsc --noEmit -p .` 0 errors (with a worktree-local Prisma client); `npx eslint <changed>` 0 errors (18 pre-existing warnings); `npx next build` success; `git diff --check` clean.
- Not unified (follow-up): EnrollModal payments/review totals (`calculateEnrollPricing` in `useEnrollDerivedState`) do not subtract a kiosk promotion; heritage-pin promotions are identity-bound and not shown before identification.
- Engram mirror: pending (writer subagent had no Engram session).

## Next step

Owner review; push / PR remain the owner's decision. Propagate to codex/develop per repo policy.
