# customer-qr-identity Specification

## Purpose

Use customer web/PWA identity and dynamic class/time QR flows so kiosk users can resolve account-aware check-in without typing phone numbers.

## Requirements

### Requirement: Dynamic Class-Time QR Identity Entry

The system MUST allow a logged-in customer to scan or open a dynamic class/time QR from the customer web or PWA and carry the resolved class context into backend check-in orchestration.

The first slice MUST NOT require a native customer app.

#### Scenario: Logged-in customer uses QR from web/PWA

- GIVEN the kiosk displays a dynamic QR for the current class and time
- AND the customer has an active authenticated web or PWA session
- WHEN the customer opens that QR flow
- THEN the backend resolves the class context and the customer identity together
- AND the customer is routed into the account-aware check-in flow

#### Scenario: QR is stale or invalid

- GIVEN a customer opens an expired, mismatched, or invalid class/time QR
- WHEN the backend validates the QR context
- THEN account-aware check-in is blocked
- AND the customer receives a recoverable retry message

### Requirement: Package Credit vs Account Drop-In Decision

After QR identity is confirmed, the backend MUST decide whether the customer should consume eligible package credit or continue through account-based drop-in payment/benefit handling.

This decision MUST be server-side and MUST use the resolved class context plus the customer account state.

#### Scenario: Eligible package credit is used

- GIVEN the customer identity and class/time QR context are valid
- AND the customer has eligible package credit for that class
- WHEN the backend evaluates fulfillment
- THEN the flow uses package credit
- AND no account-based drop-in charge is required for that fulfillment path

#### Scenario: No eligible package credit exists

- GIVEN the customer identity and class/time QR context are valid
- AND the customer has no eligible package credit
- WHEN the backend evaluates fulfillment
- THEN the flow continues through account-based drop-in payment or benefit rules
- AND the kiosk/customer flow receives that decision without manual phone lookup

### Requirement: Customer QR Flow Excludes NFC Identity

The first slice MUST NOT require NFC-based identity for account/package check-in.

#### Scenario: Account flow does not depend on NFC

- GIVEN a customer is using the QR identity path
- WHEN the account-aware decision is made
- THEN identity comes from authenticated web/PWA context plus QR context
- AND not from phone-to-kiosk NFC exchange
