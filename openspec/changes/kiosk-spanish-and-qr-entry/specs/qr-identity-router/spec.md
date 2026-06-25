# qr-identity-router Specification

## Purpose

Branches the QR entry flow based on the user's identity state after class context is resolved. Mirrors the identity routing logic already present in the kiosk terminal flow, applied to the QR path.

---

## Requirements

### Requirement: Identity State Detection on QR Entry

After context resolution, the QR entry page MUST determine the user's identity state before routing.

Identity state MUST be one of:
- `session-active` — an active Clerk session is present
- `pin-only` — no Clerk session, but student identity can be confirmed by PIN for the resolved QR class context
- `package-holder` — identity confirmed (session or PIN) and an active package exists for the resolved class
- `anonymous` — no session and no PIN prompt available

`package-holder` is not mutually exclusive with `session-active` or `pin-only`; it is a property of the resolved bootstrap state, not of the auth method.

#### Scenario: Logged-in user scans QR

- GIVEN the user has an active Clerk session
- AND QR context has been resolved to a valid class
- WHEN identity state is evaluated
- THEN state is `session-active`
- AND the user is routed directly to the purchase/check-in flow without additional auth prompts

#### Scenario: User with no session scans QR

- GIVEN no active Clerk session exists
- AND no PIN session is active
- WHEN identity state is evaluated
- THEN the user is presented with a PIN entry prompt (not an anonymous bypass)

---

### Requirement: Session-Active Routing

A user with an active Clerk session MUST be routed directly into the existing purchase/check-in flow using the resolved class context.

The system MUST NOT re-prompt for identity if a valid Clerk session is present.

The system MUST pass the resolved `courseSlug`, `date`, and `time` into the check-in bootstrap call.

#### Scenario: Direct entry for logged-in user

- GIVEN a Clerk session is active on the QR landing page
- AND context is resolved
- WHEN routing executes
- THEN `POST /api/checkin/qr/bootstrap` is called with the resolved context
- AND the user enters the standard existing-customer check-in flow

---

### Requirement: PIN-Only Entry

When no Clerk session is active, the QR entry page MUST present a PIN prompt.

After a valid PIN is entered, the system MUST establish a class-scoped student QR identity context and proceed to bootstrap.

PIN validation MUST be server-side, rate-limited, and scoped to student identity only. It MUST NOT require or create staff terminal authorization.

If the PIN is invalid or the rate limit is exceeded, the existing PIN error handling MUST apply.

#### Scenario: Valid PIN entered on QR path

- GIVEN no active Clerk session
- AND the user enters a valid PIN on the QR landing page
- WHEN PIN validation succeeds
- THEN a class-scoped QR student identity context is established
- AND the user is routed to bootstrap with the resolved class context

#### Scenario: Invalid PIN on QR path

- GIVEN no active Clerk session
- AND the user enters an incorrect PIN
- WHEN PIN validation is called
- THEN an error message is shown
- AND the PIN input is cleared for retry
- AND no student identity context is created

#### Scenario: PIN rate limit reached on QR path

- GIVEN no active Clerk session
- AND the user has exceeded the PIN attempt rate limit
- WHEN another PIN attempt is made
- THEN the existing rate-limit error response is surfaced
- AND the existing server-side rate-limiting logic is not modified

---

### Requirement: Package Holder Direct Check-In on QR Path

After identity is confirmed (session or PIN) and bootstrap resolves an active package for the current class, the system MUST trigger direct package check-in, mirroring the terminal `shouldAutoTriggerPackageCheckIn` behavior.

The consecutive promotion gate (`shouldAutoTriggerPackageCheckIn` / `resolvePackageConsecutiveAcceptAction`) MUST apply on the QR path exactly as it does on the terminal path.

#### Scenario: Package holder scans QR — direct check-in

- GIVEN identity is confirmed (session or PIN)
- AND bootstrap returns `package` with active credits for the resolved class
- AND no consecutive offer is available
- WHEN the auto-trigger gate evaluates
- THEN package check-in is triggered automatically without additional user interaction
- AND the package success overlay is shown

#### Scenario: Package holder with consecutive offer sees offer first

- GIVEN identity is confirmed
- AND bootstrap returns an active package
- AND a consecutive offer is settled before auto-trigger fires
- WHEN the auto-trigger gate evaluates
- THEN the consecutive offer overlay is shown BEFORE any package check-in API call is made
- AND the flow proceeds per the `checkin-package` spec (accept/decline paths)

#### Scenario: Non-package user on QR path — purchase flow

- GIVEN identity is confirmed
- AND bootstrap returns no active package for the resolved class
- WHEN routing executes
- THEN the standard drop-in purchase/enrollment flow is entered
- AND no package check-in is attempted

---

### Requirement: Security Boundary Preservation

The QR identity router MUST NOT weaken any existing auth or rate-limit guard.

All server-side validations (PIN check, session check, rate limiting) MUST remain server-side.

The QR path MAY introduce a student PIN verification endpoint, but it MUST be scoped to student identity and the resolved class context. It MUST NOT grant staff or terminal-management privileges.

#### Scenario: QR path does not bypass server PIN validation

- GIVEN a PIN prompt is shown on the QR path
- WHEN the user submits any PIN value
- THEN a server-side student PIN validation endpoint is called
- AND no client-side PIN acceptance logic exists

#### Scenario: Student PIN does not grant staff authority

- GIVEN a student enters a valid PIN through the QR path
- WHEN the QR identity context is created
- THEN the context is limited to the resolved class purchase/check-in flow
- AND no staff terminal session or staff-management capability is created

#### Scenario: No anonymous check-in via QR

- GIVEN no Clerk session and no PIN entered
- WHEN the QR landing page is in its initial state
- THEN no check-in action is accessible
- AND no bootstrap call is made without prior identity confirmation
