# Requirements: Staff Fast Class Action

## Requirement: Adaptive Staff Action Button

The system MUST show one adaptive action on each eligible staff student card.

### Scenario: Student has no usable package

- GIVEN a registered student has no active package credit
- WHEN staff views the student card
- THEN the action label MUST be `Fast Pay`
- AND `Provisional PIN` MUST be shown as `Prov PIN` where space is constrained.

### Scenario: Student has usable package

- GIVEN a registered student has an active package with usable credit
- WHEN staff views the student card
- THEN the action label MUST be `Fast Sign-in`.

## Requirement: Terminal Current Class Source

The fast action MUST use the terminal current-class source of truth for today's ET date/time and MUST NOT require manual class selection in v1.

### Scenario: Current terminal class exists

- GIVEN the terminal resolves a current class for now
- WHEN staff triggers the fast action
- THEN the action MUST apply to that class session.

### Scenario: No current class exists

- GIVEN the terminal cannot resolve a current class
- WHEN staff triggers the fast action
- THEN the system MUST reject the action with a clear staff-facing error.

## Requirement: Fast Pay Cash Balance

The system MUST let staff create a cash outstanding balance and attendance for a no-package student in one action.

### Scenario: Fast Pay succeeds

- GIVEN a registered student has no usable package
- WHEN staff clicks `Fast Pay`
- THEN the system MUST create or reuse today's class session
- AND MUST register attendance for the student
- AND MUST create a pending cash purchase for the current drop-in amount, defaulting to `$20`.

### Scenario: Fast Pay is repeated

- GIVEN the student already has attendance or pending balance for the same class
- WHEN staff clicks `Fast Pay` again
- THEN the system MUST NOT duplicate attendance or charge.

## Requirement: Fast Sign-in Package Usage

The system MUST let staff consume package credit and register attendance for a package student in one action.

### Scenario: Fast Sign-in succeeds

- GIVEN a registered student has a usable package credit
- WHEN staff clicks `Fast Sign-in`
- THEN the system MUST create or reuse today's class session
- AND MUST register attendance
- AND MUST decrement or reserve one package credit
- AND MUST update package usage/completed class accounting.

### Scenario: Package becomes unavailable

- GIVEN a student appeared to have package credit in the UI
- WHEN the server finds no usable package credit
- THEN the system MUST fail safely without creating package usage.

## Requirement: Promotional Second Class Prompt

The system MUST prompt staff when a linked later class promotion is available today.

### Scenario: Staff accepts promotion

- GIVEN the current class has a later linked promotional class today
- WHEN the fast action succeeds and staff accepts the prompt
- THEN the system MUST create the second class attendance
- AND MUST create a pending cash purchase for the promo amount.

### Scenario: Staff declines promotion

- GIVEN a promotion is available
- WHEN staff declines the prompt
- THEN the system MUST keep only the first class action.

## Requirement: Staff Security Boundary

The fast action MUST be staff-only and preserve existing authorization, validation, and rate-limit boundaries.

### Scenario: Unauthorized request

- GIVEN a requester lacks staff student-operation permission
- WHEN they call the fast action endpoint
- THEN the system MUST reject the request without changing attendance, package credits, or purchases.
