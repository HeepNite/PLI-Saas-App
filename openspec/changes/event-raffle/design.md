# Design: Event Raffle (v1)

## Context

The contract for this design is `specs/event-raffle/spec.md`. Supporting inputs: `proposal.md` (scope,
delivery, rollback), `research.md` (decisions 1–4, confirmed), `explore.md` (codebase constraints).
Where this document and the spec name the same thing, the spec's naming wins.

Codebase facts this design is built on (verified, not assumed):

- `parseNationalPhone(input, country)` in `lib/phone/index.ts` (committed on `main` and `codex/develop`) returns `{ ok: true, phone: { country, callingCode, nationalNumber, nationalDisplay, e164, digits } }` or `{ ok: false, reason }` or `undefined`. It is the only normalizer used here.
- `lib/security/rate-limit.ts` exposes `consumeRateLimit({ key, limit, windowMs })`, `buildRateLimitKey(scope, id)`, `getClientIp(req)`. Store is an in-process `Map` on `globalThis` — per-instance, best-effort, auto-bypassed when `NODE_ENV=test` unless `ENABLE_RATE_LIMIT_IN_TESTS=1`.
- Repo 429 convention: `NextResponse.json({ … }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } })` (`app/api/checkout/session/route.ts`).
- Base-URL convention is `NEXT_PUBLIC_SITE_URL || (VERCEL_URL ? https://$VERCEL_URL : http://localhost:3000)` — **not** `NEXT_PUBLIC_APP_URL`. The seed script reuses this exact precedence.
- Prisma convention: `String @id @default(cuid())`, `createdAt @default(now())`, `updatedAt @updatedAt`, status columns are `String` (e.g. `Purchase.status`), not Postgres enums.
- Scripts run through `tsx` (`"migrate:clerk": "tsx scripts/migrate-clerk-instance.ts"`).
- Unit tests mock the client with `vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))` (`tests/packages.test.ts`).
- Studio timezone is `America/New_York`, handled with `Intl.DateTimeFormat` (`StaffTerminalShell.tsx:53`).
- Dark full-viewport idiom: `flex h-screen w-full items-center justify-center bg-[#13141d]` (`StaffTerminalShell.tsx:309`). Reused by copy, not by import; that file is not modified.

## Goals / Non-goals

**Goals**: collect entries with no login; authorize one tablet per event without Clerk; execute each draw
exactly once with a fair winner; keep every route handler thin so the draw is unit-testable with a mocked
Prisma client; ship in five independently reviewable slices, none over 400 lines.

**Non-goals**: admin CRUD, multiple winners per draw, native app, winner SMS, i18n, cross-instance rate
limiting, real-time push (5s polling is sufficient at one-tablet scale).

## Decisions

### D1 — Domain lives in `lib/raffle/`, routes are transport only

**Choice**: seven focused modules; each route handler parses input, calls one domain function, maps a
discriminated result to a status code.

| File | Responsibility |
|---|---|
| `lib/raffle/entry-validation.ts` | `parseRaffleEntryInput(body: unknown)` → `{ ok: true, value } \| { ok: false, status }`. Hand-rolled `unknown` narrowing + `parseNationalPhone`, default country `US`. |
| `lib/raffle/event-window.ts` | `isRaffleEventClosed(eventDate, now)` — pure, no I/O (see D11). |
| `lib/raffle/entry.ts` | `createRaffleEntry(db, input)` → `{ status: "entered" \| "already_entered" \| "event_closed" \| "event_not_found" }`. Owns the P2002 catch. |
| `lib/raffle/screen-token.ts` | `generateScreenToken()`, `hashScreenToken(raw)`, `screenTokenMatches(raw, hash)`, `screenCookieName(slug)`, `isRaffleSlug(value)`, `SCREEN_COOKIE_MAX_AGE_SEC`. |
| `lib/raffle/draw.ts` | `runDraw(tx, { drawId, now })` → `{ status: "drawn" \| "in_progress" \| "no_eligible_entries" \| "not_found", winner? }`. |
| `lib/raffle/screen-state.ts` | `loadScreenState(db, slug)` → screen payload (event, entry count, draws, current draw, `now`). |
| `lib/raffle/winner-view.ts` | `toWinnerView(entry)` → `{ name, phoneLast4 }`. Shared by the draw and screen-state responses. |

