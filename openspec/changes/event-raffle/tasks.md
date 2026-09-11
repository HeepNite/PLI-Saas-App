# Tasks: Event Raffle (v1)

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Low

Branch chain: `codex/develop` ← `feat/event-raffle-1a-schema` ← `feat/event-raffle-1b-seed-plan` ← `feat/event-raffle-1c-seed-cli` ← `feat/event-raffle-2-entry-api` ← `feat/event-raffle-3-entry-page` ← `feat/event-raffle-4a-draw-api` ← `feat/event-raffle-4b-screen-ui`

PR1 was split into three chained slices during apply because its authored diff (834 changed lines) exceeded the 400-line budget: `feat/event-raffle-1a-schema` (schema + migration, targets `codex/develop`), `feat/event-raffle-1b-seed-plan` (`lib/raffle/seed-plan.ts` pure helpers + their unit tests, targets 1a), `feat/event-raffle-1c-seed-cli` (`scripts/raffle-seed.ts` CLI + example config + `package.json` entry + CLI-level tests, targets 1b). See `apply-progress.md` for per-branch line counts and verification.

### Suggested Work Units

| Unit | Goal | PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Schema + migration + seed script | PR1 | `npx vitest run tests/scripts/raffle-seed.test.ts` | `npx tsx scripts/raffle-seed.ts scripts/examples/raffle-event.example.json` against local dev DB | Drop the 3 new tables via follow-up migration; no existing table altered |
| 2 | Public entry API | PR2 | `npx vitest run tests/api/raffle-entries.test.ts` | `curl -X POST localhost:3000/api/raffle/<slug>/entries` against seeded event | Remove `app/api/raffle/[slug]/entries/route.ts` + `lib/raffle/{entry-validation,event-window,entry}.ts`; no schema change |
| 3 | Public entry page | PR3 | `npx vitest run components/front/raffle/__tests__/RaffleEntryForm.test.tsx` | Visit `http://localhost:3000/raffle/<slug>` in a browser | Remove `app/raffle/[slug]/page.tsx` + `RaffleEntryForm.tsx`; API from PR2 untouched |
| 4a | Draw domain + draw/session/state routes | PR4a | `npx vitest run tests/api/raffle-draw.test.ts tests/api/raffle-screen.test.ts` | `curl` the `screen-session`, `screen-state`, then `draw` routes against a seeded event and cookie jar | Remove the 3 new routes + `lib/raffle/{draw,screen-token,screen-state,winner-view}.ts`; entries untouched |
| 4b | Screen UI | PR4b | `npx vitest run components/front/raffle/__tests__/RaffleScreen.test.tsx` | Open `http://localhost:3000/staff/raffle/<slug>/screen?key=<token>` on a browser/tablet | Remove screen page + presentational components; PR4a APIs untouched |

---

## PR1 — Schema + migration + seed script (split into PR1a/1b/1c, see branch chain note above)

- [x] 1.1 Add `RaffleEvent`, `RaffleEntry`, `RaffleDraw` models to `prisma/schema.prisma` exactly as the D9 snippet (String cuid ids, `status` as `String`, `@@unique([eventId, phoneE164])`, `@@unique([eventId, order])`). Implements: D9. Spec: Raffle Data Model / *Duplicate phone constrained at the database*. (PR1a)
- [x] 1.2 Generate the migration with `npx prisma migrate dev --name add_raffle_models --create-only`, then review the emitted `prisma/migrations/<timestamp>_add_raffle_models/migration.sql` for additive-only DDL (no `ALTER` on existing tables). Implements: D9. Spec: Raffle Data Model. (PR1a — generated via `prisma migrate diff --script` since no live DB was available; reviewed by hand as additive-only)
- [x] 1.3 Create `scripts/raffle-seed.ts` (`npx tsx scripts/raffle-seed.ts <config.json> [--base-url ...] [--rotate-token]`): upsert event by `slug`; generate `screenTokenHash` only when absent; `--rotate-token` forces and prints a new raw token (never persisted in plaintext, never reprintable later); upsert draws by `@@unique([eventId, order])`, skip-and-report any draw whose status is not `open`; print public URL and tablet `?key=` URL using `--base-url ?? NEXT_PUBLIC_SITE_URL ?? VERCEL_URL ?? http://localhost:3000`. Implements: D8. Spec: Raffle Seed Script. (pure helpers in PR1b, thin CLI in PR1c)
- [x] 1.4 Add `"raffle:seed": "tsx scripts/raffle-seed.ts"` to `package.json` scripts. Implements: D8. Spec: Raffle Seed Script. (PR1c)
- [x] 1.5 Add `scripts/examples/raffle-event.example.json` matching the D8 config shape (`slug`, `title`, `brand`, `eventDate`, `excludePreviousWinners`, `videoUrl`, `draws[]`). Implements: D8. (PR1c)
- [x] 1.6 Write `tests/scripts/raffle-seed.test.ts` (mocked Prisma client): `eventDate` normalization to the America/New_York midnight boundary used by D11; re-running the seed is idempotent (no duplicate event/draw rows); a `drawn` draw is skipped and reported, an `open` draw is updated; token generated only when `screenTokenHash` is absent; `--rotate-token` forces regeneration and prints the raw value once. Implements: D8, D11. Spec: Raffle Seed Script / *Re-seed preserves drawn draws*. (pure-helper cases moved to `tests/lib/raffle/seed-plan.test.ts` in PR1b; CLI-level cases stay in `tests/scripts/raffle-seed.test.ts` in PR1c)

