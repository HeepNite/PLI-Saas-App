# Design: Staff Fast Class Action

## Technical Approach

Add a staff-only fast action slice that reuses existing check-in concepts but avoids QR/customer endpoints. First extract terminal current-class resolution into reusable server-safe helpers. Then implement a new staff endpoint that resolves the current class, recomputes package eligibility, writes attendance/package/cash purchase changes transactionally as kiosk-source rows, and returns an optional consecutive promo offer. The staff card UI adds one adaptive button and a promo confirmation popup.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|----------|--------|-------------------------|-----------|
| Endpoint | New `POST /api/staff/students/fast-class-action` | Reuse QR package/drop-in routes; extend `staff/checkin` | QR routes are customer/kiosk-auth oriented; `staff/checkin` requires manual class input. A narrow endpoint preserves boundaries. |
| Current class | Extract reusable terminal schedule/current-class helper | Let frontend send class; duplicate logic in route | User explicitly wants terminal source of truth and no manual picker. |
| Mode | Server decides `fast_pay` vs `fast_sign_in` | Trust UI `activePackage` | UI can be stale; package credit must be authoritative at write time. |
| Balance model | Pending cash `Purchase` rows | New outstanding-balance table/field | Existing staff loaders already derive balance from open purchases. No migration needed. |
| Promo class | Popup + second request with `acceptConsecutive: true` | Create promo purchase automatically | Staff must confirm the student is staying. Separate request keeps first action safe. |

## Data Flow

```txt
StaffStudentsBoardPanel
  └─ POST /api/staff/students/fast-class-action { userId }
       ├─ authorizeStudentOperationalRequest()
       ├─ resolveCurrentTerminalClass(now ET)
       ├─ find user + course + package eligibility
       ├─ transaction: session + attendance + package or cash purchase
       └─ return result + optional promo offer

Promo modal accept
  └─ POST same endpoint { userId, acceptConsecutive: true, promo }
       └─ transaction: second session + attendance + pending promo cash purchase
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `lib/checkin/terminal-current-class.ts` | Create | Shared ET today-classes and current-class resolver. |
| `app/api/checkin/terminal/today-classes/route.ts` | Modify | Reuse shared today-class helper. |
| `components/front/staff/StaffTerminalShell.tsx` | Modify | Reuse exported current-class helper or align client logic with it. |
| `app/api/staff/students/fast-class-action/route.ts` | Create | Staff-only fast action endpoint. |
| `components/front/staff/StaffStudentsBoardPanel.tsx` | Modify | Add adaptive button, promo modal, and `Prov PIN` label. |
| `components/front/staff/staffAdminTypes.ts` | Modify | Add optional fast-action result/promo UI types if needed. |
| Tests | Modify/Create | API, helper, and UI coverage. |

## Interfaces / Contracts

```ts
type FastClassActionRequest = {
  userId: string
  acceptConsecutive?: boolean
  promo?: { linkedCourseSlug: string; linkedFromCourseSlug: string; priceCents: number }
}

type FastClassActionResponse = {
  mode: "fast_pay" | "fast_sign_in" | "promo_cash"
  attendanceId: string
  purchaseId?: string
  packagePurchaseId?: string
  outstandingBalanceAddedCents?: number
  promoOffer?: { linkedCourseSlug: string; linkedCourseTitle: string; priceCents: number }
}
```

## Transaction Boundaries

- First action transaction: session upsert, attendance upsert, package reservation OR cash purchase creation.
- Promo transaction: linked session upsert, second attendance upsert, pending cash purchase creation.
- Idempotency: detect existing attendance and matching open purchase/package usage before creating new rows.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Terminal current-class resolver | Fixed ET dates/times and multiple classes. |
| API | Fast Pay / Fast Sign / promo / auth / idempotency | Vitest route tests with Prisma mocks. |
| UI | Adaptive button and `Prov PIN` labels; promo modal accept/decline | Component tests for staff panel. |

## Migration / Rollout

No migration required. Roll out behind normal staff permissions. Existing QR and manual staff check-in flows remain unchanged.

## Open Questions

- None for v1.
