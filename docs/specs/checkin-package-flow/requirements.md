# Check-in Package Flow — Requirements

## Scope

This spec defines the check-in/package behaviors validated by current diffs and tests for kiosk existing-customer flow.

## Requirements

### Requirement 1: Usable package semantics for class check-in
The system MUST treat a package as usable for class check-in only when:
- it is active,
- it is not expired,
- and it has consumable credit (`remainingCredits > 0`) OR it is truly unlimited (`isUnlimited = true` and `remainingCredits = null`).

#### Scenario: Unlimited package is usable only with null credits
- GIVEN an active, non-expired package marked unlimited
- WHEN `remainingCredits` is `null`
- THEN the package is eligible for package check-in

#### Scenario: Non-usable package is rejected at package check-in
- GIVEN a selected package with no consumable credit
- WHEN a package check-in is attempted
- THEN the API returns a conflict error instead of consuming package credit

### Requirement 2: Attendance-linked consecutive add-on validation
For package-holder consecutive add-ons, the system MUST validate Class A attendance by linked attendance ID when provided, and MAY fallback to same-day attendance lookup for the linked course when ID is absent.

#### Scenario: Linked attendance ID validates Class A
- GIVEN `consecutiveAddOn = true` with `linkedFromAttendanceId` and `linkedFromCourseSlug`
- WHEN the linked attendance belongs to the same user and linked course
- THEN Class A attendance validation passes

#### Scenario: Consecutive cash add-on allowed after last credit was consumed in Class A
- GIVEN Class A check-in already consumed the last package credit
- WHEN the user buys a monetary consecutive add-on in cash for Class B
- THEN the request succeeds without reserving another package credit

### Requirement 3: Duplicate purchase completion routing
The system MUST open consecutive-offer UI after duplicate-purchase completion only when both conditions are true: (a) a consecutive offer exists and (b) the user has a usable current-class package.

#### Scenario: Open overlay when offer + usable package exist
- GIVEN duplicate purchase flow has completed
- WHEN a consecutive offer exists and usable package is true
- THEN the app opens the consecutive overlay

#### Scenario: Complete station otherwise
- GIVEN duplicate purchase flow has completed
- WHEN no offer exists OR no usable package exists
- THEN the app completes station flow instead of opening consecutive overlay

### Requirement 4: UI/helper state propagation for safe consecutive flow
The kiosk UI MUST propagate package check-in attendance ID into subsequent consecutive package requests, and MUST suppress/clear consecutive UI branches when no usable current-class package exists.

#### Scenario: Attendance ID is propagated after package check-in
- GIVEN package check-in succeeds and returns attendance ID
- WHEN user continues into consecutive package actions
- THEN consecutive package requests include `linkedFromAttendanceId`

#### Scenario: No usable package forces regular completion path
- GIVEN no usable package for the current class
- WHEN consecutive accept/decline/pay actions are triggered
- THEN consecutive overlay/payment state is cleared and flow returns to regular existing-customer completion path
