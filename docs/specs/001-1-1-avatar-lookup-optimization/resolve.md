# Resolution

## Contract Decisions

1. This spec is a technical-debt follow-up to `SPEC-001`.
2. Clerk remains the source of truth for avatar presence.
3. No API shape change is allowed for `/api/checkout/intent`.
4. No new endpoint, cache, sync job, or persistence model will be introduced.
5. No frontend flow behavior will change in this spec.

## Context Strategy

1. The current correctness fix in `prepareCheckoutAccount()` refreshes the Clerk user unconditionally after identifier lookup.
2. That unconditional refresh is functionally correct but heavier than necessary.
3. `app/api/checkin/qr/bootstrap/route.ts` remains out of scope for this spec.
4. This optimization is limited to the account-preparation path used by `prepareOnly` and related checkout preparation.

## Contract Decisions For Avatar Resolution

1. Avatar-state resolution will use a two-stage strategy:
   - resolve the user by the existing auth or identifier lookup
   - derive avatar state from the resolved lookup result when the signal is explicit and trustworthy
   - call `client.users.getUser(id)` only when avatar state is missing or ambiguous
2. The implementation must not weaken correctness in exchange for fewer Clerk reads.
3. If avatar state cannot be trusted from the cheaper lookup result, the fallback full-user fetch remains allowed.
4. If the fallback refresh fails, the implementation must preserve safe behavior and avoid silently misclassifying avatar presence.

## Minimal Architectural Changes

1. Add a small internal helper in the checkout/Clerk resolution layer for avatar-state confidence.
2. Keep `prepareCheckoutAccount()` as the single decision point for account-preparation avatar gating.
3. Keep the returned `account.hasAvatar` field unchanged for all callers.

## Spec Adjustments

1. This spec does not change product behavior.
2. This spec does not change any user-facing copy.
3. This spec does not change upload contracts or auth boundaries.
4. This spec narrows an implementation detail only: when a full Clerk user refresh is actually necessary.

## Implementation Preconditions

1. The implementer must identify which fields from the resolved Clerk lookup result are reliable enough to determine avatar presence.
2. The implementation must keep the existing correct behavior for:
   - existing account with avatar and no purchases
   - existing account without avatar
   - account preparation in both kiosk and QR flows
3. The optimization must be covered by tests before the unconditional refresh is removed.
