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
- A distinct six-digit private tablet PIN for each event, typeable without clipboard support.
- America/New_York scheduling: operators start using the countdown at 11:00 PM; the manual Draw action becomes available at 12:00 AM.
- Clearly temporary DEV prize labels until final prize lists are supplied.
- Reconciliation of the existing raffle and migration evidence before DEV setup.
- The existing Latino Night dark/gold no-video draw animation until replacement videos are supplied.
- Winner attendance confirmation with `Showed up` and an audited `Draw again` flow for no-shows.
- Tablet prize authoring before the raffle starts: add, edit, remove, and reorder any number of prizes, then lock the list with an explicit `Start raffle` action.

### Out of scope

- Final prize names or counts.
- Production deployment or production data changes.
- Changing registration, screen-session validation, rate-limit, or random winner-selection contracts beyond six-digit October tablet PINs and excluding confirmed no-shows.
- Reusing the Latino Night tablet credential.
- Deleting historical raffle events or entries.
- Editing the prize list after `Start raffle` succeeds.

## Context

The existing generic raffle routes, domain logic, seed script, and token exchange remain authoritative. This spec adds two event configurations and two friendly tablet entrances for DEV.

## Functional Requirements

1. `/rifa/30` targets only the October 30 event.
2. `/rifa/31` targets only the October 31 event.
3. Each entrance accepts only its event's six-digit private PIN and redirects an authorized browser to that event's clean staff screen.
4. The October 30 draw time is `2026-10-31T04:00:00Z` (October 31 00:00 America/New_York).
5. The October 31 draw time is `2026-11-01T04:00:00Z` (November 1 00:00 America/New_York).
6. DEV seed data uses a conspicuous temporary prize label and must be replaced when final prizes are supplied.
7. Re-running setup must preserve non-open draws and must not reuse one event's screen token for the other.
8. Both October events use the existing dark/gold `Sorteando` animation while their configured `videoUrl` is the explicit empty string.
9. A selected winner remains pending physical attendance confirmation after refresh or reconnect.
10. `Showed up` confirms the pending winner and closes that prize.
11. `Draw again` records the exact pending winner as a no-show without deleting their entry, excludes them from every later draw in that event, and immediately reruns the same prize.
12. Attendance decisions are bound to the exact draw attempt and are idempotent; a stale or repeated action cannot confirm or reject a later winner.
13. The existing no-login registration stays one entry per normalized phone and event; physical event controls handle attempts to use multiple numbers.
14. Before the raffle starts, the tablet exposes an ordered prize editor for that event.
15. The operator may add, rename, remove, and move prizes up or down; the list must contain at least one non-empty prize label.
16. Saved draft prizes survive refreshes without changing registered participants or the persisted draw schedule.
17. `Start raffle` atomically saves the displayed order and changes every draft prize to an immutable live draw.
18. Once started, no tablet request may add, edit, remove, or reorder prizes; the tablet proceeds through them in ascending order.
19. Concurrent or stale prize-authoring requests fail without partially changing the saved list or lock state.

## Constraints

- Reuse `RaffleEvent`, `RaffleDraw`, `RaffleAccessForm`, the existing screen-session exchange, and `scripts/raffle-seed.ts`.
- Preserve `/rifa` and all existing raffle URLs.
- Keep each event and its entries, draws, cookie, and token isolated by slug.
- Do not add or replay a raffle schema repair migration: current `codex/develop` already contains the original additive raffle migration and complete Prisma models.
- The attendance audit may use one new additive migration; it must not edit or replay the original raffle migration.
- Prize authoring reuses `RaffleDraw` rows with `draft` status before `Start raffle`; no additional schema migration is required.
- Remote database setup requires an exact DEV environment preflight and must not expose raw PINs in logs, committed files, or chat.

## Security Rules

- Raw tablet PINs are distinct six-digit values, stored only as hashes in the database and in their separate macOS Keychain items, and never committed or written to logs/chat.
- Existing HttpOnly, Secure, SameSite=Strict, 36-hour event-scoped cookie behavior remains unchanged.
- Existing screen-session validation and rate limits remain unchanged.
- Remote operations are DEV-only and must fail closed on environment ambiguity.

## Acceptance Criteria

- [x] `/rifa/30` renders October 30 access and redirects only with the October 30 cookie/credential.
- [x] `/rifa/31` renders October 31 access and redirects only with the October 31 cookie/credential.
- [x] Existing `/rifa` behavior remains covered.
- [ ] A draft October event supports persistent add, rename, remove, and reorder operations from its tablet screen.
- [ ] `Start raffle` saves the displayed list, locks prize authoring, and exposes the first ordered draw without changing registrations or schedule.
- [ ] Stale, repeated, unauthorized, and post-start authoring requests leave draws and counters unchanged.
- [x] Both JSON configs validate and resolve to the exact midnight UTC instants above.
- [x] DEV contains two independent empty events with distinct screen-token hashes and temporary open draw data.
- [x] Public pages and tablet entrances return successful responses after the DEV deployment.
- [x] Unauthorized screen-state requests still return 404.
- [ ] Both DEV events render the existing dark/gold `Sorteando` animation instead of the yellow placeholder MP4.
- [ ] `Showed up` durably confirms the exact pending winner and closes the prize.
- [ ] `Draw again` durably audits the no-show, excludes that entry event-wide, and reruns the same prize exactly once.
- [ ] Refresh, repeated actions, and stale attempt identifiers cannot skip confirmation or act on a later winner.

## Definition Of Done

- [ ] Implementation matches the amended attendance and animation behavior.
- [ ] Focused tests and the relevant suite pass.
- [ ] Additive migration and DEV rehearsal evidence is recorded.
- [ ] Temporary prizes and the remaining video/prize decisions are explicit.

## Open Questions

- Final ordered prize list for each day.
- Replacement main-background and draw videos.
