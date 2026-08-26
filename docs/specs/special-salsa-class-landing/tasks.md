# Special Salsa Class Landing — Tasks

## Execution Status

`IMPLEMENTED — TIMED PROMOTION, READABLE COUNTDOWN, BANNER-OPENED RESERVATION, AND PRIOR VISUAL REFINEMENT VERIFIED; OPERATIONAL GATES PENDING`

Execute work units in order. Each behavior change follows red-green-refactor, keeps focused tests with the implementation, and records the exact command/result and rollback boundary before moving on.

## Work Unit 1 — Freeze Event And Policy Contracts

### RED

- [x] Add failing tests for the event key, video path, USD 2500 price, 40 capacity, 60-minute duration, address, and 30-minute hold.
- [x] Add failing timezone tests proving `2026-08-30T20:00:00.000Z`, `2026-08-28T20:00:00.000Z`, Sunday/Friday labels, and 4:00 PM New York display under a non-New-York process timezone.
- [x] Add failing tests for countable/non-countable Purchase statuses and hold cutoff boundaries.

### GREEN / REFACTOR

- [x] Create the single fixed event configuration/policy module.
- [x] Keep the module readonly, server/client safe where required, and free of environment-dependent event facts.
- [x] Avoid a generic event abstraction; expose only behavior required by this event.

### Probable files

- `lib/special-salsa-class/config.ts`
- `tests/lib/special-salsa-class.test.ts`

### Focused verification

- `npm test -- tests/lib/special-salsa-class.test.ts`
- Runtime harness: render/format the event with process timezone set outside New York and record the exact UTC/local outputs.

### Rollback boundary

Remove the config and its tests. No runtime route or stored record depends on this unit yet.

### Implementation evidence

- `TZ=UTC npm test -- tests/lib/special-salsa-class.test.ts` — 1 file passed, 10 tests passed.
- Runtime values proved by the test: `2026-08-30T20:00:00.000Z`, `2026-08-28T20:00:00.000Z`, and both New York labels at 4:00 PM while `TZ=UTC`.

## Work Unit 2 — Implement Sessionless Identity And Atomic Holds

### RED

- [x] Add failing identity tests for existing customer, new customer, matching email/phone, one-identifier match, conflicting identifiers, and no Clerk session creation.
- [x] Add failing checkout API tests proving the special request ignores/rejects tampered amount/date/time/currency/capacity fields.
- [x] Add failing same-attempt tests proving one pending Purchase and one Stripe Session idempotency key.
- [x] Add failing same-customer/different-attempt tests for active hold and completed reservation behavior.
- [x] Add a real PostgreSQL concurrent final-spot test proving one admitted hold and one `SOLD_OUT` at 39 counted spots.
- [x] Add failing tests for stale/failed/expired/refunded holds not counting.
- [x] Add failing tests for Stripe Customer reuse/creation configuration.

### GREEN / REFACTOR

- [x] Extend account preparation or add a focused identity policy that compares independent email and phone matches before linking.
- [x] Upsert the local User without creating/authenticating a Clerk session and without returning existence metadata.
- [x] Implement bounded `Serializable` admission with `P2002`/`P2034` retries, fixed ClassSession upsert, one active customer/event hold, capacity count, and namespaced `Purchase.idempotencyKey`.
- [x] Add the exact `checkoutKind: "special-salsa-class"` branch to `POST /api/checkout/session`; preserve the generic branch unchanged.
- [x] Create/recover Stripe Checkout with the same idempotency key and the exact persisted, second-precise hold expiry, durable Customer behavior, fixed URLs, and server-only event values.
- [x] Mark the hold failed when Stripe setup fails; invalidate stale same-attempt holds and require a fresh attempt safely.
- [x] Keep the existing rate-limit behavior and `Retry-After` response.

### Probable files

- `app/api/checkout/session/route.ts`
- `lib/checkout.ts`
- `lib/clerk-users.ts` or `lib/checkout/special-class-identity.ts`
- `lib/checkout/special-class-reservation.ts`
- `tests/api/checkout-session.test.ts`
- `tests/lib/checkout-prepare.test.ts` or a focused identity test file
- `tests/integration/special-salsa-class-capacity.test.ts`

### Focused verification

- `npm test -- tests/api/checkout-session.test.ts tests/lib/checkout-prepare.test.ts`
- `npm run test:db -- tests/integration/special-salsa-class-capacity.test.ts`
- Runtime harness: two concurrent requests against a seeded 39/40 event; record response codes, one returned Checkout URL, and final counted holds.

### Rollback boundary

Disable/remove only the exact special checkout discriminator and reservation/identity helpers. Preserve generic checkout behavior and any already-created Purchase/ClassSession records.

### Implementation evidence

- `npm test -- tests/lib/special-salsa-class-identity.test.ts tests/lib/special-salsa-class-reservation.test.ts tests/api/checkout-session.test.ts` — 3 files passed, 24 tests passed.
- `npx vitest run tests/integration/special-salsa-class-capacity.test.ts --reporter=verbose` — real PostgreSQL schema created, 1 test passed; 39 active holds plus two concurrent Serializable admissions produced one admitted hold, one `SOLD_OUT`, and a final active count of 40.
- Unit conflict coverage proves bounded recovery for both Prisma `P2002` and `P2034`.

## Work Unit 3 — Fulfill Paid Sessions Without Capacity Regression

### RED

- [x] Add a failing booking test proving an existing 40-capacity special ClassSession is not reset to 12.
- [x] Add failing webhook tests proving a pending special Purchase is updated rather than duplicated.
- [x] Add failing webhook replay tests proving one Purchase and one Attendance.
- [x] Add failing failure/expiry tests proving no Attendance and a non-counting terminal Purchase state.
- [x] Add a failing test proving durable Stripe Customer ID is stored without overwriting an existing different linked customer.

### GREEN / REFACTOR

- [x] Extend Stripe metadata parsing with the minimum stable special-event fields.
- [x] Validate the special marker against fixed server configuration in the webhook.
- [x] Preserve fixed ClassSession title/start/duration/capacity/location during booking sync.
- [x] Reuse existing webhook claim, payment-intent reconciliation, Purchase upsert, and Attendance uniqueness.
- [x] Keep failure handlers unable to downgrade paid purchases.

### Probable files

- `app/api/stripe/webhook/route.ts`
- `lib/stripe-metadata.ts`
- `lib/bookings.ts`
- `tests/api/stripe-webhook-checkout-session.test.ts`
- `tests/lib/bookings.test.ts`

### Focused verification

- `npm test -- tests/api/stripe-webhook-checkout-session.test.ts tests/lib/bookings.test.ts`
- Runtime harness: replay the same signed-equivalent fixture twice and record one Purchase, one Attendance, and capacity 40.

### Rollback boundary

Remove special metadata interpretation only after all open special Stripe Sessions expire. Retain the general capacity-preservation fix if regression tests prove it is correct for existing flows.

### Implementation evidence

- `npm test -- tests/api/stripe-webhook-checkout-session.test.ts tests/lib/bookings.test.ts tests/lib/special-salsa-class-stripe-customer.test.ts` — 3 files passed, 25 tests passed.
- Replay remains guarded by the existing webhook event claim and Purchase/Attendance unique paths; special expiry/failure fixtures prove no attendance call and terminal hold status.

## Work Unit 4 — Build The Public Landing And Compact Header

### RED

- [x] Add failing component tests for compact logo/Profile header in signed-in and signed-out states.
- [x] Add failing landing tests for fixed event facts, direct three-field form, temporary video source, refund deadline, validation, pending submit, cancel message, sold-out state, and generic API errors.
- [x] Add failing accessibility tests for labels, live errors, focus movement, keyboard operation, text alternatives, and reduced-motion video behavior.
- [x] Add failing mobile-layout assertions for no horizontal overflow and usable touch targets.

### GREEN / REFACTOR

- [x] Add `/special-salsa-class` server page and metadata.
- [x] Add additive compact variants to `PublicLayout`, `Header`, and `HeaderActions`; preserve default snapshots/behavior.
- [x] Implement the focused video/event/form components from the fixed configuration.
- [x] Generate and retain one UUID attempt ID per attempt; disable submit while pending and redirect only to the API-returned Stripe URL.
- [x] Render cancel, error, sold-out, and retry states without account disclosure.
- [x] Honor reduced motion and ensure required information is textual.
- [x] Supply `public/videos/SalsaClass.mp4` or obtain the approved asset through the repository's normal asset process.

### Probable files

- `app/special-salsa-class/page.tsx`
- `components/front/special-salsa-class/*`
- `components/layouts/PublicLayout.tsx`
- `components/front/Header.tsx`
- `components/front/ui/HeaderActions.tsx`
- `public/videos/SalsaClass.mp4` (asset delivery, not source logic)
- focused component tests

### Focused verification

