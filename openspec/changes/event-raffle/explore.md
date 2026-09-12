# Exploration: event-raffle (v1, PLE event raffle)

## Current State

**Phone normalization** — two independent normalizers exist, do NOT unify them for this change:
- `lib/shared.ts:21` `normalizePhone(val)` — strips non-digits, returns `undefined` if <6 digits. Used generically (checkin, checkout) where any-country loose digits are acceptable.
- `lib/phone/kiosk-phone.ts` — full `libphonenumber-js/max`-backed parser (`parseKioskPhone`, `getKioskPhoneNationalDigits`, `KIOSK_PHONE_COUNTRIES` = PR/US/AR/PE/MX/CL/EC/BR/DO/CO/CA). Produces `{ country, nationalNumber, e164, display }`. This is the kiosk-grade normalizer.
- `components/front/courses/utils/phone.ts` wraps kiosk-phone for the US-only enroll flow (`getUsPhoneDigits`, `toE164Phone`, `formatUSPhone`).
- **Recommendation for raffle**: use `parseKioskPhone` (or at minimum `getKioskPhoneNationalDigits`) keyed to a single country selector on the public form (event context is US/PLE), normalize to E.164 (`e164`) for the unique-per-(event,phone) constraint. Do not invent a third normalizer.

**Public unauthenticated routes** — `middleware.ts:1-69` wraps everything in `clerkMiddleware`, but only *forces* a 401 for `/api/staff/*` prefixed paths without a Clerk session (line 43-48). Non-`/api/staff` paths (pages and other API routes) pass through `NextResponse.next()` untouched — Clerk attaches auth context but never calls `.protect()`. This is exactly how `/checkin` and other public pages work today with zero middleware changes needed. A new `/raffle/[slug]` page and a new `POST /api/raffle/*` entry route need **no middleware change** as long as the API route path does not start with `/api/staff`.

**Staff route protection** — two different mechanisms coexist, pick the cheaper one per surface:
1. Clerk + role in metadata: `lib/security/staff-portal-auth.ts` (`authorizeStaffPortalBaseRequest` → `authorizeStaffPortalRequest` / `authorizeStaffPortalSectionRequest(section)` / `authorizeOwnerOrAdminRequest`). Requires wiring a new `StaffPortalSection` if using the section variant — avoid that for a throwaway v1 screen.
2. Terminal PIN session (no Clerk): `lib/security/staff-terminal.ts` — DB-backed `StaffTerminalSession` bound to a `StaffTerminal` row, cookie `pli_terminal_session`, HMAC-hashed token (`hashStaffTerminalSessionToken`), `authorizeStaffTerminalSession()`. Used by `app/staff/terminal/page.tsx:12-38` (falls back to `StaffTerminalSignInClient` PIN entry when no valid session). This is heavier: needs a `StaffTerminal` record, PIN provisioning UI, etc. — overkill for a single-event tablet screen.
- **Recommendation**: protect `/staff/raffle/[slug]/screen` with the plain Clerk check pattern (`auth()` + `isStaffRole`/`isStaffAdminRole` from `lib/security/staff-role.ts`, no new `StaffPortalSection`) — same lightweight per-page guard style already used ad hoc (there is no shared `app/staff/layout.tsx`; every staff page authorizes itself, confirmed by `Glob app/staff/layout.tsx` / `app/staff/*/layout.tsx` → no matches). The `POST /draw` endpoint gets the same guard server-side.

**API conventions** — no framework-level "api-helpers.ts"/"api-response.ts" found; the pattern per route is:
- Hand-rolled `unknown`-typed body validators returning `{status,error}` unions on failure (`lib/security/checkin-validation.ts`, `lib/security/profile-validation.ts`, `lib/checkin/qr.ts`). No `zod` in `package.json` — do not introduce it for one form; follow the existing manual-sanitizer pattern for consistency.
- `NextResponse.json(...)` directly in route handlers; Prisma-schema-unavailable guard pattern (`isPrismaSchemaOutOfSyncError`/`isPrismaSchemaUnavailableError`, checking `P2021`/`P2022`) repeated per route — copy this guard into the new raffle routes for parity with staff dashboards degrading gracefully.
- Rate limiting: `lib/security/rate-limit.ts` — in-memory token bucket (`consumeRateLimit`, `getClientIp`, `buildRateLimitKey`), bypassed in tests via `DISABLE_RATE_LIMIT`/`NODE_ENV=test`. Should be applied to the public `POST /api/raffle/[slug]/entries` route keyed by IP + phone to blunt spam entries.

