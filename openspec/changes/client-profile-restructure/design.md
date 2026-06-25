# Design: client-profile-restructure

## Technical Approach

Three isolated, leaf-level UI changes inside `components/front/profile/`. No hooks, no API, no schema, no Prisma. All layout deltas are mobile-only via `lg:hidden` / `hidden lg:block`, so desktop renders pixel-identical to the current build.

The existing data graph is preserved: `ProfilePageClient` keeps owning every hook call and state value. Two structural moves:

1. `AgendaCard.tsx` is removed and its presentational JSX is folded into `AssignClassesCard.tsx`. State flows via one typed object — `agendaState: AgendaCalendarState` — already exported from `useAgendaCalendar.ts`, eliminating the 13-prop fan-out.
2. A new `MobileActionCards.tsx` (mobile-only) reuses the *same callbacks* already passed to `ProfileRightRail` (`onOpenCoursePicker`, `onOpenChangeClassModal`, `onOpenRequestModal`). The right rail itself is not touched — it's already hidden under `lg`.

Change 3 is purely a Tailwind class swap inside `AnalyticsCard.tsx`. The conic-gradient donut stays — only its surrounding flex/grid wrappers change at the mobile breakpoint.

## Architecture Decisions

| Decision | Choice | Alternatives rejected | Rationale |
|---|---|---|---|
| Calendar state passing | Single typed prop `agendaState: AgendaCalendarState` | (a) Spread 13 individual props like AgendaCard does today; (b) move `useAgendaCalendar()` inside `AssignClassesCard` | (a) Triples the prop surface; (b) breaks the rule "no hook changes" and detaches state from `ProfilePageClient` where bookings live. The typed object already exists in `useAgendaCalendar.ts` — zero new types. |
| Mobile action cards composition | New leaf component `MobileActionCards.tsx` | (a) Extract a shared `<ActionCardsList>` consumed by both rail and mobile; (b) duplicate JSX inline in `ProfilePageClient` | (a) Touches `ProfileRightRail` and risks desktop visual diff; (b) inflates `ProfilePageClient` and scatters action UI. A separate `lg:hidden` leaf keeps desktop untouched and isolates rollback to one file. |
| Callback wiring for mobile actions | Pass the SAME handler refs `ProfilePageClient` already passes to `ProfileRightRail` | (a) Context provider; (b) new hook that returns action handlers | All handlers already exist as stable refs in `ProfilePageClient`. Adding context or a hook violates "no new hooks". |
| Analytics mobile layout | CSS-only: mutate Tailwind classes inside `AnalyticsCard.tsx` (responsive variants) | (a) Two separate components (`AnalyticsCardDesktop` / `AnalyticsCardMobile`); (b) extract a `<DonutBlock>` subcomponent | (a) Duplicates 277 lines including the SVG line chart; (b) unnecessary for ~40 lines of class changes. Responsive classes keep desktop bytes identical. |
| Donut chart at mobile | Keep `conic-gradient` div; flip wrapper to `flex-row` with labels left, donut right | Rewrite donut as SVG arcs to allow per-slice geometric label placement | Proposal already excludes SVG rewrite. Conic-gradient + labels column is visually equivalent and within scope. |
| Order class after AgendaCard deletion | Unified `AssignClassesCard` takes `order-3` (was AgendaCard); other cards unchanged | Re-number every order class | Minimal diff. `order-3` opens up; `order-4` (current AssignClassesCard) is the same slot semantically. `MobileActionCards` uses `order-[1.75]` (Tailwind arbitrary value) to slot between `StudentPinCard` (`order-[1.5]`) and `StudentMomentsCard` (`order-2`) without touching either. |
| Anchor preservation | `id="assign-classes-section"` stays on unified card | Move id, or duplicate id | Anchor is referenced from elsewhere; keeping it on the same DOM node (now also rendering agenda above it) preserves scroll targets. |

## Data Flow

