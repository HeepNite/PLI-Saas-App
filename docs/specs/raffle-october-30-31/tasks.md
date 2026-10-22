# October 30–31 Raffle Tasks

## Phase 1 - Analysis

- [x] Inspect current raffle routes, seed tooling, schema, and original migration.
- [x] Reconcile the stale migration-repair premise against current `origin/codex/develop`.
- [x] Identify the independent registration-close and draw-time boundaries.

## Phase 2 - Resolution

- [x] Record two independent slugs, titles, tablet entrances, and keys.
- [x] Resolve midnight instants in America/New_York.
- [x] Mark prize data as temporary instead of inventing final prizes.
- [x] Exclude the legacy repair migration from this feature.

## Phase 3 - Plan

- [x] Define the minimal allowlisted route and configuration surfaces.
- [x] Define RED tests for both paths, cross-event isolation, invalid days, and timezone config.
- [x] Preserve existing `/rifa` with a regression test.

## Phase 4 - Implementation

- [x] Add failing route/config/visibility tests. RED: missing page/config modules plus four visibility assertions failed.
- [x] Implement the allowlisted event map and dynamic tablet route.
- [x] Add the two temporary DEV seed configs.
- [x] Extend exact raffle floating-chrome suppression to both new entrances.

## Phase 5 - Validation

- [x] Run focused tests: 3 files and 41 tests passed after the expected RED failures.
- [x] Run the relevant suite and static checks: independent relevant suite 18 files/163 tests passed; TypeScript passed after Prisma generation; full lint passed with 112 existing warnings and zero errors. A broader local run passed 198 assertions but reported two unavailable Prisma-client suites before generation; it was not used as passing evidence.
- [x] Run independent verification for the high-risk data and shared-route surfaces: READY for S2–S6 code, with S3 and live keys explicitly pending T4.
- [x] Commit the reviewable work unit: `117a689b` (`feat(raffle): prepare October event entrances`). Native assessment: high after explicit Risk item 1 escalation, independent verifier required and completed; native review not due because the 229-line candidate is under budget.
- [x] Preflight exact DEV environment and migration/schema state. Vercel CLI could not pull the encrypted branch `DATABASE_URL`; the established local DEV binding was instead identified by its sanitized fingerprint, known Latino Night data, and complete 3-table/27-column/6-index/3-FK raffle schema. Both target slugs were absent. No migration was run.
- [x] Seed and verify both independent DEV events without exposing keys. Both events were created in one transaction with zero entries, one temporary open draw each, distinct token hashes, and exact midnight instants. Raw keys were captured directly to separate macOS Keychain items and independently hash-verified.
- [x] Publish the committed route work to `codex/develop`, verify `/rifa/30` and `/rifa/31`, and record residual final-prize work. Contract PR #683 and behavior PR #684 merged with green checks; post-merge CI and CodeQL passed on `1c952535`. Deployment `dpl_8F73iNoUo3CPRMviE9MNqUtjWncr` is Ready and aliases `dev.palladiumlatin.art`.

## Phase 6 - Rehearsal Amendments

- [x] Reproduce the placeholder-video defect on the day-30 iPad rehearsal and restore the event to its official empty/open state.
- [x] Add a RED config assertion for explicit empty `videoUrl`, preserve omitted-video behavior, update both repeatable configs, and set both DEV events to the existing no-video animation. Focused result: 3 files/41 tests passed after the expected two RED assertions.
- [x] Resolve the winner attendance contract: `Showed up` confirms the pending winner; `Draw again` audits the no-show, excludes them event-wide, and reruns the same prize.
- [x] Add RED domain, route, screen-state, and tablet tests for pending confirmation, refresh recovery, idempotent exact-attempt actions, no-show audit retention, and event-wide exclusion. RED: missing attendance domain; GREEN: focused attendance/draw/UI set passed 8 files/90 tests after correction.
- [x] Add the `RaffleDrawAttempt` model and additive migration, guarded attendance domain/route, and draw integration. The new migration was applied surgically to DEV and marked through Prisma without replaying the historical raffle migration.
- [x] Add refresh-safe `Showed up` / `Draw again` tablet controls and replay the animation for a reroll.
- [x] Run focused checks, relevant suite, typecheck, lint, differential checks for omitted/explicit video config, and independent high-risk verification. Relevant raffle suite passed 17 files/181 tests; TypeScript passed; full lint had zero errors and 114 warnings, followed by clean focused ESLint. Independent verification found legacy replay and pending-winner exclusion regressions; both were corrected and pinned with focused tests. Prisma validate passed with the DEV environment.
- [x] Deploy to DEV, rehearse both days visibly, and restore exact official state. Day 30 and day 31 each proved audited no-show/confirmation behavior; the final S12 contract intentionally restores clean draws to `draft` rather than `open`.

