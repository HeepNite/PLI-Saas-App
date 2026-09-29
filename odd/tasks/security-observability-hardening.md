# Security and Observability Hardening

## Goal

Contain the exposed production database credential, restore actionable Sentry telemetry, and add preventive controls so secrets and unchecked deployment artifacts cannot recur.

## Scope

- Railway production PostgreSQL credential rotation.
- Vercel environment-variable coordination and safe redeployment.
- Local secret-file containment and repository ignore policy.
- Sentry releases, source maps, environments, global error coverage, and controlled verification.
- Automated secret-leak prevention in local and CI workflows.

## Constraints

- Never print or persist secret values in logs, chat, Git, task artifacts, or command arguments.
- Preserve dirty worktrees and active deployments.
- Rotate the Railway-managed password only through Railway's supported regenerate flow.
- Keep the old deployment available until replacement production and development deployments are verified.
- Do not claim Sentry operational health without a controlled event and remote evidence.
- No commit, push, PR, merge, provider billing change, or destructive Git operation without explicit authorization.

## Tasks

- [x] 1. Audit `DATABASE_URL` exposure and identify the authoritative Railway service and all consumers.
  - Evidence: Railway `PLI-SaaS` / `production` / `Postgres` uniquely matches production snapshots; Vercel has branch-specific and shared `DATABASE_URL` records.
- [x] 2. Protect local secret files and prevent repository leaks.
  - Added the narrowest safe ignore rule for `.scratch-prod/`.
  - Removed the exposed scratch credential file after rotation readiness was confirmed.
  - Added a zero-dependency tracked-file scanner and blocking CI gate; focused tests, self-scan, syntax, and diff checks passed.
  - Verified no secret-bearing scratch path is tracked or newly visible to Git.
- [x] 3. Rotate the production database credential.
  - Regenerated through Railway's supported database UI.
  - Updated both Vercel `DATABASE_URL` records without exposing values.
  - Redeployed and verified development and production database-dependent paths.
  - Removed stale local production credential copies from known local environment files.
- [ ] 4. Complete Sentry integration.
  - [x] Configure build-time org/project/auth metadata securely.
  - [x] Configure deterministic releases and source-map uploads when secure metadata is present.
  - [x] Set explicit environment and release identity.
  - [x] Add global and route-level error-boundary capture without duplicate reporting.
  - [ ] Define and remotely provision minimum alerting policy.
- [ ] 5. Verify security and observability.
  - Run focused tests, typecheck, build, and secret scanning.
  - Emit one controlled Sentry event in a non-production-safe path and verify symbolication, release, and environment.
  - Record every skipped or unavailable check.

## Evidence Log

- 2026-09-29: Worktree created from `origin/codex/develop` at `d29567e28af579e4a9ec843cad1a28a96cb3ac4a`.
- 2026-09-29: Vercel development deployment for this SHA is READY and `/booking` returns HTTP 200.
- 2026-09-29: Sentry build logs confirmed no auth token, release, source-map upload, or global error handler.
- 2026-09-29: `.scratch-prod/prod.env` confirmed untracked and not ignored; secret value intentionally omitted.
- 2026-09-29: Railway password regenerated; direct read-only `SELECT 1` succeeded with the rotated credential.
- 2026-09-29: Vercel records `Saw2dcRx8SWd5Uyq` and `HkUgfAa6e2E40nQk` updated with values suppressed.
- 2026-09-29: Replacement deployments `dpl_5rgHkvcpK5rXFnYhZcK2iM8boG3w` (develop) and `dpl_BC5tKwqn41mgVPH5XiSAZLxcD5EU` (production) reached READY. DB-backed nonexistent-special-class probes returned expected 404 on both public aliases; dev `/booking` and production `/` returned 200.
- 2026-09-29: Removed stale production `DATABASE_URL` entries from `.env`, `.env.local`, `.env.preview`, `.env.clerk-temp`, and `.env.tmp`; removed `.scratch-prod/prod.env` and its empty directory. `.env.development.local` retains a different non-production endpoint.
- Repository Sentry delivery: focused runtime-configuration and boundary-capture tests passed without DSN/token; no-credential build-config import passed. The build wrapper is now bypassed without complete deterministic release/auth/org/project metadata and is explicitly configured only when all are present. Remote Sentry provisioning, upload, ingestion, release association, and symbolication are intentionally pending.
