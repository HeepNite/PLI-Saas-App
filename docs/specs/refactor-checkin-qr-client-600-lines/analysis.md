# Analysis — refactor-checkin-qr-client-600-lines

## Goal

Reduce `components/front/checkin/CheckInQrClient.tsx` from ~2065 LOC to **600 LOC maximum** while preserving existing kiosk/check-in behavior.

This is a structural refactor, not a feature change. The component currently works as the central orchestrator for identity, check-in bootstrap, package check-in, consecutive class offers, checkout, timers, and UI rendering. The refactor must split those responsibilities into reviewable, testable units without weakening the recently fixed kiosk flows.

## Current State

`CheckInQrClient.tsx` currently owns too many responsibilities:

- kiosk PIN/customer identity
- Clerk/staff session interpretation
- bootstrap/catalog loading
- package check-in
- package purchase/repurchase flow
- consecutive class offer flow
- cash/card/QR payment handling
- kiosk inactivity and reset timing
- transient errors/success messages
- all render orchestration and modal wiring

Measured complexity:

| Metric | Value |
|---|---:|
| Lines | ~2065 |
| `useState` | 34 |
| `useEffect` | 17 |
| `useCallback` | 30 |
| Direct `fetch` calls | 9 |

## Responsibility Map

| Lines | Responsibility | Notes |
|---|---|---|
| 1–67 | imports/types | 28 imports across hooks, helpers, components, Clerk |
| 68–95 | route/auth/catalog setup | reads catalog, route params, Clerk auth, current time/origin |
| 96–155 | flat state bag | all flow flags and refs mixed together |
| 180–234 | kiosk PIN/session hooks | already partially extracted but still prop-drills setters |
| 236–312 | display-data hook consumption | huge derived display destructure |
| 322–351 | early consecutive-offer fetch | terminal endpoint side effect |
| 353–400 | booking/context memos | current/new/existing booking contexts |
| 401–432 | station completion wiring | setter-bag into `useKioskFlowCompletion` |
| 434–590 | bootstrap + package APIs | raw `fetch`, body shaping, token/kiosk-session handling |
| 592–681 | package check-in orchestration | package success overlay, timers, station completion |
| 683–1158 | consecutive offer flow | largest behavioral block; accept/decline/cash/card/QR paths |
| 1160–1255 | consecutive QR polling | poller effect for checkout session status |
| 1267–1429 | entry-mode handlers | existing/new/late-payment/sign-in/back/switch handlers |
| 1439–1725 | cross-flow effects | bootstrap, auto-promote, duplicate routing, auto-trigger, inactivity |
| 1727–2065 | JSX render | shell, overlays, panels, two `EnrollModal` instances |

Main LOC concentration:

1. Consecutive class offer flow: ~640 LOC.
2. Bootstrap/package API and orchestration: ~250 LOC.
3. JSX render tree: ~330 LOC.
4. Entry-mode and effect glue: ~250 LOC.

## Existing Extracted Modules

These already exist and should be reused rather than duplicated:

| Module | Current responsibility |
|---|---|
| `lib/checkin/existing-customer-flow.ts` | pure policy decisions for existing customer/kiosk/package/consecutive flows |
| `lib/checkin/kiosk-qr-payment.ts` | QR checkout state, phases, poll interval, helper predicates |
| `lib/checkin/package-offer-integration.ts` | package offer prefill/scenario decisions |
| `lib/checkin/checkin-helpers.ts` | date/time, duration, message timeout, shared helpers |
| `lib/checkin/kiosk-inactivity.ts` | inactivity controller |
| `lib/checkin/terminal-sensitive-state.ts` | sensitive kiosk state predicate |
| `components/front/checkin/useKioskPinFlow.ts` | kiosk PIN identity and rotation state |
| `components/front/checkin/useKioskCustomerSession.ts` | kiosk customer session bridge |
| `components/front/checkin/useKioskFlowCompletion.ts` | station completion/reset behavior |
| `components/front/checkin/useCheckInDisplayData.ts` | derived UI display data |
| check-in UI components | overlays, panels, headers, entry buttons, modals |

The missing layer is **imperative orchestration**: API adapters, flow hooks/reducers, and presenter boundaries.

## Target Architecture

Target `CheckInQrClient.tsx`: **530–580 LOC**.

Proposed structure:

```text
components/front/checkin/CheckInQrClient.tsx             <= 600 LOC
├── CheckInShell.tsx                                     presentational shell
├── CheckInOverlays.tsx                                  overlays/panels
├── CheckInEnrollModals.tsx                              EnrollModal wiring
├── hooks/useEntryModeRouter.ts                          mode/new/existing/late-payment routing
├── hooks/useCheckInBootstrap.ts                         bootstrap + package check-in orchestration
├── hooks/useConsecutiveOfferFlow.ts                     consecutive accept/decline/cash/card/QR flow
├── hooks/useKioskQrCheckoutPoller.ts                    consecutive QR polling
├── hooks/useKioskInactivityGuard.ts                     terminal inactivity wiring
└── lib/checkin/checkin-qr-api.ts                        typed API adapter layer
```

