# Delta for Check-In Package

## Purpose

Modify the package-holder check-in flow to show consecutive class offers BEFORE package check-in occurs, improving the UX by consolidating decision-making at a single point.

## MODIFIED Requirements

### Requirement: Package Check-In Auto-Trigger

When a package holder enters their PIN and bootstrap data confirms package eligibility, the system MUST determine whether to auto-trigger check-in or show a consecutive offer first.
(Previously: Auto-triggered immediately after PIN validation for all package holders)

#### Scenario: Package holder with consecutive offer sees offer first

- GIVEN a package holder enters their PIN
- AND bootstrap confirms active package
- AND a consecutive class offer is available and fetched
- WHEN the auto-trigger logic evaluates
- THEN the consecutive class offer overlay is displayed BEFORE any check-in occurs
- AND no package check-in API call is made yet

#### Scenario: Package holder without consecutive offer auto-checks-in

- GIVEN a package holder enters their PIN
- AND bootstrap confirms active package
- AND no consecutive class offer is available
- WHEN the auto-trigger logic evaluates
- THEN the package check-in proceeds immediately (existing behavior)

#### Scenario: Consecutive offer not yet settled delays auto-trigger

- GIVEN a package holder enters their PIN
- AND bootstrap confirms active package
- AND consecutive offer fetch is still pending
- WHEN the auto-trigger logic evaluates
- THEN the system waits for offer settlement before proceeding
- AND auto-trigger re-evaluates when offer fetch completes

### Requirement: Consecutive Class Accept Flow

When a package holder accepts a consecutive class offer before check-in, the system MUST perform sequential operations to check into the primary class first, then add the consecutive class.
(Previously: Consecutive add-on occurred after package check-in was already complete)

#### Scenario: Accept consecutive offer triggers sequential check-in

- GIVEN the consecutive class offer overlay is displayed
- AND no package check-in has occurred yet
- WHEN the student taps "Add Class"
- THEN the system calls package check-in API for Class A (deducts credit)
- AND on success, calls consecutive add-on API for Class B (creates purchase)
- AND displays combined success overlay showing both classes

#### Scenario: Class A succeeds but Class B fails during accept

- GIVEN the student accepts a consecutive offer
- AND Class A check-in succeeds
- WHEN Class B add-on API fails (payment, capacity, etc.)
- THEN Class A attendance remains valid
- AND the error overlay displays retry options for Class B only
- AND the student is not charged for Class B

### Requirement: Consecutive Class Decline Flow

When a package holder declines a consecutive class offer before check-in, the system MUST perform package check-in only and proceed to completion.
(Previously: Decline occurred after package check-in was complete)

#### Scenario: Decline consecutive offer triggers check-in only

- GIVEN the consecutive class offer overlay is displayed
- AND no package check-in has occurred yet
- WHEN the student taps "No Thanks"
- THEN the system calls package check-in API for Class A only
- AND on success, displays standard package success overlay
- AND proceeds to station completion

#### Scenario: Check-in fails during decline flow

- GIVEN the student declines a consecutive offer
- WHEN the package check-in API fails
- THEN the standard check-in error handling applies
- AND no consecutive offer state persists
- AND the student can retry check-in from PIN entry

## REMOVED Requirements

*None - this change modifies timing and sequence but does not remove existing functionality*