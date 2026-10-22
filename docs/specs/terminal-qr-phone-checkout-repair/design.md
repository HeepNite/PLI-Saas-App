# Terminal QR phone checkout repair — design

## Intent

Create a narrow regression boundary around the already-present QR-phone hosted Checkout path, then remove the one duplicated terminal label. This is not a payment-flow redesign.

## Minimal change design

### QR-phone hosted checkout coverage

Extend `tests/checkin/use-enroll-payment-actions.test.tsx` using its existing hook harness and fetch mock:

1. Render the hook as a non-terminal check-in with `photoFlowContext: "qr_phone"` and Stripe selected.
2. Return a non-empty hosted Stripe URL from the session mock.
3. Assert the request is `/api/checkout/session`, never `/api/checkout/intent`.
4. Parse the request body and assert `photoContext: "qr_phone"` and `checkInBooking: true` while retaining the existing checkout payload fields.
5. Assert the browser navigation receives the returned URL.

This test is a characterization test: the current source path is expected to satisfy it. No payment source change is designed unless it exposes a deterministic contract failure.

### Single terminal heading

Extend the existing compact-with-past-courses CourseCardPanel test to count `Current Course` before changing source. Then remove the outer label at the compact+past-courses wrapper in `components/front/checkin/CourseCardPanel.tsx`. Leave CourseCardContent's split-layout label intact, so the branch renders exactly one heading.

## Reuse strategy

- Reuse `buildCheckoutPayload`, `requestCheckoutSessionApi`, and the current full-page redirect behavior.
- Reuse the checkout-session route, webhook fulfillment, QR generation, and CourseCardPanel test fixture.
- Do not add endpoints, state, dependencies, payment methods, or provider configuration.

## Change budget and rollback

The implementation plus focused tests must remain within 400 changed lines. Revert the one heading removal to restore prior rendering; no data, schema, webhook, or provider state changes are involved. No deployment is part of this work unit.

## Verification design

Run the two focused Vitest files after implementation. Use the failed heading-count assertion as RED evidence, retain the passing QR-phone characterization result as evidence of the existing contract, and finish with markdown structural and diff checks. Do not run broad suites, production actions, or provider checks under this repair.
