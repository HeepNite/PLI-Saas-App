# Delta for kiosk-terminal-ui

## Purpose

Extend the kiosk terminal UI to accept a `lang` prop and source all user-visible labels from `buildKioskLabels(lang)`. No behavioral changes to check-in logic; only label delivery is modified.

---

## ADDED Requirements

### Requirement: lang Prop on CheckInQrClient and Dependents

`CheckInQrClient` MUST accept a `lang: KioskLang` prop (defaulting to `"en"` when absent).

The `lang` prop MUST be threaded to every sub-component in the terminal render path that renders user-visible strings.

Components MUST NOT retain their own hardcoded string literals for any label that has a corresponding entry in `buildKioskLabels`.

#### Scenario: lang="en" renders English labels

- GIVEN `CheckInQrClient` is rendered with `lang="en"` and `shellVariant="terminal"`
- WHEN the terminal check-in page renders
- THEN all user-visible terminal strings are in English
- AND the output is visually and textually identical to the pre-change terminal

#### Scenario: lang="es" renders Spanish labels

- GIVEN `CheckInQrClient` is rendered with `lang="es"` and `shellVariant="terminal"`
- WHEN the terminal check-in page renders
- THEN all user-visible terminal strings are in Spanish

#### Scenario: lang prop not passed defaults to English

- GIVEN `CheckInQrClient` is rendered without a `lang` prop
- WHEN the terminal renders
- THEN English labels are used (equivalent to `lang="en"`)

---

### Requirement: Non-Terminal Flows Unaffected by lang Prop

When `shellVariant !== "terminal"`, the `lang` prop MUST have no effect on rendered output.

Public `/checkin` pages MUST NOT receive a `lang` prop from non-terminal render paths.

#### Scenario: Public /checkin page ignores lang

- GIVEN the public check-in page renders with `shellVariant !== "terminal"`
- WHEN the page loads
- THEN no language toggle is present
- AND all strings are rendered using the existing (English) string literals
- AND the `lang` prop is not propagated into the public check-in render tree

---

## MODIFIED Requirements

### Requirement: CheckInHeader Label Sources

`CheckInHeader` MUST render the check-in heading and welcome text using label values sourced from `buildKioskLabels(lang)` when `variant === "terminal"`.
(Previously: `CheckInHeader` rendered hardcoded English string literals `"Student check-in"` and `"Welcome"` unconditionally.)

`CheckInHeader` in `variant === "personal"` (public flow) MUST continue to use the current English string literals unchanged.

#### Scenario: Terminal header renders Spanish heading when lang="es"

- GIVEN `CheckInHeader` receives `variant="terminal"` and labels from `buildKioskLabels("es")`
- WHEN the component renders
- THEN the check-in heading is the Spanish equivalent of "Student check-in"
- AND the welcome text is the Spanish equivalent of "Welcome"

#### Scenario: Terminal header renders English heading when lang="en"

- GIVEN `CheckInHeader` receives `variant="terminal"` and labels from `buildKioskLabels("en")`
- WHEN the component renders
- THEN the check-in heading is "Student check-in"
- AND the welcome text is "Welcome"
- AND the output is identical to the current pre-change rendering

#### Scenario: Personal variant header is unchanged

- GIVEN `CheckInHeader` receives `variant="personal"`
- WHEN the component renders
- THEN existing English string literals are used
- AND no label map is required or consulted