- `npm test -- <special-landing-component-test-files>`
- `npx eslint app/special-salsa-class components/front/special-salsa-class components/front/Header.tsx components/front/ui/HeaderActions.tsx components/layouts/PublicLayout.tsx`
- Runtime harness: keyboard-only and mobile viewport walkthrough with reduced motion enabled; record the exact outcomes.

### Rollback boundary

Remove the special route/components/asset and additive variant branches. Default public header behavior must remain byte-for-byte or behaviorally equivalent.

### Implementation evidence

- `npm test -- tests/front/special-salsa-class-landing.test.tsx` — 1 file passed, 6 tests passed.
- `PLAYWRIGHT_SPECIAL_CLASS_MOCKS=1 CI=1 npm run test:e2e -- e2e/special-salsa-class.spec.ts` — 6 Chromium scenarios passed for desktop/mobile layout, reduced motion, keyboard focus, generic API error, cancel, raced sold-out, confirmed, and finalizing outcomes.

## Work Unit 4A — Refine The Isolated Landing Presentation

### RED

- [x] Add focused signed-in coverage for real avatar, exact `My profile` label, and `/client-profile` destination.
- [x] Add focused signed-out coverage for exact `Log in` label with no fake avatar or `My profile` content.
- [x] Add focused special-header coverage for mobile logo, course search, menu trigger, and auth action composition.
- [x] Add focused hero coverage for desktop horizontal composition, mobile stacking, cover-cropped vertical video, and a `Reserve for $25` action that focuses the guest form.
- [x] Extend browser coverage to prove no overflow and the intended composition at 375, 768, 1024, and 1440 CSS pixels.

### GREEN / REFACTOR

- [x] Replace the special compact header branch with an isolated special-event variant; preserve the default branch.
- [x] Reuse existing logo, search, menu, Clerk avatar, sign-in, and profile destination behavior without adding dependencies.
- [x] Refine the landing to a high-contrast dark-cinema hero and separate guest form without changing checkout behavior.
- [x] Keep keyboard focus, reduced motion, video fallback, sold-out, cancel, and API error behavior intact.

### Focused verification

- `npm test -- tests/front/special-salsa-class-landing.test.tsx`
- `PLAYWRIGHT_SPECIAL_CLASS_MOCKS=1 CI=1 npm run test:e2e -- e2e/special-salsa-class.spec.ts`
- `npx eslint app/special-salsa-class components/front/special-salsa-class components/front/Header.tsx components/front/ui/HeaderActions.tsx components/layouts/PublicLayout.tsx tests/front/special-salsa-class-landing.test.tsx e2e/special-salsa-class.spec.ts`
- `npm run typecheck` (check-only; report baseline failures separately)
- `git diff --check`

### Rollback boundary

Revert only the special-event header/auth variant, landing presentation, focused tests, and this spec refinement. Do not change reservation, Stripe, webhook, schema, or dependency files.

### Implementation evidence

- `npm test -- tests/front/special-salsa-class-landing.test.tsx` — 1 file passed, 7 tests passed.
- `PLAYWRIGHT_SPECIAL_CLASS_MOCKS=1 PLAYWRIGHT_BASE_URL=http://localhost:3200 npm run test:e2e -- e2e/special-salsa-class.spec.ts` — 7 Chromium scenarios passed, including 375/768/1024/1440 composition and overflow checks.
- Focused ESLint and `git diff --check` — passed with no findings.
- `npm run typecheck` — remains blocked only by the pre-existing fetch mock type mismatch at `tests/checkin/checkin-qr-api.test.ts:138`; changed feature files report no type errors.

## Work Unit 4B — Suppress Redundant Floating Chrome

### RED

- [x] Add focused coverage proving the special-event layout registers floating-chrome suppression.
- [x] Add focused coverage proving the default layout leaves floating chrome visible.
- [x] Extend mobile browser coverage to prove the assistant and Home/back-to-top controls are absent from the landing and confirmation and cannot overlap the form or CTA.

### GREEN / REFACTOR

- [x] Add a declarative floating-chrome policy to `PublicLayout` and select the hidden policy from both special routes.
- [x] Add one root provider consumed by the existing global assistant and Home/back-to-top mounts.
- [x] Preserve all default-route behavior without special-route pathname checks, global CSS hiding, dependencies, or checkout changes.

### Focused verification

- `npm test -- tests/front/special-salsa-class-landing.test.tsx`
- `PLAYWRIGHT_SPECIAL_CLASS_MOCKS=1 PLAYWRIGHT_BASE_URL=http://localhost:3200 npm run test:e2e -- e2e/special-salsa-class.spec.ts`
- Focused ESLint, `npm run typecheck`, and `git diff --check`.

### Rollback boundary

Revert only the floating-chrome provider/policy wiring, the two special-route selections, focused tests, and these spec additions. Preserve the existing global controls and all checkout behavior.

### Implementation evidence

- `npm test -- tests/front/special-salsa-class-landing.test.tsx` — 1 file passed, 8 tests passed; special suppression and default visibility both proved.
- `PLAYWRIGHT_SPECIAL_CLASS_MOCKS=1 PLAYWRIGHT_BASE_URL=http://localhost:3200 npm run test:e2e -- e2e/special-salsa-class.spec.ts` — 8 Chromium scenarios passed; the special landing and both confirmation states contain no assistant/Home chrome, while `/` retains the assistant and back-to-top control.
- Focused ESLint and `git diff --check` — passed with no findings.
- `npm run typecheck` — remains blocked only by the pre-existing fetch mock type mismatch at `tests/checkin/checkin-qr-api.test.ts:138`; changed files report no type errors.
- Mobile screenshot readback at 375 CSS pixels confirms no floating control overlaps the form or either purchase action.

## Work Unit 4C — Match The Approved Course-Card References

### RED

- [x] Add component coverage proving one hero card contains direct media/details siblings and the guest form follows outside the card.
- [x] Add component coverage for the exact badge/eyebrow, real overlay metadata, approved price/chips, and live hero CTA target.
- [x] Add browser assertions for a joined 40/60 two-column card with aligned panels at 1440 CSS pixels.
- [x] Add browser assertions for media-first stacking, 320–380 CSS-pixel media height, form-after-card order, and no overflow at 375 CSS pixels.
- [x] Prove `Reserve for $25` focuses Name from the joined hero card.

### GREEN / REFACTOR

- [x] Recompose only `SpecialSalsaClassLanding` hero/media markup as one responsive card matching the approved references.
- [x] Preserve guest form behavior, header/auth behavior, floating-chrome suppression, and all approved event facts.
- [x] Do not add reference-only rating, reviews, stars, instructor, level, popularity, or open-group claims.

### Focused verification

- `npm test -- tests/front/special-salsa-class-landing.test.tsx`
- `PLAYWRIGHT_SPECIAL_CLASS_MOCKS=1 PLAYWRIGHT_BASE_URL=http://localhost:3200 npm run test:e2e -- e2e/special-salsa-class.spec.ts`
- Focused ESLint, candidate typecheck, `git diff --check`, and temporary 1440x900/375x812 screenshot readback.

### Rollback boundary

Revert only the hero/media/details composition, its focused tests, and these spec additions. Preserve floating-chrome suppression, header/auth behavior, form/checkout behavior, and all backend files.

### Implementation evidence

- `npm test -- tests/front/special-salsa-class-landing.test.tsx` — 1 file passed, 10 tests passed.
- `npx playwright test e2e/special-salsa-class.spec.ts --project=chromium` — 7 Chromium scenarios passed and 2 database-dependent confirmation scenarios were skipped.
- Focused ESLint and `git diff --check` — passed with no findings.
- `npm run typecheck` — remains blocked only by the pre-existing fetch mock type mismatch at `tests/checkin/checkin-qr-api.test.ts:138`; changed feature files report no type errors.
- Temporary screenshot readback at 1440x900 and 375x812 confirms one joined 40/60 desktop card, one media-first mobile card, readable overlays, the external form order, and no floating-control overlap.

## Work Unit 4D — Finalize The Details-Panel Hierarchy

### RED

- [x] Add component coverage proving the date/address facts row precedes the price/purchase row in DOM order.
- [x] Add component and browser coverage proving each semantic row keeps its children side by side without overflow.
- [x] Prove the hero contains no secondary details action and `Reserve for $25` still focuses Name.

### GREEN / REFACTOR

- [x] Move date/address above the price and group both facts in one responsive row.
- [x] Group `$25` before `Reserve for $25` in one responsive purchase row.
- [x] Remove the secondary details action, its focus handler/ref, and all dead supporting code without changing the card, form, header/auth, floating chrome, or checkout behavior.

### Focused verification

- `npm test -- tests/front/special-salsa-class-landing.test.tsx`
- `npx playwright test e2e/special-salsa-class.spec.ts --project=chromium`
- Focused ESLint, candidate typecheck, `git diff --check`, and temporary 1440x900/375x812 screenshot readback.

