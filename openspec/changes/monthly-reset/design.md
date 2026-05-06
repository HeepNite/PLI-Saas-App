# Design: Monthly Reset

## Technical Approach

Non-destructive query scoping. Three board metrics (`completedClassesByUser`, `totalCollectedCents`, today-mode attendance list) get filtered by the **current month boundary in America/New_York**. Package credits, points, overrides clearing logic, and history mode follow the existing all-time / range-based patterns. Adds one Prisma model (`MonthlyBoundary`), one helper module (`lib/monthly-boundary.ts`), one admin endpoint (`/api/admin/month-close`), one report endpoint (`/api/staff/reports/monthly`), and UI dividers in `StaffUsersAdminClient.tsx`. Cron is documented but deferred.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|---|---|---|---|
| Reset model | `MonthlyBoundary` table (audit row per close) | Snapshot copies; recompute from `closedAt` only | Audit trail + idempotent upsert + future cron parity. No data duplication. |
| Month boundary source | Computed `getMonthBoundariesNY(year, month)` from current date if no row; row only marks "closed" | Always read from DB | Board works on day 1 of a new month with zero rows. DB row is the **closure event**, not the boundary itself. |
| Helpers location | New `lib/monthly-boundary.ts` | Add to `lib/class-schedule.ts` | Schedule file is already 255 lines and scoped to sessions. New domain → new module. Reuses `getStartOfDayNY` from class-schedule. |
| Scoping the 3 queries | Add `gte: monthStart, lte: monthEnd` to `attendance.groupBy` (completedClasses), filter `globalPurchases` by `metadata.date >= YYYY-MM-01` with `createdAt` fallback when metadata.date is missing, and use the same window for the today-mode `slotAttendances` aggregate | Subquery; raw SQL | Matches existing patterns (see `historyRange` filter L210-218 of payments/route.ts). Zero new query shape. |
| What is NEVER scoped | `pointsLedger.groupBy` (points), `packagePurchase.findMany` (credits), `completedClassesOverride` / `packageClassesUsedOverride` reads | — | Per proposal scope. Overrides are **all-time corrections**; only **cleared on close**, never filtered. |
| Cross-month history grouping | Server returns existing flat list; client groups by `YYYY-MM` of `classDate \|\| createdAt` and renders dividers | Server-side `groupBy` response shape | History endpoint already returns flat `items` consumed by many existing UI paths. Adding server grouping = breaking change. |
| Card aggregation across months | `buildHistoryStudentCard` already sums across all payments in the slice — no change needed | Per-month card splits | Proposal explicitly says "sum completed classes across months" for cross-month student cards. |
| Reports endpoint | New `/api/staff/reports/monthly` runs **dedicated DB queries** for the selected (year, month). In-memory data on the client is NOT used. | Reuse client `reportsData` | Client `reportsData` is built from board's bounded slice (truncated, filtered). For a true monthly report we need raw DB access. |
| CSV generation | Manual string builder, in-memory, mirroring `audit-log/export/route.ts` (`csvEscape` + `Content-Type: text/csv`) | `csv-stringify` lib; streaming | Existing convention. Monthly report ≤ 10k rows → in-memory is fine. No new dependency. |
| Excel | **Deferred**. CSV only in v1. | Add `exceljs` | Avoids new dep + lockfile churn. CSV opens in Excel natively. |
| Month-close security | `authorizeOwnerOrAdminRequest()` (existing) + rate limit + writes `studentDataAudit` per cleared override | Owner-only via custom check | Same gate as the audit log export — owner/admin is the established admin tier. |
| Idempotency of close | Prisma `upsert` on `MonthlyBoundary` `@@unique([year, month])`. Override clears use `updateMany ... where: { NOT: null }` so re-running is a no-op. | Reject if already closed | Allows re-running close after partial failure. Audit rows still emitted only when value was non-null (filtered before update). |
| Cron strategy | **Deferred but stubbed**. `/api/cron/month-close` route documented; reuses the same close service function. `vercel.json` not added in this change. | Build cron now | Out of scope per proposal. The route handler factor-out (`runMonthClose(year, month, actor)`) makes future cron a 10-line wrapper. |

## Data Flow

```
Board fetch (today mode)
  ┌─ getCurrentMonthBoundariesNY()  → { start, end, year, month }
  ↓
  payments/route.ts
    completedAttendances groupBy   → WHERE checkedInAt BETWEEN start..end
    purchase findMany (today)      → unchanged (today-only window)
    globalPurchases findMany       → adds metadata.date >= YYYY-MM-01 filter
                                       fallback: createdAt >= start
    pointsLedger groupBy           → unchanged (all-time)
    packagePurchase findMany       → unchanged (all-time, status=active)

Close month (admin)
  ┌─ POST /api/admin/month-close { year, month, notes? }
  ↓
  authorizeOwnerOrAdminRequest → rate-limit → tx:
     1. upsert MonthlyBoundary { year, month, closedAt: now, closedByClerkId }
     2. user.updateMany WHERE override IS NOT NULL → null + audit row each

Monthly report
  POST /api/staff/reports/monthly { year, month }
  → DB queries scoped to month boundaries → CSV stream
```

## File Changes

