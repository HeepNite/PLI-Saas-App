# October 30–31 Raffle Design

## Intent

Add two stable, event-specific tablet entrances and reproducible DEV seed inputs while leaving the proven raffle engine unchanged.

## Reuse Strategy

- Reuse the existing `screenCookieName` and `screenTokenMatches` helpers.
- Reuse `RaffleAccessForm` and the existing screen-session endpoint.
- Reuse generic public, staff-screen, screen-state, and draw routes.
- Reuse `scripts/raffle-seed.ts` and `parseRaffleSeedConfig`.
- Reuse the shared raffle backdrop and floating-chrome suppression policy.

## Affected Areas

- `lib/raffle/october-2026-events.ts`: immutable allowlist for day, slug, and title.
- `app/rifa/[day]/page.tsx`: validates the day, checks that event's cookie, redirects or renders access.
- `tests/pages/rifa-day-page.test.tsx`: public, authorized, wrong-key, missing-event, and invalid-day behavior.
- Shared floating-chrome route policy and its existing tests.
- `scripts/examples/raffle-october-{30,31}-2026.dev.json`: deterministic temporary event inputs.

## Architecture Constraints

- No new endpoint or dependency.
- Unknown day values return Next.js 404; they never become database lookup input.
- The event map is server-safe and contains no token.
- Existing `/rifa` remains unchanged and retains its regression tests.
- One event cannot authenticate the other because cookie names and token hashes are slug-scoped.

## Data And Contract Notes

- October 30:
  - slug `october-30-raffle-2026`
  - `eventDate: 2026-10-30`
  - `drawAt: 2026-10-31T04:00:00Z`
- October 31:
  - slug `october-31-raffle-2026`
  - `eventDate: 2026-10-31`
  - `drawAt: 2026-11-01T04:00:00Z`
- Both use `excludePreviousWinners: true`, no video, and a conspicuous temporary prize.
- The existing client countdown can be viewed before 11:00 PM, but the operational instruction is to open/use it at 11:00 PM; Draw remains unavailable until persisted `drawAt`.

## Security And Operational Notes

- Each initial seed generates a different random 32-byte raw token and stores only its SHA-256 hash.
- Redirects remain to clean URLs; raw keys are not rendered.
- No migration is required for this feature.
- DEV setup must capture one-time token output without terminal/chat exposure, verify hashes differ, and keep the events empty.
- Rollback for code is removal of the new dynamic route/map/configs and visibility-policy entries. DEV data rollback is a separately authorized deletion of only the two exact slugs while they remain test-only and empty.
