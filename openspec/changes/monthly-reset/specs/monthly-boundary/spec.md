# Monthly Boundary Specification

## Purpose

Defines the MonthlyBoundary model and month-close functionality to enable monthly resets of student attendance, completion, and payment aggregates while preserving historical data.

## Requirements

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
- AND return success with boundary ID

#### Scenario: Idempotent month close
- GIVEN a month that is already closed
- WHEN staff attempts to close the same month again
- THEN the system MUST update the existing boundary record
- AND NOT fail or create duplicates

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
- AND preserve all other user data unchanged

### Requirement: Current Month Detection

The system MUST determine the "current month" for scoping queries.

#### Scenario: Current month with no boundaries
- GIVEN no MonthlyBoundary records exist
- WHEN determining current month
- THEN the system MUST use the calendar current month

#### Scenario: Current month with boundaries
- GIVEN MonthlyBoundary records exist
- WHEN determining current month
- THEN the system MUST use the latest unclosed month boundary
- OR the calendar current month if all boundaries are closed