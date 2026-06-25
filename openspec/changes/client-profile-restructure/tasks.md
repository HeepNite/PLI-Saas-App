# Tasks: Client Profile Restructure

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 280-350 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-always |
| Chain strategy | Not needed |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: Not needed
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Complete client profile restructure | PR 1 | Single component changes; mobile-only layout; tests/verification included |

## Phase 1: Analytics Mobile Optimization (Change 3)

- [x] 1.1 Modify `components/front/profile/sections/AnalyticsCard.tsx` line 82 - change left stats className from `space-y-3 h-full flex flex-col` to `grid grid-cols-2 gap-3 lg:flex lg:flex-col lg:space-y-3 lg:gap-0 lg:h-full`
- [x] 1.2 Modify `components/front/profile/sections/AnalyticsCard.tsx` line 237 - change right donut+legend className from `space-y-3 h-full flex flex-col` to `flex flex-row gap-3 lg:flex-col lg:space-y-3 lg:gap-0 lg:h-full`
- [x] 1.3 Modify `components/front/profile/sections/AnalyticsCard.tsx` line 259 - change legend card className from `rounded-2xl border border-white/10 bg-white/5 px-4 py-3` to `flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 order-first lg:order-none lg:flex-none`
- [x] 1.4 Test analytics mobile layout at 390px width - verify 2-column stats grid and labels-left donut positioning

## Phase 2: Mobile Action Cards Creation (Change 2)

- [x] 2.1 Create new file `components/front/profile/sections/MobileActionCards.tsx` with MobileActionCardsProps interface mirroring ProfileRightRailProps
- [x] 2.2 Implement MobileActionCards component with root section className `order-[1.75] flex flex-col gap-4 lg:hidden`
- [x] 2.3 Add Book/Change class combined card in MobileActionCards using onOpenCoursePicker and onOpenChangeClassModal callbacks
- [x] 2.4 Add Suspend/Cancel card in MobileActionCards using onOpenRequestModal callback
- [x] 2.5 Add Recent requests card in MobileActionCards using latestActionRequests prop
- [x] 2.6 Import MobileActionCards in `components/front/profile/ProfilePageClient.tsx`
- [x] 2.7 Add MobileActionCards render between StudentPinCard and StudentMomentsCard in ProfilePageClient
- [x] 2.8 Pass all required props to MobileActionCards: onOpenCoursePicker, onOpenChangeClassModal, onOpenRequestModal, selectedBooking, bookingsLoading, bookingsError, requestSubmitError, requestSubmitSuccess, requestModalType, actionRequestsError, actionRequestsLoading, latestActionRequests
- [x] 2.9 Test mobile action cards display at mobile viewport - verify lg:hidden works and buttons trigger modals

## Phase 3: Calendar Unification (Change 1)

- [x] 3.1 Modify `components/front/profile/sections/AssignClassesCard.tsx` - add new props: agendaState: AgendaCalendarState, pendingBookings: BookingItem[], visibleBookings: BookingItem[], classRequestsByAttendance: Map<string, ActionRequestItem>
- [x] 3.2 Import AgendaCalendarState type and ActionRequestItem, BookingItem types in AssignClassesCard.tsx
- [x] 3.3 Add "Scheduled classes" panel above booking form in AssignClassesCard - render calendar grid, next-class summary, pending processes, and empty-state banner using agendaState
- [x] 3.4 Change order className in AssignClassesCard from `order-4` to `order-3`
- [x] 3.5 Preserve `id="assign-classes-section"` on AssignClassesCard root element
- [x] 3.6 Remove AgendaCard import from `components/front/profile/ProfilePageClient.tsx`
- [x] 3.7 Remove AgendaCard render block from ProfilePageClient.tsx (approximately -18 lines)
- [x] 3.8 Pass agendaState, pendingBookings, visibleBookings, classRequestsByAttendance props to AssignClassesCard in ProfilePageClient.tsx
- [x] 3.9 Delete file `components/front/profile/sections/AgendaCard.tsx` (272 lines)
- [x] 3.10 Test calendar navigation in unified card - verify month/year navigation via agendaState still works
- [x] 3.11 Test anchor scroll - verify links to #assign-classes-section still scroll to unified card

## Phase 4: Testing & Verification

- [x] 4.1 Run TypeScript compilation - `pnpm tsc --noEmit` to verify no TS errors from new prop interfaces
- [x] 4.2 Run linting - `pnpm lint` to verify no new lint issues
- [ ] 4.3 Take desktop screenshots at ≥1024px width - verify ProfileRightRail and center column are pixel-identical to before
- [ ] 4.4 Take mobile screenshots at 390px width - verify unified calendar, mobile action cards positioning, and 2-column analytics
- [ ] 4.5 Manual test mobile action buttons - tap Book, Change, Suspend, Recent buttons and verify same modals open
- [ ] 4.6 Manual test calendar functionality - click previous/next month, today button, verify state updates correctly
- [x] 4.7 Update any existing ProfilePageClient test snapshots if they exist