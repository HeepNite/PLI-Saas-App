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
- [ ] Add RED domain, route, screen-state, and tablet tests for pending confirmation, refresh recovery, idempotent exact-attempt actions, no-show audit retention, and event-wide exclusion.
- [ ] Add the `RaffleDrawAttempt` model and additive migration, guarded attendance domain/route, and draw integration.
- [ ] Add refresh-safe `Showed up` / `Draw again` tablet controls and replay the animation for a reroll.
- [ ] Run focused checks, relevant suite, typecheck, lint, differential checks for omitted/explicit video config, and independent high-risk verification.
- [ ] Deploy to DEV, rehearse both days visibly, and restore exact official empty/open state.

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
- Residual product input: replace each temporary prize label with the final ordered prize list before the event; no final prize was invented here.
