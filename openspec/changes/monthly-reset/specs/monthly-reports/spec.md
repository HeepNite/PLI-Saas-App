# Monthly Reports Specification

## Purpose

Defines server-side monthly report generation with CSV export functionality accessible through staff interface.

## Requirements

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
- AND include all active students for that month

#### Scenario: Invalid month parameter
- GIVEN invalid month parameter (e.g., month=13)
- WHEN requesting monthly report
- THEN the system MUST return 400 Bad Request
- AND provide clear error message about valid month range

### Requirement: CSV Report Columns

The system MUST generate CSV with specific student data columns.

#### Required Columns
- Student Name
- Email
- Phone
- Attendances (count for the month)
- Completed Classes (count for the month)
- Amount Paid (cents total for the month)
- Package Info (active packages during the month)

#### Scenario: CSV format and content
- GIVEN a monthly report request for March 2026
- WHEN generating CSV
- THEN the system MUST include header row with column names
- AND one row per student with data for March 2026 only
- AND format amounts in cents for consistency

### Requirement: Staff-Only Access

The system MUST restrict monthly report access to staff users only.

#### Scenario: Staff user access
- GIVEN a user with staff permissions
- WHEN requesting monthly report
- THEN the system MUST allow access and return report data

#### Scenario: Non-staff user access
- GIVEN a user without staff permissions
- WHEN requesting monthly report
- THEN the system MUST return 403 Forbidden

### Requirement: Close Month Button UI

The system MUST provide a "Close Month" button in the Reports UI area.

#### Scenario: Close month button placement
- GIVEN staff user is in Reports section
- WHEN viewing the reports interface
- THEN the system MUST display "Close Month" button prominently
- AND button MUST trigger month-close functionality

#### Scenario: Close month confirmation
- GIVEN staff clicks "Close Month" button
- WHEN confirmation is required
- THEN the system SHOULD display confirmation dialog
- AND warn about override clearing consequences
- AND proceed only after explicit confirmation

### Requirement: Database Query Scoping

The system MUST query database directly for monthly reports, not use in-memory board data.

#### Scenario: Server-side data aggregation
- GIVEN monthly report request
- WHEN generating report data
- THEN the system MUST query Attendance, Purchase, and User tables directly
- AND apply month filtering at database level
- AND NOT rely on in-memory staff board session data

#### Scenario: Large dataset handling
- GIVEN a month with many student records
- WHEN generating monthly report
- THEN the system MUST handle large result sets efficiently
- AND stream CSV data if necessary to avoid memory issues