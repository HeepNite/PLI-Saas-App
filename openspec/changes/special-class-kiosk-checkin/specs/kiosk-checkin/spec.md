# Kiosk Check-in Specification (Special Classes)

## Purpose

Make the kiosk check-in flow handle special classes: card buyers reserve by QR and self-check-in separately by phone, while cash walk-ins purchase and are admitted immediately.

## Requirements

### Requirement: Special-class self check-in by phone

The system MUST let an online buyer with a paid special-class reservation check in at the kiosk by entering their phone number, flipping their existing scheduled Attendance to checked-in.

#### Scenario: Paid buyer self-checks-in successfully

- GIVEN a user purchased a special class online and has a scheduled Attendance for that `ClassSession`
- WHEN they enter their phone number at the kiosk
- THEN the system finds their special-class Attendance and Purchase
- AND marks the Attendance as checked-in
- AND the kiosk confirms check-in to the user

#### Scenario: Phone number not found

- GIVEN no user account matches the entered phone number
- WHEN the phone is submitted at the kiosk
- THEN the system MUST NOT create or modify any Attendance
- AND the kiosk shows a "not found" message directing the user to buy or ask staff

#### Scenario: Already checked-in (idempotent)

- GIVEN the user's special-class Attendance is already checked-in
- WHEN they enter their phone again at the kiosk
- THEN the system MUST NOT create a duplicate Attendance or error
- AND the kiosk confirms they are already checked-in

#### Scenario: Reservation on a cancelled or closed special class

- GIVEN the user has a Purchase/Attendance for a special class that is cancelled, unpublished, or closed
- WHEN they enter their phone at the kiosk
- THEN the system MUST NOT check them in
- AND the kiosk shows a message that the class is not available, without crashing the flow

### Requirement: Special-class card walk-in via QR → Hosted Checkout

The system MUST let a walk-in scan a special-class QR code, complete Stripe Hosted Checkout on their phone, and receive a paid Purchase plus `SCHEDULED` Attendance without oversell; only F1 phone self-check-in may transition that Attendance to `CHECKED_IN`.

#### Scenario: Walk-in completes card payment and receives a scheduled reservation

- GIVEN a special class has open capacity
- WHEN a walk-in scans the kiosk QR, completes Stripe Hosted Checkout with a card, and payment succeeds
- THEN the system creates a paid Purchase and `SCHEDULED` Attendance for that walk-in on that `ClassSession`; repeat F1 check-in creates neither duplicate
- AND the seat counts toward capacity

#### Scenario: Kiosk shows sold out before payment starts

- GIVEN the special class is already at its capacity cap
- WHEN a walk-in scans the QR at the kiosk
- THEN the kiosk MUST show the class as sold out
- AND MUST NOT start a new Stripe Checkout session for that class

#### Scenario: Reservation hold expires during card payment

- GIVEN a walk-in's reservation hold was created when they started checkout
- WHEN the hold expires before Stripe payment completes
- THEN the system MUST NOT admit the walk-in on that expired hold
- AND capacity MUST NOT be double-reserved for the same seat

#### Scenario: Capacity respected through the reservation hold

- GIVEN a special class has exactly one seat remaining
- WHEN two walk-ins attempt to scan and pay for that class concurrently
- THEN only one hold/purchase MUST succeed in occupying the final seat
- AND the second walk-in MUST be blocked from paying for a seat that no longer exists

### Requirement: Special-class cash walk-in via staff at the kiosk

The system MUST let staff take cash from a walk-in at the kiosk and check them in immediately, occupying a seat on the spot, while keeping the cash Purchase in a pending state until staff settle it later.

#### Scenario: Cash walk-in is checked in immediately, purchase stays pending

- GIVEN a special class has open capacity
- WHEN staff records a cash payment for a walk-in at the kiosk
- THEN the system creates a Purchase in `pending` status linked to that special class
- AND creates a checked-in Attendance for the walk-in immediately
- AND the seat is occupied right away, before any staff settlement occurs

#### Scenario: Sold out — cash walk-in is rejected, no oversell

- GIVEN the special class is already at its 40-seat capacity cap, counting paid, held, and pending-cash seats
- WHEN staff attempts to record a cash payment for another walk-in
- THEN the system MUST reject the cash walk-in
- AND MUST NOT create a Purchase or Attendance for that attempt

#### Scenario: Settlement is a separate staff step

- GIVEN a walk-in was checked in via cash and their Purchase is `pending`
- WHEN staff later settle the cash payment
- THEN the settlement action updates only the Purchase's payment state
- AND MUST NOT alter, duplicate, or revoke the Attendance created at check-in time

#### Scenario: Duplicate cash check-in is rejected

- GIVEN a walk-in already has a checked-in Attendance for that special class (paid, held, or pending-cash)
- WHEN staff attempts to record a second cash payment / check-in for the same person and class
- THEN the system MUST NOT create a second Attendance or Purchase for that person and class
- AND MUST inform staff the person is already checked in