## Phase 7 - Tablet Prize Authoring

- [x] Resolve the product contract: prizes are authored independently on each tablet before live drawing, and an explicit `Start raffle` action permanently locks the list.
- [x] Add RED domain and API tests for add/edit/remove/reorder persistence, revision conflicts, start locking, malformed input, authorization, and unchanged registrations/schedules on rejection. RED: missing domain/route; GREEN: 2 files/18 tests.
- [x] Implement all-draft `RaffleDraw` replacement and atomic draft-to-open start without another migration. Delivered through PRs #701 and #705.
- [x] Add RED screen-state, reducer, and tablet tests for refresh-safe editing, ordering controls, explicit start confirmation, post-start lock, and existing live-screen behavior. Expected RED failures were observed for setup payload, setup phase, editor wiring, polling preservation, and ordered server progression.
- [x] Implement the tablet prize editor and setup phase, then run focused checks, the relevant suite, TypeScript, lint, and independent high-risk verification. Delivered through PRs #706 and #708. Relevant raffle suite passed 19 files/199 tests; TypeScript and focused ESLint passed. Independent verification found polling overwrite and missing ordered progression; both were corrected and independently validated.
- [x] Convert both clean October DEV placeholder draws to `draft`, deploy through reviewable PR slices, author multiple prizes visibly, start, draw in order, and restore exact official state. Day 31 visibly persisted three ordered prizes and completed one audited `no_show` plus three `confirmed` attempts across all three prizes. Guarded cleanup restored both events to one clean editable draft at the official schedule; independent verification returned READY.

## Operational Evidence

- DEV database fingerprint: `f50dcba1162d9a0efe1624c4a6d147e1dd326f1d7cf57f46704d3e43ed5d8aee` (sanitized; no connection details stored).
- Existing DEV identity signal: Latino Night present with 22 entries and 5 draws at preflight.
- October 30 event: `2026-10-30T04:00:00.000Z`, draw `2026-10-31T04:00:00.000Z`, zero entries, one open temporary draw.
- October 31 event: `2026-10-31T04:00:00.000Z`, draw `2026-11-01T04:00:00.000Z`, zero entries, one open temporary draw.
- Keychain services: `pli-dev-raffle-october-30-2026` and `pli-dev-raffle-october-31-2026`; both readable, distinct, and matched the stored hashes without exposing raw values.
- Live generic routes: both `/raffle/<slug>` pages returned 200 with the exact title and entry form; both unauthenticated screen-state requests returned 404.
- Live tablet entrances: `/rifa/30` and `/rifa/31` each returned 200 with the correct title and password form. Each Keychain token completed the existing exchange, issued only its slug-scoped Secure cookie, reached the clean staff screen, and loaded screen-state 200 with zero entries, one open draw, and the exact midnight instant.
- Isolation: the October 30 token against the October 31 exchange returned 404. Raw keys were not printed, committed, or stored in evidence.
- Delivery: issue #682 is approved; PR #683 (265 lines) and PR #684 (262 lines) passed size, tests, typecheck, lint, secret scan, CodeQL, and Vercel checks and merged to `codex/develop`. Post-merge CI also passed.
- Residual product input: final prize names remain unknown, but the accepted tablet authoring workflow will let the operator add and order them before each raffle starts.
- Day-30 rehearsal: QR registration, live entry count, countdown, draw, and winner reveal succeeded with four authorized synthetic entries. The yellow placeholder MP4 was rejected; cleanup restored zero entries, the official schedule, open status, and no winner.
- Animation correction: both repeatable configs and both DEV rows now use explicit empty `videoUrl`, selecting the existing dark/gold `Sorteando` animation. Omitted-video behavior remains unchanged by differential check.
- Attendance schema: additive `RaffleDrawAttempt` table is present in DEV with six columns, two foreign keys, three indexes, zero rows, and a finished Prisma ledger entry. The historical raffle migration was not replayed.
- Prize authoring delivery: PRs #699, #701, #705, #706, and #708 passed CI and merged to `codex/develop`; DEV deployment `pli-saas-hkte69939-heepnites-projects.vercel.app` is explicitly aliased to `dev.palladiumlatin.art` and both tablet routes return 200.
- Deployment incident: an accidental Vercel project was removed with explicit authorization; an unintended production deployment was no longer active when rollback was attempted, and production remained on its prior deployment. DEV deployment now requires a preview with complete `codex/develop` Git metadata before aliasing.
- Final independent verification: both October events are distinct, have zero entries/attempts, one `draft` placeholder, no winner/timestamps, exact official schedules, explicit empty `videoUrl`, and eligible tablet setup state.
