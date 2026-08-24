# qr-terminal-completion-and-offers Specification

## Purpose

Preserve dev-parity completion behavior, consecutive offers, and operational safety for QR terminal flows.

## Requirements

### Requirement: Completion destinations and consecutive sequencing

The system MUST keep customers in the QR flow until the current journey is actually complete and SHALL preserve the established dev completion destination for each surface.

#### Scenario: Personal QR flow redirects only after completion

- GIVEN a successful authenticated phone journey
- WHEN success is reached with no pending consecutive action, or the offer is dismissed/resolved
- THEN the system SHALL transition to the established profile completion outcome and MUST NOT redirect to profile before the QR journey finishes

#### Scenario: Terminal flow completes only after terminal outcome resolves

- GIVEN a kiosk-terminal package, drop-in, duplicate, or consecutive journey
- WHEN the current success, duplicate, payment-selection, or consecutive step is still active
- THEN the system MUST stay in terminal flow, and SHALL reset only to the established dev terminal completion outcome after the final step resolves

### Requirement: Consecutive, fallback, and regression safety

The system MUST preserve current consecutive eligibility rules, gateway fallback safety, rate limiting, and regression coverage without requiring schema changes.

#### Scenario: Consecutive offers are only surfaced when still valid

- GIVEN a linked follow-on class
- WHEN the QR flow evaluates package-holder or drop-in consecutive eligibility
- THEN the system SHALL require the current dev preconditions for that journey, use configured prices only, and suppress expired, wrong-day, wrong-time, or already-consumed offers

#### Scenario: Optional gateway is absent or unhealthy

- GIVEN bootstrap or terminal class resolution with the optional Nest gateway disabled, missing, or failing
- WHEN the QR flow executes
- THEN the system MUST fall back to the local production-safe contract, preserve current auth/rate-limit boundaries, require no production gateway activation for acceptance, and require no schema migration

#### Scenario: Regression coverage proves parity

- GIVEN this production port
- WHEN verification is prepared
- THEN regression coverage SHALL include unit, API, component, and E2E coverage for auth resume, all three journeys, duplicate/idempotent paths, payment failure, unavailable fallback dependency, and major QR error states
