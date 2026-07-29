# qr-terminal-customer-journeys Specification

## Purpose

Define the dev-parity QR decisions for new users, existing clients with usable packages, and existing clients without usable packages.

## Requirements

### Requirement: Journey routing from scanned QR

The system SHALL route each customer into the dev-equivalent journey while preserving the scanned class context.

#### Scenario: New user booking flow preserves and restores class context

- GIVEN a signed-out scanner on the QR welcome screen
- WHEN the customer chooses the new-user path, cancels, or completes onboarding/booking
- THEN the system MUST keep the scanned class context in booking URLs, return cancel actions to the QR welcome context, and continue to the established completion outcome for that journey

#### Scenario: Existing client with usable package goes to package check-in

- GIVEN an existing client whose package is active, unexpired, course-compatible, and unlimited or has positive credits
- WHEN QR bootstrap resolves the customer
- THEN the system SHALL select the preferred eligible package and route to package check-in rather than purchase-first flow

#### Scenario: Existing client without usable package goes to purchase choices

- GIVEN an existing client with no eligible package for the scanned class
- WHEN QR bootstrap resolves the customer
- THEN the system SHALL surface the applicable package renewal/upsell or drop-in purchase path for that class instead of auto-consuming package credits

### Requirement: Check-in, purchase, and duplicate safety

The system MUST preserve atomic entitlement use, duplicate protection, slot validation, and points/consecutive side effects.

#### Scenario: Package check-in is atomic and idempotent

- GIVEN a valid package-holder journey for one class session
- WHEN package check-in succeeds or is retried
- THEN the system SHALL create or confirm at most one attendance, consume at most one credit atomically, award applicable points once, and return duplicate/already-checked-in status without extra side effects

#### Scenario: Drop-in completion requires a matching paid or cash-eligible purchase

- GIVEN a no-package journey using card or cash
- WHEN drop-in check-in is completed
- THEN the system MUST accept only the matching class-slot purchase allowed by the current contract, create at most one attendance, and preserve duplicate handling

#### Scenario: Invalid class, package, or time state is rejected safely

- GIVEN an expired package, no-credit package, wrong-course package, unknown course, stale attendance, or closed check-in/add-on window
- WHEN the affected QR action is requested
- THEN the system SHALL reject the request with a controlled error and MUST NOT create attendance, purchases, credits, or points
