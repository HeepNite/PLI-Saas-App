# Resolved Contract: Security and Observability Hardening

## Decisions

1. **Credential rotation:** Railway dashboard **Regenerate Password** is the only permitted mutation. The new connection URL is handled only in provider UIs; neither manual Vercel edits from copied text nor database `ALTER USER` is allowed.
2. **Consumer sequence:** Identify the two known Vercel records by environment/scope, update both through Vercel's secret-safe UI, deploy replacement builds, verify database-dependent development and production paths, then remove stale local copies. Retain the prior deployment for rollback until verification.
3. **Repository containment:** Add the narrowest ignore rule for `.scratch-prod/`; do not commit local credentials. CI uses a repository-owned, zero-dependency Node scanner with redacted output. It scans tracked text (or staged added/modified text with `--staged`), excludes `.env*`, binary, and oversized files, and reports only high-confidence secret candidates: credential-bearing database/cache URLs, PEM private-key headers, and established GitHub/Stripe/Sentry/Slack/AWS secret prefixes. `secret-scan: allow` suppresses only a matching line and remains visible in scanner output.
4. **Sentry behavior:** Preserve DSN gating and 0.1 tracing. Use deterministic release identity from the deployment commit, explicit environment, release/source-map upload only when build metadata is present, and one capture owner per boundary.
5. **Remote access:** Provision a least-privilege Sentry automation token/integration limited to the target organization/project and release/source-map needs. Do not use a personal broad-scope token or treat local CLI absence as an error-state result.
6. **Operational verification:** Send exactly one controlled, clearly tagged test event through a safe non-production path; verify it remotely and remove/resolve it according to the runbook. No deliberate production failure is required.

## Manual Prerequisites

- An authorized Railway operator and Vercel operator must perform rotation, record updates, redeployments, and rollback if needed.
- A Sentry administrator must provide the target organization/project, least-privilege upload/audit access, alert ownership, retention/quota confirmation, and a safe verification environment.
- CI platform access is required to store any scanner configuration or tokens as masked secrets.

## Open Evidence

- Remote Sentry issues, alert rules, quotas, release artifacts, and symbolication are unverified until authenticated remote access and the controlled event are available.
- The specific production/development database-dependent verification paths must be selected by the release owner before execution; this spec does not invent user journeys.
