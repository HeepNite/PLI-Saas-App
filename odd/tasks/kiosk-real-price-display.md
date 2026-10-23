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

- [ ] T1 Shared display helper `resolveCourseDisplayPrices` + price formatter showing cents when needed. Route: inline (2 small files).
- [ ] T2 Landing card: `CourseCardPanel` renders real drop-in / first-time prices (+ promo price and label on kiosk) from the displayed catalog course. Route: inline.
- [ ] T3 EnrollModal: `StepPackages` drop-in card uses selected service price (+ kiosk promo), router passes it, remove `"15"` / `?? 20`; `regularServicePrice` loses `|| 20` (null when missing). Route: inline.

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

(pending)
