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

## Task Status

- [x] 1.1–1.6 (PR1, all sub-slices 1a/1b/1c) — see `tasks.md` for per-task PR attribution.
- [ ] PR2 — Public entry API (2.1–2.5) — not started.
- [ ] PR3 — Public entry page (3.1–3.3) — not started.
- [ ] PR4a — Draw domain + routes (4a.1–4a.9) — not started.
- [ ] PR4b — Screen UI (4b.1–4b.4) — not started.

## Worktree end state

Checked out on `feat/event-raffle-1c-seed-cli`. No branches pushed; nothing opened as a PR.
