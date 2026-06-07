# Design — refactor-checkin-qr-client-600-lines

## Architecture Approach

Convert `CheckInQrClient.tsx` from a god component into a composition root:

- pure decisions remain in `lib/checkin/*`
- API calls move to a non-React adapter
- imperative flow orchestration moves to focused hooks
- JSX moves to prop-driven presenter components last

## Target Structure

```text
components/front/checkin/CheckInQrClient.tsx
components/front/checkin/CheckInShell.tsx
components/front/checkin/CheckInOverlays.tsx
components/front/checkin/CheckInEnrollModals.tsx
components/front/checkin/hooks/useEntryModeRouter.ts
components/front/checkin/hooks/useCheckInBootstrap.ts
components/front/checkin/hooks/useConsecutiveOfferFlow.ts
components/front/checkin/hooks/useKioskQrCheckoutPoller.ts
components/front/checkin/hooks/useKioskInactivityGuard.ts
lib/checkin/checkin-qr-api.ts
```

Existing hooks may remain in `components/front/checkin/` to avoid noisy moves.

## Layer Responsibilities

### `lib/checkin/checkin-qr-api.ts`

Owns fetch calls currently embedded in `CheckInQrClient`:

- bootstrap
- package check-in
- drop-in check-in
- checkout session creation
- checkout session status
- terminal consecutive offer

It must preserve request payload fields and return parsed `{ res, data }` style results or typed equivalents.

### `useCheckInBootstrap`

Owns:

- `bootstrap`
- `loadingBootstrap`
- `packageCheckInResult`
- `processingPackageCheckIn`
- `loadBootstrap`
- `performPackageCheckIn`
- `handlePackageCheckIn`
- `handlePackageSuccessDone`
- package success timeout cleanup
- closed-window package error state, if still needed after extraction

It may accept callbacks for `onStationComplete` and `onCheckConsecutiveOfferAfterCheckIn`.

### `useConsecutiveOfferFlow`

Owns:

- `consecutiveOffer`
- `showConsecutiveOverlay`
- `showConsecutivePaymentSelection`
- `awaitingConsecutivePaymentSelection`
- `consecutiveProcessing`
- `consecutiveProcessingAction`
- `consecutiveSuccess`
- `consecutiveError`
- consecutive QR checkout state
- accept/decline/cash/card handlers
- early offer fetch and post-check-in offer lookup

It must use existing pure helpers from `lib/checkin/existing-customer-flow.ts`.

### `useEntryModeRouter`

Owns:

- `mode`
- `openNewBooking`
- `newBookingOverride`
- `latePaymentEntryOverride`
- `existingRegularBookingOverride`
- `existingRegularBookingKey`
- `showPhoneSignIn`
- `pendingLoginPhone`
- `pendingNewBooking`
- existing/new/late-payment/sign-in/switch-account handlers
- auto-promote behavior through `shouldAutoPromoteExistingMode`

It must preserve issue #32 behavior.

### `useKioskInactivityGuard`

Owns the `createKioskInactivityController` effect and `onFlowActiveChange` wiring.

### Presenter components

- `CheckInShell`: header, course card, PIN modal, entry buttons, inline feedback, bootstrap panel.
- `CheckInOverlays`: resolving, duplicate, package success, consecutive offer, consecutive success/error, QR payment.
- `CheckInEnrollModals`: existing/new booking `EnrollModal` instances and related callbacks.

Presenters must not call APIs or make business decisions.

## Data Flow

```text
CheckInQrClient
  → route/auth/catalog inputs
  → flow hooks
  → pure policy helpers + API adapters
  → presenter components
```

Cross-flow coordination should stay in the parent only when it genuinely reads several hook outputs.

## Testing Design

- API adapters: mocked fetch tests for payload shape and error parsing.
- Hooks: `renderHook` tests for state transitions and callbacks.
- Pure policies: keep/extend `tests/checkin/existing-customer-flow.test.ts`.
- Presenters: smoke/render tests only.
- Integration/manual: run kiosk happy-path checklist per PR.

## Rollback Boundaries

Each PR owns one responsibility boundary. If regression appears, revert that PR only:

1. API adapter
2. QR poller hook
3. bootstrap/package hook
4. consecutive offer hook
5. entry-mode router
6. completion/inactivity cleanup
7. presenters

Avoid mixing behavioral extraction and presenter extraction in the same PR.
