# Production QR Booking Source Hotfix — Requirements

## Status

Accepted for isolated hotfix implementation. Do not merge or deploy.

## Requirements

1. A signed-in customer with successful purchase history or any package MUST be classified as an existing customer in a scanned-QR booking, including URLs carrying `newStudent=1`.
2. Existing customers MUST see the regular service price rather than the new-student price.
3. A genuine new student who signs in during the QR flow MUST remain eligible for the new-student variant when the server reports no prior purchase or package.
4. A QR issued by an authorized studio terminal MUST retain its cash-payment authority for a reasonable booking completion window.
5. Invalid, tampered, context-mismatched, or expired grants MUST continue to fail closed.
6. Ordinary public booking links MUST remain card-only.
7. The hotfix MUST remain isolated: no merge and no deployment.

## Acceptance criteria

- [ ] Signed-in established customer plus `newStudent=1` resolves to `checkin-existing`.
- [ ] Signed-in customer without purchase history resolves to `checkin-new`.
- [ ] A default kiosk QR grant remains valid after ten minutes.
- [ ] A default kiosk QR grant is rejected after its booking completion window.
- [ ] Existing public-booking and invalid-grant boundaries pass.
