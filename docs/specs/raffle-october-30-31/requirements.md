# October 30–31 Raffle Preparation

## Status

`ACCEPTED`

## Objective

Prepare the existing DEV raffle for two independent events on October 30 and October 31, 2026, so each event can be tested and operated without reconfiguring the other.

## Scope

### In scope

- A separate event titled `October 30 Raffle`.
- A separate event titled `October 31 Raffle`.
- Permanent tablet entrances at `/rifa/30` and `/rifa/31`.
- A new private tablet key for each event.
- America/New_York scheduling: operators start using the countdown at 11:00 PM; the manual Draw action becomes available at 12:00 AM.
- Clearly temporary DEV prize labels until final prize lists are supplied.
- Reconciliation of the existing raffle and migration evidence before DEV setup.

### Out of scope

- Final prize names or counts.
- Production deployment or production data changes.
- Changing the existing draw, registration, authentication, rate-limit, or winner-selection contracts.
- Reusing the Latino Night tablet key.
- Deleting historical raffle events or entries.

## Context

The existing generic raffle routes, domain logic, seed script, and token exchange remain authoritative. This spec adds two event configurations and two friendly tablet entrances for DEV.

## Functional Requirements

1. `/rifa/30` targets only the October 30 event.
2. `/rifa/31` targets only the October 31 event.
3. Each entrance accepts only its event's private key and redirects an authorized browser to that event's clean staff screen.
4. The October 30 draw time is `2026-10-31T04:00:00Z` (October 31 00:00 America/New_York).
5. The October 31 draw time is `2026-11-01T04:00:00Z` (November 1 00:00 America/New_York).
6. DEV seed data uses a conspicuous temporary prize label and must be replaced when final prizes are supplied.
7. Re-running setup must preserve non-open draws and must not reuse one event's screen token for the other.

## Constraints

- Reuse `RaffleEvent`, `RaffleDraw`, `RaffleAccessForm`, the existing screen-session exchange, and `scripts/raffle-seed.ts`.
- Preserve `/rifa` and all existing raffle URLs.
- Keep each event and its entries, draws, cookie, and token isolated by slug.
- Do not add or replay a raffle schema repair migration: current `codex/develop` already contains the original additive raffle migration and complete Prisma models.
- Remote database setup requires an exact DEV environment preflight and must not expose raw keys in logs, committed files, or chat.

## Security Rules

- Raw tablet keys are generated independently, stored only as hashes in the database, and never committed.
- Existing HttpOnly, Secure, SameSite=Strict, 36-hour event-scoped cookie behavior remains unchanged.
- Existing screen-session validation and rate limits remain unchanged.
- Remote operations are DEV-only and must fail closed on environment ambiguity.

## Acceptance Criteria

- [x] `/rifa/30` renders October 30 access and redirects only with the October 30 cookie/key.
- [x] `/rifa/31` renders October 31 access and redirects only with the October 31 cookie/key.
- [x] Existing `/rifa` behavior remains covered.
- [x] Both JSON configs validate and resolve to the exact midnight UTC instants above.
- [x] DEV contains two independent empty events with distinct screen-token hashes and temporary open draw data.
- [x] Public pages and tablet entrances return successful responses after the DEV deployment.
- [x] Unauthorized screen-state requests still return 404.

## Definition Of Done

- [x] Implementation matches the accepted behavior.
- [x] Focused tests and the relevant suite pass.
- [x] Migration and DEV preflight evidence is recorded.
- [x] Temporary prizes and the remaining final-prize decision are explicit; no publishing step remains.

## Open Questions

- Final ordered prize list for each day.
