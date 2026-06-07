# Monthly Board Scoping Specification

## Purpose

Defines how staff board queries filter data to the current month for attendance, completion, and payment metrics while preserving package credits and points as global values.

## Requirements

### Requirement: Current Month Determination

The system MUST determine the current month using New York timezone boundaries.

#### Scenario: Month boundaries in NY timezone
- GIVEN the current date and time
- WHEN determining current month boundaries
- THEN the system MUST use start of month 00:00:00 NY timezone
- AND end of month 23:59:59 NY timezone
- AND handle daylight saving time transitions correctly

### Requirement: Completed Classes Query Filtering

The system MUST filter completedClassesByUser query in `/api/staff/payments/route.ts` to the current month.

#### Scenario: Monthly completed classes aggregation
- GIVEN Attendance records with different dates
- WHEN querying completedClassesByUser
- THEN the system MUST include only Attendance records where createdAt is within current month NY timezone
- AND group by userId as before
- AND return only attendance status in ["checked_in", "checked_out"]

#### Scenario: Cross-month attendance filtering
- GIVEN attendance records from previous and current month
- WHEN staff views the daily board
- THEN only current month attendance MUST appear in completed classes counts

### Requirement: Total Collected Query Filtering

The system MUST filter totalCollectedCents query to the current month.

#### Scenario: Monthly payment aggregation
- GIVEN Purchase records with metadata.date and classPaid=true
- WHEN querying totalCollectedCents
- THEN the system MUST filter by metadata.date within current month
- AND fall back to createdAt if metadata.date is missing
- AND sum Purchase.amount for included records

#### Scenario: Purchase without metadata.date
- GIVEN Purchase records missing metadata.date
- WHEN calculating monthly collected amount
- THEN the system MUST use createdAt for date filtering
- AND log a warning for the fallback

### Requirement: Attendance Query Filtering

The system MUST filter attendances query to the current month.

#### Scenario: Monthly attendance listing
- GIVEN Attendance records across multiple months
- WHEN querying attendances for staff board
- THEN the system MUST return only records where createdAt is within current month
- AND preserve all existing sorting and grouping logic

### Requirement: Package Credits Preservation

The system MUST NOT filter package credits by month - they remain global.

#### Scenario: Package credits across months
- GIVEN package purchases from different months
- WHEN displaying package credits on staff board
- THEN the system MUST show total available credits across all months
- AND NOT apply any date filtering to package credit calculations

### Requirement: Points Preservation

The system MUST NOT filter points by month - they remain cumulative.

#### Scenario: Cumulative points display
- GIVEN point awards from different months
- WHEN displaying user points on staff board
- THEN the system MUST show total cumulative points
- AND NOT apply any date filtering to points calculations