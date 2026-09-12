# Tasks: Event Raffle (v1)

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Low

Branch chain: `codex/develop` ← `feat/event-raffle-1a-schema` ← `feat/event-raffle-1b-seed-plan` ← `feat/event-raffle-1c-seed-cli` ← `feat/event-raffle-2-entry-api` ← `feat/event-raffle-3-entry-page` ← `feat/event-raffle-4a-draw-api` ← `feat/event-raffle-4b-screen-ui`

Actual chain as of the PR4a apply pass (PR2 and PR3 were each further split, same pattern as PR1 —
see their sections below for detail): `codex/develop` ← `feat/event-raffle-1a-schema` ←
`feat/event-raffle-1b-seed-plan` ← `feat/event-raffle-1c-seed-cli` ← `feat/event-raffle-2a-entry-domain` ←
`feat/event-raffle-2b-entry-route` ← `feat/event-raffle-3a-entry-page` ← `feat/event-raffle-3b-entry-page-tests`
← `feat/event-raffle-4a1-draw-domain` ← `feat/event-raffle-4a2-screen-domain` ← `feat/event-raffle-4a3-screen-routes`
← `feat/event-raffle-4a4-draw-route` ← `feat/event-raffle-4b1-screen-shell` (this pass) ←
`feat/event-raffle-4b2-video-qr` (not started). PR4a's own commits (`fbd2f02`/`d1cf050`/`5754f3e`) were further
split across the four `4a*` branches above in a pass after the note below was written; see git history on
those branches for their per-branch verification. PR4b's own split (4b1 shell / 4b2 video+QR) is recorded in
its section below.

PR1 was split into three chained slices during apply because its authored diff (834 changed lines) exceeded the 400-line budget: `feat/event-raffle-1a-schema` (schema + migration, targets `codex/develop`), `feat/event-raffle-1b-seed-plan` (`lib/raffle/seed-plan.ts` pure helpers + their unit tests, targets 1a), `feat/event-raffle-1c-seed-cli` (`scripts/raffle-seed.ts` CLI + example config + `package.json` entry + CLI-level tests, targets 1b). See `apply-progress.md` for per-branch line counts and verification.

### Suggested Work Units

| Unit | Goal | PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Schema + migration + seed script | PR1 | `npx vitest run tests/scripts/raffle-seed.test.ts` | `npx tsx scripts/raffle-seed.ts scripts/examples/raffle-event.example.json` against local dev DB | Drop the 3 new tables via follow-up migration; no existing table altered |
| 2 | Public entry API | PR2 | `npx vitest run tests/api/raffle-entries.test.ts` | `curl -X POST localhost:3000/api/raffle/<slug>/entries` against seeded event | Remove `app/api/raffle/[slug]/entries/route.ts` + `lib/raffle/{entry-validation,event-window,entry}.ts`; no schema change |
| 3 | Public entry page | PR3 | `npx vitest run components/front/raffle/__tests__/RaffleEntryForm.test.tsx` | Visit `http://localhost:3000/raffle/<slug>` in a browser | Remove `app/raffle/[slug]/page.tsx` + `RaffleEntryForm.tsx`; API from PR2 untouched |
| 4a | Draw domain + draw/session/state routes | PR4a | `npx vitest run tests/api/raffle-draw.test.ts tests/api/raffle-screen.test.ts` | `curl` the `screen-session`, `screen-state`, then `draw` routes against a seeded event and cookie jar | Remove the 3 new routes + `lib/raffle/{draw,screen-token,screen-state,winner-view}.ts`; entries untouched |
| 4b1 | Screen shell: page, container, state machine, polling, countdown, Draw, text reveal, closing state | PR4b1 | `npx vitest run components/front/raffle/__tests__/RaffleScreen.test.tsx components/front/raffle/__tests__/raffleScreenMachine.test.ts` | Open `http://localhost:3000/staff/raffle/<slug>/screen?key=<token>` on a browser/tablet | Remove screen page + `RaffleScreen*`/`raffleScreenMachine.ts`/`useRaffleScreenState.ts`; PR4a APIs untouched |
| 4b2 | Fullscreen draw video overlay + QR panel with offline fallback | PR4b2 (shipped as branch `feat/event-raffle-4c1-draw-video`, targets `feat/event-raffle-4b5-screen-route` — see branch-chain note below) | `npx vitest run components/front/raffle` | Open `http://localhost:3000/staff/raffle/<slug>/screen?key=<token>` on a browser/tablet and tap Draw | Revert the three `feat/event-raffle-4c1-draw-video` commits (`RaffleScreenSeams.tsx`'s two seam bodies, the `videoUrl` wiring through `raffleScreenMachine.ts`/`RaffleScreen.tsx`/`RaffleScreenView.tsx`, and `lib/raffle/screen-state.ts`'s `videoUrl` field); the PR4b1 shell and PR4a APIs are untouched |

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

