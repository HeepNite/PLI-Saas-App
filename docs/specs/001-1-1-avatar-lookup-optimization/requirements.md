# SPEC-001.1.1 - Avatar Lookup Optimization For Check-In Preparation

## Status

`ALIGNED - READY FOR PLAN`

## Objective

Reduce redundant Clerk reads during pre-payment account preparation without changing checkout behavior.

The business goal is to preserve correct photo gating for kiosk and QR preparation flows while keeping Clerk traffic bounded as usage grows.

## Scope

### In scope

- `prepareCheckoutAccount()` avatar-state resolution.
- `prepareOnly` and account-preparation paths used by kiosk and QR flows.
- Fallback-safe optimization that preserves the current correct behavior for accounts with and without avatars.
- Technical-debt reduction inside the checkout/Clerk resolution path.

### Out of scope

- Any UI changes.
- Keypad, stepper, summary, or modal layout work.
- Customer/staff blocking rules.
- New persistence or caching infrastructure.
- Changes to avatar upload contracts.
- New endpoints or schema changes.

## Context

This spec applies to the account-preparation path used before photo/payment gating in kiosk and QR onboarding flows.

The relevant server-side behavior currently lives in `prepareCheckoutAccount()` and is consumed through `POST /api/checkout/intent` when the frontend requests `prepareOnly`.

The current behavior is functionally correct, but it refreshes the full Clerk user unconditionally after identifier lookup in order to decide whether the account already has an avatar.

## Functional Requirements

- Accounts with an existing avatar must still skip the photo step.
- Accounts without an avatar must still require the photo step.
- Accounts with no purchase history must still be handled correctly.
- `prepareOnly` must not require an unconditional full Clerk user fetch on every request.
- A full Clerk fetch is allowed only as a fallback when avatar state cannot be trusted from the cheaper lookup result.
- The returned `account.hasAvatar` contract from `/api/checkout/intent` must remain unchanged.
- Kiosk and QR preparation flows must continue to rely on Clerk as the source of truth for avatar presence.

## Constraints

- No behavior change is allowed in kiosk or QR photo gating.
- No endpoint contract change is allowed for `/api/checkout/intent`.
- No schema changes are allowed.
- No new cache, sync table, or persisted avatar mirror is allowed in this spec.
- Correctness takes priority over optimization if lookup data is ambiguous.

## Security Rules

- Preserve existing authentication and authorization behavior in checkout preparation.
- Preserve current rate-limit behavior.
- Do not widen access to Clerk data beyond the current server-side checkout flow.
- Do not move avatar trust to client-side signals.

## Acceptance Criteria

- [ ] `/api/checkout/intent` with `prepareOnly` still returns `hasAvatar: true` for existing accounts that already have an avatar, including accounts with no purchases.
- [ ] `/api/checkout/intent` with `prepareOnly` still returns `hasAvatar: false` for existing accounts without an avatar.
- [ ] The optimized path avoids the extra full Clerk user fetch when avatar state is already explicit from the resolved lookup result.
- [ ] Kiosk and QR photo gating behavior does not regress.
- [ ] No API response shape changes are introduced for `/api/checkout/intent`.

## Definition Of Done

- [ ] implementation preserves current photo-gating behavior
- [ ] relevant unit/API tests exist and pass
- [ ] unconditional Clerk refresh is removed or narrowed behind an ambiguity fallback

## Open Questions

- none
