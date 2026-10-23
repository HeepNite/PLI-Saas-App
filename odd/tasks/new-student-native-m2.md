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

- [ ] N1. Server: `POST /api/checkin/qr/new-student/kiosk-session` mints a `new_student_sms` kiosk session (terminal auth, 30/min per terminal+IP, miss throttle, Clerk verified phone, DB/Clerk match, no prior successful purchase). Returns only token + expiry.
  - Route: inline (single new route + test).
- [ ] N2. Server: kiosk-session preparation branch snapshots real verified-phone state from Clerk for the new-student service.
  - Route: inline (one function in lib/checkout.ts + test).
- [ ] N3. Client: kiosk new-student EnrollModal mints the session after SMS success and adopts the token mid-flow; failure keeps cash.
  - Route: inline (small hook + API wrapper + modal wiring).
- [ ] N4. Tests and checks: vitest (api, checkin, components relevant), tsc, eslint changed files, next build, git diff --check.

## Checks

- `npx vitest run <relevant tests>`
- `npx tsc --noEmit -p .`
- `npx eslint <changed files>`
- `npx next build`
- `git diff --check`

## Progress

- Spec cherry-picked (853afc2b, 39d9065b); main's payment-attempt-visibility/requirements.md kept on conflict.
