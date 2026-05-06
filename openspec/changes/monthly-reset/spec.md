# Monthly Reset Specification

## Purpose

Complete specification for monthly reset functionality that enables monthly resets of student attendance, completion, and payment aggregates while preserving historical data, package credits, and points.

---

## Domain: Monthly Boundary

### Requirement: MonthlyBoundary Model

The system MUST provide a MonthlyBoundary model to track month closure events.

#### Schema Fields
- `id`: String CUID primary key
- `year`: Integer (required)
- `month`: Integer 1-12 (required)  
- `closedAt`: DateTime (nullable, when month was closed)
- `closedByClerkId`: String (nullable, who closed it)
- `notes`: String (nullable, closure notes)
- `createdAt`: DateTime (auto-generated)
- Unique constraint on `[year, month]`

#### Scenario: Creating month boundary record
- GIVEN a month that needs to be closed
- WHEN staff creates a monthly boundary
- THEN the system MUST store year, month, and closure metadata
- AND prevent duplicate boundaries for the same year-month

### Requirement: Month Close API

The system MUST provide a POST `/api/admin/month-close` endpoint for administrative month closure.

#### Scenario: Successful month close
- GIVEN staff has admin permissions
- WHEN POST request to `/api/admin/month-close` with year and month
- THEN the system MUST upsert MonthlyBoundary record with closedAt timestamp
- AND clear all User.completedClassesOverride fields to null
- AND clear all User.packageClassesUsedOverride fields to null

#### Scenario: Unauthorized access
- GIVEN a user without admin permissions  
- WHEN POST request to `/api/admin/month-close`
- THEN the system MUST return 403 Forbidden

### Requirement: Override Clearing

The system MUST clear manual data overrides when a month is closed.

#### Scenario: Clearing overrides on close
- GIVEN users have completedClassesOverride or packageClassesUsedOverride values
- WHEN a month is closed via the API
- THEN the system MUST set all User.completedClassesOverride to null
- AND set all User.packageClassesUsedOverride to null

---

## Domain: Monthly Board Scoping

### Requirement: Current Month Determination

The system MUST determine the current month using New York timezone boundaries.

#### Scenario: Month boundaries in NY timezone
- GIVEN the current date and time
- WHEN determining current month boundaries
- THEN the system MUST use start of month 00:00:00 NY timezone
- AND end of month 23:59:59 NY timezone

### Requirement: Completed Classes Query Filtering

The system MUST filter completedClassesByUser query in `/api/staff/payments/route.ts` to the current month.

#### Scenario: Monthly completed classes aggregation
- GIVEN Attendance records with different dates
- WHEN querying completedClassesByUser  
- THEN the system MUST include only Attendance records where createdAt is within current month NY timezone
- AND group by userId as before
- AND return only attendance status in ["checked_in", "checked_out"]

### Requirement: Total Collected Query Filtering

The system MUST filter totalCollectedCents query to the current month.

#### Scenario: Monthly payment aggregation
- GIVEN Purchase records with metadata.date and classPaid=true
- WHEN querying totalCollectedCents
- THEN the system MUST filter by metadata.date within current month
- AND fall back to createdAt if metadata.date is missing

### Requirement: Package Credits Preservation

The system MUST NOT filter package credits by month - they remain global.

#### Scenario: Package credits across months
- GIVEN package purchases from different months
- WHEN displaying package credits on staff board
- THEN the system MUST show total available credits across all months

---

## Domain: Monthly History Display

### Requirement: Month Divider Format

The system MUST display month dividers in Spanish format "Mes YYYY".

#### Scenario: Month divider display
- GIVEN history data spans January and February 2026
- WHEN displaying the history popup
- THEN the system MUST show "Enero 2026" as first month divider
- AND "Febrero 2026" as second month divider

### Requirement: Attendance History Grouping

The system MUST group attendance records by month with dividers in Attendance History popup.

#### Scenario: Cross-month attendance history
- GIVEN attendance records from December 2025 and January 2026  
- WHEN staff opens Attendance History popup for a student
- THEN the system MUST show "Diciembre 2025" divider
- AND list December attendances chronologically
- AND show "Enero 2026" divider

### Requirement: Payment History Grouping

The system MUST group payment records by month with dividers in Payment History popup.

#### Scenario: Cross-month payment history
- GIVEN purchase records from November and December 2025
- WHEN staff opens Payment History popup for a student
- THEN the system MUST show "Noviembre 2025" divider
- AND list November payments chronologically

### Requirement: Card Aggregation Cross-Month

The system MUST sum completed classes across all months for student card totals.

#### Scenario: Multi-month completed classes total
- GIVEN a student has 5 completed classes in November and 3 in December
- WHEN displaying student card in cross-month range view
- THEN the system MUST show total of 8 completed classes

---

## Domain: Monthly Reports

### Requirement: Monthly Report API

The system MUST provide a GET `/api/staff/reports/monthly` endpoint for server-side monthly report generation.

#### Query Parameters
- `year`: Integer (required) - target year
- `month`: Integer 1-12 (required) - target month  
- `format`: String (optional, default "csv") - export format

#### Scenario: Valid monthly report request
- GIVEN staff has proper permissions
- WHEN GET request to `/api/staff/reports/monthly?year=2026&month=4`
- THEN the system MUST query database for April 2026 data
- AND return CSV file download with proper headers

### Requirement: CSV Report Columns

The system MUST generate CSV with specific student data columns.

#### Required Columns
- Student Name, Email, Phone
- Attendances (count for the month)
- Completed Classes (count for the month)
- Amount Paid (cents total for the month)
- Package Info (active packages during the month)

#### Scenario: CSV format and content
- GIVEN a monthly report request for March 2026
- WHEN generating CSV
- THEN the system MUST include header row with column names
- AND one row per student with data for March 2026 only

### Requirement: Close Month Button UI

The system MUST provide a "Close Month" button in the Reports UI area.

#### Scenario: Close month button placement
- GIVEN staff user is in Reports section
- WHEN viewing the reports interface  
- THEN the system MUST display "Close Month" button prominently
- AND button MUST trigger month-close functionality