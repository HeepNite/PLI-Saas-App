# Proposal: Consecutive Offer Before Check-In

## Intent

Package holders currently see a success screen ("you're checked in") and then a payment prompt for the consecutive class. This breaks the user's mental model — they think they're done, then discover there's more to do. Showing the consecutive class offer **before** check-in gives the student one decision point before any irreversible action occurs.

## Scope

### In Scope
- Gate the auto-trigger `useEffect` in `CheckInQrClient.tsx` so it detects a settled consecutive offer and shows the overlay instead of immediately checking in
- Rewire `handleConsecutiveAccept`: call `handlePackageCheckIn()` first (class A), then the consecutive add-on (class B)
- Rewire `handleConsecutiveDecline`: call `handlePackageCheckIn()` first (class A), then `handleStationCompletion()`
- Extend `shouldAutoTriggerPackageCheckIn` in `existing-customer-flow.ts` with `hasConsecutiveOffer` + `consecutiveOfferSettled` params

### Out of Scope
- No API changes — all existing endpoints reused
- No DB schema changes
- No changes to `ConsecutiveClassOffer.tsx` (fully reusable as-is)
- No new combined atomic endpoint (sequential calls + idempotent add-on endpoint is sufficient)
- No new hooks or files

## Capabilities

### New Capabilities
None

### Modified Capabilities
- `checkin-package`: The UX sequence changes — consecutive offer is now shown **before** the package check-in, not after. Scenarios for "Decline" and "Accept" must be updated to reflect that check-in happens as a consequence of the student's decision, not before it.

## Approach

**Approach A — gate in `CheckInQrClient.tsx`, sequential API calls.**

The pre-auth consecutive offer fetch (`GET /api/checkin/terminal/consecutive-offer`) already fires before bootstrap and resolves before the auto-trigger effect. `consecutiveOfferSettled` already exists as a race-condition guard. The only changes needed:

1. Add `hasConsecutiveOffer` + `consecutiveOfferSettled` to `shouldAutoTriggerPackageCheckIn` — returns `false` when offer is pending display
2. In the auto-trigger `useEffect`, if gate says "show offer first" → `setShowConsecutiveOverlay(true)` instead of calling `handlePackageCheckIn()`
3. `handleConsecutiveAccept`: guard on `!packageCheckInResult` → call `handlePackageCheckIn()` → on success, proceed to consecutive add-on
4. `handleConsecutiveDecline`: guard on `!packageCheckInResult` → call `handlePackageCheckIn()` → on success, call `handleStationCompletion()`
5. Add `consecutiveOffer` + `consecutiveOfferSettled` to `useEffect` dependency array

No new fetches, no new endpoints, no new components.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `components/front/checkin/CheckInQrClient.tsx` | Modified | Auto-trigger useEffect (L1031–1056), handleConsecutiveAccept, handleConsecutiveDecline |
| `lib/checkin/existing-customer-flow.ts` | Modified | `shouldAutoTriggerPackageCheckIn()` gains two new params |
| `components/front/checkin/ConsecutiveClassOffer.tsx` | Unchanged | Fully reused as-is |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Decline path skips check-in | Med | `handleConsecutiveDecline` explicitly calls `handlePackageCheckIn()` first; guarded by `!packageCheckInResult` |
| Class A succeeds, Class B fails | Med | Retry UI via existing `ConsecutiveOfferError`; add-on endpoint is idempotent (`hasAttendedCourseToday`) |
| Race between consecutive fetch and bootstrap | Low | `consecutiveOfferSettled` gate already exists; auto-trigger waits until settled |
| Offer shown for non-package holders | Low | Gate is inside `shouldAutoTriggerPackageCheckIn`, which already requires `hasPackage` |

## Rollback Plan

All changes are isolated to two files with no API or DB surface. To revert:
- Remove the `hasConsecutiveOffer` / `consecutiveOfferSettled` params from `shouldAutoTriggerPackageCheckIn` and restore original return logic
- Remove the offer gate from the auto-trigger `useEffect` (restore original `void handlePackageCheckIn()` call)
- Restore original `handleConsecutiveAccept` and `handleConsecutiveDecline` handlers

Git revert of the two changed files restores the previous behavior completely.

## Dependencies

- `consecutiveOfferSettled` state (already exists — introduced in prior race-condition fix)
- Pre-auth consecutive offer endpoint (`GET /api/checkin/terminal/consecutive-offer`) — no changes needed

## Success Criteria

- [ ] Package holder with a consecutive offer sees the `ConsecutiveClassOffer` overlay **before** any check-in occurs
- [ ] Accepting the offer triggers check-in for class A, then booking of class B — terminal shows combined success
- [ ] Declining the offer triggers check-in for class A only — terminal shows standard package success
- [ ] Package holder **without** a consecutive offer is auto-checked-in immediately (original behavior unchanged)
- [ ] No regression on non-package (drop-in) check-in flows
- [ ] If the consecutive offer API fails, `consecutiveOfferSettled` is still set to `true` and auto-trigger proceeds normally
