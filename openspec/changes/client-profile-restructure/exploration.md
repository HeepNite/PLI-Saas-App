# Exploration: client-profile-restructure

## Current Architecture Map

### Component → Hook → Data Flow

```
ProfilePageClient.tsx (669 lines — orchestrator)
│
├── DATA SOURCES
│   ├── useProfileBookings        → bookings[], assignablePackages[], loadBookings()
│   ├── useAgendaCalendar         → calendarDays, bookingEventsByDay, pendingBookingEventsByDay,
│   │                               nextBookedClass, mobileAgendaOpenDay, agendaMonth/Year
│   ├── useAssignClassesFlow      → assignDate, assignTime, assignAvailability, assignSlots,
│   │                               selectedPackageForAssign, submitAssignClasses()
│   ├── useRescheduleFlow         → changeModalOpen, rescheduleStep, availability,
│   │                               openChangeClassModal(), submitPrimaryReschedule()
│   ├── useActionRequestModal     → requestModalType, openRequestModal(), submitActionRequest()
│   ├── useAnalyticsChartData     → points, pathD, pieSegments, yTicks, …
│   ├── usePointsHistory          → pointsBalance, pointsEntries, loadPointsHistory()
│   ├── useActionRequests         → actionRequests, latestActionRequests, loadActionRequests()
│   ├── useProfilePackages        → packagesData, packagesSummary, activityStats, monthlyAttendance
│   └── useAvailabilityCache      → fetchAvailability(), clearAvailabilityCache()
│
├── LAYOUT — 3-column grid
│   ├── LEFT RAIL:  ProfileLeftRail
│   │
│   ├── CENTER (flex-col, gap-6):
│   │   1. ProfileFormCard
│   │   2. StudentPinCard
│   │   3. StudentMomentsCard          ← "less important" anchor
│   │   4. AnalyticsCard
│   │   5. PliCoinsCard
│   │   6. PointsHistoryCard
│   │   7. MedalsCard
│   │   8. AgendaCard                  ← view-only calendar
│   │   9. AssignClassesCard           ← booking calendar
│   │  10. GearCard
│   │
│   └── RIGHT RAIL:  ProfileRightRail
│       ├── "Book new class" card      → opens CoursePickerModal
│       ├── "Change class" card        → openChangeClassModal()
│       ├── "Suspend / Cancel" card    → openRequestModal("SUSPEND"|"CANCEL")
│       └── "Recent requests" card     → latestActionRequests[]
│
└── MODALS
    ├── RescheduleModal
    ├── ActionRequestModal
    ├── CoursePickerModal
    └── EnrollModal (dynamic)
```

### Hook dependency graph (shared state)

```
useProfileBookings
  └─ produces: bookings[], assignablePackages[]
  └─ side-sets: selectedBookingId (useState in parent), assignPackageId (useState in parent)

useAgendaCalendar
  └─ consumes: visibleBookings, pendingBookings, classRequestsByAttendance, activityStats
  └─ owns: agendaMonth, agendaYear, calendarDays, bookingEventsByDay  ← DISPLAY ONLY

useAssignClassesFlow
  └─ consumes: assignPackageId, assignablePackages, bookings, sourceCourses, todayNyDateKey
  └─ calls: fetchAvailability, clearAvailabilityCache, loadBookings, loadPointsHistory, loadActionRequests
  └─ owns: assignDate, assignTime, assignAvailability, assignSlots  ← BOOKING LOGIC

useRescheduleFlow
  └─ consumes: bookings, visibleBookings, selectedBooking, selectedBookingId
  └─ calls: fetchAvailability, clearAvailabilityCache, loadBookings, loadActionRequests

KEY INSIGHT: useAgendaCalendar and useAssignClassesFlow are completely INDEPENDENT.
They share NO state directly. Both read from visibleBookings/bookings (common source)
but each computes its own derived data without sharing refs or callbacks.
```

---

## Change 1: Unify AgendaCard + AssignClassesCard

### What AgendaCard does (pure display)
- Renders a month calendar grid with booked-day badges
- Shows pending process badges per day (color-coded by `processType`)
- Shows "Next class" label
- Shows "Processes for assigned classes" list (pending bookings)
- No write operations — read-only display

### What AssignClassesCard does (interactive booking)
- Package selector
- CalendarPicker for date selection
- Time slot grid
- "Classes to confirm" queue
- Submit → POST `/api/profile/bookings/assign`

