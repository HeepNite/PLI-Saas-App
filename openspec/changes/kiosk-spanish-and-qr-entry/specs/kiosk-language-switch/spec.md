# kiosk-language-switch Specification

## Purpose

Scoped label system that toggles all kiosk terminal user-visible strings between English and Spanish without a global i18n layer. The toggle is session-local to `StaffTerminalShell` and never affects public `/checkin` flows.

---

## Requirements

### Requirement: KioskLang Type and Label Factory

The system MUST define a `KioskLang` union type (`"en" | "es"`) and a `buildKioskLabels(lang: KioskLang)` factory function in `lib/checkin/kiosk-labels.ts`.

`buildKioskLabels` MUST return a typed label map covering every user-visible string rendered in kiosk terminal mode.

The factory MUST be a pure function with no side effects and no runtime dependencies (no backend calls, cookies, or global state).

#### Scenario: English labels returned by default

- GIVEN `buildKioskLabels("en")` is called
- WHEN the returned label map is inspected
- THEN all values are English strings matching the current hardcoded terminal strings

#### Scenario: Spanish labels returned for "es"

- GIVEN `buildKioskLabels("es")` is called
- WHEN the returned label map is inspected
- THEN all values are Spanish equivalents of the English strings
- AND no label value is an empty string or undefined

#### Scenario: Unknown lang is not accepted by type system

- GIVEN a caller passes a value not in `"en" | "es"` to `buildKioskLabels`
- WHEN TypeScript compiles the call site
- THEN a compile-time type error is emitted
- AND no runtime fallback is required

---

### Requirement: Language Toggle UI in StaffTerminalShell

`StaffTerminalShell` MUST render a language toggle control visible within the kiosk terminal shell.

The toggle MUST store the selected language in component-local state (`useState`); it MUST NOT write to cookies, localStorage, or any server endpoint.

The toggle MUST default to `"en"` on every page load.

The selected `lang` MUST be passed as a prop to `CheckInQrClient` (and transitively to any component consuming kiosk labels).

#### Scenario: Toggle renders EN/ES switch in terminal mode

- GIVEN `StaffTerminalShell` is rendered (`shellVariant === "terminal"`)
- WHEN the kiosk terminal page loads
- THEN a language toggle control is visible in the terminal shell UI
- AND its initial state is English (`"en"`)

#### Scenario: Switching to Spanish re-renders all terminal labels

- GIVEN the kiosk terminal is displaying English labels
- WHEN the operator taps/clicks the Spanish toggle option
- THEN all user-visible terminal strings switch to their Spanish equivalents without a page reload
- AND the toggle visually reflects the active language

#### Scenario: Toggle state does not persist across page reloads

- GIVEN the operator has switched the language to Spanish
- WHEN the terminal page is reloaded or the terminal session is reset
- THEN the language reverts to English (`"en"`)

#### Scenario: Toggle is invisible outside terminal mode

- GIVEN a non-terminal check-in flow (`shellVariant !== "terminal"`)
- WHEN the public `/checkin` page renders
- THEN no language toggle control is present in the DOM

---

### Requirement: Label Map Coverage

`buildKioskLabels` MUST cover every user-visible string literal currently hardcoded in the kiosk terminal render path.

Components that previously used string literals MUST reference label map keys instead.

No user-visible string in kiosk terminal mode MAY remain hardcoded outside `buildKioskLabels`.

#### Scenario: All terminal strings are label-driven after migration

- GIVEN `buildKioskLabels("en")` returns labels
- AND all kiosk terminal components consume labels from the map
- WHEN the terminal page renders with `lang="en"`
- THEN the output is visually identical to the pre-migration terminal (no regressions)

#### Scenario: CheckInHeader renders labels from map

- GIVEN `CheckInHeader` receives a `labels` prop derived from `buildKioskLabels(lang)`
- WHEN `lang` is `"es"`
- THEN the "Student check-in" heading and "Welcome" text render in Spanish