```
ProfilePageClient
├─ useAgendaCalendar(...)         ──► agendaState: AgendaCalendarState
├─ useAssignClassesFlow(...)      ──► assign* props
├─ useRescheduleFlow(...)         ──► openChangeClassModal
├─ useActionRequestModal(...)     ──► openRequestModal
└─ useProfileBookings(...)        ──► selectedBooking, bookingsLoading, bookingsError

                     ┌──────────────────────────────┐
                     │  AssignClassesCard           │ order-3
                     │  ┌────────────────────────┐  │
                     │  │ Scheduled classes      │  │ ← agendaState (Change 1)
                     │  │ (former AgendaCard)    │  │
                     │  └────────────────────────┘  │
                     │  ┌────────────────────────┐  │
                     │  │ Booking form           │  │ ← assign* props (unchanged)
                     │  └────────────────────────┘  │
                     └──────────────────────────────┘

   lg:hidden ──► MobileActionCards   order-[1.75]
                 ├─ Book (onOpenCoursePicker)
                 ├─ Change (onOpenChangeClassModal, selectedBooking)
                 ├─ Suspend/Cancel (onOpenRequestModal)
                 └─ Recent requests (latestActionRequests)

   hidden lg:block ──► ProfileRightRail  (UNTOUCHED)
                       └─ same 4 cards on desktop
```

Both `MobileActionCards` and `ProfileRightRail` consume the SAME handler refs from `ProfilePageClient`. No state duplication, no second copy of bookings/requests data.

## File Changes

| File | Action | Description |
|---|---|---|
| `components/front/profile/sections/AssignClassesCard.tsx` | Modify | Add `agendaState: AgendaCalendarState`, `pendingBookings`, `visibleBookings`, `classRequestsByAttendance` props. Render a new "Scheduled classes" panel (calendar grid + next-class summary + pending processes + empty-state banner) above the existing booking form. Change `order-4` → `order-3`. Keep `id="assign-classes-section"`. |
| `components/front/profile/sections/AgendaCard.tsx` | Delete | All display logic moves into `AssignClassesCard`. 272 lines removed. |
| `components/front/profile/sections/MobileActionCards.tsx` | Create | New `lg:hidden`, `order-[1.75]` component. Props: `onOpenCoursePicker`, `onOpenChangeClassModal`, `onOpenRequestModal`, `selectedBooking`, `bookingsLoading`, `bookingsError`, `requestSubmitError`, `requestSubmitSuccess`, `requestModalType`, `actionRequestsError`, `actionRequestsLoading`, `latestActionRequests`. Renders the same four card bodies as `ProfileRightRail` but stacked for mobile. |
| `components/front/profile/sections/AnalyticsCard.tsx` | Modify | Mobile-only Tailwind class changes: (a) left stats column `space-y-3 h-full flex flex-col` → `grid grid-cols-2 gap-3 lg:flex lg:flex-col lg:space-y-3 lg:h-full`; (b) right donut+legend column changes from stacked column to mobile `flex flex-row gap-3` with legend left, donut right; (c) inner `lg:` variants preserve desktop layout. No SVG / no JS / no prop changes. |
| `components/front/profile/ProfilePageClient.tsx` | Modify | Remove `AgendaCard` import + render block (-18 lines). Add `MobileActionCards` import + render between `StudentPinCard` and `StudentMomentsCard` (+12 lines). Pass `agendaState`, `pendingBookings`, `visibleBookings`, `classRequestsByAttendance` to `AssignClassesCard` (+8 lines). No hook calls added or removed. |
| `components/front/profile/sections/ProfileRightRail.tsx` | No change | Stays exactly as-is. Already invisible at mobile via parent grid layout. |
| `components/front/profile/hooks/useAgendaCalendar.ts` | No change | Still called by `ProfilePageClient`; `AgendaCalendarState` is now consumed inside `AssignClassesCard`. |

## Interfaces / Contracts

### Change 1 — AssignClassesCard new props (additive)

```ts
import type { AgendaCalendarState } from "../hooks/useAgendaCalendar"
import type { ActionRequestItem, BookingItem } from "../profile-types"

type AssignClassesCardProps = {
  // ... existing props unchanged ...

  // NEW (Change 1)
  agendaState: AgendaCalendarState
  pendingBookings: BookingItem[]
  visibleBookings: BookingItem[]
  classRequestsByAttendance: Map<string, ActionRequestItem>
}
```

