# Production QR Booking Source Hotfix — Analysis

## Production evidence

- Production runs `main` and currently includes the kiosk QR signed-grant flow.
- `CourseAsideRight` skips the existing-customer eligibility request whenever `newStudent=1` is present, then captures `checkin-new`.
- `KIOSK_QR_CASH_GRANT_TTL_SECONDS` is five minutes from tablet rendering.
- The phone cannot refresh the grant because minting requires an authorized terminal session.
- The tablet refresh protects the displayed QR, but a scanned phone keeps the copied token while the customer signs in and completes booking.

## Impact

- An established customer can be shown the $15 new-student option instead of the regular $20 option.
- A valid studio scan can lose cash authority before checkout and appear equivalent to an ordinary public booking.
- Backend price validation reduces incorrect-charge exposure, but misleading UI and abandoned/failed cash checkout remain revenue risks.
