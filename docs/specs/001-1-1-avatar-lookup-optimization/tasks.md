# SPEC-001.1.1 - Tasks

## Phase 1 - Baseline And Guardrails

- [ ] inspect the current unconditional Clerk refresh behavior in `prepareCheckoutAccount()`
- [ ] identify which fields from the resolved Clerk lookup result are available before the fallback refresh
- [ ] capture the current avatar-gating behavior in tests for accounts with and without avatars

## Phase 2 - Avatar-State Helper

- [ ] add a small helper that determines whether avatar state is explicit from the resolved Clerk object
- [ ] encode whether a fallback refresh is required
- [ ] keep the helper internal to the checkout/Clerk resolution layer

## Phase 3 - Integration

- [ ] update `prepareCheckoutAccount()` to use the helper
- [ ] remove the unconditional full Clerk refresh when avatar state is already explicit
- [ ] keep the returned `account.hasAvatar` contract unchanged
- [ ] preserve the fallback full-user refresh for ambiguous cases only

## Phase 4 - Validation

- [ ] add or update unit tests for explicit-avatar, explicit-no-avatar, and ambiguous-avatar cases
- [ ] add or update API/integration tests for `/api/checkout/intent` with `prepareOnly`
- [ ] verify kiosk and QR preparation still gate photo correctly
- [ ] verify no endpoint, schema, or auth changes were introduced
