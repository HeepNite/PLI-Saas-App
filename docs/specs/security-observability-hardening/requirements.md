# Security and Observability Hardening

## Status

`DRAFT`

## Objective

Contain the exposed production database credential, restore actionable Sentry telemetry, and prevent recurrence without weakening existing application security behavior.

## Scope

### In scope

- Railway-managed production PostgreSQL credential rotation and every known Vercel consumer update.
- Local/repository secret containment and CI secret scanning.
- Sentry release/source-map delivery, environment and release identity, error coverage, least-privilege audit access, alert policy, and one controlled verification event.
- Safe rollback and incident handling.

### Out of scope

- Database schema, application authentication/authorization, rate-limit, billing, or provider-plan changes.
- Bulk rotation of credentials other than the exposed production database credential.
- Treating an unauthenticated Sentry CLI as proof of remote project health.

## Security Rules

- Secret values must never appear in Git, committed files, terminal output, CI logs, test fixtures, task artifacts, or command arguments.
- Rotate the database password only through Railway's dashboard **Regenerate Password** flow; manual variable edits and `ALTER USER` are forbidden.
- Preserve the old deployment until replacement Production and development database paths are verified.
- Sentry build credentials must be scoped to release/source-map upload only and stored in the deployment/CI provider, never in repository configuration.

## Acceptance Criteria

- [ ] The affected local scratch path is ignored, secret-bearing copies are removed only after rotation readiness, and Git confirms no such path is tracked or newly visible.
- [ ] Railway's authoritative `PLI-SaaS` / `production` / Postgres service `2f8a948a-41de-4a86-9d5c-20583e6e8759` is rotated through its supported UI without outputting the credential.
- [ ] Both known Vercel `DATABASE_URL` consumers—the Preview `codex/develop` record and shared Production+Preview+Development record—are updated without displaying values; replacement deployments are verified on production and development database-dependent paths.
- [ ] Sentry creates releases and uploads source maps when secure build metadata is available; events carry explicit environment and release identity, and a root/global boundary plus route-level boundaries capture exceptions without duplicate reports.
- [ ] Sentry remote access uses a least-privilege token or integration; a controlled non-production-safe event verifies ingestion, environment, release association, and symbolication before telemetry is declared operational.
- [ ] CI runs a non-interactive secret scanner that redacts values, fails on newly introduced high-confidence secret candidates, and does not print raw findings or secret contents.
- [ ] An incident/rollback runbook defines containment, provider rollback/redeploy criteria, secret invalidation, alert triage, and evidence to retain without retaining secrets.

## Definition Of Done

- [ ] Repository changes, provider steps, tests, and manual evidence satisfy the accepted tasks.
- [ ] Existing auth, authorization, validation, rate limiting, and audit behavior remain unchanged.
- [ ] Remaining unavailable remote checks and manual prerequisites are recorded.
