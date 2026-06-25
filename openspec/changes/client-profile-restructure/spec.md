# Delta Specifications for Client Profile Restructure

## calendar-unified

### REMOVED Requirements

#### Requirement: AgendaCard Component

AgendaCard component providing standalone calendar display functionality.
(Reason: Merging agenda display into AssignClassesCard for unified calendar interface)

### MODIFIED Requirements

#### Requirement: AssignClassesCard Calendar Integration

The system MUST display scheduled classes above the booking section in AssignClassesCard.
(Previously: Only displayed package assignment interface without agenda integration)

#### Scenario: Calendar State Display

- GIVEN user has scheduled classes
- WHEN viewing AssignClassesCard
- THEN calendar state is displayed above booking interface
- AND agenda state is passed as single typed object prop

#### Scenario: Agenda State Props

- GIVEN AssignClassesCard is rendered from ProfilePageClient
- WHEN agendaState prop is passed
- THEN all calendar functionality is available from AgendaCalendarState
- AND no individual prop destructuring is required

### ADDED Requirements

#### Requirement: AgendaCalendarState Type Integration

AssignClassesCard MUST accept agendaState as single typed object prop from AgendaCalendarState.

#### Scenario: Typed Prop Interface

- GIVEN AgendaCalendarState hook returns complete state
- WHEN passing to AssignClassesCard
- THEN agendaState prop contains all calendar state properties
- AND typescript validation ensures type safety

---

## mobile-action-cards

### ADDED Requirements

#### Requirement: MobileActionCards Component

The system MUST provide a MobileActionCards component rendering book/change, suspend/cancel, and recent requests cards on mobile only.

#### Scenario: Mobile-Only Visibility

- GIVEN user is on mobile viewport (< 1024px)
- WHEN viewing profile page
- THEN MobileActionCards is visible between StudentPinCard and StudentMomentsCard
- AND component uses lg:hidden class

#### Scenario: Desktop Preservation

- GIVEN user is on desktop viewport (>= 1024px)
- WHEN viewing profile page
- THEN MobileActionCards is hidden
- AND right rail remains untouched with original layout

#### Scenario: Action Cards Content

- GIVEN MobileActionCards is rendered
- WHEN user views mobile profile
- THEN "Book new class + Change class" appears as combined card
- AND "Suspend/Cancel" appears as separate card
- AND "Recent requests" appears as separate card

### MODIFIED Requirements

#### Requirement: ProfileRightRail Desktop Preservation

ProfileRightRail MUST remain pixel-identical on desktop while mobile actions move to center column.
(Previously: Contained all action cards on both mobile and desktop)

#### Scenario: Right Rail Desktop Layout

- GIVEN user is on desktop viewport
- WHEN viewing profile page
- THEN ProfileRightRail displays all original cards unchanged
- AND no visual modifications from mobile restructure

---

## analytics-mobile-compact

### MODIFIED Requirements

#### Requirement: AnalyticsCard Mobile Layout Optimization

The system MUST display analytics stats in optimized layout on mobile while preserving desktop layout.
(Previously: Used same layout across all viewports)

#### Scenario: Mobile Stats Grid

- GIVEN user is on mobile viewport (< 1024px)
- WHEN viewing AnalyticsCard
- THEN "Total classes" and "Weekly average" display in 2-column grid (grid-cols-2)
- AND desktop layout remains unchanged

#### Scenario: Mobile Distribution Layout

- GIVEN user is on mobile viewport
- WHEN viewing distribution section
- THEN labels display as vertical column left of donut ring
- AND desktop layout with labels below ring is preserved

#### Scenario: Desktop Layout Preservation

- GIVEN user is on desktop viewport (>= 1024px)
- WHEN viewing AnalyticsCard
- THEN original 3-column grid layout is maintained
- AND distribution labels remain below donut as before