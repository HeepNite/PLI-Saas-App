# Delta for Profile Booking

## ADDED Requirements

### Requirement: Profile Booking Consecutive Promo

The system MUST offer a linked second-class promotion during profile booking when a later linked class is available for the selected primary class.

#### Scenario: Promo is available for a later linked class

- GIVEN a signed-in profile user selects a class from profile booking
- AND an active linked class exists later on the same day
- WHEN the booking flow reaches offer evaluation
- THEN the system MUST show the consecutive promo step before final checkout
- AND the promo MUST identify the linked class and promo price.

#### Scenario: Package holder receives package promo price

- GIVEN the signed-in profile user has an active usable package
- AND the linked class has a package-holder promo price of `$10`
- WHEN the consecutive promo is shown
- THEN the system MUST show `$10` as the promo price
- AND MUST NOT show the non-package drop-in promo price.

#### Scenario: Non-package user receives drop-in promo price

- GIVEN the signed-in profile user has no active usable package
- AND the linked class has a drop-in promo price
- WHEN the consecutive promo is shown
- THEN the system MUST show the drop-in promo price.

#### Scenario: User declines promo

- GIVEN a consecutive promo is shown during profile booking
- WHEN the user declines the promo
- THEN checkout MUST include only the primary selected class.

#### Scenario: User accepts promo

- GIVEN a consecutive promo is shown during profile booking
- WHEN the user accepts the promo
- THEN checkout MUST include the primary class and the linked promo class
- AND the payment payload MUST preserve the linked course slug, date/time, and promo price.

#### Scenario: No later linked class exists

- GIVEN the selected profile booking class has no active linked class later that day
- WHEN the booking flow evaluates consecutive offers
- THEN the system MUST NOT show a promo step
- AND the user MUST continue the normal booking checkout.

### Requirement: Profile Booking Current-Day Class Visibility

The system MUST keep every class scheduled for the current New York calendar date selectable in authenticated profile booking for that entire date, regardless of the class start or end time.

#### Scenario: User selects a class after it has ended

- GIVEN a signed-in profile user opens profile booking at 10:10 New York time
- AND a class was scheduled for 08:00 on the current New York calendar date
- WHEN the profile class picker lists available classes
- THEN the 08:00 class MUST remain visible and selectable
- AND selecting it MUST pass its concrete date and `08:00` time to the existing booking flow.

#### Scenario: Picker excludes historical dates

- GIVEN a signed-in profile user opens profile booking
- WHEN the profile class picker lists available classes
- THEN it MUST NOT include classes from dates before the current New York calendar date.

#### Scenario: Picker preserves future class availability

- GIVEN a signed-in profile user opens profile booking
- AND a class is scheduled on a future date within the existing booking window
- WHEN the profile class picker lists available classes
- THEN the future class MUST remain available according to its existing schedule rules.

### Requirement: Profile Booking Promo Security Boundary

The system MUST preserve existing profile booking authentication and checkout validation boundaries while adding consecutive promo behavior.

#### Scenario: Offer lookup does not bypass checkout validation

- GIVEN a profile booking promo offer is returned to the client
- WHEN checkout is submitted
- THEN server-side checkout validation MUST still validate the primary and consecutive purchase fields
- AND MUST reject invalid or inconsistent promo payloads.
