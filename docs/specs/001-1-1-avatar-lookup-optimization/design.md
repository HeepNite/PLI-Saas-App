# SPEC-001.1.1 - Design

## Intent

Optimize avatar-state resolution during account preparation without changing product behavior.

The design goal is to keep `prepareCheckoutAccount()` correct while reducing redundant Clerk reads when the cheaper resolved user object already exposes a trustworthy avatar signal.

## Reuse Strategy

The implementation must reuse:

- `prepareCheckoutAccount()` as the orchestration point
- existing Clerk resolution helpers in `lib/clerk-users.ts`
- existing `/api/checkout/intent` response contract
- existing frontend consumption of `account.hasAvatar`

## Affected Areas

- `lib/checkout.ts`
- `lib/clerk-users.ts` or a nearby checkout helper layer
- existing unit/API tests around checkout preparation

## Architecture Constraints

- keep the change localized to the account-preparation path
- no unrelated refactor of checkout or avatar-upload flows
- no new dependency
- no frontend branching changes beyond consuming the same `account.hasAvatar`

## Data And Contract Notes

A small internal helper should separate three concerns:

1. resolved user identity
2. avatar-state confidence
3. fallback refresh requirement

Recommended helper contract:

- input: resolved Clerk user from auth or identifier lookup
- output:
  - `hasAvatar: boolean | null`
  - `needsRefresh: boolean`

Recommended rule:

- if the resolved Clerk object already exposes a clear avatar signal, use it directly
- if the signal is missing or ambiguous, refresh by `id` exactly once and derive `hasAvatar` from the full user
- return the same external `account.hasAvatar: boolean` contract after resolution completes

## Security And Operational Notes

- avatar truth remains Clerk-based, not client-based and not DB-based
- existing rate limits and auth boundaries remain unchanged
- logging may warn on refresh fallback failure, but the optimization must not introduce noisy new logging patterns
- rollout risk is functional regression in photo gating, so tests must cover avatar/no-avatar cases before reducing Clerk reads
