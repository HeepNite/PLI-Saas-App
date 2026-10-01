# Remove decorative heritage flag bubbles

## Goal
Remove standalone decorative country-flag bubbles from public booking while preserving meaningful campaign and country-selection flags.

## Resolved contract

- Public booking renders no desktop side rails or floating flag bubbles.
- Enamel flag pins on eligible class `BOOK` actions remain unchanged.
- Country selection, campaign dialogs, and campaign eligibility remain unchanged.
- No production, Clerk, Railway, payment, or SMS behavior changes.

## Tasks

- [x] 1. Update the active campaign requirement to remove standalone decorative rails.
- [x] 2. Remove the rail component and its public booking render path.
- [x] 3. Remove obsolete focused rail coverage while retaining booking-pin coverage.
- [x] 4. Run focused tests, typecheck, scoped lint, diff check, and native review.
- [ ] 5. Commit and publish after explicit authorization.

## Delivery constraints

Push, PR, merge, and deployment require explicit user authorization.

## Evidence

- 2 focused files, 16 tests passed.
- Typecheck, scoped ESLint, and `git diff --check` passed.
- Native review `review-006c3deb9eab69b1` approved and acknowledged.
