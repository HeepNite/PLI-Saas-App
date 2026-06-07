# Requirements — refactor-checkin-qr-client-600-lines

## Goal

Refactor `components/front/checkin/CheckInQrClient.tsx` so it becomes a maintainable composition root of **600 lines or fewer** while preserving all existing check-in, kiosk, package, purchase, and consecutive-class behavior.

## In Scope

- Split orchestration currently embedded in `CheckInQrClient.tsx` into focused hooks, API adapters, and presenter components.
- Keep behavior equivalent for:
  - personal QR check-in
  - kiosk terminal check-in
  - PIN identity flow and rotation
  - package check-in
  - no-package / repurchase flow
  - duplicate purchase flow
  - consecutive class offer accept/decline/cash/card/QR flows
  - late-payment flow
  - station reset and inactivity handling
- Preserve all public props and caller behavior of `CheckInQrClient`.
- Preserve existing endpoint contracts and request/response payload fields.
- Add tests for each moved behavior before or during each extraction slice.
- Keep each PR reviewable and reversible.

## Out of Scope

- UI redesign or copy changes.
- Database schema changes.
- New endpoints.
- Auth/authorization changes.
- Rewriting `useCheckInDisplayData.ts` unless a later spec explicitly targets it.
- Fixing unrelated kiosk bugs outside the slice being refactored.

## Functional Requirements

1. `CheckInQrClient.tsx` MUST be reduced to **<=600 LOC** by the end of the refactor.
2. The refactor MUST preserve the issue #32 fix: kiosk terminal flow MUST NOT treat the staff Clerk session as customer identity.
3. The refactor MUST preserve the package/no-package purchase path so users without credits can repurchase instead of looping.
4. The refactor MUST preserve daily panel attendance creation/visibility behavior by keeping package check-in response handling intact.
5. The refactor MUST preserve package success overlay and station reset timing so the kiosk does not remain stuck after successful package check-in.
6. The refactor MUST preserve consecutive class offer rules, including paid package-holder add-ons requiring cash/card collection before recording payment.
7. The refactor MUST keep kiosk inactivity/reset behavior equivalent and avoid resetting while terminal-sensitive customer state is active.
8. The refactor MUST keep all API payload fields currently sent by `CheckInQrClient`, including `flowContext`, `kioskSessionToken`, `linkedFromAttendanceId`, `linkedFromCourseSlug`, and consecutive flags.
9. Each extracted hook or adapter MUST have focused tests for its moved decisions/effects.
10. Presenter components MUST remain prop-driven and must not introduce new business decisions.

## Quality Requirements

- Prefer pure policy helpers in `lib/checkin/*` before adding new imperative logic.
- Use thin API adapters for fetch/body/error parsing.
- Avoid React context unless prop threading becomes unreviewable after extraction.
- Avoid large one-shot rewrites; use chained PRs.
- Every implementation PR MUST include validation commands and rollback scope.

## Success Criteria

- `CheckInQrClient.tsx` <=600 LOC.
- All targeted check-in/kiosk tests pass.
- Each slice lands through an approved issue and PR with exactly one `type:*` label.
- No regression in kiosk flows #32–#35.
- `docs/specs/refactor-checkin-qr-client-600-lines/tasks.md` records completed slices and validation results.
