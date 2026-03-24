# Analysis

## Current Context

The current correctness fix lives in `prepareCheckoutAccount()` in `lib/checkout.ts`.

Flow today:

1. the frontend calls `requestAccountPreparation()` from `EnrollModal`
2. that calls `POST /api/checkout/intent` with `prepareOnly: true`
3. the route delegates to `prepareCheckoutAccount()`
4. `prepareCheckoutAccount()` resolves or creates the Clerk identity
5. after resolving the Clerk user, it refreshes the full user with `client.users.getUser(id)` before returning `account.hasAvatar`

## Why The Refresh Was Added

The kiosk flow exposed a bug for accounts that:

- already existed
- already had an avatar
- had no completed purchases yet

In that case the flow incorrectly treated the account as if it had no avatar and opened the camera step.

The unconditional `getUser(id)` refresh fixed correctness by using a fuller Clerk user object before deriving `hasAvatar`.

## Cost Of The Current Fix

The current approach adds an extra Clerk read on every `prepareCheckoutAccount()` path where a Clerk identity was resolved.

That means:

- the path is still safe
- but it is heavier than necessary
- the extra fetch happens even when the cheaper resolved lookup result already contains a clear avatar signal

## Relevant Code Paths

- `components/front/courses/EnrollModal.tsx`
  - `requestAccountPreparation()`
- `app/api/checkout/intent/route.ts`
  - `prepareOnly` handling
- `lib/checkout.ts`
  - `prepareCheckoutAccount()`
- `lib/clerk-users.ts`
  - `findClerkUserByIdentifiers()` and Clerk user resolution helpers

## Key Implementation Fact

The optimization target is not the frontend and not the upload contract.

The optimization target is the internal decision of when the resolved Clerk lookup result is already trustworthy enough to derive `hasAvatar`, versus when a full Clerk refresh by `id` is still required.

## Risk

If the optimization assumes avatar state too early from an incomplete lookup shape, the old bug can return.

So the correct implementation strategy is:

- trust the cheaper result only when avatar state is explicit
- refresh by `id` when avatar state is ambiguous
- preserve current behavior if refresh fails
