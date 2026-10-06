# Terminal QR phone checkout repair — tasks

## Status

The focused implementation and local validation are complete in 238 changed lines. Production deployment and provider/device wallet eligibility remain separate gates.

## 1. Specification and plan — complete

- [x] Record the existing terminal QR, QR-phone hosted-checkout, Stripe method, and production/provider boundaries.
- [x] Identify the untested QR-phone payload/navigation contract and the duplicated compact+past-courses heading.
- [x] Resolve the minimal source and test surfaces without authorizing deployment.

## 2. Focused test-first implementation — complete

1. [x] **QR-phone characterization:** extend `tests/checkin/use-enroll-payment-actions.test.tsx` to prove `/api/checkout/session`, `photoContext: "qr_phone"`, `checkInBooking: true`, returned URL navigation, and no intent request. The existing path passed, so no payment source change was made.
2. [x] **RED:** extend `tests/checkin/CourseCardPanel.test.tsx` to require exactly one `Current Course` heading for compact content with past courses; the assertion observed two exact heading nodes.
3. [x] **GREEN:** remove only the outer duplicate heading in `components/front/checkin/CourseCardPanel.tsx`; retain CourseCardContent's heading and rerun the two focused tests.
4. [x] **TRIANGULATE/REFACTOR:** retain existing QR payload fields and hosted-checkout redirect behavior without payment-source changes; keep the scoped source/test diff within 400 lines.

## 3. Proportional validation — complete

- [x] Five-file focused verification passed 81/81 tests.
- [x] TypeScript passed; scoped ESLint completed with 0 errors and 5 pre-existing warnings.
- [x] Six markdown files passed structural checks; scoped diff/whitespace checks passed.
- [x] Exact scope is 238 changed lines, within the 400-line limit.
- [x] Production deployment, deployed-revision confirmation, browser E2E requiring a database, and provider/device wallet eligibility remain separately authorized or unavailable locally.

### Writer self-verification evidence (does not complete final validation)

- `npm test -- tests/checkin/CourseCardPanel.test.tsx` RED: the new count assertion failed with two exact `Current Course` nodes.
- `npm test -- tests/checkin/use-enroll-payment-actions.test.tsx`: 57 tests passed. The hosted URL triggers jsdom's `Not implemented: navigation to another Document` notice; the test therefore asserts the strongest observable contract: the returned non-empty URL leaves submission in redirect state without alerting, alongside the exact session route and payload assertions. No production seam was added.
- `npm test -- tests/checkin/use-enroll-payment-actions.test.tsx tests/checkin/CourseCardPanel.test.tsx`: 58 tests passed after the one-heading source change.
- Correction: typed the QR-phone fetch mock as `(url: string, init: RequestInit) => Promise<Response>` and explicitly narrow its first request options before reading the body, resolving the independent verifier's TypeScript blocker without changing behavior or assertions.
- Independent final verification passed 81/81 focused tests, TypeScript, markdown structure, and scoped diff checks. Playwright was skipped because the available terminal spec requires `DATABASE_URL`, creates rows, is marked `fixme`, and does not cover the phone redirect journey. No deployment, provider, or production verification was performed.

## Completion boundary

Do not change QR generation, payment route/methods, account or identity handling, amount, fulfillment, webhook behavior, kiosk-hosted QR, tablet fallback, native M2, production configuration, or deployment.