### Rollback boundary

Revert only the details-panel row composition, its focused tests, and this final spec refinement.

### Implementation evidence

- `npm test -- tests/front/special-salsa-class-landing.test.tsx` — 1 file passed, 10 tests passed.
- `npx playwright test e2e/special-salsa-class.spec.ts --project=chromium` — 7 Chromium scenarios passed and 2 database-dependent confirmation scenarios were skipped.
- Focused ESLint and `git diff --check` — passed with no findings.
- `npm run typecheck` — remains blocked only by the pre-existing fetch mock type mismatch at `tests/checkin/checkin-qr-api.test.ts:138`; changed candidate files report no type errors.
- Temporary 1440x900 and 375x812 screenshot readback confirms facts before purchase, side-by-side rows, one hero CTA, and no horizontal overflow or floating-control overlap.

## Work Unit 4E — Finalize Visible Copy And Compact Facts

### RED

- [x] Add component coverage for `Salsa de Cali`, the accessible video title, two-line date/time copy, and absence of visible `America/New_York`.
- [x] Add component and browser coverage proving two equal facts blocks remain in one two-column row at 1440 and 375 CSS pixels.
- [x] Add component and browser coverage proving the purchase row uses space-between and a compact non-growing CTA at 375 CSS pixels.

### GREEN / REFACTOR

- [x] Add customer-facing display copy without changing the stable event key, slug, internal title, timezone, or UTC instants.
- [x] Render date and time on separate lines and remove the raw IANA identifier from landing and confirmation copy.
- [x] Convert facts to an equal two-column grid and make the purchase CTA compact without changing focus or checkout behavior.

### Focused verification

- `npm test -- tests/front/special-salsa-class-landing.test.tsx tests/lib/special-salsa-class.test.ts tests/lib/special-salsa-class-confirmation.test.tsx`
- `npx playwright test e2e/special-salsa-class.spec.ts --project=chromium`
- Focused ESLint, candidate typecheck, `git diff --check`, and temporary 1440x900/375x812 screenshot readback.

### Rollback boundary

Revert only customer-facing display copy, date formatting, facts/purchase layout, focused tests, and this final spec refinement.

### Implementation evidence

- `npm test -- tests/front/special-salsa-class-landing.test.tsx tests/lib/special-salsa-class.test.ts tests/lib/special-salsa-class-confirmation.test.tsx` — 3 files passed, 28 tests passed.
- `npx playwright test e2e/special-salsa-class.spec.ts --project=chromium` — 7 Chromium scenarios passed and 2 database-dependent confirmation scenarios were skipped.
- Focused ESLint and `git diff --check` — passed with no findings.
- `npm run typecheck` — remains blocked only by the pre-existing fetch mock type mismatch at `tests/checkin/checkin-qr-api.test.ts:138`; changed candidate files report no type errors.
- Temporary 1440x900 and 375x812 screenshot readback confirms `Salsa de Cali`, two equal facts blocks in one row, two-line date/time, compact space-between purchase controls, and no visible raw IANA timezone or horizontal overflow.

## Work Unit 4F — Add Static Map Thumbnail And Compact Facts

### RED

- [x] Add component coverage for exact hero `Reserve here`, absence of hero `Reserve for $25`, local map image accessibility, approved Apple Maps link attributes, date copy, and compact two-column facts structure.
- [x] Add browser coverage proving the local thumbnail and readable attribution are visible, the address link is semantically correct, facts stay equal/compact in two columns at 1440 and 375 CSS pixels, and the hero CTA still focuses Name.
- [x] Add deterministic PNG signature and 1200×800 dimension verification.

### GREEN / REFACTOR

- [x] Generate the initial static map asset once through a temporary external MapLibre renderer using OpenFreeMap geometry, no symbol layers, one PLI marker, and visible attribution; remove the renderer afterward. Work Unit 4I supersedes its filename and render.
- [x] Replace the address fact with the linked local thumbnail and reduce both fact blocks to the same bounded compact height.
- [x] Change only the hero CTA copy to `Reserve here` while preserving its compact placement and focus behavior.

### Focused verification

- `npm test -- tests/front/special-salsa-class-landing.test.tsx tests/lib/special-salsa-class.test.ts tests/lib/special-salsa-class-confirmation.test.tsx`
- `npx playwright test e2e/special-salsa-class.spec.ts --project=chromium`
- PNG signature/dimension check, focused ESLint, candidate typecheck, `git diff --check`, and 1440x900/375x812 screenshot readback.

### Rollback boundary

Revert only the generated PNG, address thumbnail/link, compact facts sizing, hero CTA copy, focused tests, and this final spec refinement.

### Implementation evidence

- `npm test -- tests/front/special-salsa-class-landing.test.tsx tests/lib/special-salsa-class.test.ts tests/lib/special-salsa-class-confirmation.test.tsx` — 3 files passed, 29 tests passed.
- `npx playwright test e2e/special-salsa-class.spec.ts --project=chromium` — 7 Chromium scenarios passed and 2 database-dependent confirmation scenarios were skipped.
- Initial PNG header verification confirmed a valid 1200×800 render (310,436 bytes); Work Unit 4I later replaces and deletes that obsolete asset.
- Focused ESLint and `git diff --check` — passed with no findings.
- Temporary 1440×900 and 375×812 screenshot readback confirms equal compact fact cards, one centered PLI marker, the complete attribution, unobstructed address copy, compact `Reserve here` placement, and no horizontal overflow.

## Work Unit 4G — Improve Map Legibility And Facts Balance

### RED

- [x] Add component coverage for the image/caption split, pin semantics, attribution below the facts grid, absence of attribution inside the map link, keyboard-only focus styling, and equal compact heights.
- [x] Add browser geometry coverage for equal 104–132 CSS-pixel cards, image above caption, attribution outside and below the grid, no truncation/overflow, and exact 1440/375 layouts.
- [x] Update deterministic PNG verification for the regenerated dimensions and non-empty image.

### GREEN / REFACTOR

- [x] Regenerate the local PNG with the clearer OpenFreeMap `liberty` or `positron` style, useful street labels, filtered non-navigation labels, closer framing, and one 44–56 CSS-pixel haloed PLI marker; remove the external renderer.
- [x] Split the address link into a map image and solid pin/address caption without overlaid text, and use neutral default/hover styling with a pink `focus-visible` ring only.
- [x] Vertically balance the date card and render linked attribution immediately below the facts grid, outside both fact cards.

### Focused verification

- `npm test -- tests/front/special-salsa-class-landing.test.tsx tests/lib/special-salsa-class.test.ts tests/lib/special-salsa-class-confirmation.test.tsx`
- `npx playwright test e2e/special-salsa-class.spec.ts --project=chromium`
- PNG signature/dimension check, focused ESLint, candidate typecheck, `git diff --check`, and 1440×900/375×812 screenshot readback.

### Rollback boundary

Revert only the regenerated PNG, address/date fact composition, external attribution row, focused tests, and this visual correction.

### Implementation evidence

- OpenFreeMap `liberty` was selected over `positron` after side-by-side rendering because its roads and building outlines remain clearer against the dark event card. The final 1200×700 PNG preserves eight road-label layers, hides 17 non-navigation symbol layers, contains one haloed PLI marker, and is 186,375 bytes.
- `npm test -- tests/front/special-salsa-class-landing.test.tsx tests/lib/special-salsa-class.test.ts tests/lib/special-salsa-class-confirmation.test.tsx` — 3 files passed, 29 tests passed.
- `npx playwright test e2e/special-salsa-class.spec.ts --project=chromium` — 7 Chromium scenarios passed and 2 database-dependent confirmation scenarios were skipped.
- Focused ESLint, PNG signature/dimension validation, temporary-renderer removal, and `git diff --check` — passed.
- `npm run typecheck` — remains blocked only by the pre-existing fetch mock mismatch at `tests/checkin/checkin-qr-api.test.ts:138`; the changed candidate files report no additional error.
- Temporary 1440×900 and 375×812 screenshot readback confirms the lighter map, prominent marker, image/caption separation, balanced equal-height cards, external one-line attribution, neutral resting border, and no overflow or truncation.

## Work Unit 4H — Replace Date Fact With Informational Calendar

### RED

- [x] Add component coverage for the exact August 2026 Sunday-first 42-cell arrangement, day 1 in the Saturday column, day 30 in the Sunday column, and exactly one highlighted day.
- [x] Prove the month grid is decorative/non-interactive and one semantic time element exposes `2026-08-30T16:00:00-04:00` with the exact accessible event label.
- [x] Add browser coverage proving calendar/map cards remain equal, side by side, 166–184 CSS pixels high, and overflow-free at 1440 and 375 CSS pixels while existing map, attribution, hero CTA, and form focus behavior remain intact.

