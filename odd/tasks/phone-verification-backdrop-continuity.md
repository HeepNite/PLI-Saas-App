# Phone verification backdrop continuity

## Goal
Keep the active public booking form visible behind Phone Access until SMS verification succeeds or is canceled.

## Resolved contract

- Phone Access overlays the current booking state instead of replacing it with a synthetic campaign backdrop.
- The underlying form, progress, entered contact summary, and footer remain visible but inert and dimmed.
- The verification card remains the only interactive surface above the overlay.
- Kiosk verification behavior and identity authority remain unchanged.

## Tasks

- [x] 1. Update the campaign requirement to preserve the full active booking state.
- [x] 2. Remove the opaque synthetic Heritage verification backdrop from the public SMS overlay.
- [x] 3. Update focused coverage for translucent overlay continuity.
- [x] 4. Run focused tests, typecheck, scoped lint, diff check, and native review.
  - Focused tests: 2 files, 44 tests passed.
  - Typecheck and `git diff --check` passed.
  - Scoped ESLint: 0 errors, 6 pre-existing warnings in `EnrollModal.tsx`.
  - Native review `review-35fabfdbeac67bd2` approved and acknowledged after staging the tracker resolved the stale intended-untracked selection.

## Delivery constraints

Commit, push, PR, merge, and deployment require explicit user authorization.
