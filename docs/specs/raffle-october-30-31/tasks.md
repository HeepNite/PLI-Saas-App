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

- [ ] Add failing route/config/visibility tests.
- [ ] Implement the allowlisted event map and dynamic tablet route.
- [ ] Add the two temporary DEV seed configs.
- [ ] Extend exact raffle floating-chrome suppression to both new entrances.

## Phase 5 - Validation

- [ ] Run focused tests.
- [ ] Run the relevant suite, typecheck, and scoped lint.
- [ ] Run independent verification for the high-risk data and shared-route surfaces.
- [ ] Commit the reviewable work unit and record its hash.
- [ ] Preflight exact DEV environment and migration/schema state.
- [ ] Seed and verify both independent DEV events without exposing keys.
- [ ] Record publishing/deployment status and residual final-prize work.
