# Terminal QR phone checkout repair

## Goal
Preserve the existing `/staff/terminal` landing QR and `/checkin` phone journey, prove that it reaches Stripe-hosted payment, and remove the duplicated `Current Course` heading without changing the payment UX, routes, kiosk-generated checkout QR, embedded tablet fallback, or native M2 flow.

## Constraints
- Keep the landing QR URL and class/date/time context unchanged.
- Keep signed-in and signed-out phone journeys unchanged.
- Keep the phone journey on its existing Stripe Checkout Session path.
- Do not change amounts, products, identity, fulfillment, webhook behavior, or production configuration.
- Apple Pay and other wallets remain subject to Stripe account and device/browser eligibility.
- Production deployment requires separate explicit authorization.

## Tasks
- [completed] T1 — Create and reconcile the active requirements, analysis, resolution, design, and test-first implementation plan for the authorized minimal repair.
- [completed] T2 — Added focused QR-phone hosted-checkout payload/redirect-state coverage and the single-heading rendering assertion; removed only the duplicated outer `Current Course` heading after the assertion demonstrated it.
- [completed] T3 — Work-unit commit `9b5e1fea`; independent verification passed 81/81 focused tests, TypeScript, markdown structure, and scoped diff checks. Deployment and provider/device wallet eligibility remain separate gates.

## Evidence
- Existing focused payment/check-in suite: 124/124 passing before changes.
- RED: `npm test -- tests/checkin/CourseCardPanel.test.tsx` failed because compact content with past courses rendered two exact `Current Course` nodes.
- QR-phone characterization: `npm test -- tests/checkin/use-enroll-payment-actions.test.tsx` passed 57 tests, proving the Checkout Session route and QR payload contract without a payment production-code change.
- GREEN: `npm test -- tests/checkin/use-enroll-payment-actions.test.tsx tests/checkin/CourseCardPanel.test.tsx` passed 58 tests after the outer heading removal.
- jsdom reports cross-origin navigation as not implemented; the test verifies the strongest observable redirect contract (a valid hosted URL leaves the submission in redirect state without alerting) and adds no production seam.
- Correction: the QR-phone fetch mock now declares its `(url: string, init: RequestInit) => Promise<Response>` signature and explicitly narrows the first request options before reading its body, resolving the independent verifier's TypeScript blocker without changing behavior or assertions.
- Final local validation passed: 81/81 focused tests, TypeScript, markdown structure, scoped lint with 0 errors and 5 pre-existing warnings, and diff checks. Playwright was skipped because the available terminal spec requires a database, creates rows, is marked `fixme`, and does not cover this phone redirect journey.
- Deployment, deployed-revision confirmation, and provider/device wallet eligibility remain pending and separately authorized.