### GREEN / REFACTOR

- [x] Replace only the date fact content with the compact `August 2026` mini calendar and class-information footer.
- [x] Highlight only day 30 visually, keep the month grid decorative, and expose the event through one accessible time element.
- [x] Increase both fact cards to the same compact height and allow the existing map image area to grow while preserving its caption and external attribution.

### Focused verification

- `npm test -- tests/front/special-salsa-class-landing.test.tsx tests/lib/special-salsa-class.test.ts tests/lib/special-salsa-class-confirmation.test.tsx`
- `npx playwright test e2e/special-salsa-class.spec.ts --project=chromium`
- Focused ESLint, candidate typecheck, `git diff --check`, and 1440×900/375×812 screenshot readback.

### Rollback boundary

Revert only the informational calendar markup, equal fact-card height adjustment, focused tests, and this visual refinement. Preserve the map asset/link/caption/attribution and all purchase behavior.

### Implementation evidence

- `npm test -- tests/front/special-salsa-class-landing.test.tsx tests/lib/special-salsa-class.test.ts tests/lib/special-salsa-class-confirmation.test.tsx` — 3 files passed, 30 tests passed.
- `npx playwright test e2e/special-salsa-class.spec.ts --project=chromium` — 7 Chromium scenarios passed and 2 database-dependent confirmation scenarios were skipped.
- Focused ESLint and `git diff --check` — passed with no findings.
- `npm run typecheck` — remains blocked only by the pre-existing fetch mock mismatch at `tests/checkin/checkin-qr-api.test.ts:138`; the changed candidate files report no additional error.
- Temporary 1440×900 and 375×812 screenshot readback confirms the correct Sunday-first August 2026 hierarchy, one highlighted 30, equal 176 CSS-pixel fact cards, the preserved map/caption/attribution, and no overflow.

## Work Unit 4I — Bust Map Cache And Enlarge Fact Cards

### RED

- [x] Add component coverage for exact `/images/salsa-de-cali-map-v2.png` usage, absence of the obsolete source/path, and valid versioned PNG dimensions.
- [x] Add component/browser measurements proving both cards are equal and 204–224 CSS pixels high, calendar type/cells/highlight are larger than the prior version, and the caption is 34–38 CSS pixels.
- [x] Prove a fresh browser context requests and renders the versioned light asset, attribution remains visible, and 375/1440 layouts do not overflow.

### GREEN / REFACTOR

- [x] Generate the closer light Liberty map at the versioned filename with one marker sized for approximately 64–72 CSS pixels in the desktop thumbnail; remove the temporary renderer and obsolete PNG.
- [x] Increase both fact cards to approximately 216 CSS pixels, grow the map image while preserving its caption/attribution, and increase calendar header/weekdays/days/highlight/footer proportionally.
- [x] Preserve the joined hero, price/CTA row, Apple Maps link, form behavior, header, and all backend behavior.

### Focused verification

- `npm test -- tests/front/special-salsa-class-landing.test.tsx tests/lib/special-salsa-class.test.ts tests/lib/special-salsa-class-confirmation.test.tsx`
- `npx playwright test e2e/special-salsa-class.spec.ts --project=chromium`
- Fresh-context asset request/readback, focused ESLint, candidate typecheck, `git diff --check`, and 1440×900/375×812 screenshots.

### Rollback boundary

Revert only the versioned map asset/path, fact-card sizing/typography, focused tests, and this cache correction. Preserve the map content contract, caption/attribution, calendar semantics, and all purchase behavior.

### Implementation evidence

- A fresh Playwright browser context with service workers blocked requested only `/images/salsa-de-cali-map-v2.png` and received `200 image/png` at both 1440×900 and 375×812; the obsolete asset was not requested and is absent from disk.
- The final Liberty PNG is a valid 1200×700 image (166,405 bytes), preserves eight road-label layers, hides 17 non-navigation symbol layers, uses zoom 17.8, and renders one haloed PLI marker at an estimated 66.1 CSS pixels in both measured thumbnail crops. The external renderer was removed.
- Browser measurements at both breakpoints confirm equal 216 CSS-pixel cards, a 178 CSS-pixel map image, 36 CSS-pixel caption, 12/9/9 CSS-pixel calendar month/weekday/day text, a 22×22 CSS-pixel highlighted 30, 10 CSS-pixel footer text, visible attribution, and no document overflow.
- `npm test -- tests/front/special-salsa-class-landing.test.tsx tests/lib/special-salsa-class.test.ts tests/lib/special-salsa-class-confirmation.test.tsx` — 3 files passed, 30 tests passed.
- `npx playwright test e2e/special-salsa-class.spec.ts --project=chromium` — 7 Chromium scenarios passed and 2 database-dependent confirmation scenarios were skipped.
- Focused ESLint, PNG validation, obsolete-asset check, temporary-renderer check, and `git diff --check` — passed.
- `npm run typecheck` — remains blocked only by the pre-existing fetch mock mismatch at `tests/checkin/checkin-qr-api.test.ts:138`; the changed candidate files report no additional error.
- Fresh-context 1440×900 and 375×812 screenshot readback confirms the light V2 map, larger legible PLI marker/calendar, preserved caption/attribution, joined hero, and stable price/CTA/form hierarchy.

## Work Unit 4J — Restore Street-Map Semantics And Enlarge Event Footer

### RED

- [x] Add focused component coverage for the semantic street-map filename, removal of the obsolete V2 asset, linked OpenStreetMap attribution, and a larger one-line `Salsa de Cali · 4:00 PM` footer.

### GREEN / REFACTOR

- [x] Generate a 1200×700 neighborhood street map with recognizable road hierarchy, geometry, labels, natural land/green/blue separation, and one prominent PLI marker; remove only the obsolete V2 asset.
- [x] Keep the 216 CSS-pixel cards and place the enlarged calendar event label and time on one line without mobile overflow.
- [x] Preserve the Apple Maps caption link, dark visual language, accessibility, joined hero, responsive two-card layout, and all checkout behavior.

### Focused verification

- `npm test -- tests/front/special-salsa-class-landing.test.tsx`
- Focused ESLint, `git diff --check`, PNG validation, and fresh 1440×900/375×812 screenshots when browser preview is available.

### Rollback boundary

Revert only the semantic map asset/path, linked attribution adjustment, calendar footer presentation, focused tests, and this correction record. Preserve every backend and unrelated dirty-worktree change.

### Implementation evidence

- RED: the focused component suite failed 3 of 12 tests on the old asset path, split footer, and missing semantic PNG.
- `npm test -- tests/front/special-salsa-class-landing.test.tsx` — 1 file passed, 12 tests passed.
- Focused ESLint and `git diff --check` — passed with no findings.
- The generated PNG is 1200×700, contains 10,869 unique colors with substantial truthful blue/green context, and the obsolete V2 asset is absent.
- Fresh Chromium readback received the semantic PNG as `200 image/png` at 1440 and 375 CSS pixels. Both fact cards remain 216 CSS pixels high; the footer is 12 CSS pixels, stays on one line with equal 141 CSS-pixel client/scroll widths at 375, and the document has no horizontal overflow.
- Fresh desktop and 375 CSS-pixel screenshots confirm recognizable labeled street geometry, natural map color separation, one prominent PLI marker, preserved caption/attribution, and a fully visible `Salsa de Cali · 4:00 PM` line.

## Work Unit 4K — Simplify Date Poster And Tighten Address Map

### RED

- [x] Add focused coverage proving there is no weekday/day grid, `30` is the dominant date element, the new close-map filename replaces the superseded street-map asset, and the address caption is larger and one-line.

### GREEN / REFACTOR

- [x] Replace the literal August calendar with a balanced date poster that fills the same 216 CSS-pixel card and preserves one accessible event time.
- [x] Regenerate the OpenStreetMap asset at a closer local zoom with a substantially smaller PLI marker; remove only the superseded street-map PNG.
- [x] Enlarge the address caption while preserving one-line mobile fit, Apple Maps behavior, attribution, equal card heights, dark styling, desktop layout, and all backend behavior.

### Focused verification

- `npm test -- tests/front/special-salsa-class-landing.test.tsx`
- Focused ESLint, `git diff --check`, PNG/obsolete-asset checks, and fresh 1440×900/375×812 Chromium screenshots with measurements and visual readback.

### Rollback boundary

Revert only the date-poster markup, closer map asset/path, address-caption sizing, focused tests, and this correction record. Preserve the Stripe expiry correction and every unrelated dirty-worktree change.

### Implementation evidence

