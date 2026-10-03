# Public Booking Existing Phone Recovery

## Goal

Existing identities must show the account-exists popup before any new-account SMS attempt. A genuinely new phone must complete OTP once and continue from the current booking state without remounting or replacing entered contact data.

## Tasks

- [x] Audit `0134` read-only across Postgres-g1Qy and Clerk test.
- [x] Restore existing-identity detection before SMS/account preparation.
- [x] Preserve the mounted booking and entered contact after new-phone OTP.
- [x] Add focused regressions and run affected checks.
- [x] Complete native review and delivery.

## Evidence

- `0134` existed in Clerk test as Gabriela Barrionuevo since 2026-09-30, but was absent from the prior Postgres inventory.
- The failed 2026-10-02 attempt created a Postgres user named Pepe Pipo linked to Gabriela's Clerk ID; no purchase was created.
- The public OTP activation changed `isSignedIn`, causing `CourseAsideRight` to re-enter its unresolved eligibility loader and unmount `EnrollModal`; remounting then exposed Clerk profile data.
- Audit was read-only and performed zero remote writes.
- Known identities now return `existing_user` before any account-creation SMS or account preparation; anonymous public bookings show `This phone number already exists` and require account access.
- A captured QR flow remains auth-ready after Clerk state changes, preventing `EnrollModal` from unmounting and losing its active state.
- Successful new-phone OTP activates the corresponding Clerk session while the captured booking remains mounted; profile hydration fills only blank contact fields.
- Exact-phone ownership is checked again after activation before pricing, package reservation, or payment routing.
- Verification: 86 final focused tests, typecheck, and `git diff --check` passed; scoped ESLint reported 0 errors and pre-existing warnings.
- Native review `review-cc82c64803dedfa5` approved and was acknowledged.
- Work-unit commits: `203ea827`, `fef691ae`, `a10da6f3`, and `8c0483fc`.
- PR #594 merged into `codex/develop` as `83166f406dcd2ca68b34a0c20e97d3015c4a2568`.
- Vercel deployment `dpl_G9kkkEPw1xFdsVZnpUJG14w1dmyu` is ready and serves `dev.palladiumlatin.art`.
