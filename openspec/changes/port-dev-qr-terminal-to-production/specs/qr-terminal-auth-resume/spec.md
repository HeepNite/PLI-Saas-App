# qr-terminal-auth-resume Specification

## Purpose

Preserve the scanned QR class context through authentication without allowing open redirects.

## Requirements

### Requirement: Safe QR auth resume

The system MUST preserve the scanned QR context across authentication and SHALL only resume validated internal `/checkin` paths.

#### Scenario: Signed-out existing client resumes the same QR context

- GIVEN a scanned `/checkin` URL with `courseSlug`, `date`, `time`, and optional `durationMinutes`
- WHEN the customer chooses the existing-account path and completes authentication
- THEN authentication SHALL return to the same `/checkin` context before any purchase or completion logic runs

#### Scenario: Redirects stay internal to check-in

- GIVEN an auth redirect candidate that is external or not rooted at `/checkin`
- WHEN the sign-in URL is generated or consumed
- THEN the system MUST ignore that candidate and resume only a safe internal `/checkin` path

### Requirement: QR context validation and auth boundary

The system MUST reject malformed QR context and SHALL preserve existing auth and rate-limit boundaries for QR resume entrypoints.

#### Scenario: Missing or invalid QR params

- GIVEN missing `courseSlug`, invalid `date/time`, or invalid `durationMinutes`
- WHEN the QR flow is opened or resumed
- THEN the system SHALL stop the journey with a controlled client or API error and MUST NOT create attendance, purchases, or package usage

#### Scenario: Unauthenticated protected QR action

- GIVEN a protected QR API action without a valid authenticated customer or valid kiosk customer session
- WHEN the action is requested
- THEN the system SHALL return the existing unauthorized response and MUST NOT continue the journey
