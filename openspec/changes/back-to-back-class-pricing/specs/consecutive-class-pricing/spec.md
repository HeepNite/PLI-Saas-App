# Consecutive Class Pricing Specification

## Purpose

Define the behavior for linking two courses as consecutive sessions and configuring discounted pricing for back-to-back attendance.

## Requirements

### Requirement: Course Pair Linking

The system MUST allow administrators to create a directed link between two courses representing a consecutive class pair.

#### Scenario: Admin links two courses

- GIVEN Course A and Course B exist in the catalog
- WHEN an administrator creates a CourseLink with `courseSlugA` and `courseSlugB`
- THEN the system persists the link with configurable prices for both drop-in and package-holder scenarios

#### Scenario: Prevent self-linking

- GIVEN a course with slug "salsa-level-1"
- WHEN an administrator attempts to link it to itself
- THEN the system rejects the operation with a validation error

#### Scenario: Prevent duplicate links

- GIVEN a CourseLink already exists for ("salsa-level-1", "salsa-level-2")
- WHEN an administrator attempts to create the same pair again
- THEN the system rejects the operation with a uniqueness violation error

### Requirement: Configurable Per-Pair Pricing

The system MUST support independent configurable prices for drop-in consecutive attendance and package-holder consecutive attendance per course pair.

#### Scenario: Admin sets consecutive prices

- GIVEN a CourseLink exists for a course pair
- WHEN an administrator sets `dropInConsecutiveCents` to 800 and `packageHolderConsecutiveCents` to 500
- THEN the system stores both values independently

#### Scenario: Deactivate a link

- GIVEN an active CourseLink exists
- WHEN an administrator sets `active` to false
- THEN the link no longer appears in terminal or check-in flows

### Requirement: Computed Discount Display

The system MUST compute discount percentages at display time; it MUST NOT store percentage values.

#### Scenario: Render discount percentage

- GIVEN a course with `dropInPriceCents` of 1500 and a linked course with `dropInConsecutiveCents` of 900
- WHEN the UI renders the back-to-back offer
- THEN it displays "40% off" computed as `Math.round((1 - 900/1500) * 100)`

## Data Model

| Field | Type | Constraints |
|-------|------|-------------|
| `courseSlugA` | String | Indexed |
| `courseSlugB` | String | Indexed |
| `dropInConsecutiveCents` | Int? | Nullable |
| `packageHolderConsecutiveCents` | Int? | Nullable |
| `active` | Boolean | Default true |

Unique constraint on `[courseSlugA, courseSlugB]`.