- RED: the focused component suite failed 3 of 12 tests against the old grid structure, superseded asset path, and missing close-map PNG.
- `npm test -- tests/front/special-salsa-class-landing.test.tsx` — 1 file passed, 12 tests passed.
- Focused ESLint and `git diff --check` — passed with no findings.
- The final OpenStreetMap PNG is 1200×700 (778,677 bytes), uses the closer zoom-17 neighborhood view, and replaces the superseded wider map. Its PLI marker is approximately 114 source pixels including the halo, less than half the previous approximately 246 source-pixel badge.
- Fresh Chromium measurements at 1440 and 375 CSS pixels confirm equal 216 CSS-pixel cards, a 169 CSS-pixel flex-balanced date region, an 84 CSS-pixel `30`, zero calendar-grid nodes, a 9 CSS-pixel footer bottom inset, a 44 CSS-pixel/11 CSS-pixel one-line address caption, and no document overflow.
- Both breakpoints requested `/images/salsa-de-cali-coles-st-map.png` and received `200 image/png`; visual readback confirms the closer local map, smaller marker, dominant date, balanced card, larger address, preserved attribution, and stable desktop layout.

## Work Unit 4L — Move Guest Reservation Into An Accessible Dialog

### RED

- [x] Add focused component coverage proving the closed landing contains no inline form, `Reserve here` opens exactly one named dialog, initial focus enters the name field, safe close returns focus to the CTA, keyboard focus stays contained, and entered values survive validation/error and close/reopen cycles.
- [x] Extend the existing special-class browser coverage to prove the 375 CSS-pixel closed/open interaction, internal dialog scrolling, reachable controls, and no horizontal overflow without completing a real Stripe purchase.

### GREEN / REFACTOR

- [x] Move the existing reservation form into one landing-local portal dialog without duplicating form state, validation, submission, API, Stripe, sold-out, cancellation, or authentication-aware behavior.
- [x] Add accessible name/description, visible close, safe Escape/backdrop dismissal, initial focus, focus containment/return, background scroll protection, and active-submission dismissal protection.
- [x] Keep the mobile dialog within the dynamic viewport with an internal scroll region and preserve the centered dark PLI desktop presentation.

### Focused verification

- `npm test -- tests/front/special-salsa-class-landing.test.tsx`
- Focused special-class API/lib regression tests, focused ESLint, `git diff --check`, and fresh 1440×900/375×812 Chromium screenshots in closed/open states with measurements and visual readback.

### Rollback boundary

Revert only the reservation-dialog interaction, its focused component/E2E coverage, and this Work Unit 4L contract. Preserve all Stripe, reservation, date-poster, map, header, floating-chrome, confirmation, and unrelated dirty-worktree changes.

### Implementation evidence

- RED: `npm test -- tests/front/special-salsa-class-landing.test.tsx` failed 5 of 13 tests against the old inline form, scroll/focus action, and missing dialog semantics.
- GREEN: `npm test -- tests/front/special-salsa-class-landing.test.tsx` — 1 file passed, 14 tests passed.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3200 npx playwright test e2e/special-salsa-class.spec.ts --project=chromium` — 7 passed, 2 confirmation tests skipped behind their existing server-mock gate.
- `TZ=UTC npm test -- tests/lib/special-salsa-class.test.ts tests/lib/special-salsa-class-identity.test.ts tests/lib/special-salsa-class-reservation.test.ts tests/lib/special-salsa-class-stripe-customer.test.ts tests/api/checkout-session.test.ts` — 5 files passed, 39 tests passed.
- Focused ESLint and `git diff --check` passed with no findings.
- Fresh Chromium measurements confirm zero closed-state inline reservation forms/dialogs at 1440 and 375 CSS pixels, exactly one open dialog, initial name-field focus, hidden body overflow, `overflow-y: auto` internal content, visible close/submit controls, and document width equal to viewport width.
- The desktop dialog is centered at 512×529 CSS pixels. The 375 CSS-pixel dialog stays within 8 CSS pixels of the horizontal and bottom viewport edges at 359×545 CSS pixels. Closed/open visual readback confirms the existing hero/date/map/price/cancellation presentation remains intact, the form appears only in the dark popup, and all controls remain legible and reachable.

## Work Unit 4M — Consolidate Date Support And Center Address Copy

### RED

- [x] Add focused coverage proving the date card has no `Salsa de Cali` footer, `SUNDAY · 4:00 PM` shares one centered semantic line, supporting type is larger, the map caption is iconless/centered/larger, and the landing CTA gains only the approved 2–3 CSS-pixel text increase.

### GREEN / REFACTOR

- [x] Remove the redundant date-card footer while preserving one accessible event time and the unchanged dominant `30` inside the 216 CSS-pixel card.
- [x] Center the iconless one-line address at 13 CSS pixels without changing the close map, marker, Apple Maps link, caption height, or attribution.
- [x] Raise only the landing `Reserve here` text to 15/16 CSS pixels at the existing breakpoints and preserve the popup interaction and button geometry.

### Focused verification

- `npm test -- tests/front/special-salsa-class-landing.test.tsx`
- Relevant popup Playwright smoke, focused ESLint, `git diff --check`, and fresh 1440×900/375×812 closed-state Chromium screenshots with measurements and visual readback.

### Rollback boundary

Revert only the date support-line composition, address-caption icon/alignment/type, landing CTA typography, focused tests/E2E assertions, and this Work Unit 4M contract. Preserve the reservation dialog, Stripe correction, map asset/marker, date-card dimensions, and all unrelated dirty-worktree changes.

### Implementation evidence

- RED: `npm test -- tests/front/special-salsa-class-landing.test.tsx` failed 2 of 14 tests against the old pinned address, hidden date representation, and separate date footer.
- GREEN: `npm test -- tests/front/special-salsa-class-landing.test.tsx` — 1 file passed, 14 tests passed.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3200 npx playwright test e2e/special-salsa-class.spec.ts --project=chromium` — 7 passed, 2 existing confirmation tests skipped behind their server-mock gate.
- The focused special-class component/API/lib regression suite passed 10 files and 89 tests; focused ESLint and `git diff --check` passed with no findings.
- Fresh 1440×900 and 375×812 Chromium measurements confirm equal 216 CSS-pixel cards, 13 CSS-pixel month/support/address type, an unchanged 84 CSS-pixel `30`, one non-wrapping support line, no footer/event-name repetition, no address icon, centered fitting address copy, 16/15 CSS-pixel desktop/mobile CTA type, and an unchanged 44 CSS-pixel button height.
- Closed-state visual readback confirms balanced poster spacing, a close map with the existing small marker, readable centered address copy, and no horizontal overflow at either viewport. Opening the popup at both sizes still produced exactly one dialog and moved focus to the name field.

## Work Unit 4N — Match The Two-Line Date Reference Hierarchy

### RED

- [x] Add focused coverage proving `AUGUST 2026` and `SUNDAY AT` share the PLI red accent, `SUNDAY AT` and `4:00 PM` occupy separate centered lines, and the time remains one semantic group with no middle dot, footer, or event-name repetition.

### GREEN / REFACTOR

- [x] Apply the PLI red accent to the month while preserving its 13 CSS-pixel tracked treatment and the unchanged dominant 84 CSS-pixel `30`.
- [x] Replace the single-line support row with a compact centered vertical time group whose first line is red `SUNDAY AT` and whose second line is white `4:00 PM`.
- [x] Preserve balanced spacing inside the 216 CSS-pixel card and leave the map/address, CTA, popup, equal card heights, and checkout behavior unchanged.

### Focused verification

- `npm test -- tests/front/special-salsa-class-landing.test.tsx`
- Relevant special-class Playwright smoke, focused ESLint, `git diff --check`, and fresh 1440×900/375×812 closed-state Chromium screenshots with measurements and visual readback.

### Rollback boundary

Revert only the month accent, two-line date support grouping, focused tests/E2E assertions, and this Work Unit 4N contract. Preserve the completed Work Unit 4M address/CTA refinements, reservation dialog, Stripe correction, map asset/marker, date-card dimensions, and all unrelated dirty-worktree changes.

### Implementation evidence

