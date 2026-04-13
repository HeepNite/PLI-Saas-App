# 002-room-management Specifications

## Domain: Rooms (New)

### Purpose
Introduce a formal `Room` model to manage physical spaces where classes happen, replacing unvalidated free-text location strings.

### ADDED Requirements

#### Requirement: Room CRUD
The system MUST allow staff users to create, read, update, and disable Room records.
A Room MUST have a unique `name` and an active status.

##### Scenario: Create a Room
- GIVEN a staff user is on the Room management page
- WHEN they submit a valid room name and capacity
- THEN the system creates a new active Room record
- AND returns the new room details

##### Scenario: Disable a Room
- GIVEN an active Room exists
- WHEN a staff user disables the Room
- THEN the Room status changes to inactive
- AND it no longer appears in the list of available rooms for new class sessions

---

## Domain: Class Sessions & Check-in (Modified)

### Purpose
Update the session creation/check-in flow to validate room availability and prevent overlapping sessions.

### MODIFIED Requirements

#### Requirement: Session Creation with Room Assignment
The system SHOULD allow assigning a specific `Room` to a `ClassSession` upon creation, and MUST validate that the room is not double-booked.
(Previously: The system relied on free-text strings for location with no conflict prevention).

##### Scenario: Assigning an available Room
- GIVEN an active Room exists
- AND no other class session uses this Room during the desired time slot
- WHEN a staff user creates or updates a ClassSession with this Room's ID
- THEN the system successfully assigns the Room to the session

##### Scenario: Room Conflict Prevention
- GIVEN an active Room exists
- AND a ClassSession is already booked in this Room from 10:00 AM to 11:00 AM UTC
- WHEN a staff user attempts to create a new ClassSession in the same Room from 10:30 AM to 11:30 AM UTC
- THEN the system MUST reject the creation
- AND return a conflict error indicating the Room is unavailable

##### Scenario: Handling Legacy Sessions
- GIVEN an existing ClassSession with a null `roomId`
- WHEN the system processes or displays this session
- THEN the system MUST handle it gracefully without errors
- AND allow it to remain without a room assignment

---

## Domain: Course Catalog (Modified)

### Purpose
Allow courses to have a default room assignment.

### MODIFIED Requirements

#### Requirement: Default Course Room
The system MAY allow a `CourseCatalog` entry to be associated with a default `Room`.
(Previously: CourseCatalog had no formal room association).

##### Scenario: Assigning a default Room to a Course
- GIVEN an active Room exists
- WHEN a staff user configures a CourseCatalog entry to use this Room as default
- THEN the system saves the `roomId` on the CourseCatalog
- AND future scheduled sessions for this course SHOULD default to this Room if available