### Verification

- `npx prisma validate`
- `npx prisma generate`
- `npx tsc --noEmit`
- `npx vitest run tests/scripts/raffle-seed.test.ts`
- `npm run lint`

---

## PR2 — Public entry API (targets `feat/event-raffle-1-schema`)

Implemented on branch `feat/event-raffle-2-entry-api` (from tip `feat/event-raffle-1c-seed-cli`), two work-unit
commits: `29314f4` (domain helpers + tests, also adds `lib/raffle/slug.ts`/`isRaffleSlug` per apply-time
implementation contract, shared later by PR4a's screen-token exchange) and `c96544a` (route + its test). See
`apply-progress.md` for the line-count note: authored diff is 459 lines, over the 400-line budget and over this
section's own PR2 estimate (190–250); no task scope grew — the overage comes from thorough test coverage plus
the added slug validator, and per the apply-time instruction no test/comment/docs content was trimmed to fit.
Decision on whether to further split into `2a`/`2b` chained branches or accept `size:exception` is deferred to
the orchestrator (see apply-progress.md).

- [x] 2.1 Create `lib/raffle/entry-validation.ts`: `parseRaffleEntryInput(body: unknown)` — trims `name` (2–60 chars, must contain a non-digit), resolves `phone` via `parseNationalPhone` (default country `US`), returns `{ ok: true, value } | { ok: false, status }`. Implements: D1. Spec: Public Entry Submission.
- [x] 2.2 Create `lib/raffle/event-window.ts`: pure `isRaffleEventClosed(eventDate, now)` per D11 (`RAFFLE_EVENT_GRACE_MS = 24h`). Implements: D1, D11. Spec: Public Entry Submission / *Event closed*.
- [x] 2.3 Create `lib/raffle/entry.ts`: `createRaffleEntry(db, input)` — loads event by slug, applies `isRaffleEventClosed`, inserts, catches Prisma `P2002` → `already_entered`. Implements: D1. Spec: Public Entry Submission / *New entry accepted*, *Duplicate phone is not an error*.
- [x] 2.4 Create `app/api/raffle/[slug]/entries/route.ts` (`export const runtime = "nodejs"`): rate-limit by IP (`raffle:entry:ip`, 10/60s) then by parsed `e164` (`raffle:entry:phone`, 5/300s) using `consumeRateLimit` / `buildRateLimitKey` / `getClientIp`; on 429 include `Retry-After`; map domain result to `201 entered` / `200 already_entered` / `400` validator statuses / `404 event_not_found` / `410 event_closed`. Implements: D1, D10, D11. Spec: Public Entry Submission (all scenarios).
- [x] 2.5 Write `tests/api/raffle-entries.test.ts` (mocked Prisma): valid entry → 201 with stored `e164`; each validator rejection; name 1 char / 61 chars rejected; missing `country` defaults to `US`; duplicate phone → 200 `already_entered`, no second row; unknown slug → 404; `isRaffleEventClosed` open/closed boundary; closed event → 410; 429 carries `Retry-After` (set `ENABLE_RATE_LIMIT_IN_TESTS=1`). Implements: D1, D10, D11. Spec: Public Entry Submission (all scenarios), Raffle Data Model / *Duplicate phone constrained at the database*.

### Verification

- `npx tsc --noEmit` → clean, no output
- `npx vitest run tests/lib/raffle tests/api/raffle-entries.test.ts` → 49/49 passed
- `npm run lint` → 0 errors, 114 warnings (pre-existing baseline, none new)

---

## PR3 — Public entry page (targets `feat/event-raffle-2-entry-api`)

- [ ] 3.1 Create `app/raffle/[slug]/page.tsx` (server component): load event by `slug`, `notFound()` when absent, render `<RaffleEntryForm slug eventTitle />`. Implements: D7. Spec: Public Entry Page (both scenarios).
- [ ] 3.2 Create `components/front/raffle/RaffleEntryForm.tsx` (client): `idle → submitting → { entered | already_entered | closed | error }` states; mobile-first Tailwind; `inputMode="tel"`; country select defaulting to `US`; posts to `POST /api/raffle/[slug]/entries`. Implements: D1, D7. Spec: Public Entry Submission / *New entry accepted*, *Duplicate phone is not an error*, *Event closed*.
- [ ] 3.3 Write `components/front/raffle/__tests__/RaffleEntryForm.test.tsx`: submits parsed name/phone values; renders `already_entered`, `event_closed`, and `error` states; success state hides the form. Implements: D7. Spec: Public Entry Page, Public Entry Submission.

### Verification

- `npx tsc --noEmit`
- `npx vitest run components/front/raffle/__tests__/RaffleEntryForm.test.tsx`
- `npm run lint`

---

## PR4a — Draw domain + draw/session/state routes (targets `feat/event-raffle-3-entry-page`)

- [ ] 4a.1 Create `lib/raffle/screen-token.ts`: `generateScreenToken()`, `hashScreenToken(raw)` (SHA-256), `screenTokenMatches(raw, hash)` via `crypto.timingSafeEqual` on two 32-byte hashed buffers, `screenCookieName(slug)` (`pli_raffle_screen_<slug>`), `isRaffleSlug(value)` (the regex ^[a-z0-9-]{1,64}$), `SCREEN_COOKIE_MAX_AGE_SEC` (36h). Implements: D2. Spec: Screen Token Authorization.
- [ ] 4a.2 Create `lib/raffle/winner-view.ts`: `toWinnerView(entry)` → `{ name, phoneLast4 }` (last 4 digits only, never the full `phoneE164`). Implements: D5. Spec: Draw Execution.
- [ ] 4a.3 Create `lib/raffle/draw.ts`: `runDraw(tx, { drawId, now })` — `updateMany` claim guard with `RaffleDraw.drawingStartedAt` and `DRAW_CLAIM_TIMEOUT_MS = 60_000` (D3); on `count === 0` re-read and return `drawn` (idempotent replay) or `in_progress`; on claim success load eligible entries (exclude prior winners when `excludePreviousWinners`, D4), pick via `crypto.randomInt`, persist `winnerEntryId` / `drawnAt` / `status: "drawn"`; on zero eligible reset the claimed row to `open` / `drawingStartedAt: null` and return `no_eligible_entries`. Implements: D3, D4, D5. Spec: Draw Execution (all scenarios).
- [ ] 4a.4 Create `lib/raffle/screen-state.ts`: `loadScreenState(db, slug)` → `{ now, event, entryCount, currentDrawId, draws[] }`; `currentDrawId` is the lowest `order` with status `open` / `drawing`. Implements: D1. Spec: Screen Display State.
- [ ] 4a.5 Create `app/api/raffle/[slug]/screen-session/route.ts` (`GET`, `runtime = "nodejs"`): `isRaffleSlug` → load event (404 if absent) → `screenTokenMatches` (404 if not) → set cookie (`httpOnly`, `secure`, `sameSite: "strict"`, `path` = site root, `maxAge` per D2) → `302` to the URL /staff/raffle/[slug]/screen with `Referrer-Policy: no-referrer`, `Cache-Control: no-store`; rate-limited (`raffle:draw`-scale, D10). Implements: D2. Spec: Screen Token Authorization / *Valid key issues cookie*.
- [ ] 4a.6 Create `app/api/raffle/[slug]/screen-state/route.ts` (`GET`, cookie-gated, `runtime = "nodejs"`): 404 on missing/invalid cookie; else return `loadScreenState` payload via `toWinnerView` for any drawn entries; rate-limited (`raffle:screen-state`, 240/60s). Implements: D1, D2, D5, D10. Spec: Screen Display State, Screen Token Authorization / *No cookie and no key*.
- [ ] 4a.7 Create `app/api/raffle/[slug]/draws/[drawId]/draw/route.ts` (`POST`, cookie-gated, `runtime = "nodejs"`): rate-limited (`raffle:draw`, 20/60s); `prisma.$transaction(tx => runDraw(tx, { drawId, now }), { maxWait: 5000, timeout: 10000 })`; map `drawn` → `200`, `no_eligible_entries` → `409`, `in_progress` → `409 draw_in_progress`, missing draw/cookie → `404`. Implements: D2, D3, D4, D5, D10. Spec: Draw Execution (all scenarios), Screen Token Authorization.
- [ ] 4a.8 Write `tests/api/raffle-draw.test.ts` (mocked Prisma, `vi.spyOn` on `crypto.randomInt`): `runDraw` picks the stubbed index; replay on a `drawn` draw returns the same winner; lost claim → `in_progress`; stale `drawing` older than 60s is reclaimed; prior winners excluded when the flag is on, included when off; zero eligible → `no_eligible_entries` and the row resets to `open`; route maps each status to its HTTP code; `toWinnerView` never returns the full phone. Implements: D3, D4, D5. Spec: Draw Execution (all scenarios).
- [ ] 4a.9 Write `tests/api/raffle-screen.test.ts` (mocked Prisma): `screenTokenMatches` accepts the right token and rejects a wrong one of equal and unequal length; `screen-session` sets the cookie and 302s, bad key → 404; `screen-state` without cookie → 404; `currentDrawId` is the lowest open/drawing order. Implements: D1, D2. Spec: Screen Token Authorization (both scenarios), Screen Display State.

### Verification

- `npx tsc --noEmit`
- `npx vitest run tests/api/raffle-draw.test.ts tests/api/raffle-screen.test.ts`
- `npm run lint`

---

## PR4b — Screen UI (targets `feat/event-raffle-4a-draw-api`)

- [ ] 4b.1 Create `app/staff/raffle/[slug]/screen/page.tsx` (server component): redirect any request carrying `?key=` to the URL /api/raffle/[slug]/screen-session?key=...; when no valid cookie and no `key`, `notFound()`; else render `<RaffleScreen slug />`. Implements: D2. Spec: Screen Token Authorization.
- [ ] 4b.2 Create `components/front/raffle/RaffleScreen.tsx` (client container): state machine `waiting → ready → drawing_video → reveal → between_draws → finished` (+ `error`) per D6; polls `useRaffleScreenState(slug)` every 5s, paused during `drawing_video`; clock-drift offset `Date.parse(payload.now) - Date.now()`; reveal only when `videoEnded && drawResult !== null`; POST failure → `error` state with retry, video never replayed. Implements: D6. Spec: Screen Display State, Draw Execution / *Double tap yields one winner* (client half).
- [ ] 4b.3 Create presentational components: countdown display, QR renderer (`api.qrserver.com` `<img>` with `onError` fallback to local `qrcode` canvas render), fullscreen `<video preload="auto" playsInline muted>` overlay, winner reveal card (`••• ••• <phoneLast4>` + Next draw button), closing/finished card. Implements: D6. Spec: Screen Display State, QR Code Rendering, Draw Execution.
- [ ] 4b.4 Write `components/front/raffle/__tests__/RaffleScreen.test.tsx`: countdown reaching zero shows the Draw button and sends nothing automatically; reveal fires only when `videoEnded && drawResult`; POST failure shows retry without replaying the video; QR `onError` swaps to the local canvas render; `currentDrawId === null` renders the closing state. Implements: D6. Spec: Screen Display State / *Countdown reaches zero*, QR Code Rendering / *Remote QR image fails*.

### Verification

- `npx tsc --noEmit`
- `npx vitest run components/front/raffle/__tests__/RaffleScreen.test.tsx`
- `npm run lint`

---

## Rollout notes

- Known prod `_prisma_migrations` drift (renamed/duplicate `day_of_week` entry) can block `npx prisma migrate deploy` before it reaches `<timestamp>_add_raffle_models`. Before event day: run `npx prisma migrate status` against prod, and if deploy is blocked, apply `migration.sql` manually and `npx prisma migrate resolve --applied <timestamp>_add_raffle_models`. Never run `migrate dev` / `reset` against prod.
- `public/raffle/draw.mp4` is a user-supplied asset (not generated by this change); place it at that exact path before PR4b is exercised on a tablet, since `RaffleScreen`'s `drawing_video` state loads it by that URL.

## Review Workload Forecast

| Field | Value |
|---|---|
| PR1 estimated changed lines | 150–210 |
| PR2 estimated changed lines | 190–250 |
| PR3 estimated changed lines | 140–200 |
| PR4a estimated changed lines | 230–300 |
| PR4b estimated changed lines | 250–330 |
| Total estimated changed lines | 960–1290 |
| 400-line budget risk | Low |
| Chained PRs recommended | Yes |
| Decision needed before apply | No |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Low

Branch chain: `codex/develop` (per `openspec/config.yaml` `target_branch`) ← `feat/event-raffle-1-schema` ← `feat/event-raffle-2-entry-api` ← `feat/event-raffle-3-entry-page` ← `feat/event-raffle-4a-draw-api` ← `feat/event-raffle-4b-screen-ui`

The 4a/4b split is committed in `design.md` (PR4 as one unit forecast 350–400+); every other slice already sits comfortably under the 400-line budget with margin, so no further split decision is needed before `sdd-apply`.