### Merge approach
Add an upper "Scheduled classes" panel inside `AssignClassesCard` that renders the
calendar grid currently in `AgendaCard`. The component will have two visual sections:
1. **Calendar view** (month grid, day events, next-class banner) — from AgendaCard
2. **Booking panel** (package selector, CalendarPicker, slot grid, submit) — existing

The header changes to "Calendar" or "My classes" to reflect the unified purpose.

### Props analysis for merged component
`AgendaCard` introduces these new props to `AssignClassesCard`:
```
mobileAgendaOpenDay, setMobileAgendaOpenDay
agendaMonth, setAgendaMonth
agendaYear, setAgendaYear
calendarDays, agendaMonthLabel, agendaYears
bookingEventsByDay, pendingBookingEventsByDay
nextBookedClass
pendingBookings
visibleBookings
classRequestsByAttendance
```
The component prop list grows from 21 to ~34 props. This is the main risk.
**Mitigation**: pass `agendaState: AgendaCalendarState` as a single object prop (already
typed and exported from `useAgendaCalendar.ts`), plus a `visibleBookings` and
`pendingBookings` and `classRequestsByAttendance` trio. Keeps the signature sane.

### Affected files — Change 1
| File | Change |
|------|--------|
| `sections/AssignClassesCard.tsx` | Extend with agenda display section |
| `sections/AgendaCard.tsx` | DELETE |
| `ProfilePageClient.tsx` | Remove AgendaCard import/render; pass agendaState to AssignClassesCard |
| `hooks/useAgendaCalendar.ts` | No change (still consumed by parent, passed as prop) |

### Risks — Change 1
- **Prop explosion**: mitigated by grouping into `agendaState: AgendaCalendarState`
- **CSS order**: `AgendaCard` has `order-3`, `AssignClassesCard` has `order-4`. After merge, use `order-3` on the unified card.
- **Mobile popover z-index**: `AgendaCard`'s mobile day popup (`z-30`) needs to coexist with `CalendarPicker` — both are in the same card. No clash expected (CalendarPicker uses a different mechanism).
- **`id="assign-classes-section"`** on AssignClassesCard — preserved since it may be used by external anchors.
- No data flow risk: hooks are independent.

### Estimated lines — Change 1
- Delete: 272 lines (AgendaCard.tsx)
- Modify AssignClassesCard.tsx: +~130 lines (agenda section)
- Modify ProfilePageClient.tsx: −18 lines (AgendaCard JSX block + import)
- **Net**: −160 lines, 2 files modified + 1 deleted

---

## Change 2: Reorder action cards above StudentMomentsCard

### Current center column order
```
1. ProfileFormCard
2. StudentPinCard
3. StudentMomentsCard   ← "less important" anchor
4. AnalyticsCard
5. PliCoinsCard
6. PointsHistoryCard
7. MedalsCard
8. AgendaCard (→ merged into AssignClassesCard after Change 1)
9. AssignClassesCard
10. GearCard
```

### Current right rail order
```
A. Book new class
B. Change class
C. Suspend / Cancel
D. Recent requests
```

### Target
- Move Book + Change class into ONE combined card, placed in the CENTER column above `StudentMomentsCard`
- `Suspend / Cancel` and `Recent requests` can stay in right rail OR move — clarify with user
- Right rail is a 15rem sticky column; moving all 4 cards to center would leave it empty

**Interpretation from brief**: "These should move ABOVE StudentMomentsCard and the other less important cards in the center column" + "Book and Change class should be in the same card."

**Most likely intent**: a new `ActionActionsCard` component in the CENTER column, positioned between `StudentPinCard` and `StudentMomentsCard`, containing merged Book+Change buttons. Suspend/Cancel and Recent requests stay in right rail OR get demoted.

### Affected files — Change 2
| File | Change |
|------|--------|
| `ProfilePageClient.tsx` | Add new card between StudentPinCard and StudentMomentsCard; pass required props |
| `sections/ProfileRightRail.tsx` | Remove Book + Change class cards; possibly keep Suspend/Cancel + Recent |
| `sections/ActionActionsCard.tsx` | NEW: combined Book + Change card (~60 lines) |

**Risks — Change 2**
- The right rail currently has 4 cards filling the sticky 15rem column. After removing 2 cards it becomes sparse. Needs design decision: does right rail disappear or show Suspend/Cancel + Requests only?
- `openChangeClassModal` relies on `selectedBooking` being set (from `useRescheduleFlow`). Moving the button to center column just means passing the same props there — no logic change.
- `onOpenCoursePicker` triggers CoursePickerModal → EnrollModal chain. No structural risk.

