# Analysis: Security and Observability Hardening

## Current Inventory

| Area | Evidence | Gap |
| --- | --- | --- |
| Local containment | `.scratch-prod/prod.env` is untracked and not ignored; its known `DATABASE_URL` value was not read. | A secret-bearing scratch path can be accidentally staged. |
| Database authority | Railway `PLI-SaaS` / `production` / Postgres `2f8a948a-41de-4a86-9d5c-20583e6e8759` is authoritative. | Rotation and consumer coordination remain manual. |
| Vercel consumers | One Preview `codex/develop` `DATABASE_URL` and one shared Production+Preview+Development record exist. | Both require a coordinated update and deployment evidence. |
| Sentry SDK | `@sentry/nextjs` 10.65.0 initializes client/server/edge with DSN gating and `tracesSampleRate: 0.1`; request errors are captured. | No explicit release/environment identity is configured. |
| Error boundaries | `app/error.tsx` and `app/checkin/error.tsx` only log; `app/staff/error.tsx` captures directly. | No root `global-error` boundary; coverage and duplicate-capture ownership are inconsistent. |
| Sentry build | `next.config.ts` accepts org/project/token and dry-runs without a token. Build logs show no releases or source maps. | Vercel lacks `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT`. |
| Remote Sentry | Vercel has `NEXT_PUBLIC_SENTRY_DSN` for Production and Preview. Local Sentry CLI has no remote authentication. | Issues, alerts, quotas, and source-map state are unverified. |
| Preventive controls | `.gitignore` ignores `.env*`; CI has typecheck, reporting lint/test, and CodeQL. | No dedicated secret scanner or scratch-path rule. |

## Constraints and Risks

- Provider dashboards must handle secret values; repository commands and evidence must report only record names, scopes, statuses, and deployment identifiers.
- A rotated Railway password invalidates old consumers. Update both Vercel records before declaring the rotation complete and retain the prior deployment until validation succeeds.
- DSN gating must remain so local environments without a DSN stay inert.
- Direct capture in route boundaries must be reconciled with global capture to avoid duplicate Sentry events.