| File | Action | Description |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `MonthlyBoundary` model with `@@unique([year, month])`. Additive only. |
| `prisma/migrations/<ts>_add_monthly_boundary/migration.sql` | Create | Auto-generated by `prisma migrate dev`. |
| `lib/monthly-boundary.ts` | Create | `getMonthBoundariesNY(year, month)`, `getCurrentMonthBoundariesNY()`, `formatMonthKey(date)`, `runMonthClose(year, month, actor, notes?)`. |
| `app/api/staff/payments/route.ts` | Modify | Apply month filter to `completedAttendances` groupBy, `globalPurchases` findMany, today-mode `slotAttendances` aggregate. No history-mode changes. |
| `components/front/staff/historyCardAggregates.ts` | Modify | Add optional `currentMonthKey` parameter to filter `totalCollectedCents` / `checkedInPayments` to current month for daily-view cards (history view stays all-range). |
| `components/front/staff/StaffUsersAdminClient.tsx` | Modify | History mode: group `items` by `YYYY-MM` and render `<MonthDivider />`. Reports panel: add "Generate monthly report" button + month picker calling new endpoint. Add "Close month" button (owner/admin only) with confirmation. |
| `components/front/staff/MonthDivider.tsx` | Create | Small presentational component: sticky-ish header with month label. |
| `app/api/admin/month-close/route.ts` | Create | POST endpoint, owner/admin gate, calls `runMonthClose`. |
| `app/api/staff/reports/monthly/route.ts` | Create | GET endpoint, staff "students" section gate, returns CSV. |
| `tests/api/admin-month-close.test.ts` | Create | Idempotency, override clearing, audit emission, auth gate. |
| `tests/api/staff-reports-monthly.test.ts` | Create | CSV shape, month-scoped row counts, auth. |
| `tests/lib/monthly-boundary.test.ts` | Create | Boundary correctness across DST (March, November). |

## Interfaces / Contracts

```prisma
model MonthlyBoundary {
  id              String    @id @default(cuid())
  year            Int
  month           Int       // 1–12
  closedAt        DateTime  @default(now())
  closedByClerkId String?
  notes           String?
  createdAt       DateTime  @default(now())

  @@unique([year, month])
  @@index([closedAt])
}
```

```ts
// lib/monthly-boundary.ts
export type MonthBoundary = { start: Date; end: Date; year: number; month: number; key: string /* "YYYY-MM" */ }

export function getMonthBoundariesNY(year: number, month: number): MonthBoundary
export function getCurrentMonthBoundariesNY(now?: Date): MonthBoundary
export function formatMonthKey(date: Date): string  // "YYYY-MM" in NY tz

export type MonthCloseActor = { clerkId: string; name: string | null }
export async function runMonthClose(
  year: number,
  month: number,
  actor: MonthCloseActor,
  notes?: string,
): Promise<{ boundaryId: string; clearedOverrides: number }>
```

```ts
// POST /api/admin/month-close
// Request:  { year: number; month: number; notes?: string }
// Response: 200 { boundaryId, clearedOverrides } | 401 | 403 | 429 | 409 (already closed today)

// GET /api/staff/reports/monthly?year=2026&month=5
// Response: text/csv with sections: Summary, Top courses, Channels, Per-student totals
```

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | `getMonthBoundariesNY` across DST transitions (Mar 9, Nov 2 windows) | Vitest table tests; assert UTC offsets |
| Unit | `runMonthClose` clears non-null overrides only and emits audit per row | Mock prisma tx |
| Integration | Board endpoint returns scoped completedClasses & totalCollected | Seed: attendances Apr + May, query in May → only May counts |
| Integration | History endpoint still returns full range (unchanged) | Range Apr 1 – May 31 returns all |
| Integration | Month-close idempotency: run twice, second call clears 0 | Vitest + prisma test client |
| Integration | Monthly report CSV row count matches month-scoped DB rows | Seed + GET + parse CSV |
| Auth | Month-close rejects non-owner/admin | Existing `authorizeOwnerOrAdminRequest` test pattern |
| UI smoke | Cross-month history shows dividers | Component test with mocked items |

## Migration / Rollout

1. `prisma migrate dev -n add_monthly_boundary` — additive table, zero risk.
2. Deploy. Board metrics immediately scope to current month. **No initial seed needed** — `MonthlyBoundary` row is created **only when staff explicitly closes a month**. Boundaries for unclosed months are computed from the calendar.
3. Document "Close month" workflow in staff guide.
4. Cron follow-up: separate change `monthly-reset-cron` — 1st of month 00:05 NY runs `runMonthClose(prevYear, prevMonth, system)`.

## Open Questions

- [ ] Q1: Should the monthly report CSV include points balances (snapshot at end-of-month) or omit (since points are not month-scoped)? **Recommendation**: omit from row totals; show as info column only.
- [ ] Q2: Cross-month student card "completed classes" — current proposal says sum across months. Confirm UI label so it doesn't read as "May completed" when range spans Apr–May. **Recommendation**: label "Completed (range)".
- [ ] Q3: When a previously-closed month's report is regenerated, do we lock numbers as of close, or recompute live? **Recommendation**: always recompute live; close only clears overrides + marks closure.
