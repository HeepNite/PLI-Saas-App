# Research: event-raffle

Status: done
Date: 2026-09-10

## Lane 1 — Login-free protection for the staff tablet screen and draw endpoint

**Question**: How should `/staff/raffle/[slug]/screen` and its draw endpoint be protected without logging the tablet into Clerk?

**Evidence**
- Next.js Route Handlers read query parameters via `request.nextUrl.searchParams`; cookies are read/set server-side via `cookies()` from `next/headers`, and headers (including `Referer`) are readable the same way. — [Next.js `route.js` API reference](https://nextjs.org/docs/app/api-reference/file-conventions/route)
- OWASP documents that placing sensitive values in URL query strings risks exposure through browser history, server/proxy access logs, and the `Referer` header when the page later requests third-party resources; recommended mitigations include not putting secrets in URLs, using POST body/headers instead, and setting a `Referrer-Policy`. — [OWASP: Information exposure through query strings in URL](https://owasp.org/www-community/vulnerabilities/Information_exposure_through_query_strings_in_url)
- Node's `crypto.timingSafeEqual(a, b)` performs a constant-time comparison of two equal-length buffers to avoid leaking timing information; `crypto.randomInt([min,] max)` returns a cryptographically strong random integer in `[min, max)` with a range limit of `max - min < 2**48`. — [Node.js `crypto` module docs](https://nodejs.org/api/crypto.html)

**Recommendation**
Generate one opaque, high-entropy `screenToken` per event in the seed JSON (32 random bytes, base64url). The screen page reads it once from `searchParams` and, on successful first load, sets it into an `HttpOnly`, `Secure`, `SameSite=Strict` cookie scoped to that event so subsequent reloads and draw POSTs no longer carry the token in the URL. This minimizes the token's URL exposure to a single initial load over HTTPS. The draw endpoint requires the token from the cookie or a request header (never solely the URL) and compares it against the stored per-event secret with `crypto.timingSafeEqual`, not `===`. A Clerk-session requirement is rejected (explicitly unwanted). A generic device cookie without a per-event secret is rejected as weaker (no per-event rotation, harder to seed alongside the JSON config). Middleware only protects `/api/staff/*` (per `explore.md`), so the page route needs its own gate, which this token+cookie scheme provides.

**Confidence**: High for the overall pattern. Medium on literal Node.js API prose (page truncated by the fetch tool); the function signatures are long-stable APIs.

## Lane 2 — Fair, idempotent, race-safe draw in PostgreSQL with Prisma 6

**Question**: How to pick a winner safely against double-tap / concurrent draw requests, with a fair random selection?

**Evidence**
- Prisma interactive transactions accept an isolation level: `prisma.$transaction(async (tx) => { ... }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 10000 })`; supported levels are `ReadCommitted`, `RepeatableRead`, `Serializable`, `Snapshot` where the database allows them. — [Prisma: Transactions and batch queries](https://www.prisma.io/docs/orm/prisma-client/queries/transactions)
- A Prisma GitHub discussion confirms `SELECT ... FOR UPDATE` cannot be combined with `BEGIN`/`UPDATE`/`COMMIT` inside a single `$queryRaw` prepared statement ("cannot insert multiple commands into a prepared statement"), and native row-locking in `find*()` is a tracked feature request, not shipped. — [prisma/prisma Discussion #21335](https://github.com/prisma/prisma/discussions/21335)
- `crypto.randomInt` is CSPRNG-backed (unlike `Math.random()`), suitable for an unbiased draw among a small participant list. — [Node.js `crypto` module docs](https://nodejs.org/api/crypto.html)

**Recommendation**
Avoid raw `SELECT ... FOR UPDATE`. Use an optimistic status guard: `tx.raffleDraw.updateMany({ where: { id: drawId, status: 'open' }, data: { status: 'drawing' } })` and check the returned count. `0` means another request already claimed the draw (return the persisted winner or a "drawing in progress" response); `1` means this request proceeds. Fetch eligible entries (excluding prior winners of the night when the flag is on), select with `crypto.randomInt(0, eligibleCount)`, write the winner, and flip status to `drawn`, all inside one `prisma.$transaction(async (tx) => { ... })`. Default `ReadCommitted` isolation is sufficient because the guard column does the concurrency work; `Serializable` can be added as defense-in-depth at the cost of retry-on-conflict handling.

**Confidence**: High on the guard-column + interactive-transaction pattern. Medium on whether stricter isolation is needed; depends on production pooling (connection_limit=5 on Railway) and should be confirmed in `sdd-design`.

## Lane 3 — KMP/Android mini-app feasibility by Saturday

**Question**: Can the tablet screen realistically be a Kotlin Multiplatform / Compose Multiplatform Android app by 2026-09-12?

**Evidence**
- Android `WebView` requires a user gesture before playing media by default; `WebSettings.setMediaPlaybackRequiresUserGesture(false)` allows an HTML5 `<video autoplay>` element to play without a tap. — Android `WebSettings` API (https://developer.android.com/reference/android/webkit/WebSettings); live page could not be fetched verbatim, stated at Medium confidence.
- This repository currently has **no Android or iPad application target**; the KMP foundation exists only in local unmerged history, per `openspec/changes/native-kiosk-m2-self-service/exploration.md`.
- Community Compose Multiplatform video-playback libraries exist (e.g. `ComposeMediaPlayer`, `MediaPlayer-KMP`), typically backed by Media3 on Android and AVPlayer on iOS, but none are integrated in this codebase and their production maturity was not vetted.

**Recommendation**
Ship v1 as the planned web page, not a native KMP/Compose Multiplatform build. Standing up a new, buildable, signed, installable Android module from a from-scratch KMP foundation in two days is high risk with no existing app target. If an app-like fullscreen shell is wanted later, the lowest-risk option is a thin native `WebView` Activity loading the page URL with `setMediaPlaybackRequiresUserGesture(false)`. Keep the REST endpoints framework-agnostic so a genuine native screen can call them once the KMP foundation merges.

**Confidence**: High that a from-scratch native KMP build is not realistic for Saturday. Medium on the thin-WebView-shell effort estimate. Low on Compose Multiplatform video-library readiness.

## Lane 4 — api.qrserver.com (goqr.me) usage terms and local fallback

**Question**: Is api.qrserver.com safe to depend on for a live event, and is a local fallback cheap?

**Evidence**
- goqr.me's API docs state: "There is no request limit, but we reserve the right to reject API requests" considered abusive, and ask integrators to notify them above roughly 10,000 requests a day. No SLA or uptime guarantee is documented. — [goqr.me API docs: create-qr-code](https://goqr.me/api/doc/create-qr-code/)
- The `qrcode` npm package (`node-qrcode`) renders QR codes fully client-side with no network dependency via `toCanvas(...)`; MIT-licensed, long-standing. — [`node-qrcode` README](https://github.com/soldair/node-qrcode)

**Recommendation**
Keep `api.qrserver.com` as the primary QR source for v1 (zero setup, consistent with existing usage). Event-night volume (one QR per screen load) is far below the threshold goqr.me flags. Because there is no documented SLA, wire in the `qrcode` npm package as a local fallback so a transient outage does not blank the tablet screen.

**Confidence**: High.

## Decisions ready for proposal

1. Per-event opaque token (seeded in the raffle JSON config) + first-load `HttpOnly`/`Secure`/`SameSite=Strict` cookie + `crypto.timingSafeEqual` comparison, for both the screen page and the draw endpoint. No Clerk login on the tablet.
2. Prisma `updateMany` status guard (`open` → `drawing` → `drawn`) inside one interactive `$transaction`, `crypto.randomInt` for winner selection; default `ReadCommitted` isolation unless design decides otherwise.
3. Ship v1 as the web page; no native KMP build before Saturday. Keep REST endpoints reusable for a future native client.
4. Keep `api.qrserver.com` as primary QR source, with the `qrcode` npm package as an offline fallback.

## Sources

| ID | Class | Title | Publisher | URL | Accessed |
|----|-------|-------|-----------|-----|----------|
| S1 | documentation | route.js (Route Handlers API Reference) | Next.js | https://nextjs.org/docs/app/api-reference/file-conventions/route | 2026-09-10 |
| S2 | documentation | Information exposure through query strings in URL | OWASP | https://owasp.org/www-community/vulnerabilities/Information_exposure_through_query_strings_in_url | 2026-09-10 |
| S3 | documentation | Crypto | Node.js | https://nodejs.org/api/crypto.html | 2026-09-10 |
| S4 | documentation | Transactions and batch queries | Prisma | https://www.prisma.io/docs/orm/prisma-client/queries/transactions | 2026-09-10 |
| S5 | open-web | Discussion #21335 (FOR UPDATE with queryRaw) | GitHub / prisma | https://github.com/prisma/prisma/discussions/21335 | 2026-09-10 |
| S6 | documentation | WebSettings | Android Developers | https://developer.android.com/reference/android/webkit/WebSettings | 2026-09-10 |
| S7 | open-web | node-qrcode README | GitHub / soldair | https://github.com/soldair/node-qrcode | 2026-09-10 |
| S8 | documentation | create-qr-code API doc | goqr.me | https://goqr.me/api/doc/create-qr-code/ | 2026-09-10 |

## Gaps

- Literal Node.js prose for `timingSafeEqual`/`randomInt` and the live Android `WebSettings` page could not be fetched verbatim.
- Compose Multiplatform video-library maturity not independently vetted.
- Prisma isolation-level necessity depends on production pooling; deferred to `sdd-design`.

## Risks

- Token briefly appears in the URL on first load; HTTPS-only and per-event rotation reduce but do not eliminate log/history exposure.
- No SLA for api.qrserver.com; mitigated by the local fallback.
- The optimistic draw guard needs a carefully designed transitional status (`drawing`) in `sdd-design` to fully close the double-tap race.
