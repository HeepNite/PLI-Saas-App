# Proposal: Monthly Reset

**Change**: `monthly-reset`  
**Date**: 2026-05-02  
**Status**: Ready for spec

---

## Intent

Student card stats (attendances, completed classes, amount paid) currently aggregate all-time with no month concept. Staff need each new month to start at 0 for those three metrics, while preserving points and package credits. History viewing and a proper server-side monthly report are also required.

---

## Scope

### In Scope
- Add `MonthlyBoundary` schema model to anchor month boundaries
- Month-scope attendance and amount-paid queries in the daily board (`/api/staff/payments`)
- `historyCardAggregates.ts` month-scoped card totals for the daily view
- "Close month" button + `/api/admin/month-close` endpoint (clears overrides, inserts boundary row)
- Cross-month range: month dividers in history UI when range spans multiple months
- Cross-month student card: sum completed classes across months
- Server-side `/api/staff/reports/monthly` endpoint (query from DB, not in-memory board data)
- Monthly report export as CSV (Excel/XLSX as optional add-on — needs new dependency decision)
- Clear `completedClassesOverride` / `packageClassesUsedOverride` on month close

### Out of Scope
- Vercel Cron auto-close (follow-up — no cron infra exists yet)
- Resetting points (cumulative, never reset)
- Resetting package credits / `remainingCredits` (deplete globally until exhausted)
- Any data deletion or archival
- Snapshot-based approach (rejected in exploration)
- Drop-in data from previous months appearing in the daily board

---

## Capabilities

### New Capabilities
- `monthly-boundary`: `MonthlyBoundary` model + month-close API + clear-override logic
- `monthly-board-scoping`: Board queries filtered to current month boundary
- `monthly-history-display`: Cross-month range dividers + card aggregation in history mode
- `monthly-reports`: Server-side report endpoint + CSV export

### Modified Capabilities
- None — no existing `openspec/specs/` found; all capabilities are net-new

---

## Approach

**Non-Destructive Query Scoping (Option A):**

- Add `MonthlyBoundary { year, month, closedAt, closedByClerkId, notes }` with `@@unique([year, month])`
- "Reset" = board queries gain `checkedInAt >= start_of_current_month` and `metadata.date >= start_of_current_month` filters
- "Close month" = `POST /api/admin/month-close` → upsert `MonthlyBoundary` row + clear `User.completedClassesOverride` / `User.packageClassesUsedOverride` for all users
- History mode unchanged — already date-range filtered via `metadata.date`
- Cross-month dividers = client-side grouping in `StaffUsersAdminClient.tsx` after data is fetched
- Monthly report = new server endpoint that queries DB directly for a given `year/month`, returns JSON consumed by CSV exporter

---

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | New | `MonthlyBoundary` model + migration |
| `app/api/staff/payments/route.ts` | Modified | Add month boundary filter to attendance + payment queries |
| `components/front/staff/historyCardAggregates.ts` | Modified | Month-scope card aggregates for daily view |
| `components/front/staff/StaffUsersAdminClient.tsx` | Modified | Month dividers in history; reports UI uses server endpoint |
| `app/api/admin/month-close/route.ts` | New | Close month endpoint: upsert boundary + clear overrides |
| `app/api/staff/reports/monthly/route.ts` | New | Server-side monthly report: full DB query for year/month |

---

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Some Purchases lack `metadata.date` (cash entries) | Med | Fall back to `createdAt`; audit missing-date rows in migration |
| `completedClassesOverride` semantics change on month close | Med | Clear on close + audit log entry; spec override behavior per-month |
| In-memory report data doesn't reflect full month | High | Replace with server endpoint (in scope) |
| XLSX dependency decision | Low | Default to CSV; XLSX deferred unless explicitly requested |
| Package credit deduction spans months | Low | Credits are never scoped — no change needed, verified in exploration |

---

## Rollback Plan

- `MonthlyBoundary` rows can be deleted; queries fall back to all-time (or introduce a "no boundary = current month = all-time" guard)
- Override clear is auditable via `StudentDataAudit` — staff can re-enter overrides manually
- No data is deleted — rollback is purely query logic reversion and schema removal

---

## Dependencies

- Prisma migration (additive — no column drops)
- No new npm dependencies for CSV; XLSX requires `xlsx` or `exceljs` if approved

---

## Success Criteria

- [ ] Daily board shows 0 attendances, 0 completed classes, $0 paid on the 1st of a new month (after close)
- [ ] Points and package credits unchanged across month boundary
- [ ] "Close month" button writes `MonthlyBoundary` row and clears overrides — idempotent
- [ ] History range spanning two months shows month dividers in the UI
- [ ] `/api/staff/reports/monthly?year=2026&month=5` returns correct aggregated data from DB
- [ ] Monthly report CSV downloadable with all students for that month
- [ ] Package attendances in new month count toward new month's attendance count only
