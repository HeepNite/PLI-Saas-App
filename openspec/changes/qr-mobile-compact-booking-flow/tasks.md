# Tasks: QR Mobile Compact Booking Flow

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~220–360 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No, unless implementation expands into promo API/test changes |
| Suggested split if needed | PR1 step resolver + QR compact wiring; PR2 promo fetch/checkouts if required |
| Decision needed before apply | No, proceed with one scoped work unit and stop if diff exceeds 400 lines |

## Tasks

### 1. Add QR mobile compact step resolution

- [x] Extend `ResolveEnrollStepKeysInput` in `lib/checkin/enroll-flow.ts` with QR mobile compact context.
- [x] Add resolver branch for QR mobile compact flow:
  - [x] omit `party`
  - [x] omit `datetime`
  - [x] include `info` unless contact/account is trusted
  - [x] include `photo` only when required
  - [x] include `consecutive` only when offer exists
  - [x] include `payments`
  - [x] omit `review`
- [x] Preserve kiosk terminal resolver behavior unchanged.
- [x] Preserve regular booking resolver behavior unchanged.

### 2. Add focused resolver tests

- [x] Add tests in `tests/checkin/enroll-flow.test.ts` for:
  - [x] signed-in/trusted QR mobile without promo → `payments`
  - [x] signed-in/trusted QR mobile with promo → `consecutive`, `payments`
  - [x] signed-out QR mobile without promo → `info`, `payments`
  - [x] signed-out QR mobile with photo and promo → `info`, `photo`, `consecutive`, `payments`
  - [x] existing kiosk tests still pass
  - [x] regular booking flow remains unchanged

### 3. Wire QR compact mode from course page entry

- [x] In `CourseAsideRight`, detect signed-in user state for QR booking context.
- [x] When `qrBookingContext` exists, pass compact QR mobile mode into `EnrollModal`.
- [x] Skip contact step only when the account/session is trusted.
- [x] Keep `useDraft={false}` for QR booking.
- [x] Keep scanned `checkInContext` date/time.
- [x] Do not pass kiosk terminal props.

### 4. Update `EnrollModal` compact behavior

- [x] Add `compactBookingSource?: "qr-mobile"` prop or equivalent explicit flag.
- [x] Derive QR mobile compact flag.
- [x] Pass QR mobile compact flag to `resolveFlowStepKeys`.
- [x] Use compact sign-in presentation for QR mobile compact flow.
- [x] Keep date/time autofill from `checkInContext`.
- [x] Ensure kiosk station/PIN behavior remains disabled for QR mobile.

### 5. Reconcile consecutive promotion support

- [x] Confirm current `EnrollModal` consecutive-offer fetch behavior is sufficient for QR mobile compact flow.
- [x] If needed, scope changes to the existing selected-date consecutive offer endpoint.
- [x] Ensure accepted promotion remains included in checkout payload.

### 6. Validate

- [x] Run `npx tsc --noEmit`.
- [x] Run `npx vitest run tests/checkin/enroll-flow.test.ts tests/checkin/qr-booking-links.test.ts tests/api/checkin-qr-client-phone.test.ts`.
- [x] Inspect `git diff --stat`; if diff exceeds 400 changed lines, stop and ask before continuing.

## Out of Scope

- Full `EnrollModal` refactor.
- New booking route.
- Kiosk terminal redesign.
- Package-holder QR check-in changes.
- General course page redesign.
