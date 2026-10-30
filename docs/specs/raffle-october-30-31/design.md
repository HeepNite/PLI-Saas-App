# October 30–31 Raffle Design

## Intent

Add two stable, event-specific tablet entrances and reproducible DEV seed inputs, then extend the draw lifecycle with durable physical-attendance confirmation and audited no-show rerolls.

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
- `scripts/examples/raffle-october-{30,31}-2026.dev.json`: deterministic temporary event inputs with explicit empty `videoUrl`.
- `prisma/schema.prisma` plus one new additive migration: durable `RaffleDrawAttempt` audit rows.
- Draw domain and one cookie-gated attendance action route: guarded confirmation and same-prize reroll.
- Screen-state, reducer, and tablet view: refresh-safe pending winner plus `Showed up` / `Draw again` actions.

## Architecture Constraints

- No new dependency; add only the attendance and prize-authoring endpoints required by the amended contract.
- Unknown day values return Next.js 404; they never become database lookup input.
- The event map is server-safe and contains no token.
- Existing `/rifa` remains unchanged and retains its regression tests.
- One event cannot authenticate the other because cookie names and token hashes are slug-scoped.
- Draw statuses become `draft | open | drawing | awaiting_confirmation | drawn`; `draft` is editable only before explicit start, and `awaiting_confirmation` is the only state where attendance actions may resolve the current attempt.
- Each random selection creates one `RaffleDrawAttempt` bound to the draw and selected entry with `pending | confirmed | no_show` status and resolution timestamps.
- `Showed up` atomically changes the exact pending attempt to `confirmed` and the draw to `drawn`.
- `Draw again` atomically changes the exact pending attempt to `no_show`, resets that same draw, and runs the existing random selector again. Every entry with any `no_show` attempt is excluded from all later draws in the event.
- Attendance requests carry the exact attempt identifier. Replaying a resolved attempt is idempotent; it never resolves the current later attempt.
- Screen state treats `awaiting_confirmation` as current and exposes its pending attempt/winner so refresh returns to the attendance decision instead of skipping to finished.

## October 30–31 Waiting/Ready Background Videos

Pass the tablet event slug from the container to the view. Only `waiting` or `ready` selects a background: `october-30-raffle-2026` uses `/raffle/inka-halloween-background.mp4`, while `october-31-raffle-2026` retains `/raffle/tapville-halloween-background.mp4`. A decorative inline, muted, autoplaying loop sits behind the existing content without a video shade. Use `h-full w-full object-fill` to apply `object-fit: fill`, exactly matching the user's supplied DevTools screenshot. Fill both axes of the unchanged app backdrop without a shade; do not override the global `object-cover` utility. Do not change the app shell dimensions or media files. The static background gradient remains unchanged. Preserve the static backdrop beneath the video and keep draw-video selection and the state machine unchanged. Serve each supplied 1920×1080 H.264, 32-second file as a separate local static asset without modifying its source. No schema, API, dependencies, or deployment changes.

## October Tablet QR Presentation

Both October tablet waiting/ready screens and prize setup pass a 192-pixel QR size and hide only the visible URL label. The shared panel keeps its 160-pixel, visible-URL defaults for all other raffles. Remote QR image, local canvas fallback, and placeholder share the selected size; both encoded QR paths use the original entry URL.

## Prize Authoring Design

- A tablet may author prizes only when every draw for its event is `draft`, attempt-free, and winner-free.
- Screen state exposes `prizeSetup: { editable, revision, prizes }` for an all-draft event. The revision is a server hash of the exact ordered draft snapshot.
- `POST /api/raffle/[slug]/prizes` accepts `{ action: "save" | "start", revision, prizes: string[] }` through the existing screen cookie and rate-limit boundary.
- Validation trims labels, requires 1–50 prizes of 1–120 characters, and rejects malformed input before opening a transaction.
- The domain rereads the exact event snapshot in a serializable transaction. A revision mismatch, mixed/non-draft status, winner, or attempt returns conflict without changing rows.
- `save` deletes and recreates only that event's draft rows, preserving the shared `drawAt` schedule anchor and every registration. `start` performs the same save and then transitions every resulting row to `open` atomically.
- Tablet UI owns a local ordered label list with add, rename, remove, and move controls. `Start raffle` requires explicit confirmation and cannot be reversed from the tablet.
- Existing events whose draws are already live remain locked and follow the current screen state machine unchanged.

## Data And Contract Notes

- October 30:
  - slug `october-30-raffle-2026`
  - `eventDate: 2026-10-30`
  - `drawAt: 2026-10-31T04:00:00Z`
- October 31:
  - slug `october-31-raffle-2026`
  - `eventDate: 2026-10-31`
  - `drawAt: 2026-11-01T04:00:00Z`
- Both use `excludePreviousWinners: true`, explicit empty `videoUrl` for the existing dark/gold no-video animation, and a conspicuous temporary prize.
- The existing client countdown can be viewed before 11:00 PM, but the operational instruction is to open/use it at 11:00 PM; Draw remains unavailable until persisted `drawAt`.

## Security And Operational Notes

- Each initial seed generates a different random 32-byte raw token and stores only its SHA-256 hash. October DEV operation rotates those credentials to distinct random six-digit PINs while preserving the same hash, cookie, validation, isolation, and rate-limit contracts.
- Redirects remain to clean URLs; raw credentials are never rendered by the application. Operational PINs may be displayed only in a local ephemeral macOS dialog for manual tablet entry.
- The original raffle migration is never replayed or edited. One new additive migration creates only the draw-attempt audit table, relations, and indexes required by attendance decisions.
- DEV setup and PIN rotation must avoid terminal/chat exposure, store each raw credential only in its Keychain item, verify hashes differ, and preserve event data.
- Rollback for the attendance amendment removes the new endpoint/UI/domain code only after confirming no pending attempt exists; the additive audit table is retained unless a separately authorized data migration removes it.
- DEV rehearsal cleanup deletes only exact synthetic entries and attempts, then restores each draw to `open`, its official schedule, and no winner.