- RED: `npm test -- tests/front/special-salsa-class-landing.test.tsx` failed 1 of 14 tests against the muted month and prior single-row `SUNDAY · 4:00 PM` hierarchy.
- GREEN: `npm test -- tests/front/special-salsa-class-landing.test.tsx` — 1 file passed, 14 tests passed.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3200 npx playwright test e2e/special-salsa-class.spec.ts --project=chromium` — 7 passed, 2 existing confirmation tests skipped behind their server-mock gate.
- The focused special-class component/API/lib regression suite passed 10 files and 89 tests; focused ESLint and `git diff --check` passed with no findings.
- Fresh 1440×900 and 375×812 Chromium measurements confirm the 13 CSS-pixel month and `SUNDAY AT` use `rgb(251, 113, 133)`, `4:00 PM` uses `rgb(248, 250, 252)`, both support labels are separate centered lines, the `30` remains 84 CSS pixels, and top/bottom poster spacing is exactly balanced at 40.5625 CSS pixels inside the unchanged 216 CSS-pixel card.
- Both cards remain 216 CSS pixels high. The centered iconless address, 1200×700 close map/small marker, 15/16 CSS-pixel CTA text, and 44 CSS-pixel CTA height remain unchanged. Closed-state visual readback confirms no clipping or overflow, and opening the popup at both viewports still produced exactly one dialog with focus on the name field.

## Work Unit 4O — Remove The Mobile Hero-To-Quote Dead Band

### RED

- [x] Add a focused 375 CSS-pixel geometry assertion proving the quote card follows the special-event hero with a non-overlapping 24–40 CSS-pixel gap instead of the prior 144 CSS-pixel accumulated gap.

### GREEN / REFACTOR

- [x] Give the special-event `PublicLayout` an explicit compact mobile footer-top treatment that removes only the generic 32 CSS-pixel footer margin and 80 CSS-pixel quote-wrapper top padding below 768 CSS pixels.
- [x] Keep the landing section's existing 32 CSS-pixel bottom padding as the intentional mobile gap, retain quote-wrapper bottom padding, and restore all existing footer spacing at the medium breakpoint.
- [x] Preserve default/compact layouts, desktop composition, event/date/map/address/CTA/popup content, quote styling, footer, accessibility, and checkout behavior without negative margins, overlap, or horizontal overflow.

### Focused verification

- `npm test -- tests/front/special-salsa-class-landing.test.tsx`
- Relevant special-class Chromium E2E with mobile and desktop geometry, focused ESLint, `git diff --check`, and fresh 375×812/1440×900 closed-state screenshots with measured before/after gap and visual readback.

### Rollback boundary

Revert only the special-event compact mobile footer-top flag, its responsive `FooterQuote` spacing, focused geometry coverage, and this Work Unit 4O contract. Preserve all completed event-card, date/map/address/CTA/popup/Stripe/checkout changes and unrelated dirty-worktree work.

### Implementation evidence

- RED: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3200 npx playwright test e2e/special-salsa-class.spec.ts --project=chromium --grep "mobile hero keeps"` failed because the measured hero-to-quote gap was 144 CSS pixels, exceeding the 40 CSS-pixel maximum.
- GREEN: the same focused mobile geometry test passed after reducing the gap to 32 CSS pixels with no overlap.
- `npm test -- tests/front/special-salsa-class-landing.test.tsx` — 1 file passed, 14 tests passed. The focused component/API/lib regression suite passed 10 files and 89 tests.
- Full special-class Chromium E2E passed 7 tests with 2 existing confirmation tests skipped behind their server-mock gate. Focused ESLint and `git diff --check` passed with no findings.
- Before the fix at 375 CSS pixels, the 144 CSS-pixel gap consisted of 32 CSS pixels of landing-section bottom padding, 32 CSS pixels of footer margin, and 80 CSS pixels of quote-wrapper top padding. After the fix, only the intentional 32 CSS-pixel section padding remains; footer margin and quote top padding both measure zero.
- Desktop measured 224 CSS pixels before and after the correction: 64 CSS pixels of section padding, 48 CSS pixels of footer margin, and 112 CSS pixels of quote top padding. Fresh visual readback confirms the mobile dead band is gone, the quote does not overlap the hero, desktop composition is unchanged, document width equals viewport width, and the popup still opens once with focus on the name field.

## Work Unit 4P — Integrate The Map With The Dark Card

### RED

- [x] Add focused coverage proving the existing map `<Image>` alone receives an 82% brightness treatment while its source, accessible description, address caption, attribution, and card geometry remain unchanged.

### GREEN / REFACTOR

- [x] Add only `brightness-[0.82]` to the existing map image presentation classes; do not regenerate the asset or add grayscale, desaturation, wrapper opacity, or overlays.
- [x] Preserve recognizable roads, labels, neighborhood context, the small PLI marker, close zoom, Apple Maps link, centered address, attribution, equal 216 CSS-pixel cards, responsive layout, and all popup/checkout behavior.

### Focused verification

- `npm test -- tests/front/special-salsa-class-landing.test.tsx`
- Relevant special-class Chromium smoke, focused ESLint, `git diff --check`, and fresh 375×812/1440×900 closed-state screenshots compared with the immediately previous spacing-correction screenshots.

### Rollback boundary

Revert only the map image brightness class, focused assertions, and this Work Unit 4P contract. Preserve the map asset, marker, link/caption/attribution, all completed visual refinements, popup, Stripe/checkout behavior, and unrelated dirty-worktree changes.

### Implementation evidence

- RED: `npm test -- tests/front/special-salsa-class-landing.test.tsx` failed 1 of 14 tests because the map image lacked the required `brightness-[0.82]` class.
- GREEN: the same focused component suite passed 1 file and 14 tests after adding the single map-image class.
- Chromium computed style is `brightness(0.82)` on the map image and `none` on the map frame, centered address caption, and attribution at both 375×812 and 1440×900. The local source, accessible description, 1200×700 natural size, Apple Maps URL, caption text, and attribution text remain unchanged.
- Full special-class Chromium E2E passed 7 tests with 2 existing confirmation tests skipped behind their server-mock gate. The focused component/API/lib regression suite passed 10 files and 89 tests; focused ESLint and `git diff --check` passed with no findings.
- Fresh screenshots compared with the immediately prior spacing-correction screenshots show a visibly darker map that integrates with the dark card while preserving colored road hierarchy, readable labels, neighborhood context, and the red PLI marker. The address and attribution retain their prior brightness, both fact cards remain 216 CSS pixels, mobile/desktop hero-to-quote spacing remains 32/224 CSS pixels, and the popup still opens once with focus on the name field.

## Work Unit 5 — Add Public Confirmation And Outcome Coverage

### RED

- [x] Add failing tests for paid+persisted, paid+webhook-pending, open, expired, missing, and wrong-event Stripe Sessions.
- [x] Add failing privacy assertions that confirmation output contains no email, phone, Clerk/local user ID, Stripe Customer ID, or raw metadata.
- [x] Add failing tests proving the confirmation page performs no fulfillment write.
- [x] Add failing tests for exact refund-policy copy on landing and confirmation.

### GREEN / REFACTOR

- [x] Add the server-only confirmation resolver and `/special-salsa-class/confirmation` page.
- [x] Retrieve Stripe Session by opaque ID, validate the fixed event marker, and read Purchase state.
- [x] Render confirmed/finalizing/non-confirmed states and a safe return action.
- [x] Keep `GET /api/checkout/session/status` terminal-only.

### Probable files

- `app/special-salsa-class/confirmation/page.tsx`
- `lib/checkout/special-class-confirmation.ts`
- focused confirmation tests

### Focused verification

- `npm test -- <special-confirmation-test-files> tests/api/checkout-session-status.test.ts`
- Runtime harness: success redirect with webhook intentionally delayed, then refresh after persistence; record both public states.

### Rollback boundary

Disable the public checkout branch before removing confirmation. Do not remove confirmation while paid/open Sessions can still redirect to it.

### Implementation evidence

- `npm test -- tests/lib/special-salsa-class-confirmation.test.tsx tests/api/checkout-session-status.test.ts` — 2 files passed, 13 tests passed.
- Confirmation tests exercise only Stripe retrieval and `Purchase.findUnique`; fulfillment write mocks remain untouched.

## Work Unit 6 — Cross-Boundary Regression And Operational Release

