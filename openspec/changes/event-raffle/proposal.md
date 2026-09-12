# Proposal: Event Raffle (v1)

## Intent

PLE events need an on-site raffle by **2026-09-12**. Today there is no way to collect attendees at the door or pick a winner on stage. Attendees scan a QR, enter name + phone once; a tablet runs the draws on a big screen. The domain is brand-agnostic (`PLE | PLI`) so PLI can reuse it. Success: on event night, entries are collected without login, each configured draw picks exactly one fair winner, and a double tap or retry never produces two winners.

## Scope

### In Scope
- `RaffleEvent` / `RaffleEntry` / `RaffleDraw` models + one migration.
- Public `/raffle/[slug]`: name + phone, no login, **no SMS OTP**, one entry per phone per event.
- `POST /api/raffle/[slug]/entries` — hand-rolled validators, rate-limited, E.164 dedupe.
- Tablet `/staff/raffle/[slug]/screen`: pending draw, countdown, live entry count, big QR, manual **Draw** button, fullscreen MP4, winner reveal on video end, **Next draw**.
- `POST` draw endpoint — transactional, idempotent, excludes prior winners when configured.
- `scripts/raffle-seed.ts` + `npm run raffle:seed` (JSON config → event, draws, printed URLs + token).

### Out of Scope
- Staff admin CRUD panel; multiple winners per draw; native KMP/Android app (future: WebView shell over the same URLs); SMS/notification to winners; i18n (English-only copy, i18n is opt-in in this repo).

## Capabilities

### New Capabilities
- `event-raffle`: public entry collection, per-event screen authorization, and fair idempotent draw execution.

### Modified Capabilities
- None.

## Approach

Per `explore.md` and `research.md` (both in this folder):

- **Entry**: dedupe on `@@unique([eventId, phoneE164])` using `parseNationalPhone` (`lib/phone/index.ts`) — no third normalizer. Manual `unknown` validators (no zod) + `lib/security/rate-limit.ts` keyed by IP + phone. Public API path avoids `/api/staff/*`, so `middleware.ts` is untouched.
- **Screen auth**: no Clerk on the tablet. Per-event 32-byte base64url token from the seed script; page reads `?key=` once, compares with `crypto.timingSafeEqual`, sets an `HttpOnly`/`Secure`/`SameSite=Strict` event-scoped cookie, then renders without the key in the URL. Draw POST accepts the cookie/header only, never the URL. Invalid token → 404.
- **Draw**: interactive `$transaction`; optimistic guard `updateMany({ where: { id, status: 'open' }, data: { status: 'drawing' } })` and check `count`; eligible entries exclude prior winners of the same event when `excludePreviousWinners`; `crypto.randomInt`; persist `winnerEntryId`, status → `drawn`. Repeat calls return the persisted winner. Zero eligible → explicit error, draw stays `open`.
- **Screen UX**: nothing auto-fires at zero — a centered Draw button appears. Tap fires the POST *and* plays `public/raffle/*.mp4`; the winner is revealed when the video ends (await the server if the video finishes first). QR via `api.qrserver.com` (matching `StaffTerminalShell`) with the `qrcode` npm package as offline fallback.
- **Styling**: mirror `StaffTerminalShell.tsx` dark full-viewport conventions; do not modify that file.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modified | Add `RaffleEvent`, `RaffleEntry`, `RaffleDraw` |
| `prisma/migrations/<ts>_add_raffle_models/` | New | Additive-only migration |
| `app/raffle/[slug]/page.tsx` | New | Public entry page |
| `app/api/raffle/[slug]/entries/route.ts` | New | `POST` entry |
| `app/staff/raffle/[slug]/screen/page.tsx` | New | Token-gated tablet screen |
| `app/api/raffle/[slug]/draws/[drawId]/route.ts` | New | `POST` draw |
| `components/front/raffle/*` | New | Form, countdown, QR, video overlay, reveal |
| `scripts/raffle-seed.ts`, `package.json` | New/Modified | Seed + `raffle:seed` script |
| `public/raffle/*.mp4` | New | Draw animation |
| `tests/api/raffle-*.test.ts`, `components/front/raffle/__tests__/*` | New | Vitest coverage |
| `lib/phone/index.ts`, `lib/security/rate-limit.ts`, `middleware.ts` | Unchanged | Read-only reuse |

## Delivery Plan (auto-chain, 400-line budget)

Estimated total ~830–1150 lines → 4 chained slices, each independently verifiable:

| PR | Content | Est. lines |
|----|---------|-----------|
| 1 | Schema + migration + `raffle-seed.ts` + npm script | ~150–210 |
| 2 | Public entry endpoint + validator + rate limit + tests | ~190–240 |
| 3 | Public entry page/components + tests | ~140–200 |
| 4 | Screen page/components + draw endpoint + tests | ~350–400 |

If PR4 forecasts over 400, split into 4a (draw endpoint + tests) and 4b (screen UI). PR1 targets `codex/develop` (per `openspec/config.yaml`), each later PR targets the previous branch.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Prod `_prisma_migrations` drift (known `day_of_week` issue) blocks deploy | Med | Additive-only migration; verify prod migration state and apply surgically before event day |
| Double-tap / retry yields two winners | Med | `open → drawing → drawn` guard inside one `$transaction`; idempotent replay returns the persisted winner |
| `api.qrserver.com` unreachable at venue (no SLA) | Med | Local `qrcode` fallback render |
| Public unauthenticated endpoint abused | Med | IP+phone rate limit, strict validators, unique constraint |
| Screen token leaked via URL/history | Low | HTTPS-only, single-load `?key=`, cookie thereafter, per-event rotation |
| Deadline slip (2 days) | Med | Slice order ships value incrementally; PR1–PR3 alone already collect entries |

## Rollback Plan

- Code: revert the chained PRs newest-first; every path is net-new, so no existing behavior regresses.
- Data: the migration is purely additive (three new tables, no alters). Rollback = drop the three tables via a follow-up migration; no backfill or data loss elsewhere.
- Runtime kill switch: deleting or unpublishing the `RaffleEvent` row makes `/raffle/[slug]` and the screen 404 without a deploy.

## Dependencies

- `qrcode` npm package (new dependency, QR fallback).
- MP4 asset supplied before event day.
- Prod DB migration window before 2026-09-12.

## Success Criteria

- [ ] A scanned QR lets an attendee submit name + phone with no login and no OTP.
- [ ] A second submission with the same phone for the same event is rejected as a duplicate.
- [ ] Nothing draws automatically; a staff tap starts the video and the winner appears when it ends.
- [ ] Calling the draw endpoint twice for the same draw returns the same winner.
- [ ] With `excludePreviousWinners` on, no attendee wins twice in one event.
- [ ] `npm run raffle:seed <config.json>` prints a working public URL and tablet URL.

## Open Questions

None. All product decisions were confirmed in the pre-proposal handoff. `sdd-design` should still settle the Prisma isolation level given the Railway `connection_limit=5` pooling (deferred by `research.md` Lane 2).
