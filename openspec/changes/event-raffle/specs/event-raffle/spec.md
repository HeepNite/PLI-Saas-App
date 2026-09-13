# Event Raffle Specification

## Purpose

Brand-agnostic (PLE|PLI) on-site raffle: unauthenticated attendees submit name + phone via QR-linked page; staff run fair, idempotent draws on a token-gated tablet screen.

## Requirements

### Requirement: Raffle Data Model

The system MUST persist `RaffleEvent` (unique `slug`, `brand` PLE|PLI, `title`, `eventDate`, `excludePreviousWinners` default true, `screenTokenHash` — the SHA-256 of the per-event screen token), `RaffleEntry` (`eventId`, `name`, `phoneE164`, unique `(eventId, phoneE164)`), and `RaffleDraw` (`eventId`, `order`, `prizeLabel`, `drawAt`, `status` open|drawing|drawn, `winnerEntryId` nullable, `drawnAt`). One event MUST have many draws.

#### Scenario: Duplicate phone constrained at the database

- GIVEN an entry already exists for `(eventId, phoneE164)`
- WHEN a second insert with the same pair is attempted
- THEN the unique constraint MUST reject it

### Requirement: Public Entry Page

`GET /raffle/[slug]` MUST render a name + phone form for an existing event and MUST return 404 for an unknown slug.

#### Scenario: Existing event renders form

- GIVEN a `RaffleEvent` with slug `s1` exists
- WHEN a visitor requests `GET /raffle/s1`
- THEN the page renders the entry form

#### Scenario: Unknown slug is not found

- GIVEN no `RaffleEvent` has slug `s2`
- WHEN a visitor requests `GET /raffle/s2`
- THEN the response is 404

### Requirement: Public Entry Submission

`POST /api/raffle/[slug]/entries` MUST validate `name` (trimmed, 2–60 chars) and `phone` (via `parseNationalPhone`, default country US, MUST resolve to E.164), MUST be rate-limited per IP, MUST reject entries for a closed/past event, and MUST NOT require auth or OTP.

#### Scenario: New entry accepted

- GIVEN valid name and phone for an open event
- WHEN the entry is submitted
- THEN the response is 201 `{ status: "entered" }` and a `RaffleEntry` row is created

#### Scenario: Duplicate phone is not an error

- GIVEN a `RaffleEntry` already exists for this event and phone
- WHEN the same phone is submitted again
- THEN the response is 200 `{ status: "already_entered" }` and no duplicate row is created

#### Scenario: Rate limit exceeded

- GIVEN an IP has exceeded the configured submission rate
- WHEN it submits another entry
- THEN the response is 429

#### Scenario: Event closed

- GIVEN the event date has passed
- WHEN an entry is submitted
- THEN the response is 410 (or an equivalent explicit closed status)

### Requirement: Screen Token Authorization

`GET /staff/raffle/[slug]/screen?key=<token>` MUST compare the token in constant time; a valid token MUST set an `HttpOnly`/`Secure`/`SameSite=Strict` event-scoped cookie and redirect to the same path without `key`. Missing valid cookie and missing/invalid key MUST return 404. Draw and screen-state endpoints MUST require this cookie, never the URL key.

#### Scenario: Valid key issues cookie

- GIVEN a correct `screenToken` in `?key=`
- WHEN the tablet requests the screen
- THEN a scoped cookie is set and the browser is redirected without `key`

#### Scenario: No cookie and no key

- GIVEN neither a valid cookie nor a valid `key`
- WHEN the screen is requested
- THEN the response is 404

### Requirement: Screen Display State

The screen MUST show the current draw (lowest `order` with status open/drawing), its prize label, a countdown to `drawAt`, and a live entry count polled via `GET /api/raffle/[slug]/screen-state` (cookie-gated) every ~5s, plus a QR of the public URL. At countdown zero a centered "Draw" button MUST appear; nothing MUST fire automatically. After a draw completes, "Next draw" MUST advance; with no pending draws, a closing state MUST show.

#### Scenario: Countdown reaches zero

- GIVEN the current draw's `drawAt` has passed
- WHEN the screen re-renders
- THEN a "Draw" button appears and no draw request is sent automatically

### Requirement: Draw Execution