**Estimated lines — Change 2**
- New ActionActionsCard.tsx: ~70 lines
- Modify ProfilePageClient.tsx: +20 lines (new card render + props)
- Modify ProfileRightRail.tsx: −40 lines (remove Book + Change sections)
- **Net**: +50 lines, 1 new file, 2 files modified

---

## Change 3: Analytics card mobile redesign

### Current layout (AnalyticsCard.tsx)
```
Row 1 (lg:grid-cols-[0.65fr_2.75fr_0.85fr]):
  Col A: "Total classes" stat card + "Weekly average" stat card (stacked vertically)
  Col B: Line chart (last 4 months)
  Col C: Donut chart + legend list (separate sub-cards)
```

On mobile: cols stack to single column → A is full-width, then B, then C.

### Target changes
1. **"Total classes" + "Weekly average" in 2 columns** (more compact)
   - Currently: `space-y-3 h-full flex flex-col` with two stacked cards
   - Change: `grid grid-cols-2 gap-3` — they sit side by side always, not just on large screens
   
2. **Distribution chart legend inline to the left** of each segment ring slice
   - Currently: Pie chart in one sub-card, legend list (`pieSegments.map`) in a separate sub-card below it
   - Target: Labels rendered inline alongside the donut (like a legend overlaid or positioned left of the ring)
   - Implementation: Replace the two separate sub-cards in Col C with a single card that places labels on the left of the SVG donut. Each label gets an `absolute` or `flex` positioning to align left of its arc segment.

### Affected files — Change 3
| File | Change |
|------|--------|
| `sections/AnalyticsCard.tsx` | Layout-only changes, no prop/hook changes |

### Risks — Change 3
- **Purely CSS/layout** — no hook or data changes
- The donut is implemented as `conic-gradient` on a div, not an SVG. Segment labels aren't computed geometrically — they just list segments. "Inline to the left" needs a design decision: are labels positioned as a vertical list to the left of the ring, or overlaid at each arc? The `conic-gradient` approach doesn't expose arc midpoints, so true "per-slice" inline positioning requires either switching to SVG arcs (bigger change) or rendering labels as a vertically-distributed column adjacent to the ring.
- **Recommended approach**: render labels as a column to the LEFT of the donut circle (flex row: labels col + donut col), keeping `conic-gradient`. This is safe and visually achieves "inline" appearance without rewriting the chart.

**Estimated lines — Change 3**
- Modify AnalyticsCard.tsx: ~40 lines changed (layout restructure in Col A and Col C)
- **Net**: ~40 lines modified, 1 file

---

## Summary Table

| Change | Files affected | New files | Deleted files | Lines Δ | Risk |
|--------|---------------|-----------|---------------|---------|------|
| 1: Unify calendars | 2 modified | 0 | 1 (AgendaCard.tsx) | −160 | Low — hooks independent |
| 2: Reorder action cards | 2 modified | 1 | 0 | +50 | Low-Med — right rail becomes sparse |
| 3: Analytics mobile | 1 modified | 0 | 0 | ~40 | Low — layout only |
| **Total** | **5 modified** | **1** | **1** | **~−70** | **Low** |

---

## Estimated Total Lines Changed

~350 lines touched across 6 file operations. No new API endpoints, no schema changes, no hook logic changes.

---

## Blockers

**None that prevent starting.** One ambiguity to resolve before Change 2:

> **OPEN QUESTION**: After moving Book + Change into the center column, what stays in the right rail?
> Options:
> a) Right rail keeps only "Suspend/Cancel" + "Recent requests"
> b) Right rail becomes empty and is hidden on desktop (grid changes to 2-column)
> c) "Suspend/Cancel" also moves to center, right rail only keeps "Recent requests"
>
> This must be decided before implementing Change 2 to avoid layout thrash.

---

## Recommendation: Implement as ONE change or split?

**Recommended: implement as 3 sequential tasks in one change**, not split into separate changes. Reasons:
- All 3 touch the same parent (`ProfilePageClient.tsx`) — splitting creates merge conflicts
- No task depends on another (parallel-safe), but they share the same parent render tree
- Total scope is modest (~350 lines) — well within a single focused PR

**Suggested task order**: 3 → 2 → 1  
(Analytics first: pure CSS, safest warm-up. Action cards second: defines right rail shape. Calendar merge last: largest structural change.)

---

## Ready for Proposal

**Yes** — pending resolution of the one open question about the right rail after Change 2.
