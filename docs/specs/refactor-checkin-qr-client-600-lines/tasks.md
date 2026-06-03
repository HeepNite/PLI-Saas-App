# Tasks — refactor-checkin-qr-client-600-lines

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated total changed lines | 2,000–2,500 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Delivery strategy | ask-always |
| Current decision | use chained PRs; ask before each high-risk slice |

## Target

- [ ] Final `components/front/checkin/CheckInQrClient.tsx` line count <=600.
- [ ] No behavior change outside scoped refactor slices.
- [ ] Regression checklist validated before final archive.

## Phase 0 — Baseline and Safety

- [ ] 0.1 Record current `CheckInQrClient.tsx` LOC and complexity metrics.
- [ ] 0.2 Run baseline focused tests:
  - `tests/checkin/existing-customer-flow.test.ts`
  - `tests/checkin/kiosk-reset.test.ts`
  - `tests/checkin/useKioskFlowCompletion.test.tsx`
  - `tests/checkin/kiosk-qr-payment.test.ts`
  - `tests/checkin/kiosk-qr-poller.test.ts`
- [ ] 0.3 Create regression checklist for kiosk happy paths.

## Phase 1 — API Adapter Extraction

- [x] 1.1 Create `lib/checkin/checkin-qr-api.ts`.
- [x] 1.2 Move bootstrap/package/dropin/checkout/session-status/terminal-offer fetch shapes into the adapter.
- [x] 1.3 Add `tests/checkin/checkin-qr-api.test.ts` with mocked fetch payload assertions.
- [x] 1.4 Replace callsites in `CheckInQrClient.tsx` without changing behavior.
- [x] 1.5 Validate typecheck, lint, focused tests.
- Suggested commit: `refactor(checkin): extract qr api adapter`
- Rollback boundary: adapter + callsite replacement only.

## Phase 2 — Consecutive QR Poller Hook

- [x] 2.1 Create `components/front/checkin/hooks/useKioskQrCheckoutPoller.ts`.
- [x] 2.2 Move consecutive QR polling effect into the hook.
- [x] 2.3 Reuse `lib/checkin/kiosk-qr-payment.ts` phase decisions.
- [x] 2.4 Add focused hook tests.
- [x] 2.5 Validate consecutive QR and checkout adapter suites.
- Suggested commit: `refactor(checkin): extract consecutive qr poller hook`

## Phase 3 — Bootstrap and Package Check-in Hook

- [x] 3a.1 Extract package check-in lifecycle into `components/front/checkin/hooks/useCheckInPackageFlow.ts`.
- [x] 3a.2 Preserve package success timeout, cleanup, and station-completion behavior for #35.
- [x] 3a.3 Keep `processingPackageCheckIn` in `CheckInQrClient.tsx` temporarily because display derivation still reads it before bootstrap is untangled.

- [ ] 3.1 Create `components/front/checkin/hooks/useCheckInBootstrap.ts`.
- [ ] 3.2 Move `bootstrap`, `loadingBootstrap`, `packageCheckInResult`, `processingPackageCheckIn` ownership.
- [ ] 3.3 Move `loadBootstrap`, `performPackageCheckIn`, `handlePackageCheckIn`, `handlePackageSuccessDone`.
- [ ] 3.4 Keep package success timeout and cleanup inside this hook.
- [ ] 3.5 Add hook tests for package/no-package, usable/unusable package, success timer, and #35 regression path.
- [ ] 3.6 Validate API and existing customer flow tests.
- Suggested commit: `refactor(checkin): extract bootstrap package hook`

## Phase 4 — Consecutive Offer Flow Hook

- [ ] 4.1 Decide whether to split this phase into multiple PRs if forecast exceeds 400 changed lines.
- [ ] 4.2 Create `components/front/checkin/hooks/useConsecutiveOfferFlow.ts`.
- [ ] 4.3 Move consecutive state atoms and handlers.
- [ ] 4.4 Move early offer fetch and post-check-in offer lookup.
- [ ] 4.5 Keep paid package-holder add-on behavior routed through cash/card selection.
- [ ] 4.6 Add hook tests for accept/decline/cash/card matrix.
- [ ] 4.7 Validate #33, #34, #35 regression surfaces.
- Suggested commit: `refactor(checkin): extract consecutive offer flow`

## Phase 5 — Entry Mode Router Hook

- [ ] 5.1 Create `components/front/checkin/hooks/useEntryModeRouter.ts`.
- [ ] 5.2 Move mode/open booking/late payment/sign-in state and handlers.
- [ ] 5.3 Move auto-promote effect using `shouldAutoPromoteExistingMode`.
- [ ] 5.4 Add tests for #32, personal QR/web active session, explicit `entryMode=existing`, switch-account and late-payment branches.
- Suggested commit: `refactor(checkin): extract entry mode router`

## Phase 6 — Completion and Inactivity Cleanup

- [ ] 6.1 Slim `useKioskFlowCompletion` from setter-bag to reset callbacks.
- [ ] 6.2 Create `components/front/checkin/hooks/useKioskInactivityGuard.ts`.
- [ ] 6.3 Move inactivity controller effect into the hook.
- [ ] 6.4 Validate sensitive-state reset behavior.
- Suggested commit: `refactor(checkin): simplify kiosk completion wiring`

## Phase 7 — Presenter Split

- [ ] 7.1 Create `CheckInShell.tsx`.
- [ ] 7.2 Create `CheckInOverlays.tsx`.
- [ ] 7.3 Create `CheckInEnrollModals.tsx`.
- [ ] 7.4 Move JSX only; do not move business decisions into presenters.
- [ ] 7.5 Add smoke tests if practical.
- [ ] 7.6 Confirm final `CheckInQrClient.tsx` <=600 LOC.
- Suggested commit: `refactor(checkin): split qr client presenters`

## Final Verification

- [ ] Run targeted check-in/kiosk unit suites.
- [ ] Run relevant API check-in suites.
- [ ] Run `npx tsc --noEmit`.
- [ ] Run scoped lint for touched files.
- [ ] Run preview/manual kiosk happy-path checklist.
- [ ] Archive or update this spec with final LOC and validation evidence.
