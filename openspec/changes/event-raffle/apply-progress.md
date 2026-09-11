# Apply Progress: event-raffle

**Worktree**: `/Users/marianobarrionuevo/WebstormProjects/PLI-Saas-App-worktrees/event-raffle`
**Delivery strategy**: `auto-chain`, chain strategy `feature-branch-chain`.

## PR1 split (schema + migration + seed script)

PR1 was originally implemented as one commit (`1a1dacb`) on `feat/event-raffle-1-schema`.
Its authored diff was **834 changed lines** (excluding `package-lock.json` and `openspec/`),
well over the 400-line budget and over `tasks.md`'s own PR1 estimate (150–210 lines). Per
the coordinator's instruction (delivery strategy is `auto-chain`), the single commit was
rewritten into three chained branches, each under budget, with no change in code semantics
— only files/tests were redistributed across commits. The old `feat/event-raffle-1-schema`
branch was deleted after the split.

### PR1a — `feat/event-raffle-1a-schema` (targets `codex/develop`)

Commits: `d7bebc8` (docs, unchanged) + `0ed94e4` (schema + migration).

| File | Action |
|---|---|
| `prisma/schema.prisma` | Modified — added `RaffleEvent`, `RaffleEntry`, `RaffleDraw` models per D9 |
| `prisma/migrations/20260911180000_add_raffle_models/migration.sql` | Created — additive-only DDL |

**Diff vs `origin/codex/develop`** (excl. lockfile/openspec): 2 files, 124 insertions.

**Verification**:
- `npx prisma validate` → "The schema at prisma/schema.prisma is valid 🚀"
- `npx prisma generate` → Prisma Client (v6.19.3) generated successfully
- `npx tsc --noEmit` → clean, no output

### PR1b — `feat/event-raffle-1b-seed-plan` (targets `feat/event-raffle-1a-schema`)

Commit: `121cd55` (pure seed-plan helpers + their tests).

| File | Action |
|---|---|
| `lib/raffle/seed-plan.ts` | Created — `parseRaffleSeedConfig`, `nyMidnightUtc`, `planDrawUpserts`, `generateRaffleScreenToken`/`hashRaffleScreenToken`, `resolveRaffleBaseUrl` |
| `tests/lib/raffle/seed-plan.test.ts` | Created — 20 tests: config validation (valid/defaults/each rejection), NY-midnight normalization (EDT + EST), draw upsert planning (create/update-open/skip-drawn), token generation + hash, base-URL precedence |

**Diff vs `feat/event-raffle-1a-schema`** (excl. lockfile/openspec): 2 files, 384 insertions.

**Verification**:
- `npx tsc --noEmit` → clean, no output
- `npx vitest run tests/lib/raffle/seed-plan.test.ts` → 20/20 passed
- `npm run lint` → 0 errors, 115 warnings (pre-existing baseline, none new)

### PR1c — `feat/event-raffle-1c-seed-cli` (targets `feat/event-raffle-1b-seed-plan`)

Commits: `6382210` (seed CLI script + example config + tests) + one follow-up docs
commit (this file + `tasks.md` branch-chain/checkbox update).

| File | Action |
|---|---|
| `scripts/raffle-seed.ts` | Created — thin CLI (`parseSeedArgs`, `runRaffleSeed`, `main()`) over `lib/raffle/seed-plan.ts` |
| `scripts/examples/raffle-event.example.json` | Created — example seed config |
| `package.json` | Modified — `raffle:seed` script entry |
| `tests/scripts/raffle-seed.test.ts` | Created — 9 tests: `parseSeedArgs` (bare path, `--base-url`/`--rotate-token`, missing path throws), `runRaffleSeed` idempotency (new event generates + prints token, existing event without rotate does not regenerate/print, `--rotate-token` forces regen, drawn draw skipped + reported while open draw updated, new draw created, unchanged re-seed does not duplicate) |

**Diff vs `feat/event-raffle-1b-seed-plan`** (excl. lockfile/openspec): 4 files, 327 insertions, 1 deletion.

**Verification**:
- `npx tsc --noEmit` → clean, no output
- `npx vitest run tests/scripts/raffle-seed.test.ts` → 9/9 passed
- `npm run lint` → 0 errors, 115 warnings (pre-existing baseline, none new)

## PR2 — Public entry API (`feat/event-raffle-2-entry-api`, targets `feat/event-raffle-1c-seed-cli`)

Two work-unit commits, no further sub-split performed (see budget note below):