**Alternatives**: (a) logic inline in route handlers — rejected, `runDraw` becomes untestable without an
HTTP harness and a live DB; (b) a `RaffleService` class — rejected, no state to hold, the repo is
function-first (`lib/packages.ts`, `lib/checkout/*`).
**Rationale**: `runDraw(tx, …)` taking the transaction client as its first parameter is the same shape as
`reservePackageCreditForAttendanceTx` already in this repo, and it is the only shape that lets Vitest drive
the whole concurrency contract with a mock.

### D2 — Screen token: stored as SHA-256, exchanged for a per-event cookie by a route handler

**Choice**: `RaffleEvent.screenTokenHash` holds `sha256(rawToken)` hex. Verification hashes the input and
compares with `crypto.timingSafeEqual`. The exchange is
`GET /api/raffle/[slug]/screen-session?key=<raw>`: it validates, sets the cookie, and 302s to
`/staff/raffle/[slug]/screen`. Cookie: name `pli_raffle_screen_<slug>`, value = raw token,
`httpOnly`, `secure`, `sameSite: "strict"`, `path: "/"`, `maxAge = 36h`. The response also carries
`Referrer-Policy: no-referrer` and `Cache-Control: no-store`.

**Spec conformance**: the spec describes `GET /staff/raffle/[slug]/screen?key=<token>` setting the cookie
and redirecting to the same path without `key`. That observable behavior is preserved: the screen page,
when it receives a `?key=`, immediately redirects to the exchange route, which sets the cookie and 302s back
to `/staff/raffle/[slug]/screen` with no `key`. Both URL shapes therefore work and both end on the clean
path; the exchange route exists only because a server component may not set a cookie (below). Deviating
from the spec's `screenToken` field name to `screenTokenHash` is deliberate and coordinator-approved.