**Prisma conventions** — `prisma/schema.prisma`: `provider = "postgresql"`, every model `id String @id @default(cuid())`, no `@map`/`@@map` (table/column names default to Prisma's PascalCase/camelCase). No `@@index` boilerplate beyond what's needed (e.g. `Currency` has `@@index([active])`). **Migrations**: `prisma/migrations/` holds 38 versioned folders (latest `20260810210000_add_staff_device_otp`), so a new `<timestamp>_add_raffle_models` migration follows the normal convention. **Risk**: project notes record prod `_prisma_migrations` drift (a renamed/duplicate `day_of_week` migration), so apply the new migration surgically and verify prod migration state before `prisma migrate deploy`.

**Seed scripts** — two co-existing styles:
- `prisma/seed.ts` — CommonJS-flavored `require()`/`module.exports`, run via `node --require ./prisma/register-ts.js prisma/seed.ts` (wired to `"prisma":{"seed":...}` in package.json; `register-ts.js` just aliases `.ts` to the `.js` loader — only works because `seed.ts` avoids real TS syntax).
- Standalone scripts use `tsx` directly: `package.json` scripts `migrate:clerk` = `tsx scripts/migrate-clerk-instance.ts`; `scripts/backfill-payroll-from-clerk.ts` is real TypeScript (interfaces, generics) with no npm script wiring, implying ad hoc `npx tsx scripts/...`.
- **Recommendation**: write `scripts/raffle-seed.ts` as a normal ESM/TS module and add an npm script `"raffle:seed": "tsx scripts/raffle-seed.ts <path-to-json>"` — matches the `tsx` convention, avoids the CJS/register-ts hack.

**Kiosk/terminal fullscreen UI reuse** — `components/front/staff/StaffTerminalShell.tsx` (420+ lines) is a good structural reference: full-viewport `bg-[#13141d]` dark shell, `useEffect`-driven polling/rotation, loading spinner pattern (`h-screen w-full items-center justify-center`), and — critically — **QR generation is already solved via a third-party image service, not a local library**: `buildCheckInQrImageUrl` (line 421-443) calls `https://api.qrserver.com/v1/create-qr-code/?size=180x180&format=png&data=<url>`. `package.json`/`package-lock.json` has **no** `qrcode`/`react-qr-code` dependency. For the raffle screen, either (a) reuse the same `api.qrserver.com` pattern (zero new deps, matches convention, but adds a runtime external dependency + no offline fallback), or (b) add a local `qrcode` package (~1 dep, no network dependency, better for a tablet on venue wifi). Given "ship by Saturday" and existing precedent, (a) is lowest-risk/most consistent; flag (b) as the safer alternative if venue wifi to api.qrserver.com is a concern.

**Video** — `<video>` is already used directly (no wrapper component) in `components/front/courses/CourseSections.tsx:360-366` (`autoPlay loop`, `poster`, plain `<video src=... />` from `/public`). No existing "play video then reveal result" orchestration exists — this is new. `/public` assets are served at root path by Next.js static file convention (no evidence otherwise); place the MP4 at `public/raffle/<name>.mp4` and reference `/raffle/<name>.mp4`.

**Test setup** — Vitest (`vitest.config.ts`), `environment: "node"`, `TZ` pinned to `America/New_York`, tests under `tests/**/*.test.ts(x)` and `components/**/*.test.ts(x)` (co-located `__tests__` dirs also picked up, confirmed by the new `components/front/staff/__tests__/StaffTerminalShell.test.ts` in the working tree). Mocking convention (from `tests/api/staff-checkin.test.ts`): `vi.mock("@/lib/prisma", () => ({...}))` and `vi.mock("@clerk/nextjs/server", () => ({...}))` at module scope, then import the route handler and call it directly with a constructed `Request`.

**i18n** — `lib/i18n.tsx` (`I18nProvider`/`useI18n`) is a client-side context reading `?lang=` or a `lang` cookie, backed by `lib/i18n-dict`. It is used selectively (enroll flow, header, verify-phone) — NOT globally enforced on every public page. **Minimal compliant approach for v1**: the raffle public page can ship English-only copy (matches "minimal v1" instruction) without wiring `I18nProvider`; only add i18n if the user explicitly asks, since it is opt-in per page today, not a lint-enforced convention.

## Affected Areas (net-new, nothing existing is modified except migrations)
- `prisma/schema.prisma` — add `RaffleEvent`, `RaffleEntry`, `RaffleDraw` models + one migration.
- `app/raffle/[slug]/page.tsx` (or `app/(pages)/raffle/[slug]/page.tsx`) — public entry form, no auth.
- `app/api/raffle/[slug]/entries/route.ts` — `POST` create entry (dedupe by normalized phone + event, rate-limited).
- `app/staff/raffle/[slug]/screen/page.tsx` — Clerk-guarded tablet screen (SSR guard + role check).
- `app/api/raffle/[slug]/draw/route.ts` (or `/draws/[drawId]/draw`) — `POST` idempotent draw (transactional `crypto.randomInt`, excludes prior winners when flag set).
- `components/front/raffle/*` — new components for the public form and the screen (countdown, QR, video overlay, winner reveal).
- `scripts/raffle-seed.ts` + a new `package.json` script entry — seed the night's config from JSON.
- `public/raffle/*.mp4` — motion graphics asset(s).
- `lib/phone/kiosk-phone.ts` — read-only reuse, no changes expected.
- Tests: `tests/api/raffle-*.test.ts`, `components/front/raffle/__tests__/*.test.tsx`.

## Approaches

1. **Reuse StaffTerminal PIN-session machinery for screen auth** — Pros: consistent with existing kiosk auth model, works without staff having a Clerk session open on the tablet. Cons: requires creating a `StaffTerminal` row, PIN provisioning, and a sign-in screen just for one-night use — disproportionate for a deadline feature. Effort: Medium-High.
2. **Guard the screen with a plain Clerk `auth()` + `isStaffRole` check (no new StaffPortalSection)** — Pros: ~10 lines, matches the ad hoc per-page pattern already used everywhere in `app/staff/*`, tablet just needs staff to be logged into Clerk in the browser once. Cons: staff must remember to log in on the shared tablet (acceptable for a one-night event with staff present). Effort: Low. **Recommended.**
3. **QR via new local `qrcode` npm package vs. reusing `api.qrserver.com`** — (a) local: zero external network dependency, works if venue wifi to the API is flaky, +1 dependency; (b) reuse existing pattern: zero new deps, identical to `StaffTerminalShell`, but adds a runtime dependency on a third-party service reachability at showtime. Given precedent and time pressure, default to (b); switch to (a) only if the user is worried about venue connectivity — this is a good clarifying question but not a blocker since the existing kiosk terminal already relies on the same external service for its own QR codes.

## Recommendation

Follow the manual-validator/no-zod convention, the plain-Clerk-guard pattern for the screen, `api.qrserver.com` for QR (matching `StaffTerminalShell`), a `tsx`-run `scripts/raffle-seed.ts`, and E.164 normalization via `lib/phone/kiosk-phone.ts` for entry dedupe. Keep the draw endpoint's idempotency and previous-winner exclusion inside a single Prisma `$transaction` to avoid double-draw races if the "Draw" button is tapped twice or the request is retried.

## Estimated changed lines per area (400-line PR budget)
- Prisma schema + migration: ~60-90 lines → own small PR/slice.
- Public entry route (`POST /entries`) + validator + rate limit wiring: ~120-150 lines.
- Public form page/component: ~100-150 lines.
- Draw route (`POST /draw`) + transaction logic: ~120-160 lines.
- Screen page/component (countdown, QR, video, winner reveal, next-draw flow): ~200-280 lines (likely needs its own slice, or split into screen-shell + video-orchestration hook).
- Seed script + JSON schema + npm script: ~80-120 lines.
- Tests (entries, draw idempotency, dedupe, screen countdown/video logic): ~150-200 lines.
- **Total estimate: ~830-1150 lines** → exceeds the 400-line budget; plan at least 3 chained PR slices (schema+seed, public entry flow, staff screen+draw endpoint), consistent with `auto-chain` delivery strategy already cached for this session.

## Risks

- **Migration drift**: prod already has known `_prisma_migrations` drift (per prior project notes on `day_of_week`). The new raffle migration must be applied surgically and validated against actual prod migration state before deploy.
- **Idempotent draw correctness under concurrency**: the "tap once, wait for video" flow plus a possible double-tap or client retry requires the draw endpoint to be truly transactional and safe to call twice with the same result — must lock the `RaffleDraw` row (`SELECT ... FOR UPDATE` via Prisma transaction or a unique constraint on `winnerEntryId` write) to avoid two different winners under a race.
- **External QR dependency**: reusing `api.qrserver.com` ties the public entry QR (and thus the whole raffle) to a third-party service's uptime during the live event; no fallback exists today even for the current check-in kiosk.
- **No zod / ad hoc validators**: introducing zod would be inconsistent with the codebase; but hand-rolled validators must be written carefully for the public unauthenticated entry endpoint since it has no auth layer to fall back on for abuse mitigation — rate limiting is essential here (unlike most other validated routes which sit behind Clerk).
- **Tight deadline (2026-09-12) vs. schema change**: any schema/migration risk found only in production is harder to fix same-day; recommend testing the migration against a preview/staging DB before the event.

## Ready for Proposal
Yes — scope, affected areas, and a clear recommendation are established. `sdd-propose` should confirm: (a) the screen-auth approach (recommend plain Clerk guard, approach 2), (b) QR approach (recommend reuse of `api.qrserver.com`, approach 3b), and (c) the PR slicing plan (3 chained PRs) given the 400-line budget.