| File | Action |
|---|---|
| `lib/raffle/entry-validation.ts` | Created — `parseRaffleEntryInput`: object/type narrowing → `invalid_body`; trims `name` (2–60 chars, must contain a non-digit) → `invalid_name`; resolves `phone` via `parseNationalPhone` (default country `US`) → `invalid_phone`; success value is `{ name, phoneE164, phoneCountry }` (added `phoneCountry` beyond the two fields named in the apply prompt's contract summary, because `RaffleEntry.phoneCountry` is a required column per D9) |
| `lib/raffle/event-window.ts` | Created — `RAFFLE_EVENT_GRACE_MS` (24h), `isRaffleEventClosed(eventDate, now)`, pure, per D11 |
| `lib/raffle/entry.ts` | Created — `createRaffleEntry(db, input, now?)`: loads `RaffleEvent` by slug (`event_not_found`), applies `isRaffleEventClosed` (`event_closed`), inserts `RaffleEntry`, catches Prisma `P2002` → `already_entered` |
| `lib/raffle/slug.ts` | Created — `isRaffleSlug` (`^[a-z0-9-]{1,64}$`), used by the route to 404 malformed slugs before any DB/rate-limit work; **not** a `tasks.md` PR2 line item — added per the apply-time implementation contract so PR4a's screen-token exchange (design.md D2, which also names `isRaffleSlug`) can import the same helper instead of duplicating it |
| `app/api/raffle/[slug]/entries/route.ts` | Created — `POST`, `runtime = "nodejs"`; order: `isRaffleSlug` → rate-limit IP (`raffle:entry:ip`, 10/60s) → parse JSON → `parseRaffleEntryInput` → rate-limit phone (`raffle:entry:phone`, 5/300s) → `createRaffleEntry` → status→HTTP map (`201 entered` / `200 already_entered` / `400 {invalid_body\|invalid_name\|invalid_phone}` / `404 event_not_found` / `410 event_closed` / `429` + `Retry-After`) |
| `tests/lib/raffle/entry-validation.test.ts` | Created — 10 tests covering every rejection status, the 1/2/60/61-char name boundaries, all-digit name rejection, explicit-country success, and default-to-US |
| `tests/lib/raffle/event-window.test.ts` | Created — 4 tests: well before, just-under-boundary, exact-boundary (open), just-over-boundary (closed) |
| `tests/lib/raffle/slug.test.ts` | Created — 3 tests: valid charset/length boundary, invalid separators/case/empty, over-length rejection |
| `tests/api/raffle-entries.test.ts` | Created — mocked Prisma (`vi.hoisted` + `vi.mock("@/lib/prisma", ...)`, matching `tests/packages.test.ts`); 11 tests: 201 entered with stored `e164`, default-country-US, `invalid_body`/`invalid_name`(1/61 chars)/`invalid_phone` → 400, malformed JSON → 400, P2002 → 200 `already_entered` with `create` called exactly once, unknown slug → 404, closed event → 410, 429 with `Retry-After` (per-IP limiter isolated from the per-phone limiter by varying the phone per request) |

**Diff vs `feat/event-raffle-1c-seed-cli`** (excl. lockfile/openspec): 9 files, 459 insertions.

**Verification**:
- `npx tsc --noEmit` → clean, no output
- `npx vitest run tests/lib/raffle tests/api/raffle-entries.test.ts` → 49/49 passed
- `npm run lint` → 0 errors, 114 warnings (pre-existing baseline, none new)

**Budget note (unresolved, needs orchestrator decision)**: authored diff is **459 changed lines**, above the
400-line budget and above this section's own PR2 estimate (190–250 lines) in `tasks.md`'s Review Workload
Forecast. The overage is not scope creep — all 5 tasks (2.1–2.5) map 1:1 to design.md's D1/D10/D11 file list,
plus the one extra `slug.ts` module named by the apply-time implementation contract. It comes from thorough
edge-case test coverage (49 tests across 5 files) that the apply prompt explicitly said not to trim to fit the
budget ("If your forecast exceeds 400, stop and report instead of trimming tests"). The two commits are
already a clean work-unit split (`29314f4` domain helpers, 237 lines; `c96544a` route + its test, 222 lines) —
either one individually clears the 400-line budget. Two next steps are available and neither was taken
unilaterally: (a) restructure into `feat/event-raffle-2a-entry-domain` → `feat/event-raffle-2b-entry-route`
chained sub-branches (same pattern PR1 used for 1a/1b/1c), or (b) keep the single `feat/event-raffle-2-entry-api`
branch and accept `size:exception` for this PR. Nothing was pushed and no PR was opened either way, so this is
purely a delivery-boundary decision, not a rework.

## Task Status

- [x] 1.1–1.6 (PR1, all sub-slices 1a/1b/1c) — see `tasks.md` for per-task PR attribution.
- [x] 2.1–2.5 (PR2, public entry API) — see above; budget/branch-split decision pending.
- [ ] PR3 — Public entry page (3.1–3.3) — not started.
- [ ] PR4a — Draw domain + routes (4a.1–4a.9) — not started.
- [ ] PR4b — Screen UI (4b.1–4b.4) — not started.

## Worktree end state

Checked out on `feat/event-raffle-2-entry-api` (tip `c96544a`, base `feat/event-raffle-1c-seed-cli` tip
`41150dc`). No branches pushed; nothing opened as a PR.