- [x] Run focused suites from Work Units 1–5.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint` in check-only mode.
- [x] Run the relevant public E2E scenario for desktop, mobile, keyboard, cancel, success, and sold-out states.
- [x] Confirm no Prisma schema/migration or dependency change exists.
- [ ] Inspect authored changed-line count and apply the review slices below.
- [ ] Verify the deployed video URL and media behavior.
- [ ] Verify live Stripe configuration and event subscriptions through approved redacted status controls; do not read or record secret values.
- [ ] Execute one controlled live purchase at the currently applicable USD 20 or USD 25 amount with owner authorization.
- [ ] Verify one paid Purchase, a ClassSession at `2026-08-30T20:00:00.000Z` with capacity 40/duration 60/address, and one Attendance.
- [ ] Verify webhook success/replay behavior and public confirmation.
- [ ] Verify cancel and 30-minute expiry release capacity.
- [ ] If cleanup is required, authorized staff processes it manually in Stripe/backoffice; do not add refund automation.
- [ ] Record go/no-go, rollback owner, and evidence without PII or secrets.

### Local verification evidence

- `TZ=UTC npm test -- tests/lib/special-salsa-class.test.ts tests/lib/special-salsa-class-identity.test.ts tests/lib/special-salsa-class-reservation.test.ts tests/lib/special-salsa-class-stripe-customer.test.ts tests/lib/special-salsa-class-confirmation.test.tsx tests/api/checkout-session.test.ts tests/api/checkout-session-status.test.ts tests/api/stripe-webhook-checkout-session.test.ts tests/lib/bookings.test.ts tests/front/special-salsa-class-landing.test.tsx` — 10 files passed, 78 tests passed.
- Focused ESLint over all changed application, test, and E2E source files — passed with no findings.
- `PLAYWRIGHT_SPECIAL_CLASS_MOCKS=1 CI=1 npm run test:e2e -- e2e/special-salsa-class.spec.ts` — 6 Chromium scenarios passed, including desktop initial/error, mobile, keyboard, cancel/raced sold-out focus, and public confirmed/finalizing confirmation focus.
- `npm run typecheck` — blocked only by the pre-existing incompatible fetch mock at `tests/checkin/checkin-qr-api.test.ts:138`; changed feature files report no type errors.
- `npm run lint` — repository-wide check remains blocked by pre-existing/generated findings; focused changed-file lint passes.
- Authored diff inspection: 3,401 additions and 18 deletions across tracked and untracked text files (3,419 changed lines), excluding the existing tracked video binary. The planned review slices remain required before delivery.

## Work Unit 7 — Lock And Present The Timed Promotion

### RED

- [x] Add exact policy tests proving 2000 cents one millisecond before `2026-08-30T14:00:00.000Z`, 2500 cents at the exact deadline, and 2500 cents afterward.
- [x] Add reservation tests proving a new pre-deadline Purchase stores 2000 cents and same-attempt recovery after the deadline preserves that amount without mutation.
- [x] Add checkout tests proving new Sessions use the server-resolved amount, recovery uses the persisted Purchase amount, and browser amount/discount/deadline input cannot influence Stripe.
- [x] Add webhook tests proving a legitimate locked 2000-cent Session fulfills after the deadline while Purchase/Session/metadata amount or currency mismatches fail before fulfillment mutation.
- [x] Add component tests proving the special route shows the exact promotion announcement, fixed-deadline countdown, `$20` hero/dialog price, and existing reservation entry before the deadline; at the deadline the promotion disappears and all live price surfaces show `$25`.
- [x] Add regression coverage proving other routes retain the generic announcement and existing pricing behavior.

### GREEN / REFACTOR

- [x] Extend the fixed event policy with regular/promotional amounts, exact discount, UTC deadline, strict boundary resolver, and allowed-amount validation.
- [x] Capture one server instant for new checkout admission, persist the resolved amount in `Purchase.amount`, and use that amount for Stripe creation and same-attempt recovery.
- [x] Echo the locked amount in server-authored Stripe metadata and validate webhook amount/currency against the linked Purchase without consulting the current wall clock.
- [x] Pass one server-rendered initial instant into the special announcement and landing, then synchronize the fixed-deadline countdown and hero/dialog price transition in the client.
- [x] Add a special-event announcement variant and CTA into the existing reservation-dialog path while preserving the generic announcement on every other route.
- [x] Keep capacity, hold/Session expiry, idempotency, cancellation, confirmation, refund, schema, dependencies, and approved visual layout unchanged.

### Probable files

- `lib/special-salsa-class/config.ts`
- `lib/checkout/special-class-reservation.ts`
- `lib/stripe-metadata.ts`
- `app/api/checkout/session/route.ts`
- `app/api/stripe/webhook/route.ts`
- `app/special-salsa-class/page.tsx`
- `components/layouts/PublicLayout.tsx`
- `components/front/ui/NotificationBar.tsx`
- `components/front/special-salsa-class/SpecialSalsaClassLanding.tsx`
- focused policy, reservation, checkout, webhook, component, and E2E tests

### Focused verification

- `TZ=UTC npm test -- tests/lib/special-salsa-class.test.ts tests/lib/special-salsa-class-reservation.test.ts tests/api/checkout-session.test.ts tests/api/stripe-webhook-checkout-session.test.ts tests/front/special-salsa-class-landing.test.tsx`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3200 npx playwright test e2e/special-salsa-class.spec.ts --project=chromium`
- Focused ESLint, candidate typecheck, `git diff --check`, and fresh active/expired 1440×900 and 375×812 screenshots.

### Rollback boundary

Revert only the promotion policy/presentation, locked-amount metadata validation, and Work Unit 7 tests after every open 2000-cent Session has expired or completed. Preserve Purchase records, webhook recognition needed by open Sessions, all prior visual work, generic announcements, and unrelated dirty-worktree changes.

### Implementation evidence

