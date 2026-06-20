# Proposal: Staff Fast Class Action

## Intent

Add one adaptive action to staff student cards so staff can quickly check in registered students for the terminal's current class without opening the full kiosk flow.

## Scope

### In Scope
- Add one student-card button that shows `Fast Pay` when the student has no usable package and `Fast Sign` when the student has a usable package.
- Use the terminal current-class source of truth based on today's ET date/time; no manual class picker in v1.
- `Fast Pay` registers attendance and creates a pending cash outstanding balance for the current drop-in amount (`$20` default).
- `Fast Sign` registers attendance and consumes one package credit.
- If a linked later class promotion exists today, show a confirmation popup and add the promo cash outstanding balance when accepted.
- Rename visible `Provisional PIN` button text to `Prov PIN`.

### Out of Scope
- SMS/payment links.
- Manual class selection.
- New package purchase flows.
- Database schema changes unless implementation analysis proves an existing model cannot represent the balance.

## Capabilities

### New Capabilities
- `staff-fast-class-action`: Staff-triggered fast attendance/payment action from student cards.

### Modified Capabilities
- None.

## Approach

Create a staff-only endpoint that reuses existing terminal class resolution, attendance/session upsert, package-credit reservation, and pending cash `Purchase` patterns. The frontend adds an adaptive button and a small promo confirmation modal.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `components/front/staff/StaffStudentsBoardPanel.tsx` | Modified | Add adaptive button, shorten PIN label, promo popup. |
| `app/api/staff/students/*` | New/Modified | Staff-only fast action route. |
| `lib/checkin/*` | Modified | Reuse/centralize terminal current-class resolution. |
| `lib/purchase-attendance.ts` / package helpers | Modified | Reuse atomic attendance/package/cash balance behavior. |
| Tests | Modified | Add API/UI coverage for fast pay/sign-in and promo acceptance. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Double attendance or double charge | Medium | Idempotent session/attendance checks and transactional writes. |
| Wrong class chosen | Medium | Use terminal source of truth only and test ET date/time boundaries. |
| Package credit consumed incorrectly | Medium | Reuse package reservation helper and verify package usage ledger. |

## Rollback Plan

Remove the new button and endpoint. Existing QR, package, and cash checkout flows remain unchanged.

## Dependencies

- Existing staff auth/authorization boundary.
- Existing terminal today/current-class logic.
- Existing `Purchase`, `Attendance`, `PackagePurchase`, and `PackageUsageLedger` models.

## Success Criteria

- [ ] Staff can perform Fast Pay for a no-package student and see a `$20` outstanding balance.
- [ ] Staff can perform Fast Sign for a package student and see package credit usage reflected.
- [ ] Promo popup can add the linked second-class cash balance.
- [ ] The action uses the same current class as the terminal.
- [ ] `Provisional PIN` visible label becomes `Prov PIN`.
