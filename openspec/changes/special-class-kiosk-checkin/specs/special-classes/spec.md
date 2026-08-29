# Special Classes Specification (Kiosk Capacity)

## Purpose

Ensure a special class's capacity cap accounts for every seat that is actually occupied or reserved — including seats taken by kiosk cash walk-ins whose Purchase is still pending settlement — so the class never oversells.

## Requirements

### Requirement: Capacity counting includes pending-cash occupied seats

The system MUST count a kiosk cash walk-in's seat toward a special class's capacity as soon as their Attendance is created and checked-in, even though their Purchase remains `pending` until staff settlement.

#### Scenario: Pending-cash seat counts toward the cap

- GIVEN a special class has a capacity cap of 40
- AND 39 seats are already occupied by paid, held, or pending-cash Attendances
- WHEN a kiosk cash walk-in is checked in, creating the 40th occupied seat
- THEN the special class capacity count MUST reflect 40 occupied seats
- AND no further purchase, hold, or cash check-in MUST be allowed for that class

#### Scenario: Settling a pending-cash purchase does not change occupied-seat count

- GIVEN a pending-cash seat is already counted as occupied
- WHEN staff settle that cash Purchase to a completed/paid state
- THEN the capacity count for that class MUST remain unchanged
- AND the same Attendance continues to occupy the same seat

#### Scenario: A cancelled cash walk-in seat is released

- GIVEN a pending-cash seat is occupied and counted against capacity
- WHEN that Attendance/Purchase is cancelled through an authorized staff action
- THEN the seat MUST no longer count toward the capacity cap
- AND the freed seat becomes available for a new purchase, hold, or check-in

### Requirement: Capacity cap never oversells across mixed seat states

The system MUST enforce the capacity cap atomically across all seat-occupying states (paid, live-held, pending-cash) so concurrent purchases or check-ins cannot push occupancy above the cap.

#### Scenario: Concurrent card and cash attempts at the last seat

- GIVEN a special class has exactly one seat remaining
- WHEN a card walk-in's Stripe hold and a staff cash check-in are attempted at nearly the same time
- THEN only one of the two MUST succeed in occupying the last seat
- AND the other attempt MUST be rejected as sold out
