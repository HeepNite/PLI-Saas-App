# Delta for checkin-package

## Purpose

Extend the package check-in capability so that the QR entry path evaluates the consecutive promotion gate before completing check-in — the same gate already applied on the terminal path. No change to the existing terminal behavior.

---

## ADDED Requirements

### Requirement: QR Path Applies Consecutive Promotion Gate

On the QR entry path, `shouldAutoTriggerPackageCheckIn` MUST be called with `hasConsecutiveOffer` and `consecutiveOfferSettled` populated from the resolved QR context.

The auto-trigger gate MUST return `false` when `hasConsecutiveOffer` is `true` AND `consecutiveOfferSettled` is `true`, causing the consecutive offer overlay to surface BEFORE any package check-in API call is made.

This gate behavior MUST be identical to the behavior already in place on the terminal path.

#### Scenario: QR package holder with settled consecutive offer sees overlay first

- GIVEN a package holder enters the QR flow with a valid PIN or active session
- AND bootstrap confirms an active package for the resolved class
- AND a consecutive offer is available and `consecutiveOfferSettled` is `true`
- WHEN the auto-trigger gate evaluates on the QR path
- THEN `shouldAutoTriggerPackageCheckIn` returns `false`
- AND the consecutive offer overlay is displayed
- AND no call to `POST /api/checkin/qr/package` is made before the user decides

#### Scenario: QR package holder with no consecutive offer auto-checks-in

- GIVEN a package holder enters the QR flow
- AND bootstrap confirms an active package
- AND `hasConsecutiveOffer` is `false` (or offer fetch failed with `consecutiveOfferSettled: true`)
- WHEN the auto-trigger gate evaluates on the QR path
- THEN `shouldAutoTriggerPackageCheckIn` returns `true`
- AND package check-in proceeds immediately (same as terminal)

#### Scenario: Consecutive offer fetch still pending delays auto-trigger on QR path

- GIVEN a package holder enters the QR flow
- AND `consecutiveOfferSettled` is `false` (offer fetch in progress)
- WHEN the auto-trigger gate evaluates
- THEN `shouldAutoTriggerPackageCheckIn` returns `false`
- AND the gate re-evaluates when `consecutiveOfferSettled` becomes `true`

---

### Requirement: QR Consecutive Accept and Decline Mirror Terminal Logic

On the QR path, `handleConsecutiveAccept` and `handleConsecutiveDecline` MUST apply the same pre-checkin guards defined by `resolvePackageConsecutiveAcceptAction` and `resolvePackageConsecutiveDeclineAction`.

When `packageCheckInResult` is null (pre-checkin offer mode on QR path):
- Accept MUST call package check-in for class A first, then proceed to payment selection or direct add per `resolvePackageConsecutiveAcceptAction`.
- Decline MUST call package check-in for class A first, then complete the station.

#### Scenario: QR accept with positive consecutive price — pre-checkin path

- GIVEN the consecutive offer overlay is displayed on the QR path (pre-checkin)
- AND the consecutive class has a positive price (`priceCents > 0`)
- WHEN the user taps "Add Class"
- THEN `resolvePackageConsecutiveAcceptAction` returns `"pre-checkin-then-payment-selection"`
- AND package check-in (class A) is called first
- AND on class A success, Cash/Card payment selection is shown for class B
- AND no monetary add-on is created before payment method is selected

#### Scenario: QR accept with free consecutive class — direct add

- GIVEN the consecutive offer overlay is displayed on the QR path (pre-checkin)
- AND the consecutive class has zero or null price
- WHEN the user taps "Add Class"
- THEN `resolvePackageConsecutiveAcceptAction` returns `"direct-add"`
- AND package check-in (class A) is called first
- AND on success, class B is added directly via `/api/checkin/qr/package`

#### Scenario: QR decline — check-in still occurs

- GIVEN the consecutive offer overlay is displayed on the QR path (pre-checkin)
- WHEN the user taps "No Thanks"
- THEN `resolvePackageConsecutiveDeclineAction` returns `"pre-checkin"`
- AND package check-in (class A) is called
- AND on success, station completion flow runs
- AND no consecutive add-on is created

#### Scenario: QR class A fails during accept

- GIVEN the user accepts the consecutive offer on the QR path
- WHEN the package check-in API (class A) returns an error
- THEN the standard check-in error handling is applied
- AND no class B request is made
- AND the user may retry from PIN entry
