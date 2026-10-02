# Public Booking Existing Phone Recovery

## Goal

Existing identities must show the account-exists popup before any new-account SMS attempt. A genuinely new phone must complete OTP once and continue from the current booking state without remounting or replacing entered contact data.

## Tasks

- [x] Audit `0134` read-only across Postgres-g1Qy and Clerk test.
- [x] Restore existing-identity detection before SMS/account preparation.
- [x] Preserve the mounted booking and entered contact after new-phone OTP.
- [x] Add focused regressions and run affected checks.
- [ ] Complete native review and delivery.

## Evidence

- `0134` existed in Clerk test as Gabriela Barrionuevo since 2026-09-30, but was absent from the prior Postgres inventory.
- The failed 2026-10-02 attempt created a Postgres user named Pepe Pipo linked to Gabriela's Clerk ID; no purchase was created.
- The public OTP activation changed `isSignedIn`, causing `CourseAsideRight` to re-enter its unresolved eligibility loader and unmount `EnrollModal`; remounting then exposed Clerk profile data.
- Audit was read-only and performed zero remote writes.
- Known identities now return `existing_user` before any account-creation SMS or account preparation; anonymous public bookings show `This phone number already exists` and require account access.
- A captured QR flow remains auth-ready after Clerk state changes, preventing `EnrollModal` from unmounting and losing its active state.
- New-phone OTP does not activate Clerk mid-flow, and profile hydration fills only blank contact fields.
- Verification: 117 focused tests, typecheck, and `git diff --check` passed; scoped ESLint reported 0 errors and pre-existing warnings.
- Delegated verification could not attach to the sibling worktree, so the same commands ran directly.
- Work-unit commit: `203ea827` (`fix(booking): route existing phones to account access`).
- Pre-commit native review did not start because the controller returned stale consent while the task artifact was untracked; retry against the committed range.
