# Delta for Check-In Package

## Purpose

Add back-to-back consecutive class add-on behavior to the existing package-holder check-in flow.

## ADDED Requirements

### Requirement: Consecutive Class Prompt After Package Check-In

After a student with an active package successfully checks into Class A, the system MUST prompt the student to add Class B at the configured `packageHolderConsecutiveCents` price if a consecutive link exists and the student has not already attended Class B today.

#### Scenario: Package holder gets consecutive prompt

- GIVEN a student with an active package checks into Salsa 8pm
- AND a CourseLink exists from Salsa 8pm to Bachata 9pm with `packageHolderConsecutiveCents` of 500
- WHEN the package check-in succeeds
- THEN the terminal displays a prompt to add Bachata 9pm at the package-holder consecutive price with the computed percentage discount

#### Scenario: Package holder declines consecutive class

- GIVEN the consecutive class prompt is displayed
- WHEN the student taps "No thanks"
- THEN the modal closes and the terminal returns to the class picker

#### Scenario: Package holder accepts consecutive class

- GIVEN the consecutive class prompt is displayed for Bachata 9pm
- WHEN the student confirms adding the class
- THEN the system creates a Purchase record for the discounted amount
- AND creates an Attendance record for the Bachata 9pm session
- AND the student is checked into both classes

#### Scenario: No consecutive link for package

- GIVEN a student with a package checks into Salsa 8pm
- AND no CourseLink exists from Salsa to any later class
- WHEN the check-in succeeds
- THEN no consecutive class prompt is displayed

#### Scenario: Package holder already attended consecutive class

- GIVEN a student already checked into Bachata 9pm today
- WHEN the student checks into Salsa 8pm with a package
- THEN the consecutive class prompt for Bachata 9pm is suppressed

#### Scenario: Package does not cover consecutive course

- GIVEN a student checks into Salsa 8pm with a package
- AND a CourseLink exists to Bachata 9pm
- BUT the student’s active `PackagePlan.courseSlugs[]` does not include Bachata
- WHEN the check-in succeeds
- THEN the consecutive prompt is NOT shown (or shows at drop-in rate instead)

## MODIFIED Requirements

*No existing main spec found. The above behavior is additive to the existing package check-in flow, which deducts a credit from the PackageUsageLedger and creates an Attendance record.*
