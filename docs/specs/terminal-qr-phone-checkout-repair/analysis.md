# Terminal QR phone checkout repair — analysis

## Diagnosis

No deterministic local source regression has been reproduced. Parent-supplied baseline evidence reports **124/124 focused tests passing**. A production observation can still differ when production has not received the local revision; Stripe wallet availability is separately determined by provider, account, device, and browser eligibility.

## Evidence from the current implementation

| Concern | Evidence | Conclusion |
| --- | --- | --- |
| Terminal QR context | `components/front/staff/StaffTerminalShell.tsx` builds `/checkin` with `courseSlug`, `date`, `time`, `durationMinutes`, and `fromQr=1`. | The landing QR is already the required class-context QR; do not replace it. |
| QR-phone payment route | `useEnrollPaymentActions.ts` sends a non-terminal check-in card payment to `requestCheckoutSessionApi` with `buildCheckoutPayload({ checkInBooking: true })`, then assigns the returned URL to `window.location.href`. | The hosted Checkout route and navigation already exist. |
| Server contract | `app/api/checkout/session/route.ts` identifies a mobile QR check-in only when `photoContext` is `qr_phone` and `checkInBooking` is true. | Both fields are contract-critical and need a client regression test. |
| Stripe method configuration | The checkout-session route currently passes `payment_method_types: ["card"]` to Stripe. | Retain it unless implementation analysis demonstrates a required change. |
| Existing hook coverage | `tests/checkin/use-enroll-payment-actions.test.tsx` proves a non-terminal check-in uses `/api/checkout/session` rather than `/api/checkout/intent`, but does not assert the QR-phone payload or returned-URL navigation. | Extend this focused test file rather than adding a new test harness. |
| Duplicate heading | `CourseCardPanel.tsx` renders an outer `Current Course` label in the compact+past-courses branch, while split `CourseCardContent` renders the same label. | Remove only the outer label and retain the inner component label. |
| Existing component coverage | `tests/checkin/CourseCardPanel.test.tsx` already renders the compact+past-courses shape. | Add a heading-count assertion to that test. |

## Affected implementation surfaces for the next work unit

- `components/front/courses/enroll/hooks/useEnrollPaymentActions.ts` — no intended behavior change; only change if focused tests reveal a contract mismatch.
- `tests/checkin/use-enroll-payment-actions.test.tsx` — hosted-checkout contract characterization.
- `components/front/checkin/CourseCardPanel.tsx` — remove the duplicated outer heading only.
- `tests/checkin/CourseCardPanel.test.tsx` — assert exactly one heading.

## Risks and boundaries

- Do not infer a payment failure from a wallet not appearing: card wallets depend on Stripe/provider and device/browser/account eligibility.
- Do not infer that a local passing path is deployed; compare the deployed revision separately before production action.
- The current code comments describe wallets as available on hosted checkout. They must not be treated as a provider-eligibility guarantee.

## Recommended next focus

Add the focused tests first, make the one-line heading removal only after its test demonstrates the duplicate, then run only the two focused test files and structural/diff checks. Do not alter payment routing unless the new contract test exposes a deterministic mismatch.