**Alternatives**: (a) plaintext token column — rejected, a DB dump or log leak is directly replayable;
(b) one cookie `pli_raffle_screen=<slug>.<token>` — rejected, needs parsing and can only authorize one
event per tablet; (c) server component reads `searchParams` and sets the cookie — rejected, Next 15
forbids `cookies().set` during a server-component render, so it would need a client-side round trip;
(d) server action — rejected, requires a rendered page and a POST for what is a plain GET link.
**Rationale**: hashing the input first makes both buffers exactly 32 bytes, which removes
`timingSafeEqual`'s length-mismatch throw as a code path. `path: "/"` is required because the screen page
and `/api/raffle/*` share no prefix. `isRaffleSlug` (`/^[a-z0-9-]{1,64}$/`) runs before the cookie name is
built, so the slug can never inject a cookie-name separator. No valid cookie and no valid key →
`notFound()` (404, never 401 — an unauthenticated probe learns nothing about the event's existence).

### D3 — Stuck `drawing` recovery and isolation level

**Choice**: `RaffleDraw.drawingStartedAt`. The claim guard is

```ts
const claimed = await tx.raffleDraw.updateMany({
  where: {
    id: drawId,
    OR: [{ status: "open" }, { status: "drawing", drawingStartedAt: { lt: new Date(now - DRAW_CLAIM_TIMEOUT_MS) } }],
  },
  data: { status: "drawing", drawingStartedAt: new Date(now) },
})
```

with `DRAW_CLAIM_TIMEOUT_MS = 60_000`. `claimed.count === 0` → the draw is either `drawn` (re-read and
return the persisted winner, idempotent) or freshly `drawing` (`in_progress`). Transaction options:
default `ReadCommitted`, `{ maxWait: 5_000, timeout: 10_000 }`.

**Alternatives**: (a) `Serializable` — rejected, it adds 40001 retry handling and holds pool slots longer,
and with Railway `connection_limit=5` a retry storm is a worse failure mode than the race it prevents;
(b) `SELECT … FOR UPDATE` via `$queryRaw` — rejected, `research.md` Lane 2 shows Prisma cannot combine it
with the surrounding statements in one prepared statement; (c) no timeout, `drawing` is terminal —
rejected, a crashed request would brick that draw for the rest of the event with no UI recovery, and the
spec requires recovery without manual database edits.
**Rationale**: under `ReadCommitted` Postgres re-evaluates the `WHERE` of a conditional single-row `UPDATE`
after the row lock is released, so the losing concurrent request sees `status = 'drawing'` and gets
`count = 0`. The guard column, not the isolation level, is doing the concurrency work. 60s is far longer
than the ~10s transaction ceiling, so a live request can never be stolen from.

### D4 — Fair selection, and reverting the claim on zero eligible

**Choice**: inside the transaction, load the draw with its event (for `excludePreviousWinners`), then the
prior winner ids for that event, then
`tx.raffleEntry.findMany({ where: { eventId, id: { notIn: priorWinnerIds } }, select: { id: true }, orderBy: { id: "asc" } })`;
pick `ids[crypto.randomInt(0, ids.length)]`. When `ids.length === 0`, `runDraw` **resets the row it just
claimed** (`status: "open"`, `drawingStartedAt: null`) before returning `no_eligible_entries`.

**Alternatives**: (a) `ORDER BY random() LIMIT 1` raw SQL — rejected, non-CSPRNG and unmockable in unit
tests; (b) `Math.random()` — rejected, not cryptographically strong; (c) `skip: randomOffset, take: 1` —
rejected, needs a separate `count` and is not stable against a concurrent insert; (d) throwing to force a
transaction rollback on zero eligible — rejected, exception control flow would break `runDraw`'s plain
discriminated return and makes the "reverts to open" assertion indirect.
**Rationale**: `crypto.randomInt(0, n)` is unbiased and its `n < 2**48` bound is unreachable here.
Deterministic `orderBy: { id: "asc" }` makes the index→winner mapping reproducible in tests with a stubbed
`randomInt`. The explicit reset is what satisfies the spec's "draw status reverts to open" and is directly
assertable against a mocked client. A few thousand cuids is tens of KB — irrelevant memory-wise, one round trip.

### D5 — Winner exposure

**Choice**: draw and screen-state responses return `winner: { name, phoneLast4 }` only — `phoneLast4` is
the four trailing digits (e.g. `"1234"`), which is the concrete filling of the spec's masked-phone slot.
The screen renders `••• ••• 1234`. The full `phoneE164` never leaves the server.

**Alternatives**: last 2 digits — rejected, collides across a few hundred entries so staff cannot resolve
"is that me?" on stage; full number — rejected, it would be projected on a public screen.
**Rationale**: last 4 is the minimum that lets a winner self-identify in a loud venue while keeping the
projected screen and the network response free of a complete contactable identifier.

### D6 — Screen client: one container, presentational children, explicit state machine

**Choice**: `RaffleScreen.tsx` (client container) owns the state machine and data; children are pure
presentational components. Polling via `useRaffleScreenState(slug)` — 5s interval, paused while
`drawing_video` plays. Clock drift: every poll stores `offset = Date.parse(payload.now) - Date.now()`;
countdown renders `drawAt - (Date.now() + offset)`. Video: `<video preload="auto" playsInline muted>`
mounted hidden and only unhidden on `drawing_video`. Reveal condition is `videoEnded && drawResult !== null`.
POST failure → state `error` with a retry button; the video is never replayed on retry.

**Alternatives**: SSE/WebSocket — rejected as YAGNI for one tablet and one screen; countdown from client
clock only — rejected, tablet clock drift would fire the "ready" state early or late; auto-firing the draw
at zero — rejected by the spec (a staff tap must start it).
**Rationale**: separating "video finished" from "server answered" is the whole reason the reveal never
shows a half state; making it one boolean `&&` in the container keeps that invariant in one place. GSAP is
not adopted: the reveal is an opacity/scale transition, so Tailwind transitions suffice and add no dependency.

### D7 — Public entry page

**Choice**: `app/raffle/[slug]/page.tsx` is a server component: fetch event by slug, `notFound()` when
missing, render `<RaffleEntryForm slug eventTitle />` (client). Form states: `idle → submitting →
{ entered | already_entered | closed | error }`. Mobile-first Tailwind, English copy, `inputMode="tel"`,
country select defaulting to `US` (spec's default country).

**Rationale**: the server component keeps the 404 decision and the DB read off the client; the form is the
only interactive surface, which is the container/presentational split this repo already uses.

### D8 — Seed script contract

`scripts/raffle-seed.ts`, `npm run raffle:seed -- <config.json> [--base-url https://…]`.

```json
{
  "slug": "ple-launch-2026-09-12",
  "title": "PLE Launch Night",
  "brand": "PLE",
  "eventDate": "2026-09-12",
  "excludePreviousWinners": true,
  "videoUrl": "/raffle/draw.mp4",
  "draws": [{ "order": 1, "prizeLabel": "Grand Prize — free month", "drawAt": "2026-09-12T23:30:00-04:00" }]
}
```

Idempotency: `upsert` the event by `slug`; generate a token **only when `screenTokenHash` is absent** (a
re-run never invalidates a tablet already in the venue) — `--rotate-token` forces a new one and prints it.
Draws are upserted by `@@unique([eventId, order])`; a draw whose status is not `open` is **skipped and
reported**, never mutated. Prints the public URL and the tablet URL with `?key=` using
`--base-url ?? NEXT_PUBLIC_SITE_URL ?? VERCEL_URL ?? http://localhost:3000`. The raw token is printed once,
at generation time only, since only the hash is stored.

### D9 — Prisma schema (additive only)

```prisma
model RaffleEvent {
  id                     String        @id @default(cuid())
  slug                   String        @unique
  brand                  String        @default("PLE")
  title                  String
  eventDate              DateTime
  excludePreviousWinners Boolean       @default(true)
  screenTokenHash        String
  videoUrl               String?
  createdAt              DateTime      @default(now())
  updatedAt              DateTime      @updatedAt
  entries                RaffleEntry[]
  draws                  RaffleDraw[]
}

model RaffleEntry {
  id           String       @id @default(cuid())
  eventId      String
  event        RaffleEvent  @relation(fields: [eventId], references: [id], onDelete: Cascade)
  name         String
  phoneE164    String
  phoneCountry String
  createdAt    DateTime     @default(now())
  wonDraws     RaffleDraw[]

  @@unique([eventId, phoneE164])
  @@index([eventId, createdAt])
}

model RaffleDraw {
  id               String       @id @default(cuid())
  eventId          String
  event            RaffleEvent  @relation(fields: [eventId], references: [id], onDelete: Cascade)
  order            Int
  prizeLabel       String
  drawAt           DateTime?
  status           String       @default("open") // open | drawing | drawn
  drawingStartedAt DateTime?
  winnerEntryId    String?
  winnerEntry      RaffleEntry? @relation(fields: [winnerEntryId], references: [id], onDelete: SetNull)
  drawnAt          DateTime?
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt

  @@unique([eventId, order])
  @@index([eventId, status])
  @@index([winnerEntryId])
}
```

Migration: `prisma/migrations/<timestamp>_add_raffle_models/`. `status` is `String`, not a Postgres enum,
matching `Purchase.status` and avoiding enum-alter migrations later. `excludePreviousWinners` is an event-level
policy (one rule per night), which is why it lives on `RaffleEvent` and not on each draw.

### D10 — Rate limits

| Scope | Limit | Key | Reason |
|---|---|---|---|
| `raffle:entry:ip` | 10 / 60s | `getClientIp(req)` | a whole venue can share one NAT IP, so this must not be tight |
| `raffle:entry:phone` | 5 / 300s | `e164` (post-parse) | blocks one number retried across IPs |
| `raffle:draw` | 20 / 60s | `getClientIp(req)` | cookie already gates it; this only caps a tap-storm |
| `raffle:screen-state` | 240 / 60s | `getClientIp(req)` | 12 polls/min expected, wide margin |

The in-process store is per serverless instance, so these are best-effort throttles. The real duplicate
guard is `@@unique([eventId, phoneE164])`; the real draw guard is the status column.

### D11 — Closed-event rule as a pure function

**Choice**: `lib/raffle/event-window.ts`

```ts
export const RAFFLE_EVENT_GRACE_MS = 24 * 60 * 60 * 1000 // through the end of the event night
export const isRaffleEventClosed = (eventDate: Date, now: Date) =>
  now.getTime() > eventDate.getTime() + RAFFLE_EVENT_GRACE_MS
```

`eventDate` is stored as the America/New_York midnight that starts the event day, so `+ 1 day` is the end of
that night in studio-local terms and no timezone maths is needed at call time. The entry endpoint calls this
before touching the entry table and returns `410 { status: "event_closed" }`.

**Alternatives**: (a) an `isOpen`/`closedAt` boolean column — rejected, it needs a human or a cron to flip and
would silently keep collecting after the party; (b) inline date comparison in the route handler — rejected,
the rule is the thing most likely to be argued about and must be assertable without HTTP; (c) computing the
NY day boundary at request time with `Intl` — rejected as unnecessary once the seed normalizes `eventDate`.
**Rationale**: one exported pure function with an injected `now` makes both the open and closed cases plain
unit tests, and keeps the grace window a single named constant.

## Architecture

```
attendee phone ──► GET  /raffle/[slug]                    (server component → RaffleEntryForm)
                └─ POST /api/raffle/[slug]/entries        ──► entry-validation ──► event-window ──► entry ──► prisma

tablet ──► GET /staff/raffle/[slug]/screen?key=…          (redirects to the exchange)
        ├─ GET /api/raffle/[slug]/screen-session?key=…    ──► screen-token ──► Set-Cookie ──► 302
        └─ GET /staff/raffle/[slug]/screen                (cookie-gated server component → RaffleScreen)
             ├─ GET  /api/raffle/[slug]/screen-state      ──► screen-state ──► winner-view
             └─ POST /api/raffle/[slug]/draws/[drawId]/draw ──► $transaction( runDraw ) ──► winner-view
```

**Entry flow**: rate-limit(IP) → parse JSON → `parseRaffleEntryInput` (400 on failure) → rate-limit(e164) →
load event by slug (404 if absent) → `isRaffleEventClosed` (410 `event_closed`) → insert →
`201 { status: "entered" }`, or P2002 → `200 { status: "already_entered" }`.

**Screen session flow**: `isRaffleSlug` → load event (404 if absent) → `screenTokenMatches` (404 if not) →
`cookies().set` → 302 to `/staff/raffle/[slug]/screen` with `Referrer-Policy: no-referrer`.

**Draw flow**: cookie gate → light rate limit → `prisma.$transaction(tx => runDraw(tx, { drawId, now }))` →
claim guard → event flag + prior winners → eligible ids → `crypto.randomInt` → write `winnerEntryId`,
`drawnAt`, `status: "drawn"` → `toWinnerView` → `200 { status: "drawn", winner }`; zero eligible → reset the
claim to `open` → `409 { status: "no_eligible_entries" }`; lost claim → `409 { status: "draw_in_progress" }`;
already drawn → `200 { status: "drawn", winner }` (same winner).

## API contracts

All handlers declare `export const runtime = "nodejs"` (they use `node:crypto`).

| Route | Method | Auth | Success | Errors |
|---|---|---|---|---|
| `/api/raffle/[slug]/entries` | POST | public | `201 { status: "entered" }` · `200 { status: "already_entered" }` | `400 { status: "invalid_name" \| "invalid_phone" \| "invalid_body" }`, `404 { status: "event_not_found" }`, `410 { status: "event_closed" }`, `429 + Retry-After` |
| `/api/raffle/[slug]/screen-session` | GET | `?key=` | `302 → /staff/raffle/[slug]/screen` + `Set-Cookie` | `404` (bad slug or token), `429 + Retry-After` |
| `/api/raffle/[slug]/screen-state` | GET | cookie | `200 { now, event: { slug, title, entryUrl }, entryCount, currentDrawId, draws: [{ id, order, prizeLabel, status, drawAt, winner? }] }` | `404` (no/invalid cookie) |
| `/api/raffle/[slug]/draws/[drawId]/draw` | POST | cookie | `200 { status: "drawn", drawId, winner: { name, phoneLast4 } }` (identical on replay) | `409 { status: "draw_in_progress" }`, `409 { status: "no_eligible_entries" }`, `404`, `429 + Retry-After` |

Entry request body: `{ name: string, phone: string, country?: string }`. `name` trimmed, 2–60 chars, must
contain a non-digit. `country` defaults to `"US"` and must satisfy `isKioskPhoneCountry`; `phone` must yield
a `parseNationalPhone` result, and its `e164` is what is stored. `currentDrawId` is the lowest `order` whose
status is `open` or `drawing`, or `null` when none remain.

## Screen state machine

```
waiting ──(countdown reaches 0)──► ready ──(staff tap: POST + play)──► drawing_video
   ▲                                                                       │
   │                                                    (videoEnded && drawResult)
   │                                                                       ▼
   └──(next draw selected)──── between_draws ◄──("Next draw" pressed)── reveal
                                    │
                                    └──(currentDrawId === null)──► finished
                                                       error ◄──(POST failed) ──► retry → ready
```

- `waiting`: QR (primary `api.qrserver.com`, `qrcode` canvas fallback on `onError`), live entry count, `prizeLabel`, countdown.
- `ready`: centered **Draw** button; nothing auto-fires.
- `drawing_video`: fullscreen MP4, polling paused, button disabled.
- `reveal`: winner name + `••• ••• 1234`, **Next draw** button.
- `finished`: closing card, QR hidden.

## Testing strategy

`vitest run`, node env, `vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))`; `crypto.randomInt` stubbed
via `vi.spyOn`. Component tests use the existing jsdom/RTL setup under `components/front/raffle/__tests__/`.

| Slice | Tests |
|---|---|
| 1 schema + seed | seed upsert is idempotent; token generated only when absent; a `drawn` draw is skipped not mutated while the `open` one is updated; printed URLs honour `--base-url` then `NEXT_PUBLIC_SITE_URL` |
| 2 entry endpoint | valid entry → 201 `entered` with stored `e164`; each validator rejection status; name 1 char and 61 chars rejected; missing `country` defaults to US; P2002 → 200 `already_entered`; unknown slug → 404; `isRaffleEventClosed` open/closed boundary; closed event → 410 `event_closed`; 429 carries `Retry-After` (with `ENABLE_RATE_LIMIT_IN_TESTS=1`) |
| 3 entry page | form submits parsed values; `already_entered`, `event_closed` and error states render; success state hides the form |
| 4a draw + screen APIs | `runDraw` picks the stubbed index; replay on a `drawn` draw returns the same winner; lost claim → `draw_in_progress`; stale `drawing` older than 60s is reclaimed; prior winners excluded when the event flag is on and included when off; zero eligible → `no_eligible_entries` **and** the row is reset to `open`; `screenTokenMatches` accepts the right token and rejects a wrong one of equal and unequal length; `screen-session` sets the cookie and 302s, bad key → 404; screen-state without cookie → 404; `currentDrawId` is the lowest open/drawing order; `toWinnerView` never returns full phone |
| 4b screen UI | countdown zero shows the Draw button and sends nothing; reveal only when `videoEnded && drawResult`; POST failure shows retry without replaying the video; QR `onError` swaps to the local canvas render; `currentDrawId === null` renders the closing state |

## Delivery slices (auto-chain, 400-line budget)

| PR | Content | Est. lines |
|----|---------|-----------|
| 1 | `prisma/schema.prisma` + migration + `scripts/raffle-seed.ts` + npm script + seed tests | 150–210 |
| 2 | `lib/raffle/{entry-validation,event-window,entry}.ts` + entries route + tests | 190–250 |
| 3 | `app/raffle/[slug]/page.tsx` + `RaffleEntryForm` + tests | 140–200 |
| 4a | `lib/raffle/{draw,screen-token,screen-state,winner-view}.ts` + `draws/[drawId]/draw` route + `screen-session` route + `screen-state` route + tests | 230–300 |
| 4b | `app/staff/raffle/[slug]/screen/page.tsx` + `RaffleScreen` container + countdown/video/QR/reveal presentational components + component tests | 250–330 |

The 4a/4b split is committed, not conditional: PR4 as one unit forecast 350–400+ and would have landed the
draw transaction and the whole screen UI in one review. 4a is independently verifiable with API tests only;
4b consumes 4a's endpoints and is reviewable as pure UI. PR1 targets `codex/develop` (per
`openspec/config.yaml`); each later PR targets the previous slice's branch.

## Threat matrix

The five rows of `references/threat-matrix.md` cover shell/VCS/PR-automation boundaries, none of which this
change touches. Documentation-like paths: **N/A** — no file classification or execution. Git repository
selection, commit state, push state, PR commands: **N/A** — no `git`, subprocess, or PR automation; the only
new script is a `tsx` DB seeder invoked by a human. The real boundary here is HTTP, covered by D2, D3, D5,
D10, D11 and their tests: token in URL (single 302 hop, `no-referrer`, hash-at-rest), unauthenticated write
(validators + dual rate limit + unique constraint), draw race (claim guard + idempotent replay), stale
collection (410 closed rule), and PII on a public screen (`phoneLast4` only).

## Migration / rollout

1. Additive-only migration; no `ALTER` on existing tables, so a partial prod history cannot conflict semantically.
2. Known prod drift (`_prisma_migrations` has a renamed/duplicate `day_of_week` entry) can still make
   `prisma migrate deploy` fail before it reaches this migration. Before event day: inspect
   `_prisma_migrations`, and if deploy is blocked, apply `<timestamp>_add_raffle_models/migration.sql`
   manually and `prisma migrate resolve --applied <timestamp>_add_raffle_models`. Do not run
   `migrate dev`/`reset` against prod.
3. Seed the event, print the tablet URL, open it once on the tablet before doors open so the cookie is set
   while there is still time to re-exchange.
4. Kill switch: delete the `RaffleEvent` row → both routes 404 with no deploy.
5. Rollback: revert PRs newest-first; drop the three tables in a follow-up migration if needed.

## Open questions

- [ ] MP4 asset and its final duration (drives nothing structurally; the reveal waits on `ended`).
- [ ] `brand` default `"PLE"` assumed; confirm at seed time whether PLI reuse needs a different value.

Next phase: sdd-tasks
