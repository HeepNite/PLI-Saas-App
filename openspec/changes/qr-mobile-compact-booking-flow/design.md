# Design: QR Mobile Compact Booking Flow

## Overview

The QR mobile compact booking flow should reuse the existing `EnrollModal` infrastructure while adding an explicit mobile compact mode. The design avoids duplicating kiosk code and avoids treating personal mobile devices as kiosk terminals.

## Current Architecture

### QR mobile no-booking path

```text
ClientPhoneCheckIn
  → buildQrBookingUrl(...)
  → /courses/{slug}?enroll=1&qrBooking=1&date=...&time=...
  → CourseAsideRight
  → EnrollModal(flowVariant="default")
```

Problem: `flowVariant="default"` keeps regular booking steps.

### Kiosk compact path

```text
CheckInQrOverlays
  → EnrollModal(flowVariant="checkin-new" | "checkin-existing", photoFlowContext="kiosk_terminal")
  → resolveEnrollStepKeys(...)
```

Problem: kiosk compacting is coupled to `isKioskTerminalFlow`, which also implies station-specific behavior.

## Proposed Architecture

Add a compact booking source concept to `EnrollModal` and the step resolver.

```ts
type CompactBookingSource = "qr-mobile"
```

`EnrollModal` receives:

```ts
compactBookingSource?: CompactBookingSource
```

Derived flags:

```ts
const isQrMobileCompactFlow = compactBookingSource === "qr-mobile"
const isCompactCheckInFlow = isCheckInFlow || isQrMobileCompactFlow
```

The step resolver receives explicit context rather than inferring from kiosk terminal only.

## Step Resolution

Extend `resolveEnrollStepKeys` input:

```ts
type ResolveEnrollStepKeysInput = {
  isCheckInFlow: boolean
  isCheckInNewFlow: boolean
  isKioskTerminalFlow: boolean
  isQrMobileCompactFlow?: boolean
  requiresPhotoStep: boolean
  skipInfoStep?: boolean
  hasPackages?: boolean
  hasConsecutiveOffer?: boolean
}
```

Recommended resolver behavior:

1. Kiosk terminal check-in keeps existing behavior unchanged:

```text
info → [photo] → [packages] → [consecutive] → payments
```

2. QR mobile compact flow:

```text
[info] → [photo] → [consecutive] → payments
```

Where:

- `info` is omitted when `skipInfoStep=true`
- `photo` appears only when existing photo policy requires it
- `consecutive` appears only when a consecutive offer exists
- `party`, `datetime`, and `review` are omitted

3. Default/regular flow remains unchanged.

## Wiring

### `CourseAsideRight`

When `qrBookingContext` exists:

- pass `compactBookingSource="qr-mobile"`
- pass `flowVariant="checkin-existing"` for signed-in/trusted account path if account is already available, or use compact source to drive step behavior while preserving non-kiosk account creation path
- keep `useDraft={false}`
- keep `checkInContext={qrBookingContext}`
- do not pass `photoFlowContext="kiosk_terminal"`

Recommended minimal wiring:

```tsx
<EnrollModal
  ...
  compactBookingSource={qrBookingContext ? "qr-mobile" : undefined}
  skipContactStep={Boolean(qrBookingContext && isSignedIn)}
  checkInContext={qrBookingContext}
  useDraft={shouldUseDraft}
/>
```

`CourseAsideRight` may need Clerk `useUser` / `useAuth` context to know whether the current user is signed in and can skip contact.

### `EnrollModal`

Use the compact source flag to:

- drive `resolveFlowStepKeys`
- treat QR mobile as a compact sign-in context for `getCheckInSignInModalVariant`
- keep check-in date/time autofill enabled
- keep regular kiosk/station flags disabled

Do not set `isKioskTerminalFlow` for QR mobile.

## Consecutive Promotion

The current working tree includes logic to fetch consecutive offers from:

```text
/api/checkin/terminal/consecutive-offer?courseSlug&date&time
```

For this change, the implementation should either:

1. reuse that existing endpoint and fetched-offer state inside `EnrollModal`, or
2. extract the fetch into a QR/mobile-specific helper while keeping the same API contract.

Preferred minimal route: reuse the existing endpoint with selected date/time because the promotion is keyed by class context, not by terminal type.

## Account and Sign-In Behavior

`EnrollModal` already supports:

- `requiresSignIn`
- `existingAccountDetected`
- `pendingAutoPay`
- embedded sign-in behavior
- compact sign-in UI variant for check-in flows

QR mobile compact should reuse these mechanisms. The compact source should be included in the condition for compact sign-in presentation.

## Testing Strategy

### Unit/model tests

Add resolver tests in `tests/checkin/enroll-flow.test.ts`:

- QR mobile signed-in/trusted flow with no promo: `payments`
- QR mobile signed-in/trusted flow with promo: `consecutive → payments`
- QR mobile signed-out flow: `info → payments`
- QR mobile signed-out with photo + promo: `info → photo → consecutive → payments`
- kiosk terminal existing tests remain unchanged
- regular booking flow remains unchanged

### Targeted validation

Run:

```bash
npx tsc --noEmit
npx vitest run tests/checkin/enroll-flow.test.ts tests/checkin/qr-booking-links.test.ts tests/api/checkin-qr-client-phone.test.ts
```

## Review Scope

Keep implementation within:

- `lib/checkin/enroll-flow.ts`
- `tests/checkin/enroll-flow.test.ts`
- `components/front/courses/EnrollModal.tsx`
- `components/front/courses/CourseAsideRight.tsx`

Only touch consecutive-offer route/tests if required to make promo fetching deterministic.

## Risks

1. `EnrollModal` is large and already has pending local changes. Use selective staging and avoid unrelated refactors.
2. Signed-in detection in `CourseAsideRight` may require a client hook import from Clerk.
3. Promo fetching is currently partly implemented in the local working tree; reconcile before commit.
4. The compact flow must not disable required contact collection for signed-out customers.
