# Monthly History Display Specification

## Purpose

Defines how student history popups display cross-month data with month dividers and proper aggregation for completed classes across months.

## Requirements

### Requirement: Cross-Month Range Support

The system MUST support date ranges that span multiple months in history view.

#### Scenario: Multi-month date range selection
- GIVEN staff selects a date range spanning 2+ months
- WHEN viewing student history popups
- THEN the system MUST display all data within the range
- AND group data by month with visual dividers

### Requirement: Month Divider Format

The system MUST display month dividers in Spanish format "Mes YYYY".

#### Scenario: Month divider display
- GIVEN history data spans January and February 2026
- WHEN displaying the history popup
- THEN the system MUST show "Enero 2026" as first month divider
- AND "Febrero 2026" as second month divider
- AND use proper Spanish month names

#### Scenario: Single month range
- GIVEN a date range within one month
- WHEN displaying history popup
- THEN the system MAY omit month dividers
- OR display single month divider for clarity

### Requirement: Attendance History Grouping

The system MUST group attendance records by month with dividers in Attendance History popup.

#### Scenario: Cross-month attendance history
- GIVEN attendance records from December 2025 and January 2026
- WHEN staff opens Attendance History popup for a student
- THEN the system MUST show "Diciembre 2025" divider
- AND list December attendances chronologically
- AND show "Enero 2026" divider
- AND list January attendances chronologically

### Requirement: Payment History Grouping

The system MUST group payment records by month with dividers in Payment History popup.

#### Scenario: Cross-month payment history
- GIVEN purchase records from November and December 2025
- WHEN staff opens Payment History popup for a student
- THEN the system MUST show "Noviembre 2025" divider
- AND list November payments chronologically
- AND show "Diciembre 2025" divider
- AND list December payments chronologically

### Requirement: Card Aggregation Cross-Month

The system MUST sum completed classes across all months for student card totals.

#### Scenario: Multi-month completed classes total
- GIVEN a student has 5 completed classes in November and 3 in December
- WHEN displaying student card in cross-month range view
- THEN the system MUST show total of 8 completed classes
- AND aggregate all months within the selected range

#### Scenario: Monthly vs cross-month card display
- GIVEN student card can be viewed in daily board (current month) or history mode (date range)
- WHEN viewing daily board
- THEN the system MUST show only current month totals
- WHEN viewing history with range
- THEN the system MUST show aggregated totals across the range