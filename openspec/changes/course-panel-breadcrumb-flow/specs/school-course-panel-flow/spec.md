# school-course-panel-flow Specification

## Purpose

Define a breadcrumb-guided in-panel flow for School course management that improves orientation while preserving current routes, query params, and backend/API behavior.

## Requirements

### Requirement: In-panel process steps

The system MUST render a visible process flow inside the existing School panel (`nav=schedule`) with deterministic steps in this order: Overview, Courses, Packages, Points, Reservations & Rooms.

#### Scenario: Staff opens schedule panel

- GIVEN a staff user opens the portal with `nav=schedule`
- WHEN the School panel is rendered
- THEN the process flow is visible and ordered as Overview → Courses → Packages → Points → Reservations & Rooms

#### Scenario: Missing course context

- GIVEN a staff user opens `nav=schedule` without `course`
- WHEN the panel renders
- THEN the flow defaults to Overview as the active step

### Requirement: Breadcrumb step navigation

The system SHALL allow staff to move between process steps from breadcrumb controls without leaving the current panel context.

#### Scenario: Navigate to a later step

- GIVEN the flow is visible in `nav=schedule`
- WHEN the user selects Packages in the breadcrumb
- THEN the panel focuses Packages content and marks Packages as active

#### Scenario: Navigate back to an earlier step

- GIVEN Points is active
- WHEN the user selects Courses in the breadcrumb
- THEN Courses becomes active and points-related content is no longer active

### Requirement: Query-parameter compatibility

The system MUST preserve current deep-link semantics for `nav` and `course` query params and MUST NOT require new query params for the flow.

#### Scenario: Existing deep link remains valid

- GIVEN a user lands on `.../staff/portal?nav=schedule&course=<slug>`
- WHEN the panel initializes
- THEN the same course context is loaded and the flow initializes within the panel

#### Scenario: Unknown query params coexist

- GIVEN a user lands with `nav=schedule&course=<slug>` plus unrelated query params
- WHEN the panel initializes
- THEN schedule and course behavior remains unchanged by the flow

### Requirement: API and contract preservation

The system MUST keep existing endpoints, request/response shapes, validations, and persistence semantics for course and course-link operations.

#### Scenario: Course data fetch in flow

- GIVEN the flow is used to access Courses or Packages
- WHEN course data is requested
- THEN current course endpoints are used with unchanged contract and validation behavior

#### Scenario: Course-link metrics continuity

- GIVEN the flow reaches points or reservations-related operations
- WHEN course-link metrics are read or updated
- THEN current course-link endpoint contracts remain unchanged

### Requirement: Deterministic active-step state

The system SHOULD maintain a single source of truth for the active step and recover predictably when a requested step lacks visible content.

#### Scenario: Step visibility mismatch

- GIVEN a requested step has no renderable section for current data
- WHEN the panel evaluates active step
- THEN the flow falls back to the nearest previous available step in order

#### Scenario: Scroll or visibility changes

- GIVEN the user scrolls through grouped sections
- WHEN section visibility changes
- THEN only one step is active at a time according to deterministic mapping

## Acceptance Criteria

1. Staff can complete course-management tasks within one `nav=schedule` panel and always see current step context.
2. Existing deep links using `nav=schedule` and optional `course=<slug>` continue to work without required URL changes.
3. No new backend endpoints, schema changes, or API contract changes are introduced.
4. Breadcrumb navigation updates active section context without routing to a different page.
5. Active-step behavior is deterministic for normal and edge visibility conditions.
