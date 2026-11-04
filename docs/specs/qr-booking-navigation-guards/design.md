# Design

## Navigation

- Add Next navigation to the QR welcome component.
- Replace the plain account anchor with `next/link`.
- For a validated QR `/checkin` redirect, render the existing embedded phone/SMS sign-in instead of the Clerk widget and complete with local client navigation.
- Preserve the Clerk multi-method widget for ordinary, unsafe, or missing redirect values, and preserve callback-based embedded flows.
- Keep hosted Stripe URLs on `window.location`; they are cross-origin handoffs, not internal navigation.

## Checkout locking

- Add a mutable single-flight ref at the payment-action hook boundary.
- Acquire it before validation/request work can overlap.
- Mirror it with `processing` for rendered disabled/loading feedback.
- Release both on validation rejection, recoverable API failure, embedded checkout readiness, native terminal failure, and cash completion.
- Do not release on hosted redirect success.

## QR timers

- Centralize cancellation of refresh and expiry timers inside the effect.
- Cancel any existing pair immediately before scheduling the next pair.
- On cleanup, mark the effect inactive and cancel the pair.
- Keep the stale-response guard and current expiry behavior.

## Risk

- Navigation and checkout hooks are shared code: Risk item 3, because unrequested behavior can be affected through shared auth/payment components.
- Timer cleanup is localized, but shares the public kiosk QR rendering path.

## Delivery

Use stacked PRs to `main`:

1. `fix/qr-booking-navigation-guards` — client-side QR navigation, embedded QR sign-in, and exact redirect-context preservation.
2. `fix/qr-booking-interaction-guards` — Stripe single-flight locking, QR timer ownership, and feature closure docs; targets PR1 until PR1 lands.
