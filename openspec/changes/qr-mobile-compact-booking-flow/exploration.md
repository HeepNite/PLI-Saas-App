# Exploration: QR Mobile Compact Booking Flow

## Goal

Make the QR mobile no-booking purchase path behave like a compact kiosk-style purchase flow adapted to mobile.

The intended behavior:

- If the scanner has no active booking/package/account path, continue into a short mobile booking flow.
- If the user is not signed in, collect only the minimum account/contact data needed before payment.
- If the user is signed in or has an existing account path, skip regular catalog/date/party steps and go directly to promotion/payment as appropriate.
- If the user has an active package, keep the existing direct check-in behavior and consume a credit.

## Current QR Mobile Flow

Relevant files:

- `components/front/checkin/ClientPhoneCheckIn.tsx`
- `lib/checkin/qr-booking-links.ts`
- `components/front/courses/CourseAsideRight.tsx`
- `components/front/courses/EnrollModal.tsx`
- `app/api/checkin/qr/client-phone/route.ts`

Current behavior after a QR mobile rejected/no-booking result:

1. `ClientPhoneCheckIn` shows `Continue Booking`.
2. `Continue Booking` routes to `/courses/{courseSlug}?enroll=1&qrBooking=1&date=...&time=...` via `buildQrBookingUrl`.
3. `CourseAsideRight` detects `qrBooking=1`, captures the QR date/time into `qrBookingContext`, disables draft restore, and auto-opens the mobile `EnrollModal`.
4. `EnrollModal` receives `checkInContext={qrBookingContext}`, but still runs with default `flowVariant="default"`.

Consequence: date/time can be prefilled, but the modal remains the regular booking flow and can still show extra steps such as party/date-time/info/review depending on state.

## Current Kiosk Compact Flow

Relevant files:

- `components/front/checkin/CheckInQrOverlays.tsx`
- `lib/checkin/enroll-flow.ts`
- `components/front/courses/EnrollModal.tsx`

Kiosk compact booking is driven through `EnrollModal` props:

### New booking path

`CheckInQrOverlays.tsx` renders:

```tsx
<EnrollModal
  initialStep={0}
  flowVariant="checkin-new"
  completionMode={isKioskTerminalFlow ? "station" : completionMode}
  checkInContext={newBookingContext}
  photoFlowContext={photoFlowContext}
  kioskSessionToken={kioskPinSessionToken || undefined}
  useDraft={false}
  mode="modal"
  preventOutsideClose={isKioskTerminalFlow}
  consecutiveOffer={consecutiveOffer ?? undefined}
  isPackageHolder={false}
/>
```

### Existing regular booking path

`CheckInQrOverlays.tsx` renders:

```tsx
<EnrollModal
  initialStep={existingRegularBookingInitialStep}
  prefillSelection={prefillSelection}
  flowVariant="checkin-existing"
  completionMode={isKioskTerminalFlow ? "station" : completionMode}
  checkInContext={existingRegularBookingContext}
  useDraft={false}
  mode="modal"
  prefillContact={bootstrapContact || undefined}
  consecutiveOffer={consecutiveOffer ?? undefined}
  isPackageHolder={activeCourseHasUsablePackage}
/>
```

`lib/checkin/enroll-flow.ts` reduces steps for check-in/kiosk context:

```ts
if (input.isCheckInFlow && input.isKioskTerminalFlow) {
  return [
    "info",
    ...(input.requiresPhotoStep ? ["photo"] : []),
    ...(input.hasPackages ? ["packages"] : []),
    ...(input.hasConsecutiveOffer ? ["consecutive"] : []),
    "payments",
  ]
}
```

Non-kiosk check-in currently still uses:

```ts
[
  "party",
  "datetime",
  ...(input.skipInfoStep ? [] : ["info"]),
  ...(input.requiresPhotoStep ? ["photo"] : []),
  ...(input.hasConsecutiveOffer ? ["consecutive"] : []),
  "payments",
  ...(input.isCheckInFlow ? [] : ["review"]),
]
```

This means `flowVariant="checkin-existing"` alone would remove `review`, but would not automatically remove `party` and `datetime` unless the resolver gets a mobile compact mode or treats QR mobile as kiosk-like for step resolution.

## Existing Support Already Available

### QR booking date/time

