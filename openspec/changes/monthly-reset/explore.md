# Exploration: Monthly Student Data Reset + History + Reports

**Change name**: `monthly-reset`  
**Date**: 2026-05-02  
**Status**: Ready for proposal

---

## Current State

### Data Model (How attendance data is currently stored)

**No concept of "month" exists anywhere in the schema.** All data is "all time" by default.

| Model | Key Fields | Monthly relevance |
|-------|-----------|-------------------|
| `Attendance` | `userId`, `sessionId`, `status`, `checkedInAt` | `checkedInAt` is the only date anchor |
| `PackageUsageLedger` | `packagePurchaseId`, `userId`, `attendanceId`, `delta`, `createdAt` | `createdAt` is the date anchor |
| `Purchase` | `userId`, `amount`, `metadata.date`, `createdAt` | `metadata.date` (YYYY-MM-DD string) is the class date |
| `PackagePurchase` | `remainingCredits`, `totalCredits`, `status` | No month scope — credits are global |
| `User` | `completedClassesOverride`, `packageClassesUsedOverride` | Manual override only, all-time |

### How "Completed Classes" is computed

In `/app/api/staff/payments/route.ts` (line 621–738):

```ts
// ALL-TIME count — no date filter
prisma.attendance.groupBy({
  by: ["userId"],
  where: { userId: { in: userIds }, status: { in: ATTENDED_CHECKIN_STATUSES } },
  _count: { _all: true },
})
```

→ `completedClassesTotal` = `Math.max(allTimeAttendances, packageClassesUsed)` or the override.  
→ **This is a pure all-time aggregate. No month boundary.**

### How "Amount Paid" is computed

In `historyCardAggregates.ts` → `buildHistoryStudentCard`:
- `totalCollectedCents` = sum of `payment.amount` where `payment.classPaid === true`
- For daily card: `resolveHistoryStudentCardAmountPaidCents` deduplicates by `fundingPayment.id`
- For history card: sums all payments in the selected range

→ **Amount paid is derived from Purchase records filtered by date range. No "current month" concept.**

### How "Attendances" is computed

- Daily board: counts `checkedInPayments` = `Math.max(...providedCompletedClasses, ...providedPackageClassesUsed)` — all-time
- History board: from the filtered payment rows in the date range

### History Mode (Current)

History mode exists and is functional. The CalendarPicker supports `rangeMode`, returns `rangeStart`/`rangeEnd` as `YYYY-MM-DD`. The board client passes `?mode=history&from=YYYY-MM-DD&to=YYYY-MM-DD` to the payments API.

The API filters by:
```ts
{ metadata: { path: ["date"], gte: historyRange.from, lte: historyRange.to } }
```
(i.e., filters on `Purchase.metadata.date`, NOT on `createdAt`).

**History already works for arbitrary date ranges.** What's missing is:
1. A pre-set "current month" view for the daily board
2. Month dividers in cross-month range display
3. Student card reset logic for the "today" board view

### Existing Report Infrastructure

Reports exist in the UI (`StaffUsersAdminClient.tsx`, lines 6478–7030):
- `exportReportsCsv` — client-side CSV export of `reportFilteredPayments`
- `exportReportsPdf` — client-side PDF export via `window.open`
- Range filter: two `<input type="date">` fields (`reportsDateFrom`, `reportsDateTo`)
- The data source is the **payments loaded in the current session** — it is NOT a dedicated API endpoint
- One server-side export exists: `/api/staff/students/[userId]/audit-log/export` — generates CSV from `StudentDataAudit` table

**No server-side monthly report endpoint exists.** No Excel/XLSX library in use.

### Cron / Scheduled Jobs

**No cron infrastructure exists.** No `vercel.json`. No `/api/cron` routes. No background job runner.

`next.config.ts` is minimal — only `distDir` dev override and `middlewareClientMaxBodySize`.

---

## Affected Areas

| File | Why affected |
|------|-------------|
| `prisma/schema.prisma` | New model(s) needed: `MonthlySnapshot` or `MonthlyBoundary` |
| `app/api/staff/payments/route.ts` | `completedAttendances` query must become month-scoped; amount query must be month-scoped |
| `components/front/staff/historyCardAggregates.ts` | `checkedInPayments` and `totalCollectedCents` need month context |
| `components/front/staff/StaffUsersAdminClient.tsx` | Reports section + history CalendarPicker UI for month dividers |
| `app/api/staff/students/[userId]/stats/route.ts` | Override model changes if we store overrides per-month |
| New: `app/api/staff/reports/monthly/route.ts` | Dedicated monthly report endpoint |
| New: `app/api/admin/month-close/route.ts` | "Close month" manual trigger |

---

## Approaches

### Option A — Non-Destructive Query Scoping (Recommended)
**Keep all raw data. Add a `MonthlyBoundary` model. Scope all queries by current month boundaries.**

- Add a `MonthlyBoundary` record per month: `{ year, month, closedAt, closedBy }`
- "Closed month" = a row exists in `MonthlyBoundary` for that month
- Monthly reset = API queries for "today" board filter `checkedInAt >= start_of_current_month`
- History = as-is, filtered by user-selected range
- Package credits: never scoped — always global (as per requirements)
- Points: never scoped — always global (as per requirements)

**Schema addition:**
```prisma
model MonthlyBoundary {
  id          String    @id @default(cuid())
  year        Int
  month       Int       // 1–12
  closedAt    DateTime?
  closedByClerkId String?
  notes       String?
  createdAt   DateTime  @default(now())
  
  @@unique([year, month])
  @@index([year, month])
}
```

**Pros:**
- Zero data loss — all historical data preserved
- No migration risk — additive only
- History mode already works; just restrict "today" scope
- "Close month" = insert/update a `MonthlyBoundary` row (idempotent)
- No cron needed — boundary is set by the "Close month" button
- Cross-month range works naturally (queries span both months)

