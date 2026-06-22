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

### Requirement: Profile Booking Promo Security Boundary

The system MUST preserve existing profile booking authentication and checkout validation boundaries while adding consecutive promo behavior.

#### Scenario: Offer lookup does not bypass checkout validation

- GIVEN a profile booking promo offer is returned to the client
- WHEN checkout is submitted
- THEN server-side checkout validation MUST still validate the primary and consecutive purchase fields
- AND MUST reject invalid or inconsistent promo payloads.
