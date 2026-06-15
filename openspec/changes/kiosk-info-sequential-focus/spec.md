# Delta for Kiosk Terminal UI

## ADDED Requirements

### Requirement: Sequential Phase Flow for Kiosk Info Step

The kiosk terminal flow MUST implement a 3-phase sequential focus flow for the info step when `isKioskTerminalFlow === true`. The system SHALL show only relevant fields per phase with inline keypad placement to improve UX and eliminate viewport scrolling.

#### Scenario: Phase 1 Initial State (Name-Email)

- GIVEN user is on kiosk info step AND `isKioskTerminalFlow` is true
- WHEN the component renders
- THEN only phase 1 fields are visible (firstName, lastName, email)
- AND phase 2 (phone) and phase 3 (pin) are hidden
- AND no keypad is visible
- AND the global "Continue" button is disabled until name (>1 char) + email (>5 chars) are filled

#### Scenario: Phase 1 to Phase 2 Transition

- GIVEN user is in phase 1 with valid name + email
- WHEN user taps the global "Continue" button
- THEN phase 1 animates out with opacity + y transform
- AND phase 2 animates in showing only phone field + inline keypad
- AND `activeNumericField` is set to "phone"
- AND transition uses framer-motion AnimatePresence

#### Scenario: Phase 2 Continue to PIN

- GIVEN user is in phase 2 AND service is "new-student"
- WHEN phone reaches 10 digits (isCompleteUSPhone returns true)
- THEN the global Continue button is enabled
- AND WHEN user taps the global Continue button
- THEN phase 2 → 3 transition occurs immediately
- AND `activeNumericField` is set to "pin"

#### Scenario: Phase 3 PIN Entry

- GIVEN user is in phase 3 AND service is "new-student"
- WHEN phase renders
- THEN PIN and confirm PIN fields are visible with inline keypad
- AND keypad is positioned directly below PIN fields
- AND final completion is handled by outer EnrollModal "Continue"

#### Scenario: Non-New-Student Service Skip

- GIVEN user is in phase 2 AND service is NOT "new-student"
- WHEN phone is complete
- THEN phase 3 is skipped entirely
- AND flow proceeds to outer EnrollModal validation
- AND no PIN fields are shown

#### Scenario: Summary Pill Display

- GIVEN user has completed phase 1 AND is in phase 2 or 3
- WHEN viewing current phase
- THEN completed phases show as compact summary pill
- AND pill displays "name + email" from phase 1
- AND pill includes "Edit" button

#### Scenario: Edit Button Functionality

- GIVEN user is viewing summary pill with "Edit" button
- WHEN user taps "Edit"
- THEN system returns to phase 1
- AND all fields remain populated with existing values
- AND `activeNumericField` is reset to null
- AND keypad is hidden

#### Scenario: Validation States

- GIVEN user is in phase 1
- WHEN name or email is invalid (name ≤1 char OR email ≤5 chars)
- THEN the global "Continue" button is disabled
- AND WHEN user is in phase 2 with incomplete phone
- AND WHEN phone field has been touched
- THEN error hint is displayed

#### Scenario: Keypad Inline Placement

- GIVEN user is in phase 2 or phase 3
- WHEN keypad is active
- THEN keypad renders inline within the phase section
- AND appears directly below the active field
- AND no viewport scrolling is required to see keypad

#### Scenario: Non-Kiosk Flow Unchanged

- GIVEN `isKioskTerminalFlow` is false
- WHEN component renders
- THEN all fields are visible simultaneously (existing behavior)
- AND no phase state machine is active
- AND keypad placement follows existing max-h CSS pattern

## MODIFIED Requirements

None — this adds new behavior only for `isKioskTerminalFlow === true` without changing existing web/QR flows.

## REMOVED Requirements

None — existing functionality is preserved for non-kiosk flows.