**Cons:**
- `completedClassesTotal` on today's board must now be month-scoped (query change)
- `amount paid` on today's board must now be month-scoped (query change)
- Existing `completedClassesOverride` / `packageClassesUsedOverride` on `User` become month-ambiguous (need clearing on month close)
- Some queries in `route.ts` are non-trivial to month-scope

**Effort:** Medium

---

### Option B — Destructive Reset (Archive + Delete)
**On month close, archive current data into a separate table and reset.**

- Create `MonthlyArchive` with a JSON blob of each student's snapshot
- Delete attendance rows older than current month
- Write a "Reset" procedure that: archives → deletes → resets overrides

**Pros:**
- Daily board queries stay simple (always "all time" = current month)
- No query changes needed for the board

**Cons:**
- HIGH risk: data deletion is irreversible
- History mode would need to query `MonthlyArchive` instead of real tables — massive refactor
- Package credits are tied to `PackageUsageLedger` — cannot delete without breaking packages
- Cross-month range would need stitching from archive + live tables

**Effort:** High (and dangerous)

---

### Option C — Snapshot Records
**On month close, write a `MonthlyStudentSnapshot` per student with aggregated totals.**

```prisma
model MonthlyStudentSnapshot {
  id                String   @id @default(cuid())
  userId            String
  year              Int
  month             Int
  attendanceCount   Int
  completedClasses  Int
  amountPaidCents   Int
  packageClassesUsed Int
  createdAt         DateTime @default(now())
  
  @@unique([userId, year, month])
}
```

- Keep raw data intact (like Option A)
- History mode reads from snapshots for closed months
- Daily board reads live queries for current month

**Pros:**
- Clean separation of historical vs. live data
- Fast history reads (pre-aggregated)
- No risk to raw data

**Cons:**
- History mode currently shows per-payment rows (not aggregated) — would need UI redesign for snapshot months
- Snapshot must be re-generated if raw data is corrected after close
- More complex: two data sources for history
- Cross-month ranges combining snapshot + live data are complex

**Effort:** High

---

## Recommendation

**Option A (Non-Destructive Query Scoping)** with a `MonthlyBoundary` model.

### Reasoning

1. **Raw data must be preserved** — Package credits and usage ledger rows are coupled. Cannot delete.
2. **History mode already works** — It filters by date range. Just pre-wire "current month" boundaries.
3. **The reset is conceptual, not physical** — The board shows "this month's" data; history shows past data. This is a query filter, not a data operation.
4. **"Close month" = a DB record** — Triggers no data mutation, just marks the boundary and resets overrides for the new month.
5. **Cross-month range** is naturally handled: query spans both months' data.

### What "reset" means in Option A

When the 1st of the month arrives (or "Close month" is clicked):
- `completedClassesOverride` and `packageClassesUsedOverride` on `User` are cleared to `null`
- Board queries filter `Attendance.checkedInAt >= start_of_current_month`
- Board queries filter `Purchase` by `metadata.date >= start_of_current_month`
- Package credits (remainingCredits) continue depleting normally — untouched
- Points continue accumulating normally — untouched

---

## Risks

1. **Overrides reset**: `completedClassesOverride` / `packageClassesUsedOverride` are all-time overrides. On month close, these need to be cleared so the new month starts fresh. Logic needed to clear + audit this.

2. **Purchase metadata.date vs createdAt**: History mode filters on `Purchase.metadata.date`. Some purchases may lack this field (e.g., cash payments entered manually). The board might miss them in month-scoped views.

3. **Package credits in monthly attendance count**: Requirement says "package attendances in the new month count toward new month's attendance." This is already natural with Option A (attendance timestamp in new month is >= new month boundary).

4. **No cron infrastructure**: "Automatic reset on 1st" requires either: (a) Vercel Cron (add to vercel.json), (b) a client-side trigger on first page load of the new month, or (c) manual "Close month" button only (simplest, lowest risk). Given no existing cron, recommend starting with manual close + optional cron as a follow-up.

5. **Reports data source**: The current Reports section uses **in-memory** payments from the board session. A proper monthly report needs a **server-side** endpoint that queries the DB directly for the full month, not just what's loaded on the board.

6. **XLSX export**: No Excel library exists. Would need `xlsx` or `exceljs` added as a new dependency.

7. **Cross-month range dividers**: Pure UI change in `StaffUsersAdminClient.tsx` — group history cards by month when range spans multiple months. The data already comes sorted; just need grouping logic.

---

## Summary of What Needs to Be Built

| Feature | Effort | Type |
|---------|--------|------|
| `MonthlyBoundary` schema model | Low | Schema migration |
| Month-scope attendance query in payments API | Medium | Backend |
| Month-scope amount-paid query in payments API | Medium | Backend |
| Clear overrides on month close | Low | Backend |
| "Close month" button in Reports area | Low | UI |
| `/api/admin/month-close` endpoint | Low | Backend |
| Month dividers in cross-month range view | Medium | UI |
| Student card: sum totals in cross-month view | Medium | UI (historyCardAggregates) |
| Server-side monthly report endpoint | Medium | Backend |
| Export Excel/CSV from report endpoint | Medium | Backend (new dep) |
| Vercel Cron for auto-close on 1st | Low | Config (optional) |

---

## Ready for Proposal

**Yes.** The codebase is clear, the approach is non-destructive, the risk profile is manageable.

The key insight: **the "reset" is a query filter boundary, not a data operation.** All raw data stays. The board shows "current month." History shows "selected range." A `MonthlyBoundary` model tracks when each month was officially closed.

Next step: create proposal with scope, phasing, and implementation decisions.
