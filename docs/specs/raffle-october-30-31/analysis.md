# Analysis

## Existing Implementation

- `app/rifa/page.tsx` is a hard-coded Latino Night tablet entrance.
- `RaffleAccessForm` submits a raw key to the existing event-specific screen-session exchange.
- `app/raffle/[slug]` and `app/staff/raffle/[slug]/screen` are already generic by slug.
- `scripts/raffle-seed.ts` upserts one event, generates a token only when needed, preserves non-open draws, and prints the raw tablet URL once.
- `lib/raffle/seed-plan.ts` validates seed JSON and normalizes date-only event dates to America/New_York midnight.
- `prisma/migrations/20260911180000_add_raffle_models/migration.sql` and the three Prisma models exist on current `origin/codex/develop`.

## Affected Files

- New dynamic entrance under `app/rifa/[day]/page.tsx`.
- A small event-map module under `lib/raffle/`.
- Existing route visibility policy and its tests.
- Page tests for both new entrances and the preserved legacy entrance.
- Two DEV-only JSON seed configs under `scripts/examples/`.
- This active spec and ODD task record.

## Architecture Constraints

- Friendly entrances select an allowlisted event; arbitrary slugs are not accepted at `/rifa/[day]`.
- Generic raffle APIs and domain logic remain unchanged.
- The countdown remains client-gated by persisted `drawAt`; operators open the screen at 11:00 PM and the existing state machine unlocks Draw at midnight.
- Data setup uses existing seed orchestration rather than custom SQL.

## Spec/Code Conflicts

- The previous friendly route supports only `/rifa`; the accepted contract requires permanent `/rifa/30` and `/rifa/31`.
- Historical repair notes initially claimed missing raffle tables. Later readback found the complete schema and live data. Current `codex/develop` contains no repair migration, so the stale repair branch must not be merged into this feature.
- `eventDate + 24h` controls registration closure independently from `drawAt`. With event dates October 30 and 31, registration closes at the requested midnight draw boundary for each day.
- Final prizes are unknown; production-looking prize content would be an invented requirement.

## Recommended Next Focus

Implement the two allowlisted entrances and temporary DEV configs, test exact timezone boundaries, then perform a read-only DEV migration/schema preflight before any seed write.
