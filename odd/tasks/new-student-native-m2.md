# New Student Native M2

## Outcome

A new student ("I am new" on /staff/terminal in the Android PLI app) can pay by card on the Stripe Reader M2 after mandatory SMS verification, reusing the existing kiosk-session native path.

## Source of truth

- `docs/specs/new-student-native-m2/requirements.md`, `resolve.md` (OQ1-OQ9), `analysis.md` (G1-G7).

## Constraints

- SMS verification is mandatory: a session is minted only when the server re-reads Clerk and the submitted phone is verified on the prepared Clerk user.
- Kiosk in-studio cash stays available; mint failure never blocks cash (OQ7).
- Do not touch the kiosk QR / public web QR flow (PR #737 files: CourseAsideRight.tsx, lib/checkin/qr-booking-links.ts, lib/checkin/kiosk-qr-cash-grant.ts).
- Price shown == charged (server authoritative, existing #728 helpers). Uncharged attempts handled by #735 (unchanged).
- No schema change, no new dependency. `KioskIdentificationSession.credentialKind` is a free `String` (prisma/schema.prisma:807), so `"new_student_sms"` needs no migration.
- TDD: strict (owner instruction for this task). Runner: vitest (`npx vitest run`).
- Delivery: work-unit commits on `feat/new-student-native-m2`; no push/PR.

## Tasks

- [x] N1. Server: `POST /api/checkin/qr/new-student/kiosk-session` mints a `new_student_sms` kiosk session (terminal auth, 30/min per terminal+IP, miss throttle, Clerk verified phone, DB/Clerk match, no prior successful purchase). Returns only token + expiry.
  - Route: inline (single new route + test).
  - Evidence: commit b86680ec. RED 10/10 failing against 501 stub; GREEN 10/10. `hasVerifiedPhone` exported from lib/checkout.ts and reused; eligibility via `enforceNewStudentRules`.
- [x] N2. Server: kiosk-session preparation branch snapshots real verified-phone state from Clerk for the new-student service.
  - Route: inline (one function in lib/checkout.ts + test).
  - Evidence: commit 0d1a3f5b. RED 1 failing (Clerk not read); GREEN 18/18 in tests/lib/checkout-prepare.test.ts. Uncached `clerkClient().users.getUser` only for the new-student service; other services unchanged (test asserts no Clerk read).
- [x] N3. Client: kiosk new-student EnrollModal mints the session after SMS success and adopts the token mid-flow; failure keeps cash.
  - Route: inline (small hook + API wrapper + modal wiring).
  - Evidence: commit a3b16b3e. RED 1 failing (stub hook, no mint); GREEN 5/5 hook tests + mid-flow token test in use-enroll-payment-actions (84/84). Mint is fire-and-forget after SMS success so it never blocks SMS completion or cash; token is dropped if the phone changes.
- [x] N4. Tests and checks: vitest (api, checkin, components relevant), tsc, eslint changed files, next build, git diff --check.

  - Evidence: vitest tests/api tests/checkin tests/lib/checkout-prepare.test.ts components: 273 files / 2765 tests passed. `tsc --noEmit` clean. eslint changed files: 0 errors (6 pre-existing warnings in EnrollModal.tsx, untouched lines). `next build` exit 0. `git diff --check` clean.

- [x] R1. Security review fixes: mint requires Clerk createdAt within 30 min (`NEW_STUDENT_SESSION_MAX_ACCOUNT_AGE_MS` in lib/checkin/kiosk-session.ts; route files cannot export constants); prior purchaser and every refusal return the same 403 and record a terminal miss; N2 snapshot counts only a verified primary phone equal to the session user's phone.
  - Evidence: RED 3 failing; GREEN 30/30 focused. Full set: 273 files / 2767 tests, tsc clean, eslint 0, next build 0, diff --check clean.
  - Bootstrap (app/api/checkin/qr/bootstrap/route.ts ~321-326) left unchanged: dropping its any-verified-phone fallback would change the existing-customer prepared-context snapshot.

## Checks

- `npx vitest run <relevant tests>`
- `npx tsc --noEmit -p .`
- `npx eslint <changed files>`
- `npx next build`
- `git diff --check`

## Residual notes

- No full EnrollModal render test for the SMS onSuccessAction wiring (3-line glue); covered by hook + payment-actions tests.
- Not verified here: if the staff recovery-code path finishes without a Clerk-verified phone, the mint is refused (card fails closed, cash only); SMS proof stays mandatory.
- Kiosk-session branch still reports `hasAvatar: true` (pre-existing); the new-student flow keeps the earlier prepared account for the photo step.
- No on-device M2 validation (adb/device out of scope).

## Progress

- Spec cherry-picked (853afc2b, 39d9065b); main's payment-attempt-visibility/requirements.md kept on conflict.
