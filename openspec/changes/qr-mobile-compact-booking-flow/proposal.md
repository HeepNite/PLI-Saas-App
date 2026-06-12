# Proposal: QR Mobile Compact Booking Flow

## Problem

When a customer scans the class QR from a phone and has no active booking, the current recovery path opens the regular course booking flow. That flow is too broad for the QR context because the class, date, and time are already known from the scanned QR.

The QR mobile flow should behave more like the kiosk compact purchase flow, but adapted to a personal mobile device.

## User Goal

After scanning a class QR, the customer should be able to complete the required purchase with the fewest possible steps:

- no catalog browsing
- no redundant date/time selection
- no extra review step
- promotion shown only when applicable
- sign-in/account handling only when required
- package holders checked in directly without purchase

## Proposed Behavior

### 1. Package holder

If the scanned phone belongs to a customer with a usable active package for the scanned class:

- keep the existing direct QR check-in behavior
- consume the package credit when applicable
- do not open the purchase flow

### 2. Signed-in customer without eligible booking/package

When the user is signed in and scans a QR for a class they have not booked:

- open a compact QR mobile booking flow for the scanned class
- prefill and lock the scanned date/time context
- skip party/date-time/contact/review when account data is already trusted
- show consecutive promotion step when eligible
- proceed to payment for the class, plus selected promotion if accepted

Recommended step sequence:

```text
[consecutive?] → payments
```

If a photo is required by existing policy and the account does not have one:

```text
photo → [consecutive?] → payments
```

### 3. Signed-out / no active account on device

When the scanner is not signed in and continues booking:

- open a compact QR mobile booking flow
- collect only minimum required contact/account data
- do not show party/date-time/review
- show consecutive promotion when eligible
- proceed to payment

Recommended step sequence:

```text
info → [photo?] → [consecutive?] → payments
```

### 4. Existing account detected during checkout/contact

If contact/payment detects an existing account:

- use the existing compact sign-in mechanism
- after sign-in, resume the compact QR mobile flow
- do not restart regular booking
- continue to promotion/payment as applicable

### 5. Consecutive promotion

If a consecutive class promotion exists for the scanned class/date/time:

- show it before payment
- if accepted, include it in the checkout payload
- if declined, continue to payment for the scanned class only

If no promotion exists:

- go directly to payment after any required account/photo step

## Implementation Direction

Reuse existing `EnrollModal` and `resolveEnrollStepKeys`; do not create a separate QR booking modal.

Introduce a QR mobile compact context that is distinct from kiosk terminal behavior.

Recommended implementation shape:

1. Add a compact flow signal to `EnrollModal`, for example:

```ts
compactBookingSource?: "qr-mobile"
```

or an equivalent explicit flag. Avoid overloading `photoFlowContext="kiosk_terminal"` because QR mobile must not inherit kiosk station/PIN behavior.

2. Extend `resolveEnrollStepKeys` to support QR mobile compact flow.

Expected compact behavior:

- no `party`
- no editable `datetime` when `checkInContext` is present
- `info` only when contact/account is not trusted
- `photo` only when required
- `consecutive` only when an offer exists
- `payments`
- no `review`

3. In `CourseAsideRight`, when `qrBookingContext` exists:

- pass the QR compact flag to `EnrollModal`
- keep `useDraft={false}`
- keep `checkInContext={qrBookingContext}`
- use mobile modal mode
- do not pass kiosk terminal props

4. Keep package-holder direct check-in in the QR client-phone API.

5. Reconcile consecutive promotion fetching. Prefer a deterministic existing path inside `EnrollModal` or a focused helper/API call keyed by `courseSlug`, `date`, and `time`.

## Non-Goals

- Do not redesign the full course booking flow.
- Do not create a new `/courses` route.
- Do not duplicate kiosk modal code.
- Do not introduce kiosk terminal PIN/session behavior into mobile QR.
- Do not change package-holder direct check-in semantics.
- Do not refactor the entire `EnrollModal` as part of this change.

## Risks and Mitigations

### Risk: accidentally inheriting kiosk behavior

Mitigation: introduce an explicit QR mobile compact mode rather than using `photoFlowContext="kiosk_terminal"`.

### Risk: consecutive promotion appears too late or not at all

Mitigation: add tests around step resolution and checkout payload inclusion when `hasConsecutiveOffer=true`.

### Risk: signed-in customers still see contact/date steps

Mitigation: add a resolver test for trusted QR mobile flow: `[consecutive?] → payments`.

### Risk: signed-out users bypass required account/contact data

Mitigation: keep `info` in compact flow unless account/contact is explicitly trusted.

### Risk: review size grows because `EnrollModal` is large

Mitigation: keep changes limited to props, step resolver, QR entry wiring, and focused tests.

## Likely Files

- `lib/checkin/enroll-flow.ts`
- `tests/checkin/enroll-flow.test.ts`
- `components/front/courses/EnrollModal.tsx`
- `components/front/courses/CourseAsideRight.tsx`
- possibly `tests/checkin/enroll-flow-reducer.test.ts`
- possibly consecutive-offer route/helper tests if promo fetching is formalized

## Review Workload Forecast

Estimated changed lines: 180–350 if scoped carefully.

400-line budget risk: Medium.

Chained PRs recommended: Not initially, but stop before apply if tasks forecast exceeds 400 changed lines.

## Recommendation

Proceed to spec phase and define exact acceptance criteria for:

1. signed-in QR mobile compact booking
2. signed-out QR mobile compact booking
3. existing account detected and sign-in resume
4. consecutive promotion behavior
5. package-holder direct check-in preservation
