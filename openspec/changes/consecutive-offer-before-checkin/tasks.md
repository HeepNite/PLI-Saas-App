# Tasks: Consecutive Offer Before Check-In

## Phase 1: Foundation (Auto-Trigger Gate)

- [x] 1.1 Extend `shouldAutoTriggerPackageCheckIn` in `lib/checkin/existing-customer-flow.ts` with `hasConsecutiveOffer` + `consecutiveOfferSettled` params
- [x] 1.2 Implement gate logic: return `false` when offer exists but not settled, OR when settled offer pending decision
- [x] 1.3 Update function signature and behavior table per design (4 new param combinations)

## Phase 2: Core Implementation (CheckIn Component Changes)

- [x] 2.1 Modify auto-trigger `useEffect` in `CheckInQrClient.tsx` (L1031-1056) to pass new params to gate
- [x] 2.2 Add logic: when gate returns false due to settled offer, call `setShowConsecutiveOverlay(true)`
- [x] 2.3 Add `consecutiveOffer` + `consecutiveOfferSettled` to useEffect dependency array
- [x] 2.4 Modify `handleConsecutiveAccept`: add guard `!packageCheckInResult` → call `handlePackageCheckIn()` first
- [x] 2.5 Modify `handleConsecutiveDecline`: add guard `!packageCheckInResult` → call `handlePackageCheckIn()` then `handleStationCompletion()`

## Phase 3: Integration & Error Handling

- [x] 3.1 Test sequential API flow: Accept path calls class A, then class B on success
- [x] 3.2 Test class A failure during Accept aborts flow and shows error
- [x] 3.3 Test class B failure after class A success shows retry UI
- [x] 3.4 Test Decline path calls class A only then proceeds to completion

## Phase 4: Testing & Verification

- [x] 4.1 Unit test: `shouldAutoTriggerPackageCheckIn` truth table for all 4 new combinations
- [x] 4.2 Unit test: consecutive handlers only call `handlePackageCheckIn` when `!packageCheckInResult`
- [x] 4.3 Integration test: package holder + offer shows overlay BEFORE any API calls
- [x] 4.4 Regression test: package holder without offer auto-checks-in (unchanged behavior)
- [x] 4.5 Regression test: drop-in flow unaffected by changes