# Kiosk QR Cash Hotfix — Requirements

## Status

Accepted for production hotfix implementation under issue #702.

## Requirements

1. A customer phone reached from a QR issued by an authorized in-studio kiosk tablet MUST offer cash and card/wallet.
2. Cash authorization MUST come from a short-lived server-verifiable grant bound to the selected course, date, and time.
3. Caller-controlled markers such as `fromQr`, `qrBooking`, `photoContext`, `flowContext`, or omitted `bookingSource` MUST NOT authorize cash.
4. Ordinary public booking links MUST remain card-only.
5. QR-phone cash MUST create a pending kiosk-attributed settlement and MUST NOT create immediate attendance.
6. Special-class immediate cash admission MUST remain restricted to an authorized kiosk terminal.
7. Existing authorized kiosk-terminal cash MUST remain unchanged.
8. Invalid, expired, tampered, or context-mismatched grants MUST fail closed before validation, identity, purchase, or attendance side effects.

## Acceptance criteria

- [ ] The authorized kiosk tablet QR carries a valid short-lived grant.
- [ ] The phone payment step offers cash and card/wallet only with that grant.
- [ ] Valid QR-phone cash creates a pending kiosk purchase without attendance.
- [ ] Public, missing, expired, tampered, and mismatched grants cannot authorize cash.
- [ ] Authorized terminal cash and card/wallet regressions pass.
