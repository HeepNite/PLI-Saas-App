# Technical Design: 002-room-management

## Architecture Decisions

### Core Model Approach
We will implement a first-class `Room` entity with the following characteristics:
- Standalone model with UUID primary key
- Optional foreign key relationship to `ClassSession` (allowing legacy sessions without rooms)
- Optional foreign key relationship to `CourseCatalog` for default room assignment
- Soft delete pattern using `active` boolean flag instead of hard deletes

### Data Flow
1. Room CRUD operations flow through `/app/api/staff/rooms/route.ts`
2. Room assignment occurs during session creation/upsert in check-in flow
3. Conflict detection happens synchronously during session validation
4. UI components adjust to show room selection alongside existing location fields

### Conflict Detection Strategy
- Perform conflict checks at session creation/update time
- Query existing sessions for overlapping time slots in the same room
- Use strict UTC comparisons to avoid timezone issues
- Allow booking the same room for sequential non-overlapping sessions

## Implementation Details

### Database Schema Changes
```prisma
model Room {
  id        String   @id @default(uuid())
  name      String   @unique
  capacity  Int
  location  String?  // For backward compatibility with existing location strings
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  sessions    ClassSession[]
  courses     CourseCatalog[]  // Default room for courses
  
  @@index([active])
}

model ClassSession {
  // Existing fields...
  roomId    String?   @unique
  room      Room?     @relation(fields: [roomId], references: [id])
  
  @@index([courseSlug, startsAt])
  @@index([roomId, startsAt, endsAt])
}

model CourseCatalog {
  // Existing fields...
  defaultRoomId String?
  defaultRoom   Room?   @relation(fields: [defaultRoomId], references: [id])
}
```

### API Endpoints
**GET /app/api/staff/rooms/route.ts**
- List rooms with optional filtering by active status
- Support pagination and search by name/location

**POST /app/api/staff/rooms/route.ts**
- Create new room with validation (name unique, capacity > 0)

**PUT /app/api/staff/rooms/[id]/route.ts**
- Update room properties
- Prevent deactivation if room has active/future sessions

**DELETE /app/api/staff/rooms/[id]/route.ts**
- Soft delete by setting active=false
- Hard delete only if no sessions reference the room

### Conflict Detection Logic
In `lib/class-schedule.ts`:
```typescript
function isRoomAvailable(roomId: string, startsAt: Date, endsAt: Date, excludeSessionId?: string): boolean {
  // Query for overlapping sessions in the same room
  const conflictingSession = await prisma.classSession.findFirst({
    where: {
      roomId,
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      // Exclude current session if updating
      ...(excludeSessionId ? { id: { not: excludeSessionId } } : {}),
      // Only check active sessions or those in future/past as needed
    }
  });
  
  return !conflictingSession;
}
```

### UI Adjustments
- Staff course creation/edit forms: Add room selection dropdown (optional)
- Session management: Show assigned room alongside time slot
- Check-in interface: Display room information for verification
- Room management dashboard: List rooms with capacity and usage stats

### Backward Compatibility
- `location` field remains in `Room` model for gradual migration
- Existing sessions without `roomId` continue to function
- Course `location` field can be populated from assigned room's location
- Validation gracefully handles null roomIds

## Integration Points

### Check-in Flow Modification
1. When creating/updating a session via check-in:
   - Validate room assignment if provided
   - Check room availability for the time slot
   - Prevent saving if conflict detected
   - Allow saving with null roomId (legacy behavior)

### Schedule Rules Impact
- No immediate changes to `scheduleRules` format
- Future enhancement: store room preferences in schedule rules
- Current schedule generation remains room-agnostic

### Reporting and Analytics
- New room utilization reports possible
- Capacity vs attendance tracking
- Room-specific revenue analytics (when payments implemented)

## Error Handling and Validation

### Validation Rules
- Room name: required, unique, max 100 characters
- Capacity: integer > 0
- Location: optional string, max 200 characters
- Active status: boolean for soft delete

### Error Responses
- 400 Bad Request: Validation errors (duplicate name, invalid capacity)
- 409 Conflict: Room already booked for requested time slot
- 404 Not Found: Room not found or inactive
- 422 Unprocessable Entity: Cannot deactivate room with active sessions

## Performance Considerations

### Indexing Strategy
- Composite index on `(roomId, startsAt, endsAt)` for efficient conflict detection
- Index on `active` flag for quick active room filtering
- Maintain existing indexes on `(courseSlug, startsAt)` for course-based queries

### Query Optimization
- Conflict detection uses indexed range queries
- Room listing queries leverage active flag index
- Avoid SELECT *; fetch only needed fields for lists

## Security Considerations

### Authorization
- All room endpoints protected by staff authentication
- Same staff role restrictions as existing staff APIs
- No public exposure of room management endpoints

### Data Protection
- No PII stored in room model
- Location field treated as non-sensitive facility information
- Standard Prisma query protection against injection

## Testing Approach

### Unit Tests
- Prisma model validation (constraints, defaults)
- Conflict detection logic edge cases
- API endpoint validation and error handling

### Integration Tests
- Full room CRUD lifecycle
- Conflict prevention in session creation
- Backward compatibility with legacy sessions
- Soft delete behavior and restoration

### Manual Testing Scenarios
- Creating rooms with various capacities
- Attempting double-booking prevention
- Migrating existing sessions to rooms gradually
- UI flow for room assignment during course creation

## Rollback Procedure
1. Revert Prisma schema changes (drop Room table, remove relations)
2. Remove `/app/api/staff/rooms/` API routes
3. Revert `lib/class-schedule.ts` to previous version
4. Revert UI changes in staff components
5. No data migration required as changes are additive