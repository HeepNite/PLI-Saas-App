# Analysis

## Baseline

`useEntryModeRouter` records a valid new-booking override, but only opens the modal after `consecutiveOfferSettled` becomes true. `useConsecutiveOfferState` performs the terminal request without a timeout. A slow request therefore leaves `pendingNewBooking` true indefinitely.

The terminal route performs three Prisma reads: active links, the selected course, and linked courses. Its current catch-to-null response is intentionally fail-soft, but it has no route timing visibility.

## Constraints

- Keep the existing terminal endpoint and response schema.
- Do not add dependencies, migrations, or database access outside the existing route behavior.
- Preserve rate limiting and avoid any telemetry fields that could identify a customer or expose payment data.

## Test surface

- `tests/checkin/useConsecutiveOfferState.test.tsx` covers lookup state.
- `tests/checkin/useEntryModeRouter.test.tsx` covers booking routing and context.
- `tests/checkin/checkin-qr-api.test.ts` covers adapter request behavior.
- `tests/api/checkin-terminal-consecutive-offer.test.ts` covers route behavior with mocked Prisma.