`CheckInQrClient.tsx` should remain as the composition root only:

- read route/auth/catalog props
- compose hooks
- pass state/handlers into presenters
- keep only cross-hook effects that genuinely coordinate several hooks

## Proposed Chained PR Slices

The full refactor will exceed the 400-line review budget. Chained PRs are recommended.

| PR | Slice | Scope | Estimated impact |
|---:|---|---|---:|
| 1 | API adapter extraction | move raw check-in/checkout fetches into `lib/checkin/checkin-qr-api.ts` with body-shape tests | ~330 changed lines |
| 2 | Consecutive QR poller hook | move consecutive QR session polling into `useKioskQrCheckoutPoller` | ~160 changed lines |
| 3 | Bootstrap/package hook | extract `loadBootstrap`, `performPackageCheckIn`, package success/timer cleanup | ~300 changed lines |
| 4 | Consecutive offer flow hook | extract accept/decline/cash/card/QR/consecutive offer state | ~600+ changed lines; likely needs smaller sub-slices |
| 5 | Entry-mode router hook | extract mode/new/existing/late-payment/sign-in handlers and #32 auto-promote policy consumption | ~400 changed lines |
| 6 | Completion/inactivity cleanup | slim `useKioskFlowCompletion`, add `useKioskInactivityGuard` | ~100–200 changed lines |
| 7 | Presenter split | move render tree into `CheckInShell`, `CheckInOverlays`, `CheckInEnrollModals` | ~300–400 changed lines |

Expected final result: `CheckInQrClient.tsx` around **560 LOC**.

## Regression-Critical Flows

These must remain stable during every slice:

1. **Issue #32 fixed behavior**: kiosk terminal must not auto-promote to existing mode from the staff Clerk session. Only explicit `entryMode=existing` or real customer PIN identity should enter existing mode.
2. **Issue #33 risk**: promotional/consecutive popup after package exhaustion must not disappear due to stale offer clearing.
3. **Issue #34 risk**: package check-in must still return/use attendance information so registered users appear in daily student panels.
4. **Issue #35 risk**: successful package check-in must not leave the kiosk stuck on PIN; package success, timeout, and station reset must move together.
5. Consecutive package-holder paid add-on flow must never record a paid add-on without cash/card collection.
6. Duplicate purchase flow must show the duplicate/status popup, not silently rerun package check-in.
7. Kiosk inactivity guard must not reset while a sensitive customer state is active.

## Required Test Strategy

Existing tests to keep running:

- `tests/checkin/existing-customer-flow.test.ts`
- `tests/checkin/kiosk-reset.test.ts`
- `tests/checkin/useKioskFlowCompletion.test.tsx`
- `tests/checkin/kiosk-qr-payment.test.ts`
- `tests/checkin/kiosk-qr-poller.test.ts`
- relevant `tests/api/checkin-*` suites for bootstrap/package/dropin/consecutive endpoints

New tests per slice:

- API adapter: mocked fetch body-shape tests for bootstrap/package/dropin/checkout/session/terminal-offer calls.
- Bootstrap hook: package/no-package, usable/unusable package, success timer, duplicate purchase paths.
- Consecutive flow hook: accept/decline/cash/card matrix for package holder vs drop-in, positive vs zero price.
- Entry router hook: #32 regression, explicit `entryMode=existing`, personal QR/web active session.
- Presenter split: component smoke tests only; presenters should remain mostly prop-driven.

## Risks

- No full component-level coverage exists for `CheckInQrClient.tsx`; the refactor must add hook-level tests as behavior moves.
- Effect dependency arrays are fragile. Every hook extraction must keep exhaustive deps clean.
- Timer ownership around package success and consecutive offer lookup is risky. Do not split the 2.5s package-success timer away from the package check-in hook.
- Consecutive flow has stale-closure risk. Decisions must be computed before `await` and use existing pure policy helpers.
- `useKioskFlowCompletion` currently receives too many setter props. It should be slimmed only after the owning hooks expose reset callbacks.
- Review workload is high; use chained PRs and fresh reviews.

## Open Questions for Resolve Phase

1. Should PR 4 (consecutive offer flow) be split into smaller slices: accept/decline first, payment handlers second, QR cleanup third?
2. Should new hooks live directly under `components/front/checkin/` or in `components/front/checkin/hooks/`?
3. Should `useCheckInDisplayData.ts` remain out of scope even though it is 486 LOC? Recommendation: yes, out of scope for this target.
4. Should presenter extraction happen only after all behavior hooks are merged? Recommendation: yes.

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated total changed lines | 2,000–2,500 across all slices |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested strategy | feature branch chain or stacked PRs; do not ship one giant PR |
| Decision needed before apply | Yes |

## Next Recommended Phase

Create `requirements.md` and `resolve.md` for `refactor-checkin-qr-client-600-lines`, then write design/tasks before any implementation.
