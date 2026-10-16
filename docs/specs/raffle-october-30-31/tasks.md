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
- [ ] Preflight exact DEV environment and migration/schema state.
- [ ] Seed and verify both independent DEV events without exposing keys.
- [ ] Record publishing/deployment status and residual final-prize work.