- `buildQrBookingUrl` already carries `courseSlug`, `date`, `time`, and `durationMinutes`.
- `CourseAsideRight` already captures `qrBookingContext` before clearing the URL.
- `EnrollModal` already accepts `checkInContext` and can compute date/time autofill.

### Consecutive promotion

- `EnrollModal` already supports `consecutiveOffer` passed from check-in flows.
- Current pending local work also has fetched-offer logic in `EnrollModal` and `app/api/checkin/terminal/consecutive-offer/route.ts`; treat that as related but currently uncommitted and should be reconciled before implementation.

### Account-required sign-in

- `EnrollModal` already contains `requiresSignIn`, `existingAccountDetected`, `pendingAutoPay`, `EmbeddedSignIn`, and compact sign-in handling via `getCheckInSignInModalVariant(isCheckInFlow)`.
- This is only activated in the right places when `isCheckInFlow` / account detection conditions match.

### Package-holder check-in

- `app/api/checkin/qr/client-phone/route.ts` already checks package holder flow and can directly check in / consume credit.
- No purchase UI should be shown for a valid package-holder success path.

## Smallest Safe Implementation Approach

Avoid duplicating kiosk UI. Reuse `EnrollModal` compact mechanics, but introduce a clear mobile QR compact context rather than pretending the user is a kiosk terminal.

Recommended approach:

1. Add a compact QR booking mode to `EnrollModal` / step resolver.
   - Example prop: `compactBookingSource="qr-mobile"` or `flowVariant="qr-mobile"` if a new variant is cleaner.
   - Keep `photoFlowContext` separate from kiosk terminal so mobile does not inherit kiosk PIN/numeric-keypad/station-specific behaviors.
2. Update `resolveEnrollStepKeys` to support mobile compact check-in flow:
   - No regular `party` step.
   - No editable `datetime` step when `checkInContext` already provides date/time.
   - Include `info` only when contact/account is needed.
   - Include `photo` only if required by policy.
   - Include `consecutive` when a consecutive offer exists.
   - Include `payments`.
   - No `review` step.
3. In `CourseAsideRight`, when `qrBookingContext` exists, pass compact QR props to `EnrollModal`:
   - `useDraft={false}`
   - `checkInContext={qrBookingContext}`
   - compact mobile QR flag
   - likely `completionMode="personal"`
4. Ensure consecutive offer loading is deterministic for QR mobile:
   - Either pass a fetched `consecutiveOffer` from a new route/hook before opening payments, or keep the existing fetched-offer implementation but document/test it.
5. Add tests around `resolveEnrollStepKeys` for mobile QR compact scenarios.

## Risks / Ambiguities

1. **Consecutive promotion source**: current pushed QR mobile flow does not clearly pass `consecutiveOffer`; there is local uncommitted fetched-offer work. Before implementation, decide whether QR mobile should fetch promo inside `EnrollModal` or before opening it.
2. **Existing account vs signed-in semantics**: “if it has account” may mean either Clerk signed-in user or checkout API detected an existing account by phone/email. Spec should define both.
3. **Photo requirement**: kiosk may require photo/PIN flows; mobile QR should not inherit kiosk terminal PIN/session behavior unless explicitly required.
4. **Package selection**: kiosk compact flow can show packages; user asked for payment of class + promotion. Spec should decide whether package purchase options are hidden in QR mobile compact mode.
5. **Review budget**: this likely touches `EnrollModal`, `enroll-flow.ts`, `CourseAsideRight`, tests, and maybe consecutive-offer fetching. Estimated 180–350 changed lines if scoped carefully; could exceed 400 if promo fetching and API tests expand.

## Estimated Files

Likely implementation files:

- `lib/checkin/enroll-flow.ts`
- `tests/checkin/enroll-flow.test.ts`
- `components/front/courses/EnrollModal.tsx`
- `components/front/courses/CourseAsideRight.tsx`
- Possibly `app/api/checkin/terminal/consecutive-offer/route.ts`
- Possibly `tests/checkin/enroll-flow-reducer.test.ts` or focused UI/model helper tests

## Next Recommended Phase

Write the proposal for `qr-mobile-compact-booking-flow`, deciding:

- exact mobile compact step sequence for signed-out vs signed-in users
- where consecutive offer is fetched/resolved
- whether package purchase options are shown or suppressed
- whether photo/PIN requirements apply on QR mobile
- review slice boundaries if forecast exceeds 400 lines
