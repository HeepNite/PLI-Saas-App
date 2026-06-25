# Proposal: client-profile-restructure

## Intent

The client profile page (`/client-profile`) has redundant UI components and a suboptimal mobile
experience. Action buttons are buried in the right rail (hidden on mobile), there are two separate
calendar cards that serve overlapping purposes, and the analytics section doesn't adapt well to
narrow viewports. This change consolidates the calendar into a single card, surfaces action buttons
in the center column for mobile users, and optimizes the analytics layout for small screens.

## Scope

### In Scope
- Delete `AgendaCard.tsx` and merge its display into `AssignClassesCard.tsx` (web + mobile)
- Create `MobileActionCards.tsx`: mobile-only component rendering Book, Change, Suspend/Cancel, Recent requests above `StudentMomentsCard`
- Redesign `AnalyticsCard.tsx` mobile layout: 2-column stat grid + labels-left-of-donut (mobile only)
- Single PR, estimated ~350 lines touched, within 400-line review budget

### Out of Scope
- Desktop layout changes (FIRM constraint — `lg:hidden` / `hidden lg:block` pattern only)
- Right rail restructuring on desktop (stays untouched)
- Hook or API changes of any kind
- Schema or data model changes
- Refactoring unrelated profile sections

## Capabilities

### New Capabilities
- `mobile-action-cards`: Mobile-only component surfacing all booking/request actions in center column

### Modified Capabilities
- `calendar-unified`: Merges AgendaCard view into AssignClassesCard — one card owns both display and booking

## Approach

**Task order: Change 3 → Change 2 → Change 1**

### Change 1 — Unify calendars (web + mobile)
`AgendaCard` is pure display (read-only); `AssignClassesCard` owns all booking logic. Add an upper
"Scheduled classes" panel inside `AssignClassesCard` that renders the calendar grid from `AgendaCard`.
Pass `agendaState: AgendaCalendarState` as a single typed object prop (already exported from
`useAgendaCalendar.ts`) to avoid prop explosion. Delete `AgendaCard.tsx`. The unified card uses
`order-3` (was `AgendaCard`'s order).

### Change 2 — Mobile action cards above StudentMomentsCard
Create `MobileActionCards.tsx` (new, `lg:hidden`) rendered in `ProfilePageClient` between
`StudentPinCard` and `StudentMomentsCard`. It renders: Book new class + Change class (combined),
Suspend/Cancel, Recent requests — reusing the same handlers already passed to `ProfileRightRail`.
`ProfileRightRail` stays untouched; it's already hidden on mobile via the parent layout.

### Change 3 — Analytics mobile redesign (mobile-only CSS)
Two targeted layout changes inside `AnalyticsCard.tsx`, both mobile-only:
1. Stat cards (Total classes + Weekly average) → `grid grid-cols-2` instead of stacked column
2. Donut chart section → flex row with labels column to the LEFT of the ring, preserving the
   `conic-gradient` div (no SVG rewrite needed)

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `components/front/profile/sections/AssignClassesCard.tsx` | Modified | +~130 lines: agenda panel added above booking section |
| `components/front/profile/sections/AgendaCard.tsx` | Deleted | 272 lines removed |
| `components/front/profile/sections/AnalyticsCard.tsx` | Modified | ~40 lines: mobile layout only |
| `components/front/profile/sections/MobileActionCards.tsx` | New | ~70 lines: mobile action buttons |
| `components/front/profile/ProfilePageClient.tsx` | Modified | −18 (AgendaCard) + 20 (MobileActionCards) = net ~+2 lines |
| `hooks/useAgendaCalendar.ts` | No change | Still consumed by parent, passed as typed prop |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Prop explosion on unified card | Low | Group via `agendaState: AgendaCalendarState` typed object |
| Mobile popover z-index clash (AgendaCard z-30 + CalendarPicker) | Low | Different mechanisms; no overlap expected — verify visually |
| Right rail appears sparse on desktop after Change 2 | N/A | Right rail is NOT modified; desktop stays as-is |
| CSS order conflict after AgendaCard delete | Low | Unified card takes `order-3` explicitly |
| `id="assign-classes-section"` anchor broken | Low | Preserved on the merged card |

## Rollback Plan

All 3 changes are isolated to leaf components. Rollback per change:
- **Change 1**: restore `AgendaCard.tsx` from git, remove agenda panel from `AssignClassesCard`, restore `ProfilePageClient` import/render
- **Change 2**: delete `MobileActionCards.tsx`, remove its render from `ProfilePageClient`
- **Change 3**: revert `AnalyticsCard.tsx` to previous layout classes

No API, schema, or hook rollback needed — data layer is untouched.

## Dependencies

- Resolution confirmed: right rail stays untouched on desktop; `MobileActionCards` is the mobile-only addition

## Success Criteria

- [ ] Visiting `/client-profile` on mobile shows Book + Change + Suspend/Cancel + Recent requests above StudentMomentsCard
- [ ] No second calendar card on any viewport — a single unified card shows booked days AND the booking form
- [ ] Analytics stat cards appear side-by-side on mobile; donut legend renders to the left of the ring on mobile
- [ ] Desktop layout is pixel-identical to pre-change across all three sections
- [ ] No TypeScript errors introduced
- [ ] PR diff is ≤ 400 lines