Tapping "Draw" MUST call `POST /api/raffle/[slug]/draws/[drawId]/draw` (cookie required) and start the fullscreen video. The server MUST run an interactive transaction, guard the open→drawing transition with an `updateMany` (zero affected rows MUST return the current persisted state without picking a second winner), compute eligible entries as all entries minus prior event winners when `excludePreviousWinners` is set, pick with `crypto.randomInt`, and persist `winnerEntryId`/`drawnAt`/status `drawn`. The response MUST be `{ status: "drawn", winner: { name, phoneLast4 } }`. Repeating the call on a drawn draw MUST return the same winner. The client MUST reveal the winner only after both the video ends and the response has arrived.

#### Scenario: Zero eligible entries

- GIVEN no eligible entries remain for the draw
- WHEN "Draw" is tapped
- THEN the response is 409 `{ status: "no_eligible_entries" }` and the draw status reverts to open

#### Scenario: Double tap yields one winner

- GIVEN a draw in status open
- WHEN two draw requests arrive concurrently
- THEN exactly one succeeds in picking a winner and the other returns the same persisted result

#### Scenario: Stuck drawing state is recoverable

- GIVEN a draw is stuck in status drawing because a prior request crashed
- WHEN a subsequent draw attempt is made
- THEN the system MUST recover the draw to a runnable state without manual database edits

### Requirement: Raffle Seed Script

`npm run raffle:seed -- <file.json>` MUST create or update an event and its draws from JSON (`slug`, `brand`, `title`, `eventDate`, `excludePreviousWinners`, `draws[]`), MUST generate the screen token (persisting only `screenTokenHash`) if absent, and MUST print the public URL and the tablet URL with `?key=`. Re-running with the same slug MUST update draws still open and MUST NOT modify drawn draws.

#### Scenario: Re-seed preserves drawn draws

- GIVEN an event has one drawn draw and one open draw
- WHEN the seed script runs again with updated `prizeLabel` for both
- THEN only the open draw is updated

### Requirement: QR Code Rendering

The public URL QR MUST render via the `api.qrserver.com` image endpoint and MUST fall back to a local `qrcode` canvas render if the remote image fails to load.

#### Scenario: Remote QR image fails

- GIVEN the `api.qrserver.com` image fails to load
- WHEN the screen renders the QR
- THEN a locally generated QR code is shown instead

## Authorized event UI amendment — 2026-09-12

- Both public entry and tablet draw surfaces use the supplied Palladium Latin Events logo and event photo, served locally from `public/raffle`. Preserve logo colors and proportions, trim only blank exterior space, and provide a light backing for its black lettering. Photo uses cover sizing with a 70% black overlay.
- Follow-up authorization supersedes the stacked phone layout: country and telephone stay on one row, including at 320px and 375px. The country selector is 112px wide with compact ISO + calling code text, full accessible option names, and a flexible telephone field that can shrink without horizontal overflow. Preserve separate accessible labels and minimum 44px controls.
- Hide the global assistant/chat and Home/back-to-top widgets on `/raffle/[slug]` and `/staff/raffle/[slug]/screen` only (optional trailing slash), reusing the existing shared visibility hook. Preserve other routes and existing checkout/modal suppression.
- Winner reveal also shows the configured `prizeLabel` of the exact drawn/tracked draw alongside the winner name and masked phone. An in-flight poll advancing `currentDrawId` MUST NOT substitute the next draw's prize. Reuse the existing screen-state data; do not configure real prizes from examples or change the database, seed, endpoints, access rules, or reveal gate.
- This event uses one tablet and no video: retain the existing six-second no-video animation and reveal gate. Any required event `videoUrl` configuration remains an operational follow-up, not a global video removal or database change in this UI work.
- Keep submission, validation, authentication, rate limiting, polling and draw logic unchanged. This is a localized authorized amendment, not a new SDD pipeline.
- Visual follow-up: only raffle primary actions (Enter raffle, Draw, Next draw) MUST use a vertical gradient from exact `#6d1245` (top) to `#401f4c` (bottom), white labels, visible keyboard focus, and distinct disabled styling without fading label contrast. Preserve existing action availability and minimum 44px targets; do not recolor global brand tokens, form errors, or the rest of the site.

## Out of Scope

Admin CRUD UI, SMS/OTP verification, multiple winners per draw, native app, i18n beyond English.
