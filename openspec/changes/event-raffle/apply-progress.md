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

## PR3 — Public entry page (`feat/event-raffle-3-entry-page`, targets `feat/event-raffle-2b-entry-route` tip `9f466bd`)

Two work-unit commits:

| File | Action |
|---|---|
| `app/raffle/[slug]/page.tsx` | Created — server component; `isRaffleSlug` guard, loads `RaffleEvent` by slug (`title`, `eventDate`), `notFound()` when absent, computes `closed` via `isRaffleEventClosed` and passes it as `initiallyClosed` |
| `components/front/raffle/RaffleEntryForm.tsx` | Created — client form; self-contained state (`idle\|submitting\|entered\|already_entered\|closed\|error`); exports pure `resolveRaffleEntrySubmitOutcome(httpStatus, body)` and `buildRaffleEntryPayload(name, phone, country)` helpers (same "export pure functions from the component file" pattern as `StaffTerminalShell.tsx`); country `<select>` built from `getPhoneCountryCatalog()` (reuses `lib/phone` conventions, does not import/modify `InternationalPhoneField` since that component is kiosk-specific — dark theme + on-screen numeric keypad — not a fit for a mobile visitor's own keyboard) |
| `components/front/raffle/__tests__/RaffleEntryForm.test.tsx` | Created — 16 tests: 8 on the pure helpers (outcome mapping for every API status, payload trimming) + 8 mounted (`createRoot`/`act`, same pattern as `AddPackageForm.test.tsx`, `// @vitest-environment jsdom` override since the repo's default Vitest environment is `node`): submits trimmed name/phone to `/api/raffle/[slug]/entries`, hides the form on `entered`/`already_entered`/`event_closed`, `initiallyClosed` skips the first fetch, inline field error keeps the form visible, generic/network error shows retry with the form intact |

**Diff vs `feat/event-raffle-2b-entry-route`** (excl. lockfile/openspec): 3 files, 480 insertions — over the
400-line budget and over `tasks.md`'s own PR3 estimate (140–200). Per the apply-time instruction ("do not
trim tests to fit"), no test/comment content was cut. Split into 2 commits so the orchestrator has a clean
boundary if the slice needs 2 PRs instead of 1 (each commit alone clears budget):

- `e8079a9` — page + form: 2 files, 260 insertions
- `f8db3e0` — tests: 1 file, 220 insertions

**Verification**:
- `npx tsc --noEmit` → clean, no output
- `npx vitest run components/front/raffle/__tests__/RaffleEntryForm.test.tsx` → 16/16 passed
- `npm run lint` → 0 errors, 114 warnings (pre-existing baseline, none new)

**Note on jsdom mounting**: `vitest.config.ts`'s default `environment` is `"node"`, not `jsdom`. Per-file
`// @vitest-environment jsdom` overrides it (already used by
`components/front/staff/student-override/__tests__/AddPackageForm.test.tsx`), so the component was tested by
actually mounting it (`react-dom/client` `createRoot` + `act`), not only via pure-function extraction. Typing
into a controlled `<input>` from raw DOM requires writing through the native `HTMLInputElement.prototype.value`
setter before dispatching `"input"` — assigning `.value` directly is silently ignored by React's controlled-input
change detection in this mount style.

## PR4a — Draw domain + draw/session/state routes (`feat/event-raffle-4a-draw-api`, targets `feat/event-raffle-3b-entry-page-tests`)

Three work-unit commits, each pairing a module (or module group) with its own tests so the branch can be
split at a commit boundary if needed:

| Commit | Content | Files | Authored lines |
|---|---|---|---|
| `fbd2f02` | Draw domain | `lib/raffle/draw.ts`, `tests/lib/raffle/draw.test.ts` | 283 |
| `d1cf050` | Screen token + winner masking + screen state | `lib/raffle/{screen-token,winner-view,screen-state}.ts` + their tests | 265 |
| `5754f3e` | Route handlers | `app/api/raffle/[slug]/{screen-session,screen-state}/route.ts`, `app/api/raffle/[slug]/draws/[drawId]/draw/route.ts` + their tests | 442 |

**Total authored diff vs `feat/event-raffle-3b-entry-page-tests`** (excl. lockfile/openspec): 13 files, 990
insertions, 0 deletions — well over the 400-line budget and over `tasks.md`'s own PR4a estimate (230–300).
This was expected: `design.md` itself flagged "PR4 as one unit forecast 350–400+" as the reason for the
4a/4b split, and the apply prompt for this pass said the slice "will likely exceed" budget. No task scope
grew beyond 4a.1–4a.9; per the apply-time instruction no test/comment/docs content was trimmed to fit.
Commits 1 and 2 individually clear the 400-line budget; commit 3 (all three routes + their tests) is 442
lines, ~10% over on its own. Two next steps are available and neither was taken unilaterally: (a) split
commit 3 into its own `feat/event-raffle-4a2-draw-routes`-style sub-branch (or split the three routes across
two smaller commits/branches), or (b) accept `size:exception` for the whole `feat/event-raffle-4a-draw-api`
branch, or for just its third commit. Nothing was pushed and no PR was opened.

**Design decision on test file layout**: `tasks.md`'s 4a.8/4a.9 name only `tests/api/raffle-draw.test.ts`
and `tests/api/raffle-screen.test.ts`, mixing domain-level cases (runDraw claim/replay/exclusion behavior,
`screenTokenMatches`, `toWinnerView`, `currentDrawId`) with route-level HTTP-status mapping. Per the
apply-time work-unit-commits instruction ("keep each module's tests in the same commit as that module"),
domain-level cases were split into `tests/lib/raffle/{draw,screen-token,winner-view,screen-state}.test.ts`
(committed alongside their modules in commits 1–2) and only the route HTTP-mapping cases stayed in
`tests/api/{raffle-draw,raffle-screen}.test.ts` (commit 3). All cases named in 4a.8/4a.9 are covered; none
were dropped.

**`runDraw` typing convention**: `lib/raffle/draw.ts` types its transaction parameter as `Prisma.TransactionClient`
(not a narrow interface), matching `reservePackageCreditForAttendanceTx` in `lib/packages.ts`. Its test builds
a plain mock object and casts it `as never` at each call site — this is the established convention in this
repo (see `tests/packages.test.ts`), not a narrow-interface pattern like `MigrateTransactionClient` in
`scripts/migrate-clerk-instance.ts` (which is cast with `prisma as unknown as MigratePrismaClient` at its own
call site, confirming direct structural assignment of the real Prisma client to a hand-rolled narrow type is
not relied on in this codebase either).

**Verification**:
- `npx tsc --noEmit` → clean, no output
- `npx vitest run tests/lib/raffle tests/api` → 1147/1147 passed (111 test files)
- `npm run lint` → 0 errors, 114 warnings (pre-existing baseline, none new)

## Task Status

- [x] 1.1–1.6 (PR1, all sub-slices 1a/1b/1c) — see `tasks.md` for per-task PR attribution.
- [x] 2.1–2.5 (PR2, public entry API) — see above; budget/branch-split decision pending.
- [x] 3.1–3.3 (PR3, public entry page) — see above; budget/split decision pending.
- [x] 4a.1–4a.9 (PR4a, draw domain + routes) — see above; budget/branch-split decision pending.
- [ ] PR4b — Screen UI (4b.1–4b.4) — not started.

## Worktree end state

Checked out on `feat/event-raffle-4a-draw-api` (tip `5754f3e`, base `feat/event-raffle-3b-entry-page-tests`).
No branches pushed; nothing opened as a PR.
