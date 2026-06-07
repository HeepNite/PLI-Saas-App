# School Wizard Stepper Specification

## Purpose
Transform the School section from a flat scroll-spy navigation into a dynamic tabbed wizard panel system that guides staff through course, package, and points management workflows.

## ADDED Requirements

### Requirement: Wizard Panel Structure (REQ-01)

The system MUST render a wizard panel at the top of the School section with three entity tabs (Courses, Packages, Points) and maintain static listings below.

#### Scenario: Initial wizard render
- GIVEN the School section loads
- WHEN the user navigates to the School tab
- THEN the wizard panel displays at the top with Courses tab active by default
- AND static listings remain visible below the wizard

#### Scenario: Tab switching between entities
- GIVEN the wizard panel is displayed
- WHEN the user clicks the Packages or Points tab
- THEN the wizard content switches to that entity's steps
- AND the static listings below remain unchanged

### Requirement: Courses Wizard Steps (REQ-02)

The Courses wizard MUST implement exactly 7 steps with specific field mappings.

#### Scenario: Courses wizard navigation
- GIVEN Courses tab is active
- WHEN the user views the step navigation
- THEN steps 1-7 are displayed: Main Info, Prices, Media Assets, Schedule, Course Links, Preview & Calendar, Publish/Social Media
- AND Course Links step is disabled for new courses (when courseEditingSlug is falsy)

#### Scenario: Main Info step fields
- GIVEN step 1 (Main Info) is active
- WHEN the user views the form
- THEN fields are displayed: slug, title, kind, category, description, level, durationMinutes, location, defaultRoomId, active
- AND slug conflict validation renders inline when applicable

#### Scenario: Media Assets step file handling
- GIVEN step 3 (Media Assets) is active  
- WHEN the user uploads files
- THEN courseImageInputRef and courseVideoInputRef function correctly
- AND file inputs remain mounted in DOM even when step is inactive

### Requirement: Packages Wizard Steps (REQ-03)

The Packages wizard MUST implement exactly 4 steps with specific field mappings.

#### Scenario: Packages wizard steps
- GIVEN Packages tab is active
- WHEN the user views the step navigation
- THEN steps 1-4 are displayed: Main Info, Assign Courses, Pricing & Credits & Makeup Classes, Valid Days & Status & Launch Date

#### Scenario: Course assignment step
- GIVEN step 2 (Assign Courses) is active
- WHEN the user views the form
- THEN courseSlugs multi-select displays as a grid of course cards

### Requirement: Points Stepper Steps (REQ-04)

The Points stepper MUST implement exactly 2 steps for rule management and manual assignment.

#### Scenario: Points stepper steps
- GIVEN Points tab is active
- WHEN the user views the step navigation  
- THEN steps 1-2 are displayed: Rule Builder, Manual Assignment

#### Scenario: Rule Builder step
- GIVEN step 1 (Rule Builder) is active
- WHEN the user views the form
- THEN fields are displayed: templateKey, points, active toggle
- AND existing rules list remains visible

### Requirement: Step Navigation Behavior (REQ-05)

The system MUST allow free navigation between wizard steps and tabs without enforcing linear progression.

#### Scenario: Non-linear step navigation
- GIVEN any wizard step is active
- WHEN the user clicks a different step number
- THEN the wizard navigates directly to that step
- AND no validation blocking occurs

#### Scenario: Cross-tab navigation preservation
- GIVEN user is on Courses step 3
- WHEN user switches to Packages tab then back to Courses
- THEN Courses wizard returns to step 3
- AND all form data is preserved

### Requirement: Conditional Course Links Step (REQ-06)

The Course Links step MUST only be available when editing existing courses.

#### Scenario: New course creation
- GIVEN courseEditingSlug is null/undefined
- WHEN the Courses wizard renders
- THEN step 5 (Course Links) is disabled in navigation
- AND wizard progresses from step 4 to step 6

#### Scenario: Existing course editing
- GIVEN courseEditingSlug has a value
- WHEN the Courses wizard renders
- THEN step 5 (Course Links) is enabled and accessible
- AND courseLinksAsA, courseLinksAsB, courseLinkForm fields are available

### Requirement: Persistent Save Functionality (REQ-07)

The system MUST provide save capability from any wizard step without requiring completion.

#### Scenario: Save from any step
- GIVEN any wizard step is active with form data
- WHEN the user clicks the Save button
- THEN the current form state is saved
- AND the user remains on the same step

#### Scenario: Save button visibility
- GIVEN the wizard panel is displayed
- WHEN the user navigates between any steps
- THEN the Save button remains visible in the wizard header

### Requirement: Static Listings Preservation (REQ-08)

The system MUST maintain static listings below the wizard panel at all times.

#### Scenario: Listings always visible
- GIVEN the wizard panel is active
- WHEN the user performs any wizard actions
- THEN course, package, and points listings remain visible below
- AND listings data updates when saves occur

### Requirement: File Input DOM Mounting (REQ-09)

The system MUST keep file input elements mounted in the DOM to preserve upload functionality.

#### Scenario: File inputs during step navigation
- GIVEN file inputs are rendered (courseImageInputRef, courseVideoInputRef)
- WHEN the user navigates away from Media Assets step
- THEN file input elements remain in the DOM tree
- AND upload functionality is preserved when returning to step

### Requirement: Special Event Course Handling (REQ-10)

The system MUST adjust Schedule step behavior for special event courses.

#### Scenario: Special event course schedule
- GIVEN isSpecialEventCourse is true
- WHEN step 4 (Schedule) renders
- THEN special event mode fields display instead of recurring options
- AND step navigation reflects the special event context

## MODIFIED Requirements

None - this is a new capability addition.

## REMOVED Requirements  

None - no existing functionality is being removed.