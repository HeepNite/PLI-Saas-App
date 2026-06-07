# Delta for Check-In Drop-In

## Purpose

Add back-to-back consecutive class discount behavior to the existing drop-in check-in flow.

## ADDED Requirements

### Requirement: Consecutive Class Offer After Drop-In Check-In

After a student successfully checks into Class A using drop-in purchase, the system MUST offer Class B at the configured `dropInConsecutiveCents` price if a consecutive link exists and the student has not already purchased Class B for the same day.

#### Scenario: Drop-in student gets consecutive offer

- GIVEN a student checks into Salsa 8pm via drop-in purchase
- AND a CourseLink exists from Salsa 8pm to Bachata 9pm with `dropInConsecutiveCents` of 900
- WHEN the check-in succeeds
- THEN the terminal displays a back-to-back offer for Bachata 9pm at the discounted price with the computed percentage discount

#### Scenario: Student declines consecutive offer

- GIVEN the consecutive offer modal is displayed
- WHEN the student taps "No thanks"
- THEN the modal closes and the terminal returns to the class picker

#### Scenario: Student accepts consecutive offer

- GIVEN the consecutive offer modal is displayed for Bachata 9pm
- WHEN the student confirms purchase at the discounted drop-in price
- THEN the system creates a Purchase record for the discounted amount
- AND creates an Attendance record for the Bachata 9pm session
- AND the student is checked into both classes

#### Scenario: No consecutive link exists

- GIVEN a student checks into Salsa 8pm via drop-in
- AND no CourseLink exists from Salsa to any later class
- WHEN the check-in succeeds
- THEN no back-to-back offer is displayed

#### Scenario: Already purchased consecutive class

- GIVEN a student already purchased Bachata 9pm today
- WHEN the student checks into Salsa 8pm
- THEN the back-to-back offer for Bachata 9pm is suppressed

## MODIFIED Requirements

*No existing main spec found. The above behavior is additive to the existing drop-in check-in flow, which upserts a ClassSession, creates an Attendance record, and deducts nothing.*
