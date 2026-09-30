# Design: Security and Observability Hardening

## Approach

Use existing Next.js, Sentry, Vercel, Railway, GitHub Actions, and Git ignore facilities. Add no runtime dependency unless the selected CI secret scanner cannot run as a pinned action or existing tool. Preserve the current Sentry SDK initialization, DSN gating, and all application security controls.

## Repository Changes

| Change | Boundary |
| --- | --- |
| Ignore `.scratch-prod/` and add a focused secret-scanning CI gate | A zero-dependency Node scanner evaluates tracked text by default or staged added/modified index text with `--staged`; it skips `.env*`, binary, and files over 1 MiB. Its fixed high-confidence rules cover credential URLs, PEM private-key headers, and GitHub/Stripe/Sentry/Slack/AWS secret prefixes. Findings and `secret-scan: allow` suppressions report rule ID plus repository-relative path and line only. |
| Configure Sentry build integration | Read build-only `SENTRY_ORG`, `SENTRY_PROJECT`, and least-privilege `SENTRY_AUTH_TOKEN` only from CI/Vercel secrets; attach release and environment from trusted deployment metadata. |
| Add root global-error capture and normalize route boundaries | Capture each thrown boundary error once, retain user-safe error UI, and avoid sending request bodies, credentials, or raw sensitive context. |
| Add focused tests and build verification | Assert configuration/capture behavior without live secrets or remote credentials. |

## Manual Provider Runbook

1. Confirm the Railway service identity; regenerate its password in Railway.
2. Update both named Vercel consumers through the dashboard without exposing the value, then create replacement deployments.
3. Verify approved database-dependent paths in development and production; keep the prior deployment available until both succeed. On failure, roll back deployment/consumer use, contain the credential incident, and escalate rather than reverting a password manually.
4. Provision scoped Sentry credentials and deployment variables, configure alerts/ownership, run one controlled non-production event, and record only identifiers/statuses.

## Failure and Rollback Policy

- A suspected secret exposure stops further disclosure, invalidates the credential through the owning provider, removes local copies, and records redacted incident evidence.
- Failed deployment verification keeps or restores the last known-good deployment while the release owner investigates; it never restores a compromised password.
- Missing Sentry remote proof is a failed observability verification, not permission to claim completion. Alert failures are triaged with the release/environment/event identifier only.
