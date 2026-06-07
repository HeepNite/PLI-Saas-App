# Terminal Multi-Class View Specification

## Purpose

Define the terminal behavior for displaying all available classes on a given day and allowing the student to select one before check-in.

## Requirements

### Requirement: Display All Today’s Classes

The terminal MUST display all active courses that have sessions scheduled for the current day, regardless of the terminal’s `defaultCourseSlug`.

#### Scenario: Terminal with multiple same-day classes

- GIVEN today is Tuesday and the catalog has Salsa at 8pm and Bachata at 9pm
- WHEN a staff member opens the terminal
- THEN both classes appear as selectable cards

#### Scenario: Terminal with single class

- GIVEN today is Tuesday and only one course is scheduled
- WHEN a staff member opens the terminal
- THEN that single class appears pre-selected or as the only option

### Requirement: Student Class Selection

The student MUST explicitly select a class before the check-in panel is shown.

#### Scenario: Student picks a class

- GIVEN the terminal shows two classes (Salsa 8pm, Bachata 9pm)
- WHEN the student taps the Salsa card
- THEN the terminal shows the check-in panel scoped to the Salsa 8pm session

#### Scenario: Student switches class selection

- GIVEN the student previously selected Salsa 8pm
- WHEN the student taps Bachata 9pm
- THEN the check-in panel refreshes to the Bachata 9pm context

### Requirement: Class Card Information

Each class card MUST display the course title, start time, and location/room.

#### Scenario: Render class card

- GIVEN a course "Salsa Level 1" starting at 20:00 in Room A
- WHEN the terminal renders the class picker
- THEN the card shows "Salsa Level 1", "8:00 PM", and "Room A"

### Requirement: No Forced Single-Course Constraint

The terminal MUST NOT rely solely on `forcedCourseSlug` to determine which class to display.

#### Scenario: Terminal without default course configured

- GIVEN a terminal has no `defaultCourseSlug`
- WHEN it loads
- THEN it still displays all today’s classes instead of showing an error

## Edge Cases

### Edge Case: No Classes Today

- GIVEN no courses are scheduled for today
- WHEN the terminal loads
- THEN it displays an empty state message: "No classes scheduled for today"

### Edge Case: All Classes Inactive

- GIVEN all courses scheduled for today are inactive
- WHEN the terminal loads
- THEN it displays the same empty state as "No classes scheduled for today"