### Change 2 — MobileActionCards signature

```ts
import type { ActionRequestItem, ActionRequestType, BookingItem } from "../profile-types"

type MobileActionCardsProps = {
  onOpenCoursePicker: () => void
  onOpenChangeClassModal: () => void
  onOpenRequestModal: (type: ActionRequestType) => void
  selectedBooking: BookingItem | null
  bookingsLoading: boolean
  bookingsError: string | null
  requestSubmitError: string | null
  requestSubmitSuccess: string | null
  requestModalType: ActionRequestType | null
  actionRequestsError: string | null
  actionRequestsLoading: boolean
  latestActionRequests: ActionRequestItem[]
}

export function MobileActionCards(props: MobileActionCardsProps): JSX.Element
// Root: <section className="order-[1.75] flex flex-col gap-4 lg:hidden">...</section>
```

All prop names mirror `ProfileRightRailProps` exactly — `ProfilePageClient` passes the same identifiers, just to a second consumer.

### Change 3 — Analytics responsive class map (mobile-only mutations)

```
Left stats column (line 82):
  CURRENT:  className="space-y-3 h-full flex flex-col"
  NEW:      className="grid grid-cols-2 gap-3 lg:flex lg:flex-col lg:space-y-3 lg:gap-0 lg:h-full"

Right donut+legend column (line 237):
  CURRENT:  className="space-y-3 h-full flex flex-col"
  NEW:      className="flex flex-row gap-3 lg:flex-col lg:space-y-3 lg:gap-0 lg:h-full"

Legend card (line 259):
  CURRENT:  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
  NEW:      className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 order-first lg:order-none lg:flex-none"

Donut card (line 238):
  add: lg:flex-1  flex-1 already implicit on desktop via parent flex-col
  add: order: none mobile, ensure ratio works  → no class change needed if legend gets order-first
```

Net: ~6 className edits, ~40 lines diff including formatting.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Visual / Manual | Desktop ≥ 1024px pixel-identical | Side-by-side screenshot at `lg`: `/client-profile` before vs after — center column, right rail, and analytics card MUST match |
| Visual / Manual | Mobile < 1024px restructure | Take screenshots at 390px width: confirm (a) one unified calendar card, (b) Book/Change/Suspend/Recent above StudentMomentsCard, (c) 2-col analytics stats + labels-left donut |
| Type | No TS errors | `pnpm tsc --noEmit` (or project equivalent) — new prop shapes must compile |
| Lint | No lint regressions | `pnpm lint` |
| Functional | Calendar still navigates months | Click ‹ / › / Today inside unified card — `setAgendaMonth`/`setAgendaYear` should still update via `agendaState` |
| Functional | Mobile action buttons open the same modals | Tap each of the 3 action buttons on mobile, confirm same modals open as on desktop right rail |
| Functional | `assign-classes-section` anchor still scrolls | Verify any link to `#assign-classes-section` still scrolls to the unified card |
| E2E (if covered) | Existing profile booking flow unchanged | Run whatever Playwright spec covers `/client-profile` booking + reschedule + suspend — none of those flows touch deleted code paths |

No new test files are required by the proposal. If the existing test suite has a snapshot for `ProfilePageClient`, update it once.

## Migration / Rollout

Single PR, ~350 lines. No data migration, no feature flag, no schema. Per-change rollback is `git revert` on the matching commit — proposal already documents this.

Recommended commit order (matches proposal task order):
1. Change 3 (AnalyticsCard CSS) — smallest, lowest risk, isolated
2. Change 2 (MobileActionCards new + ProfilePageClient wire-up) — additive only
3. Change 1 (Calendar merge — delete AgendaCard, modify AssignClassesCard + ProfilePageClient)

## Open Questions

- None blocking. Proposal already resolved the right-rail question (stays untouched).
- Soft check during implementation: confirm `order-[1.75]` resolves correctly under the project's Tailwind version. If the arbitrary value misbehaves, fall back to `order-2` on `MobileActionCards` and bump `StudentMomentsCard` from `order-2` to `order-[2.5]` — 1-line swap, still mobile-scoped.