## PR3 — Public entry page (targets `feat/event-raffle-2b-entry-route`, actual base tip `9f466bd`)

Implemented on branch `feat/event-raffle-3-entry-page`, two work-unit commits: `e8079a9` (page + form, 260
authored lines) and `f8db3e0` (tests, 220 authored lines). Total authored diff is 480 lines, over the
400-line budget and over this section's own PR3 estimate (140–200); no task scope grew beyond 3.1–3.3 — the
overage is thorough state-mapping/mount test coverage plus jsdom-mount plumbing, and per the apply-time
instruction no test content was trimmed to fit. Each commit individually clears the 400-line budget, so the
orchestrator can split the branch at the `e8079a9`/`f8db3e0` boundary if the whole slice needs two PRs, or
accept `size:exception` for one PR. Nothing pushed, no PR opened.

- [x] 3.1 Create `app/raffle/[slug]/page.tsx` (server component): load event by `slug`, `notFound()` when absent, render `<RaffleEntryForm slug eventTitle />`. Implements: D7. Spec: Public Entry Page (both scenarios).
- [x] 3.2 Create `components/front/raffle/RaffleEntryForm.tsx` (client): `idle → submitting → { entered | already_entered | closed | error }` states; mobile-first Tailwind; `inputMode="tel"`; country select defaulting to `US`; posts to `POST /api/raffle/[slug]/entries`. Implements: D1, D7. Spec: Public Entry Submission / *New entry accepted*, *Duplicate phone is not an error*, *Event closed*. (also passes `initiallyClosed` computed server-side by page.tsx via `isRaffleEventClosed`, so the page doesn't flash the form for an already-closed event before the first fetch)
- [x] 3.3 Write `components/front/raffle/__tests__/RaffleEntryForm.test.tsx`: submits parsed name/phone values; renders `already_entered`, `event_closed`, and `error` states; success state hides the form; also covers inline field-error rendering and the outcome/payload pure-helper mappings directly. Implements: D7. Spec: Public Entry Page, Public Entry Submission.

### Verification

- `npx tsc --noEmit` → clean, no output
- `npx vitest run components/front/raffle/__tests__/RaffleEntryForm.test.tsx` → 16/16 passed
- `npm run lint` → 0 errors, 114 warnings (pre-existing baseline, none new)

---

## PR4a — Draw domain + draw/session/state routes (targets `feat/event-raffle-3b-entry-page-tests`)

Implemented on branch `feat/event-raffle-4a-draw-api`, three work-unit commits: `fbd2f02` (draw domain
`lib/raffle/draw.ts` + `tests/lib/raffle/draw.test.ts`, 283 lines), `d1cf050` (screen token verification +
winner masking + screen state — `lib/raffle/{screen-token,winner-view,screen-state}.ts` + their tests, 265
lines), `5754f3e` (the three route handlers + their tests, 442 lines). Test coverage was split into more
granular files than the two named in tasks.md (`tests/lib/raffle/{draw,screen-token,winner-view,screen-state}.test.ts`
for domain-level cases, `tests/api/{raffle-draw,raffle-screen}.test.ts` for route-level HTTP mapping) so each
commit carries only the tests for the module it introduces, per the apply-time work-unit-commits instruction.
Total authored diff vs the branch base is 990 lines, over the 400-line budget and over this section's own
PR4a estimate (230–300) — expected upfront (design.md: "PR4 as one unit forecast 350–400+", and the apply
prompt itself flagged this slice as likely exceeding budget). No task scope grew beyond 4a.1–4a.9; per the
apply-time instruction no test content was trimmed to fit. Commits 1 and 2 individually clear the 400-line
budget (283 and 265 lines); commit 3 (routes + their tests) is 442 lines, slightly over. See
`apply-progress.md` for the full per-commit breakdown. Branch-split vs `size:exception` decision deferred to
the orchestrator, same pattern as PR2/PR3. Nothing pushed, no PR opened.

- [x] 4a.1 Create `lib/raffle/screen-token.ts`: `generateScreenToken()`, `hashScreenToken(raw)` (SHA-256), `screenTokenMatches(raw, hash)` via `crypto.timingSafeEqual` on two 32-byte hashed buffers, `screenCookieName(slug)` (`pli_raffle_screen_<slug>`), `isRaffleSlug(value)` (the regex ^[a-z0-9-]{1,64}$), `SCREEN_COOKIE_MAX_AGE_SEC` (36h). Implements: D2. Spec: Screen Token Authorization.
- [x] 4a.2 Create `lib/raffle/winner-view.ts`: `toWinnerView(entry)` → `{ name, phoneLast4 }` (last 4 digits only, never the full `phoneE164`). Implements: D5. Spec: Draw Execution.
- [x] 4a.3 Create `lib/raffle/draw.ts`: `runDraw(tx, { drawId, now })` — `updateMany` claim guard with `RaffleDraw.drawingStartedAt` and `DRAW_CLAIM_TIMEOUT_MS = 60_000` (D3); on `count === 0` re-read and return `drawn` (idempotent replay) or `in_progress`; on claim success load eligible entries (exclude prior winners when `excludePreviousWinners`, D4), pick via `crypto.randomInt`, persist `winnerEntryId` / `drawnAt` / `status: "drawn"`; on zero eligible reset the claimed row to `open` / `drawingStartedAt: null` and return `no_eligible_entries`. Implements: D3, D4, D5. Spec: Draw Execution (all scenarios).
- [x] 4a.4 Create `lib/raffle/screen-state.ts`: `loadScreenState(db, slug)` → `{ now, event, entryCount, currentDrawId, draws[] }`; `currentDrawId` is the lowest `order` with status `open` / `drawing`. Implements: D1. Spec: Screen Display State.
- [x] 4a.5 Create `app/api/raffle/[slug]/screen-session/route.ts` (`GET`, `runtime = "nodejs"`): `isRaffleSlug` → load event (404 if absent) → `screenTokenMatches` (404 if not) → set cookie (`httpOnly`, `secure`, `sameSite: "strict"`, `path` = site root, `maxAge` per D2) → `302` to the URL /staff/raffle/[slug]/screen with `Referrer-Policy: no-referrer`, `Cache-Control: no-store`; rate-limited (`raffle:draw`-scale, D10). Implements: D2. Spec: Screen Token Authorization / *Valid key issues cookie*.
- [x] 4a.6 Create `app/api/raffle/[slug]/screen-state/route.ts` (`GET`, cookie-gated, `runtime = "nodejs"`): 404 on missing/invalid cookie; else return `loadScreenState` payload via `toWinnerView` for any drawn entries; rate-limited (`raffle:screen-state`, 240/60s). Implements: D1, D2, D5, D10. Spec: Screen Display State, Screen Token Authorization / *No cookie and no key*.
- [x] 4a.7 Create `app/api/raffle/[slug]/draws/[drawId]/draw/route.ts` (`POST`, cookie-gated, `runtime = "nodejs"`): rate-limited (`raffle:draw`, 20/60s); `prisma.$transaction(tx => runDraw(tx, { drawId, now }), { maxWait: 5000, timeout: 10000 })`; map `drawn` → `200`, `no_eligible_entries` → `409`, `in_progress` → `409 draw_in_progress`, missing draw/cookie → `404`. Implements: D2, D3, D4, D5, D10. Spec: Draw Execution (all scenarios), Screen Token Authorization.
- [x] 4a.8 Write `tests/api/raffle-draw.test.ts` (mocked Prisma, `vi.spyOn` on `crypto.randomInt`): `runDraw` picks the stubbed index; replay on a `drawn` draw returns the same winner; lost claim → `in_progress`; stale `drawing` older than 60s is reclaimed; prior winners excluded when the flag is on, included when off; zero eligible → `no_eligible_entries` and the row resets to `open`; route maps each status to its HTTP code; `toWinnerView` never returns the full phone. Implements: D3, D4, D5. Spec: Draw Execution (all scenarios). (domain-level cases moved to `tests/lib/raffle/draw.test.ts` and `tests/lib/raffle/winner-view.test.ts`; `tests/api/raffle-draw.test.ts` covers the route's HTTP-status mapping)
- [x] 4a.9 Write `tests/api/raffle-screen.test.ts` (mocked Prisma): `screenTokenMatches` accepts the right token and rejects a wrong one of equal and unequal length; `screen-session` sets the cookie and 302s, bad key → 404; `screen-state` without cookie → 404; `currentDrawId` is the lowest open/drawing order. Implements: D1, D2. Spec: Screen Token Authorization (both scenarios), Screen Display State. (`screenTokenMatches` and `currentDrawId` unit cases moved to `tests/lib/raffle/screen-token.test.ts` and `tests/lib/raffle/screen-state.test.ts`; `tests/api/raffle-screen.test.ts` covers the two routes' HTTP-status mapping)

### Verification

- `npx tsc --noEmit` → clean, no output
- `npx vitest run tests/lib/raffle tests/api` → 1147/1147 passed (111 test files)
- `npm run lint` → 0 errors, 114 warnings (pre-existing baseline, none new)

---

## PR4b — Screen UI (targets `feat/event-raffle-4a-draw-api`, split into PR4b1/PR4b2 — see note below)

PR4b was split into two chained slices for the same reason PR1/PR2/PR3/PR4a were: the tablet screen shell
(state machine, polling, countdown, Draw/Next-draw, winner-as-text reveal, closing state) and the fullscreen
MP4 video overlay + QR panel (with its offline canvas fallback) are independently reviewable, and doing both
in one PR would repeat PR4a's "forecast 350-400+" overage. **PR4b1** (this apply pass, branch
`feat/event-raffle-4b1-screen-shell`, targets `feat/event-raffle-4a4-draw-route`) implements the shell only.
**PR4b2** (not started) implements the video overlay and QR panel against the two named seams PR4b1 leaves
in place: `RaffleDrawVideoOverlay` and `RaffleQrPanel` in `components/front/raffle/RaffleScreenSeams.tsx`,
plus `RaffleScreen`'s injectable `isRevealReady` prop (defaults to always-ready; PR4b2 wires it to the
video's `ended` event instead of touching the reducer).

**Naming deviation from D6/this section's original task text (both PR4b1 and future PR4b2 use it)**: the
design diagram's `drawing_video` phase is `drawing` here, since PR4b1 has no video; the reveal gate is the
injectable `isRevealReady` signal (default: always ready) rather than a hardcoded `videoEnded && drawResult`
check, so PR4b2 can satisfy the same gate without changing `raffleScreenMachine.ts`. `error` is not a
separate phase — a failed draw returns to `ready` with `error` set, so the same Draw button retries.

- [x] 4b.1 Create `app/staff/raffle/[slug]/screen/page.tsx` (server component): redirect any request carrying `?key=` to the URL /api/raffle/[slug]/screen-session?key=...; when no valid cookie and no `key`, `notFound()`; else render `<RaffleScreen slug />`. Implements: D2. Spec: Screen Token Authorization. (PR4b1)
- [x] 4b.2 Create `components/front/raffle/RaffleScreen.tsx` (client container): state machine `waiting → ready → drawing → reveal → between_draws → finished` per D6 (see naming-deviation note above); polls `useRaffleScreenState(slug)` every 5s, paused during `drawing`/`reveal`; clock-drift offset `Date.parse(payload.now) - Date.now()`; reveal gated behind the injectable `isRevealReady` signal (always-ready in this slice); POST failure → back to `ready` with `error` set, retry is the same Draw button. Implements: D6. Spec: Screen Display State, Draw Execution / *Double tap yields one winner* (client half). (PR4b1)
- [x] 4b.3 Create presentational components: countdown display, QR renderer (`api.qrserver.com` `<img>` with `onError` fallback to local `qrcode` canvas render), fullscreen `<video preload="auto" playsInline muted>` overlay, winner reveal card (`••• ••• <phoneLast4>` + Next draw button), closing/finished card. Implements: D6. Spec: Screen Display State, QR Code Rendering, Draw Execution. **Split**: countdown display, winner reveal card, and closing card shipped in PR4b1 (`RaffleScreenView.tsx`). The QR renderer and video overlay were named seams only through PR4b1; this pass (`feat/event-raffle-4c1-draw-video`) implements their real bodies in `RaffleScreenSeams.tsx` — see the PR4c section below.
- [x] 4b.4 Write `components/front/raffle/__tests__/RaffleScreen.test.tsx`: countdown reaching zero shows the Draw button and sends nothing automatically; a successful draw reveals the winner; a draw failure renders its error and the same Draw button retries without breaking the machine; `currentDrawId === null` renders the closing state; polling updates the entry count. Implements: D6. Spec: Screen Display State / *Countdown reaches zero*. (PR4b1) **The two cases deferred at PR4b1 time are now covered** (`feat/event-raffle-4c1-draw-video`): "reveal fires only when the video ends and the draw response arrives" is covered by two new `RaffleScreen.test.tsx` cases (video-ends-first and response-first) plus a rejected-`play()` case; "QR `onError` swaps to the local canvas render" is covered by `RaffleScreenSeams.test.tsx`'s new `RaffleQrPanel` describe block.

### Verification (PR4b1)

- `npx tsc --noEmit` → clean, no output
- `npx vitest run components/front/raffle/__tests__/RaffleScreen.test.tsx components/front/raffle/__tests__/raffleScreenMachine.test.ts` → 33/33 passed
- `npm run lint` → 0 errors, 114 warnings (pre-existing baseline, none new)

---

## PR4c — Fullscreen draw video overlay + QR panel (branch `feat/event-raffle-4c1-draw-video`, targets `feat/event-raffle-4b5-screen-route`)

Completes the two seams PR4b1 left in place (4b.3's `RaffleQrPanel`/`RaffleDrawVideoOverlay` stubs) and the
two 4b.4 test cases PR4b1 deferred, closing out the whole PR4b slice. The branch chain PR4b1 was implemented
on was later regrouped by the coordinator into `feat/event-raffle-4b1-poll-hook` ← `4b2-screen-machine` ←
`4b3-screen-view` ← `4b4-screen-container` ← `4b5-screen-route` (see `apply-progress.md`); `4b5-screen-route`
is this pass's actual base. Three work-unit commits, each independently under the 400-line budget except the
first (see per-commit note):

| Commit | Content | Files | Authored lines |
|---|---|---|---|
| 1 | Video overlay | `RaffleScreenSeams.tsx` (video half), `RaffleScreenView.tsx`, `RaffleScreen.tsx`, `raffleScreenMachine.ts` (`selectVideoUrl`), `hooks/useRaffleScreenState.ts` (type), `__tests__/RaffleScreen.test.tsx`, new `__tests__/RaffleScreenSeams.test.tsx` (video half) | 482 |
| 2 | QR panel | `RaffleScreenSeams.tsx` (QR half), `__tests__/RaffleScreenSeams.test.tsx` (QR half), `package.json` (+`qrcode`/`@types/qrcode`) | 167 (excl. lockfile) |
| 3 | Expose `videoUrl` through screen state | `lib/raffle/screen-state.ts`, `tests/lib/raffle/screen-state.test.ts` | 39 |

Commit 1 (482 lines) is over the general 400-line PR budget on its own — the overage is the fullscreen
video overlay's real implementation (mount-from-start, `hidden`-toggle visibility, rejected/absent-`play()`
handling) plus its container wiring (the new `videoEnded` state and `revealReady` gate in `RaffleScreen.tsx`)
plus thorough test coverage for both (ordering in either direction, a rejected `play()`, hidden/visible).
No test/comment content was trimmed to fit, per the apply-time instruction. Commits 2 and 3 individually
clear budget by a wide margin.

**Budget note (unresolved, needs a maintainer/orchestrator decision, same pattern as every prior PR in this
change)**: total authored diff vs `feat/event-raffle-4b5-screen-route` (excl. the lockfile, `openspec/`, and
the pre-existing binary `public/raffle/draw.mp4`) is **684 changed lines** (605 insertions, 79 deletions)
across the three commits — over the apply prompt's own "well under 600" instruction for this slice, before
counting this documentation update on top. No task scope grew beyond 4b.3 and 4b.4's two deferred test
cases; the overage is thorough test coverage (both ordering directions of the reveal gate, the rejected/absent
`play()` cases, the QR fallback, hidden/visible) that the apply prompt explicitly said not to trim. The three
commits are already a clean, independently-revertable split (see the per-commit table above); commit 1
alone (482 lines) is the one still over the general 400-line PR budget. Two next steps are available and
neither was taken unilaterally: (a) split commit 1 into its own `feat/event-raffle-4c1a-video-overlay`-style
sub-branch, or (b) accept `size:exception` for the whole `feat/event-raffle-4c1-draw-video` branch (or just
its first commit). Nothing was pushed and no PR was opened either way.

**Implementation notes**:
- The video overlay is mounted unconditionally in every `RaffleScreenView` phase branch (not only `drawing`)
  so playback buffering starts on the very first render; visibility toggles via the `hidden` attribute.
- A `play()` call that returns a rejected promise, or that does not return a promise at all (jsdom's
  `HTMLMediaElement.play()` stub, and the only realistic non-spec-compliant case), is treated as an immediate
  `ended` so a video that cannot actually play never blocks the reveal. This also means the browser tests
  that predate this pass and never mock `play()` keep passing unmodified: jsdom's stub always resolves the
  reveal instantly, exactly as it did before this pass, and the new ordering tests explicitly mock
  `HTMLMediaElement.prototype.play` to control the timing being asserted.
- `RaffleScreen.tsx`'s `isRevealReady` prop is unchanged in shape but its *default* behavior changed: it now
  tracks the video's own `ended` event via internal state instead of always returning `true`. This is the
  intentional completion of the "gates the winner reveal behind an injectable readiness signal" design —
  `raffleScreenMachine.ts` itself was not touched.
- `RaffleQrPanel`'s `entryUrl` prop is unchanged. On the remote image's `onError` it lazily `import()`s the
  `qrcode` package (only loaded once a failure actually happens) and draws onto a `<canvas>`; the URL is
  always rendered as text underneath.
- `lib/raffle/screen-state.ts`'s `RaffleScreenState.event.videoUrl` is always a resolved string (the event's
  own, else the shared fallback video path committed alongside PR4c1); the client type marks it optional
  only so the pre-existing `raffleScreenMachine.test.ts`/`RaffleScreen.test.tsx` fixtures that predate this
  field keep compiling without being touched.

### Verification (PR4c)

- `npx tsc --noEmit` → clean, no output
- `npx vitest run components/front/raffle tests/lib/raffle tests/api` → 1218/1218 passed (115 test files)
- `npm run lint` → 0 errors, 114 warnings (pre-existing baseline, none new)

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
