# Kiosk QR Cash Hotfix — Design

## Grant lifecycle

1. The authenticated tablet requests a grant for its current course/date/time.
2. The server verifies `authorizeStaffTerminalSession()` and signs a compact, short-lived payload with the terminal secret.
3. A shared client component requests and refreshes the grant for each displayed tablet class context, then renders the complete URL locally with `qrcode.react`.
4. Current, late-payment, and past-class tablet QRs remain hidden until their matching grant is ready; no signed URL is sent to an external QR-image service.
5. QR navigation preserves the grant through the booking URL, modal context, and checkout payload.
6. The payment UI offers cash only when the kiosk grant is present and the flow is not `public_booking`.
7. `/api/checkout/cash` verifies signature, expiry, purpose, and exact checkout context before any side effect.

## Cash fulfillment

- Valid QR-phone grant: create the existing pending cash purchase with `purchaseSource: kiosk`.
- Authorized terminal: preserve current cash behavior, including intentional special-class walk-in admission.
- QR phone plus special-class fields: reject before admission.
- All other remote requests: reject.

## Verification

- Unit tests for mint/verify, expiry, tampering, and context mismatch.
- Route tests for mint authorization and cash admission boundaries.
- UI/link/payload tests for grant propagation and channel visibility.
- Focused checkout regression, TypeScript, ESLint, diff check, and independent verification.