- RED was confirmed across policy/reservation, checkout, webhook, and component boundaries before each production slice.
- Final post-rendering-policy rerun: `TZ=UTC npm test -- tests/lib/special-salsa-class.test.ts tests/lib/special-salsa-class-identity.test.ts tests/lib/special-salsa-class-reservation.test.ts tests/lib/special-salsa-class-stripe-customer.test.ts tests/lib/special-salsa-class-confirmation.test.tsx tests/api/checkout-session.test.ts tests/api/stripe-webhook-checkout-session.test.ts tests/lib/bookings.test.ts tests/front/special-salsa-class-landing.test.tsx` — 9 files passed, 90 tests passed.
- Final post-rendering-policy rerun: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3200 npx playwright test e2e/special-salsa-class.spec.ts --project=chromium` — 7 Chromium scenarios passed; 2 existing server-mock confirmation scenarios skipped.
- Focused ESLint and `git diff --check` passed with no findings. `npm run typecheck` remains blocked only by the pre-existing fetch mock mismatch at `tests/checkin/checkin-qr-api.test.ts:138`; changed feature files report no additional error.
- Fresh active and client-expired screenshots at 375×812 and 1440×900 confirm the scoped promotion banner/countdown and `$20` surfaces before the deadline, no stale promotion banner and `$25` surfaces at the deadline, and unchanged hero/date/map/quote composition.

## Work Unit 8 — Refine The Special Promotion Countdown

### RED

- [x] Add deterministic formatting coverage for multi-day values, singular units, zero-unit omission, and `Less than 1 min`.
- [x] Add fake-time component coverage for minute-boundary updates and exact-deadline removal without one-second special-route rerenders.
- [x] Prove the special route has no clock icon or digital timer while the generic announcement retains both unchanged.

### GREEN / REFACTOR

- [x] Add a special-only human-readable countdown presentation while retaining the generic digital countdown path.
- [x] Schedule special countdown state updates only when the visible minute label can change and at exact expiry.
- [x] Refine special banner spacing/hierarchy for 375×812 and 1440×900 without changing dismissal, focus, CTA, pricing, checkout, or webhook behavior.

### Focused verification

- Focused banner/config/landing, checkout, reservation, and webhook regression tests.
- Relevant Chromium E2E, focused ESLint, `git diff --check`, active 375×812/1440×900 screenshots, and deterministic expired-state evidence.

### Rollback boundary

Revert only the special countdown format/scheduler, special banner presentation classes, Work Unit 8 tests, and this contract refinement. Preserve the timed pricing policy, immutable Purchase amount, Stripe validation, generic announcement, popup, event facts, map, spacing, and unrelated dirty-worktree changes.

### Implementation evidence

- RED: `TZ=UTC npm test -- tests/front/special-salsa-class-landing.test.tsx` failed 4 of 19 tests: the readable formatter/export did not exist, the special route still rendered `HH:MM:SS` and a clock icon, the human time label was absent, and the sub-minute state remained digital.
- GREEN: the same focused component suite passed 1 file and 19 tests. Fake time proves a `2 hours 10 min` label remains stable for 29,999 milliseconds, changes to `2 hours 9 min` at the next visible boundary, uses no interval, shows `Less than 1 min`, and removes the complete promotion at the exact deadline.
- Promotion regression: `TZ=UTC npm test -- tests/lib/special-salsa-class.test.ts tests/lib/special-salsa-class-identity.test.ts tests/lib/special-salsa-class-reservation.test.ts tests/lib/special-salsa-class-stripe-customer.test.ts tests/lib/special-salsa-class-confirmation.test.tsx tests/api/checkout-session.test.ts tests/api/stripe-webhook-checkout-session.test.ts tests/lib/bookings.test.ts tests/front/special-salsa-class-landing.test.tsx` passed 9 files and 92 tests, including pricing boundary, immutable recovery, and post-deadline webhook fulfillment coverage.
- Chromium E2E passed 7 scenarios with 2 existing server-mock confirmation skips. It proves the special banner has readable unit text, no clock/digital timer, no mobile overflow, a height no greater than 100 CSS pixels, and an unchanged reservation CTA; the default route retains its clock icon, digital timer, and generic CTA.
- Focused ESLint and `git diff --check` passed. Repository typecheck remains blocked only by the pre-existing fetch mock mismatch at `tests/checkin/checkin-qr-api.test.ts:138`.
- Active screenshots at 375×812 and 1440×900 show a compact two-row mobile hierarchy and one-row desktop hierarchy. The mobile banner is 96.5 CSS pixels versus the prior digital banner's approximately 108 CSS pixels; desktop is 52 CSS pixels. Deterministic expired screenshots contain no banner or USD 20 claim, render `$25`, and have no horizontal overflow.

## Work Unit 9 — Connect Banner Intent To The Existing Dialog

### RED

- [x] Add component coverage for direct `reserve=1`, exactly one dialog, Name focus, transient-query consumption, and unrelated-query preservation.
- [x] Add browser coverage for banner click, actual banner-opener focus return, repeated landing/banner entry, and Back/Forward safety.
- [x] Preserve deterministic expired-state coverage proving no banner entry point while the regular-price landing CTA still opens the dialog.

### GREEN / REFACTOR

- [x] Observe the existing query contract inside the landing client and open only its existing reservation dialog.
- [x] Consume only `reserve=1` through same-route Next.js replacement without page reload or unrelated query loss.
- [x] Return focus to the connected actual opener, with the landing CTA as the direct-URL fallback.

### Focused verification

- Focused popup/banner/config/checkout/reservation/webhook regression tests.
- Mobile and desktop Chromium interaction checks, focused ESLint, `git diff --check`, candidate typecheck/scoped equivalent, and fresh banner-opened dialog screenshots.

### Rollback boundary

Revert only transient reservation-intent handling, actual-opener focus return, Work Unit 9 tests, and this contract refinement. Preserve the banner href/copy/countdown, existing dialog/form, promotion policy, Purchase lock, checkout/webhook behavior, and all approved visuals.

### Implementation evidence

- RED component evidence: `TZ=UTC npm test -- tests/front/special-salsa-class-landing.test.tsx` ran 21 tests with 2 failures and 19 passes because close did not consume `reserve=1` or preserve unrelated query parameters.
- RED browser evidence: the focused mobile/desktop banner checks failed because the hard-coded href dropped `campaign=social`; after query wiring, the keyless preview sometimes stripped `reserve=1` before the landing could observe it and navigation could replace the clicked anchor before focus return.
- GREEN: the focused component suite passed 1 file and 21 tests. The final special regression passed 9 files and 94 tests, including promotion boundary, immutable recovery, checkout tamper resistance, post-deadline USD 20 webhook fulfillment, popup validation, and focus behavior.
- Full Chromium special-class E2E passed 11 scenarios with 2 existing confirmation scenarios skipped behind their server-mock gate. Mobile and desktop prove immediate banner entry, one dialog, Name focus, actual-opener return, repeated banner/landing entry with retained values, direct URL consumption, unrelated-query preservation, refresh safety, Back/Forward safety, and expired-banner/regular-price landing behavior.
- Focused ESLint and `git diff --check` passed. Full candidate typecheck remains blocked only by the pre-existing fetch mock mismatch at `tests/checkin/checkin-qr-api.test.ts:138`; no candidate file reports another error.
- Fresh banner-opened screenshots at 375×812 and 1440×900 show the complete existing dialog without scrolling: visible close control, Name/Phone/Email, `Reserve for $20`, availability, and refund copy. Mobile dialog geometry is 545 CSS pixels high with a 438/438 scroll client/content height; desktop is 529 CSS pixels high with 418/418, so no additional scrolled capture is required.

## Work Unit 10 — Integrate Attribution Into The Map Footer

### RED

- [x] Add focused component coverage proving exactly one OpenStreetMap attribution appears directly below the centered address inside the map card.
- [x] Prove the Apple Maps destination and OpenStreetMap attribution are distinct sibling links with no nested anchors or detached attribution below the facts row.

### GREEN / REFACTOR

- [x] Recompose only the map fact into one 216 CSS-pixel card containing an Apple Maps image/address link followed by a subordinate OpenStreetMap attribution link.
- [x] Rebalance only the map image/footer heights required to avoid clipping while preserving the address line, image brightness, close zoom, small marker, equal card height, popup, promotion, and checkout behavior.

### Focused verification

- Focused landing component tests, relevant mobile/desktop Chromium E2E, focused ESLint, `git diff --check`, and fresh closed-state 375×812/1440×900 screenshots with computed geometry and semantic readback.

### Rollback boundary

Revert only the map-card link/footer composition, focused assertions, and this Work Unit 10 contract. Preserve the map asset, date card, banner-to-popup behavior, pricing, checkout/fulfillment flow, and unrelated dirty-worktree changes.

### Implementation evidence

- RED: `TZ=UTC npm test -- tests/front/special-salsa-class-landing.test.tsx` ran 21 tests with 1 failure and 20 passes because the map card did not yet expose a distinct `data-map-link` or contain the attribution.
- GREEN: the same focused component suite passed 1 file and 21 tests after the minimal map-card composition change.
- Full special-class Chromium E2E passed 11 scenarios with 2 existing confirmation scenarios skipped behind their server-mock gate. Mobile and desktop banner scenarios still open exactly one dialog and focus Name.
- Focused ESLint and `git diff --check` passed with no findings.
- Computed mobile/desktop date and map heights remain exactly 216 CSS pixels. The address footer is 36 CSS pixels at both widths; the map image is 154 CSS pixels at 375 and 158 CSS pixels at 1440. Attribution uses 24 CSS pixels over two unclipped lines at 375 and 20 CSS pixels with a 12 CSS-pixel one-line label at 1440.
- Both viewports render exactly one attribution, zero detached attributions, two sibling external links, zero nested anchors, a one-line centered address, no document overflow, and image-only `brightness(0.82)`. Fresh closed-state screenshot readback confirms the attribution now sits directly below the address inside the dark map footer while the close zoom, small marker, date hierarchy, CTA, and surrounding layout remain visually stable.

## Work Unit 11 — Replace Hero Video And Add Confirmed Calendar Download

### RED

- [x] Add focused tests for the H.264/AAC hero video configuration and rendered MP4 source type.
- [x] Add focused tests for a confirmed-only accessible `Add to calendar` `.ics` download and its fixed event payload.

### GREEN / REFACTOR

- [x] Transcode the supplied HEVC MOV to a browser-compatible H.264/AAC MP4 using an existing local system tool, then configure the landing from the one fixed video source.
- [x] Add a dependency-free iCalendar builder and render its download action only for durable confirmed reservations.

### Focused verification

- [x] Run the focused landing, configuration, calendar, and confirmation tests, plus focused ESLint and typecheck.

### Rollback boundary

Revert only the replacement MP4, event video configuration, calendar helper/action, focused tests, and this work unit. Preserve confirmation state resolution and all checkout behavior.

### Implementation evidence

- The supplied 1080×1920 HEVC/AAC MOV is 30.67 seconds long. It was transcoded with installed `ffmpeg` to `public/Videos/special-salsa.mp4` using H.264 High/yuv420p video, AAC-LC audio, and fast-start MP4 metadata; the output is 36.5 MiB.
- `npm test -- tests/lib/special-salsa-class-calendar.test.ts tests/lib/special-salsa-class.test.ts tests/front/special-salsa-class-landing.test.tsx tests/lib/special-salsa-class-confirmation.test.tsx` — 4 files passed, 42 tests passed.
- Focused ESLint, `npm run typecheck`, and `git diff --check` — passed with no findings.

## Rollback Plan

1. Stop advertising/linking the landing.
2. Disable the exact special checkout discriminator so no new holds are admitted.
3. Leave webhook fulfillment and confirmation available until all open Sessions are paid or expired.
4. Reconcile any pending holds and paid sessions through existing Stripe/backoffice and database operations.
5. Remove special UI/config only after redirect traffic is drained.
6. Never delete paid Purchase, ClassSession, Attendance, User, or Stripe Customer records as rollback.

## Review Workload Forecast

### Estimated authored workload

| Work area | Estimated additions + deletions |
|---|---:|
| Fixed event/time/hold policy and tests | 120–170 |
| Identity, checkout branch, capacity/idempotency, integration tests | 300–390 |
| Webhook/booking preservation and tests | 180–250 |
| Landing, compact header, accessibility, component/E2E tests | 250–340 |
| Public confirmation, privacy tests, operational notes | 140–200 |
| **Total** | **990–1,350** |

The forecast **exceeds 400 authored changed lines**. Do not present the implementation as one undifferentiated review.

### Planned review slices

1. **Slice A — Fixed policy, identity, and atomic hold contract (target 350–400 lines):** Work Units 1 and the smallest independently testable portion of Work Unit 2.
2. **Slice B — Stripe session and fulfillment integrity (target 300–400 lines):** Remaining Work Unit 2 plus Work Unit 3, split again if the measured diff exceeds 400.
3. **Slice C — Public landing and compact UI (target 300–400 lines):** Work Unit 4 with its focused tests.
4. **Slice D — Public confirmation and release evidence (target 200–300 lines):** Work Units 5–6 and outcome tests.

Each slice must keep tests with behavior, record focused command results, remain rollback-safe, and avoid file-type-only commits.
