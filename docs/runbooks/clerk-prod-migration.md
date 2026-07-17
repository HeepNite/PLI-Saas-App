# Clerk dev→prod instance migration runbook

Cuts over the app from the Clerk dev instance to the Clerk prod instance: bulk-migrates ~101 users into prod ahead of time, then swaps API keys and remaps the DB inside a single hard maintenance window. Full design: engram `sdd/clerk-prod-instance-migration/design`.

Every step is labeled:
- **OWNER** — a human action in the Vercel dashboard or Clerk dashboard.
- **SCRIPT** — a command run from the operator's machine.

Steps that say "inside the maintenance window" MUST run back-to-back, without unrelated work in between.

## Quick path (happy case)

1. Pre-flight checks pass (peppers, prisma migration, freeze list regenerated).
2. Seed peppers → deploy Unit-1 code (guards + pepper decoupling).
3. Dry-run → canary → full bulk migration (no DB remap yet — app keeps running on dev).
4. Enter maintenance window → freeze routes → final delta pass.
5. Flip keys + webhook secret → deploy.
6. Remap DB (`--remap`) → coverage gate passes (0 missing / 0 mismatched).
7. Smoke tests pass → exit maintenance window.

If the coverage gate fails, do NOT exit the window — see [Failure decision tree](#failure-decision-tree).

---

## Pre-flight (before touching anything else)

- [ ] **OWNER** — In Vercel Production env, re-read the CURRENT values of `STAFF_PIN_PEPPER`, `STUDENT_PIN_PEPPER`, `STAFF_TERMINAL_SECRET`. Assert each is either unset, or already equals the intended seed value (current `sk_test` `CLERK_SECRET_KEY`). Do NOT trust this document's design-time snapshot — if any pepper already holds something else, STOP and investigate before seeding.
- [ ] **OWNER** — Confirm the Prisma migration for `ClerkIdMigration` has actually been applied to the production database. Unit 1 generated the migration SQL by hand (no `DATABASE_URL` was available at apply time) — run `npx prisma migrate deploy` against prod and verify the `ClerkIdMigration` table exists before proceeding. This is NOT optional: the migration script cannot write its old→new map without this table.
- [ ] **SCRIPT** — Regenerate the freeze list (do not reuse a stale copy — see [Freeze list](#freeze-list-regenerate-at-cutover-time)):
  ```bash
  npm run migrate:clerk:freeze-list
  ```

## Pepper seeding + Unit-1 deploy

- [ ] **OWNER** — In Vercel Production env (all environments), set:
  - `STAFF_PIN_PEPPER` = current `sk_test` `CLERK_SECRET_KEY` value
  - `STUDENT_PIN_PEPPER` = current `sk_test` `CLERK_SECRET_KEY` value
  - `STAFF_TERMINAL_SECRET` = current `sk_test` `CLERK_SECRET_KEY` value

  These three are currently unset in Production, which means `CLERK_SECRET_KEY` is the active pepper for every existing hash today. This step is what keeps staff PIN, student PIN, and terminal-session hashes valid after the key swap — it is not precautionary, it is required.
- [ ] **OWNER** — Deploy the Unit-1 branch (kiosk `getUser` guards on `identify-and-bootstrap` and `qr/bootstrap`, staff PIN pepper decoupling).
- [ ] **GATE** — On dev, confirm: kiosk phone identify + QR bootstrap both succeed end-to-end (both routes), staff PIN login succeeds. Do not proceed until this gate is green.

## Bulk migration (no DB remap yet — app keeps running on dev/sk_test)

All commands below assume `CLERK_SOURCE_SECRET_KEY` (dev `sk_test`) and `CLERK_TARGET_SECRET_KEY` (prod `sk_live`) are set in the operator's local `.env`. **Never set these in Vercel** — they exist only for this local, non-deployed script.

- [ ] **SCRIPT** — Dry run (read-only, inspect the transform output, makes zero writes):
  ```bash
  npm run migrate:clerk -- --mode=dry-run
  ```
- [ ] **SCRIPT** — Review the dry-run table output. Confirm phone/email transforms look correct, confirm placeholder emails are excluded, confirm no unexpected `skipped_deleted` rows.
- [ ] **SCRIPT** — Canary: migrate one known non-owner test account only:
  ```bash
  npm run migrate:clerk -- --mode=write --userId=<clerk_dev_user_id>
  ```
  Verify in the prod Clerk dashboard: the user was created, and check the logged `verification.status` for the attached phone (the script logs this automatically — see D6 SDK note in the design). Either `verified` or `unverified` is an acceptable canary outcome; the two-call sequence handles both. Do not proceed to the full run until the canary user looks correct in the prod dashboard.
- [ ] **SCRIPT** — Full bulk write (creates all prod users, attaches verified phones, writes the `ClerkIdMigration` map). This does NOT touch `User.clerkId` or `StaffAccount.clerkUserId` — the app keeps running normally against dev/`sk_test` throughout this step:
  ```bash
  npm run migrate:clerk -- --mode=write
  ```
- [ ] **SCRIPT** — Confirm the run summary shows `failed: 0`. If any rows failed, re-run the same command — the script is idempotent and resumes from wherever each row left off (map-first delta identity, see design's Idempotency section). Note: `processed` counts unique Clerk identities, not DB rows — when a `User` and a `StaffAccount` row were merged (same-person dedupe), they count as ONE `processed` entry but still write TWO `ClerkIdMigration` map rows, so `processed` can legitimately read lower than the coverage gate's later `totalMapped`.

## Maintenance window entry

- [ ] **OWNER** — Announce the maintenance window to staff. Kiosk/booking traffic paused or bannered unavailable. Staff-side write tooling disabled for the duration.
- [ ] **OWNER** — Freeze every route listed by the freeze-list generator (below). Freeze scope is defined by CAPABILITY (any route that can create a Clerk user or a `StaffAccount` row), not by matching only the named examples — if a new route reaches `syncStaffAccountFromClerkUser`, `ensureClerkUser`, or `client.invitations.createInvitation` after this document was written, the regenerated list will catch it.

### Freeze list (REGENERATE at cutover time)

Do not trust the list below as a static source of truth — it is a snapshot. Re-run the generator immediately before entering the window:

```bash
npm run migrate:clerk:freeze-list
```

The generator greps the repo for call sites of `syncStaffAccountFromClerkUser`, `ensureClerkUser`, and `client.invitations.createInvitation`, and resolves each to its owning `app/api/**` route file (one hop through `lib/*.ts` helpers when the call site itself isn't in a route file, e.g. `lib/checkout.ts`). Server-component call sites under `app/**/page.tsx` or `app/**/layout.tsx` (neither an `app/api/**` route nor a `lib/*.ts` helper) are classified separately into a **Server pages** section so they are never silently dropped. Source: `scripts/generate-clerk-freeze-list.ts`.

**Generated 2026-07-17 — REGENERATE at cutover time:**

```
- [ ] app/api/checkin/qr/bootstrap/route.ts
      - ensureClerkUser (via lib/checkout.ts)
- [ ] app/api/checkin/qr/new-student/verify/route.ts
      - ensureClerkUser (via lib/checkout.ts)
- [ ] app/api/checkout/cash/route.ts
      - ensureClerkUser (via lib/checkout.ts)
- [ ] app/api/checkout/intent/route.ts
      - ensureClerkUser (via lib/checkout.ts)
- [ ] app/api/checkout/session/route.ts
      - ensureClerkUser (via lib/checkout.ts)
- [ ] app/api/staff/bootstrap/route.ts
      - syncStaffAccountFromClerkUser
- [ ] app/api/staff/students/route.ts
      - ensureClerkUser
      - client.invitations.createInvitation
- [ ] app/api/staff/sync/route.ts
      - syncStaffAccountFromClerkUser
- [ ] app/api/staff/users/[userId]/profile/route.ts
      - syncStaffAccountFromClerkUser
- [ ] app/api/staff/users/[userId]/route.ts
      - syncStaffAccountFromClerkUser
- [ ] app/api/staff/users/route.ts
      - syncStaffAccountFromClerkUser
      - client.invitations.createInvitation

Total routes to freeze: 11
```

## Server pages
The following server components call a create-capable Clerk function directly — they are neither an app/api/** route nor a lib/*.ts helper, so freeze them explicitly alongside the routes above.

```
- [ ] app/staff/resolve/page.tsx
      - syncStaffAccountFromClerkUser
```

**Why `/api/staff/users/sync` and `/api/staff/users/sync-clerk/[userId]` are deliberately absent from the generated list**: both routes were named in the design's Lazy-create audit as staff-sync routes to consider, but neither reaches a create-capable Clerk function. They only call `syncDbUserFromClerkUser` (`lib/users.ts`), which reconciles an existing `User` row against a Clerk user's current data — its clerkId-mismatch branch returns the existing row UNMODIFIED rather than creating or relinking anything (see design's "Safety Note on Existing Relink Tooling"). Since the freeze list is generated by grepping call sites of the three create-capable symbols (`syncStaffAccountFromClerkUser`, `ensureClerkUser`, `client.invitations.createInvitation` — see above), a route that only reaches the mismatch-safe reconcile path correctly produces zero matches and is correctly excluded. Do not add them manually — if a future change makes either route create-capable, the next `npm run migrate:clerk:freeze-list` run will catch it.

**Manual pre-remap operator check (until the coverage gate's `incomplete` field makes this automatic)**: before trusting the coverage gate at the remap step below, confirm zero `ClerkIdMigration` rows are stuck at `phase='user_created'` (e.g. from an invalid phone during the bulk/delta run). The coverage gate itself now fails automatically when `incomplete > 0` (see the Immediate remap section), but it is still worth this manual spot-check as a second signal before entering the highest-risk part of the window.

- [ ] **SCRIPT** — Final delta pass, picking up any dev-side changes since the bulk run:
  ```bash
  npm run migrate:clerk -- --mode=write --delta
  ```
  This pass is repeatable by design — safe to run more than once if needed.

## Key swap + webhook registration (same deploy)

- [ ] **OWNER** — In Vercel **Production** environment ONLY (leave Preview untouched), set:
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` → prod `pk_live` value
  - `CLERK_SECRET_KEY` → prod `sk_live` value
  - `CLERK_WEBHOOK_SIGNING_SECRET` → the new prod webhook signing secret (staged ahead of time)
- [ ] **OWNER** — Register the prod webhook endpoint in the Clerk dashboard (prod instance): `https://pli.palladiumlatin.art/api/clerk/webhook`, subscribed to `user.created` and `user.updated` (the only two events the handler processes).
- [ ] **OWNER** — Deploy. This is the SAME deploy that carries the new `CLERK_WEBHOOK_SIGNING_SECRET` — do not split the key swap and webhook registration across separate deploys, that widens the gap where webhook signature verification could fail.

## Immediate remap (still inside the window)

- [ ] **SCRIPT** — Run the remap. This performs TWO distinct pre-checks before any DB write, each with its own failure path, then updates `User.clerkId` + `StaffAccount.clerkUserId` in one transaction, then runs the coverage gate — the whole sequence exits non-zero (without throwing) when the coverage gate fails, so a failing gate is never mistaken for a clean run:
  ```bash
  npm run migrate:clerk -- --remap
  ```
  1. **Grouped duplicate-newClerkId check** (before the transaction opens): every map row's `newClerkId` is grouped; a `newClerkId` shared by more than one row is only legitimate when ALL rows sharing it also share the SAME `oldClerkId` and are distinct entities — that is exactly the merged User+StaffAccount pair produced when the same person exists as both a `User` row and a `StaffAccount` row in dev (see round-1's same-person dedupe). A `newClerkId` shared across DIFFERENT `oldClerkId` values, or duplicated within one entity's own group, aborts immediately with no writes.
  2. **Pre-remap `StaffAccount` collision assertion** (inside the transaction, before any update commits): no `StaffAccount` row may already hold a map `newClerkId` under a DIFFERENT `appId` than the map row expects. If this trips, it means a route in the freeze list was not actually frozen — investigate immediately.
- [ ] **GATE** — Coverage report must read `missingInTarget: 0`, `mismatched: 0`, AND `incomplete: 0`. `missingInTarget` means a mapped user doesn't resolve on the prod Clerk instance at all (or its DB row vanished). `mismatched` means the DB row's current `clerkId`/`clerkUserId` no longer equals the map's `newClerkId` — it diverged after the map was built (e.g. re-synced by a webhook, or manually relinked) but before/during the remap. `incomplete` counts `ClerkIdMigration` rows still stuck at `phase='user_created'` (never reached `phone_attached` — e.g. an invalid phone during migration) — these rows are excluded from the remap entirely (only `phase='phone_attached'` rows are remapped), so a nonzero `incomplete` means real users are being left behind, not just a coverage-reporting gap. Do not exit the window if any of the three is nonzero — see [Failure decision tree](#failure-decision-tree). The command's own exit code reflects this: a nonzero exit means the gate failed even if you did not read the printed report closely.

### Failure decision tree

If the coverage gate reports any missing or mismatched rows:

1. **Small, explainable gap** (e.g. rows that changed in the final seconds before the key-swap deploy, missed by the delta pass): run a targeted delta pass for just those rows, re-run `--remap`, re-run the coverage check. Repeat until clean.
2. **Gap not cleanly explained, or no confident targeted fix within the window**: perform the [two-move rollback](#rollback) immediately rather than exiting in a known-bad state. Investigate offline, then re-attempt cutover starting from the canary step.

## Smoke tests

- [ ] Kiosk phone identify (both the fast path and the full bootstrap path) succeeds for a real test user.
- [ ] Staff PIN login succeeds (confirms `staffPinHash` copied correctly and the pepper survived the swap).
- [ ] Web sign-in via SMS OTP succeeds for a new signup.
- [ ] Walk 3-4 known password-based users through a Clerk password reset (they have no password to carry over from dev — see design's Proposal-Consistency Note; PIN-based staff do NOT need this, only email/password web accounts).

## Post-cutover

- [ ] **OWNER** — Run the app's in-app coverage check (`/api/staff/users/sync-clerk`) as an independent second opinion — this now targets prod correctly since the key swap already happened. Note it only checks `User.clerkId`, not `StaffAccount.clerkUserId` — the script's own coverage gate above is the authoritative check for both.
- [ ] **OWNER** — Confirm the password resets from the smoke-test step completed.
- [ ] **OWNER** — Check Sentry for any new error patterns in the 30 minutes following cutover, specifically around Clerk calls and staff/kiosk routes.
- [ ] **OWNER** — Exit the maintenance window — un-freeze every route from the freeze list.

---

## Rollback

Two moves, in this order. Both are reversible independently.

- [ ] **Move 1 — keys (instant, no data loss)**: **OWNER** reverts the Vercel Production env to the previous `pk_test`/`sk_test` values and the previous webhook signing secret, then redeploys.
- [ ] **Move 2 — DB**: **SCRIPT**
  ```bash
  npm run migrate:clerk -- --rollback
  ```
  Restores `User.clerkId`/`StaffAccount.clerkUserId` to their old (dev) values from the `ClerkIdMigration` map — but ONLY for rows whose CURRENT value still equals the map's `newClerkId` (the same WHERE-guard used by the coverage gate's mismatch check). Rows that diverged post-cutover are skipped and listed in the result for manual reconciliation — never silently overwritten.

**Session-invalidation notes**:
- Staff terminal sessions (pepper-based, decoupled from `CLERK_SECRET_KEY`) are instance-independent and SURVIVE the key rollback.
- Clerk-issued auth sessions ARE bound to the clerkId/instance active at sign-in and do NOT survive rollback — every user who authenticated via Clerk after cutover must sign in again.

**Post-rollback reconciliation**: after Move 2, review the `skipped` list from the rollback result. Each skipped row diverged after the remap (re-synced by a webhook, or manually edited) — decide case by case whether to leave it on the new (prod) clerkId or manually correct it. Do not re-run `--rollback` expecting it to resolve these automatically; the guard exists specifically to avoid silently overwriting rows that changed for a real reason.

---

## Command reference

| Command | What it does |
|---|---|
| `npm run migrate:clerk:freeze-list` | Generates the maintenance-window freeze checklist by grepping call sites (see [Freeze list](#freeze-list-regenerate-at-cutover-time)). |
| `npm run migrate:clerk -- --mode=dry-run` | Read-only transform preview. Zero writes. |
| `npm run migrate:clerk -- --mode=write --userId=<id>` | Canary: migrates exactly one user, bypassing enumeration order. |
| `npm run migrate:clerk -- --mode=write` | Full bulk migration. Creates users + attaches phones + writes the map. No DB remap. |
| `npm run migrate:clerk -- --mode=write --delta` | Re-scans for DB rows changed since the last successful run. Map-first identity — never re-creates an existing prod user. Safe to run repeatedly. |
| `npm run migrate:clerk -- --remap` | Pre-remap assertion → `$transaction` DB remap (`User.clerkId` + `StaffAccount.clerkUserId`) → coverage gate. Run once, inside the maintenance window, immediately after the key swap. |
| `npm run migrate:clerk -- --rollback` | Guarded restore of old (dev) clerkIds from the map. Skips rows that diverged post-cutover. |

## Out of scope for this migration

- `checkout/finalize` route and payroll route-helpers' `getCachedClerkUser` call sites — session-keyed, different failure mode than the kiosk guard fix, not covered by Unit 1's `getUser` guards.
- Student PIN re-enrollment — deprecated flow, not actively migrated, but the `STUDENT_PIN_PEPPER` seed step still applies so existing student PIN verifications keep working.
