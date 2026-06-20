# Analysis: Staff Fast Class Action

## Current Contracts

| Area | Current behavior |
|------|------------------|
| Student card actions | `StaffStudentsBoardPanel.tsx` renders bottom actions twice: profile cards and payment-backed cards. Current labels are `Notify`, `Provisional PIN` / `Reissue PIN`, and `Edit info`. |
| Staff check-in | `app/api/staff/checkin/route.ts` already creates/reuses `ClassSession`, upserts `Attendance`, consumes package credit if available, or creates a pending cash `Purchase` when no package exists. It requires explicit class/session input. |
| QR package check-in | `app/api/checkin/qr/package/route.ts` has the strongest package-credit implementation: package selection by course eligibility, `reservePackageCreditForAttendanceTx`, `ensureAttendancePackagePurchase`, and points logic. |
| QR drop-in check-in | `app/api/checkin/qr/dropin/route.ts` checks in only after a successful/cash purchase already exists. It does not create the outstanding balance first. |
| Outstanding balance | Staff balances are derived from open `Purchase` rows by `buildOutstandingBalanceByUser`; pending cash purchases count as outstanding. |
| Terminal class source | `app/api/checkin/terminal/today-classes/route.ts` returns today's ET classes. `StaffTerminalShell.tsx` currently computes the active/current slug in component-local logic, so the exact current-class resolver is not reusable yet. |
| Consecutive promo | `lib/course-links.ts` stores linked courses and promo prices. Existing QR flows validate linked course attendance before discounted second-class purchase/check-in. |

## Conflicts / Gaps

- The staff card does not know the terminal current class; it only knows student/payment rows.
- The reusable terminal source is incomplete: the API returns today's classes, but the current-class selection algorithm lives in the client component.
- Existing staff check-in route is close, but it accepts manual class payload and uses broader staff check-in auth; the requested feature needs student-card operational auth and no manual class picker.
- Existing QR endpoints are customer/kiosk-oriented and should not be called directly from staff cards.
- Package availability shown in the UI is only a hint; the server must recompute package eligibility before consuming credit.
- Fast Pay repeat behavior must avoid duplicate cash `Purchase` rows for the same user/class slot.
- Promo acceptance should create the second-class attendance and cash balance without consuming a package credit, even for package holders.

## Reuse Targets

- `authorizeStudentOperationalRequest()` for staff permission boundary.
- `PackagePurchase` eligibility query + `reservePackageCreditForAttendanceTx()` + `ensureAttendancePackagePurchase()` from package check-in.
- `ClassSession` upsert and `Attendance` upsert patterns from staff/QR check-in.
- `Purchase` metadata pattern for pending cash: `paymentChannel: "cash"`, `settlementStatus: "pending"`, `purchaseSource: "front_desk"`.
- `CourseLink` helpers for promo validation.
- `buildOutstandingBalanceByUser` remains unchanged; new pending cash rows should appear automatically.

## Implementation Constraints

- No Prisma migration expected.
- UI/copy/code stays in English.
- Use a clean endpoint/service instead of overloading QR endpoints.
- Centralize current-class logic before using it from the staff endpoint.
- Keep v1 scoped to one adaptive button and one promo confirmation flow.

## Test Targets

- API: Fast Pay creates attendance + one pending cash purchase and is idempotent.
- API: Fast Sign-in consumes package credit + creates package-credit purchase and is idempotent.
- API: Promo acceptance creates second attendance + pending cash promo balance.
- API: Unauthorized callers cannot mutate attendance, package, or purchases.
- Unit: current-class resolver matches terminal rotation rules for ET now.
- UI: button label switches between `Fast Pay` and `Fast Sign-in`; PIN label is `Prov PIN`.
