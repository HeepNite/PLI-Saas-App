# Analysis: Profile Booking Consecutive Promo

## Current Contracts

- Profile booking opens `EnrollModal` from `ProfilePageClient` with `compactBookingSource: "profile-booking"`, `skipContactStep`, and selected `checkInContext` date/time.
- `EnrollModal` already supports a `consecutive` step and uses `effectiveIsPackageHolder = isPackageHolder || Boolean(pkg)` for promo price selection.
- `resolveEnrollStepKeys` already includes `consecutive` for profile booking when `hasConsecutiveOffer` is true.
- Consecutive offer fetching currently excludes profile booking because the fetch gate only allows QR mobile or check-in flows.
- `/api/checkin/terminal/consecutive-offer` already resolves linked later classes using `courseSlug`, `date`, and `time`.

## Gap

Profile booking does not fetch consecutive offers and does not pass existing active package-holder state into `EnrollModal`.

## Affected Files

- `components/front/profile/ProfilePageClient.tsx` — pass `isPackageHolder` based on active usable profile packages.
- `components/front/courses/EnrollModal.tsx` — allow consecutive offer fetch for `profile-booking`.
- `tests/checkin/enroll-flow.test.ts` — existing step coverage confirms profile flow can include promo.
- Profile/Enroll tests — add focused regression where feasible.

## Constraints

- No schema changes.
- Preserve existing checkout validation and split purchase payload behavior.
- Use package-holder price automatically when an active usable package exists.
