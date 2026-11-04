# Production QR Booking Source Hotfix — Design

## Existing-customer classification

Move the QR classification predicates into `lib/checkin/qr-booking-links.ts` and use them from `CourseAsideRight`. Every signed-in scanned-QR booking waits for the server eligibility result before capturing its flow variant. The server result, not `newStudent=1`, decides whether the variant is `checkin-existing`.

## QR cash continuity

Increase the signed grant's default lifetime from five to thirty minutes. The tablet continues refreshing before expiry, while a scanned phone receives enough time to sign in and finish checkout. Verification remains cryptographic and context-bound.

## Verification

- Focused QR booking classification tests.
- Default-lifetime boundary tests.
- Existing grant tamper/context/expiry and public-booking checkout regressions.
- TypeScript, lint on touched files, and differential checks against the base commit.
