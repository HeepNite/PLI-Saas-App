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
- [ ] **SCRIPT** — Regenerate the freeze list (do not reuse a stale copy — see [Freeze list](#freeze-list-regenerate-at-cutover)):
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
- [ ] **SCRIPT** — Confirm the run summary shows `failed: 0`. If any rows failed, re-run the same command — the script is idempotent and resumes from wherever each row left off (map-first delta identity, see design's Idempotency section).

## Maintenance window entry

- [ ] **OWNER** — Announce the maintenance window to staff. Kiosk/booking traffic paused or bannered unavailable. Staff-side write tooling disabled for the duration.
- [ ] **OWNER** — Freeze every route listed by the freeze-list generator (below). Freeze scope is defined by CAPABILITY (any route that can create a Clerk user or a `StaffAccount` row), not by matching only the named examples — if a new route reaches `syncStaffAccountFromClerkUser`, `ensureClerkUser`, or `client.invitations.createInvitation` after this document was written, the regenerated list will catch it.

### Freeze list (REGENERATE at cutover time)

Do not trust the list below as a static source of truth — it is a snapshot. Re-run the generator immediately before entering the window:

```bash
npm run migrate:clerk:freeze-list
```

The generator greps the repo for call sites of `syncStaffAccountFromClerkUser`, `ensureClerkUser`, and `client.invitations.createInvitation`, and resolves each to its owning `app/api/**` route file (one hop through `lib/*.ts` helpers when the call site itself isn't in a route file, e.g. `lib/checkout.ts`). Source: `scripts/generate-clerk-freeze-list.ts`.

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

- [ ] **SCRIPT** — Run the remap. This performs the pre-remap `StaffAccount` collision assertion FIRST (inside the transaction, before any update commits), then updates `User.clerkId` + `StaffAccount.clerkUserId` in one transaction, then runs the coverage gate:
  ```bash
  npm run migrate:clerk -- --remap
  ```
  If the pre-remap assertion trips (a `StaffAccount` row already holds a map `newClerkId` — an imperfect-freeze symptom), the transaction aborts before any write. Investigate immediately: a route in the freeze list was not actually frozen.
- [ ] **GATE** — Coverage report must read `missingInTarget: 0` AND `mismatched: 0`. `missingInTarget` means a mapped user doesn't resolve on the prod Clerk instance at all (or its DB row vanished). `mismatched` means the DB row's current `clerkId`/`clerkUserId` no longer equals the map's `newClerkId` — it diverged after the map was built (e.g. re-synced by a webhook, or manually relinked) but before/during the remap. Do not exit the window if either is nonzero — see [Failure decision tree](#failure-decision-tree).

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
| `npm run migrate:clerk:freeze-list` | Generates the maintenance-window freeze checklist by grepping call sites (see [Freeze list](#freeze-list-regenerate-at-cutover)). |
| `npm run migrate:clerk -- --mode=dry-run` | Read-only transform preview. Zero writes. |
| `npm run migrate:clerk -- --mode=write --userId=<id>` | Canary: migrates exactly one user, bypassing enumeration order. |
| `npm run migrate:clerk -- --mode=write` | Full bulk migration. Creates users + attaches phones + writes the map. No DB remap. |
| `npm run migrate:clerk -- --mode=write --delta` | Re-scans for DB rows changed since the last successful run. Map-first identity — never re-creates an existing prod user. Safe to run repeatedly. |
| `npm run migrate:clerk -- --remap` | Pre-remap assertion → `$transaction` DB remap (`User.clerkId` + `StaffAccount.clerkUserId`) → coverage gate. Run once, inside the maintenance window, immediately after the key swap. |
| `npm run migrate:clerk -- --rollback` | Guarded restore of old (dev) clerkIds from the map. Skips rows that diverged post-cutover. |

## Out of scope for this migration

- `checkout/finalize` route and payroll route-helpers' `getCachedClerkUser` call sites — session-keyed, different failure mode than the kiosk guard fix, not covered by Unit 1's `getUser` guards.
- Student PIN re-enrollment — deprecated flow, not actively migrated, but the `STUDENT_PIN_PEPPER` seed step still applies so existing student PIN verifications keep working.
