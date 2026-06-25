# Resolve: Profile Booking Consecutive Promo

## Decisions

1. Reuse the existing consecutive offer endpoint for v1.
   - Reason: The endpoint already accepts selected `courseSlug`, `date`, and `time`, which matches profile booking needs.

2. Profile booking package-holder pricing is derived from existing active usable profile packages.
   - A usable package means unlimited OR `remainingCredits > 0`, with active state already reflected by profile package data.
   - If true, `EnrollModal` receives `isPackageHolder` so the consecutive step uses `packageHolderConsecutiveCents`.

3. Checkout payload and server checkout behavior remain unchanged.
   - Reason: Consecutive checkout fields already exist and should be reused.

## Non-Goals

- Rename the terminal consecutive endpoint.
- Add manual selection for simultaneous classes/rooms.
- Change staff fast-action behavior.
