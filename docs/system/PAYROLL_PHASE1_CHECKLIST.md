# Payroll Phase 1 Acceptance Checklist

Change: `payroll-end-to-end`
Spec source: Engram observation `#819`, section `6. Acceptance Criteria per Phase`
Tasks source: Engram observation `#820` (`T01`-`T31`)

## Sign-off Summary

Overall status: **CONDITIONAL / PARTIAL SIGN-OFF**

- `npx prisma validate` passes.
- Payroll Phase 1 unit + API tests pass.
- The main Phase 1 foundation is in place, but some acceptance criteria are **not fully satisfied yet** by the current codebase.

## Verification Commands

```bash
npx prisma validate
npx vitest run tests/payroll/adapter-registry.test.ts tests/payroll/audit.test.ts tests/payroll/backfill-payroll.test.ts
npx vitest run tests/api/staff-payroll-payment-methods.test.ts tests/api/staff-payroll-payment-models.test.ts
```

## Acceptance Criteria Mapping

| AC | Spec acceptance criterion | Implementing tasks | Status | Evidence | Verification |
|---|---|---|---|---|---|
| 1 | All new Prisma models are present in schema and migrate without errors | `T01`-`T12`, `T13`, `T27`-`T31` | **PARTIAL** | `prisma/schema.prisma` includes `Currency`, `StaffPaymentModel`, `StaffPaymentMethod`, `StaffPayrollEntry`, `StaffCreditLedgerEntry`, `StaffPayrollBonus`, `StaffUnavailabilityRequest`, `StaffPaymentSchedule`, `StaffPayrollAudit`, `StaffNotification`; `npx prisma validate` passes. But spec AC explicitly names `StaffCreditLedger`, and there is **no separate `StaffCreditLedger` model** in schema. | `npx prisma validate` |
| 2 | `StaffAccount` has `paymentModelId` FK, `hourlyRate`, `paydayWeekday`; payroll data is no longer read from Clerk metadata in active code paths | `T05`, `T18`, `T19`, `T23`, `T24` | **PARTIAL** | `prisma/schema.prisma` adds `paymentModelId`, `hourlyRate`, `paydayWeekday`, `creditCapCents`. But `lib/security/staff-account-sync.ts` still uses Clerk fallback reads (`extractStaffPayrollFallbackFromClerkUser`, `resolveStaffPayrollBridgeFields`) marked `@deprecated-clerk-fallback`, so Clerk metadata is **still part of an active bridge path**. | `npx prisma validate` |
| 3 | Backfill script migrates existing Clerk payroll metadata to DB with no data loss, verified by checksum | `T18`, `T29` | **PARTIAL** | `scripts/backfill-payroll-from-clerk.ts` exists and `tests/payroll/backfill-payroll.test.ts` passes for CLI parsing and dry-run behavior. The script reports `sentinelEntryCount`, but there is **no checksum verification step** proving no data loss end-to-end. | `npx vitest run tests/payroll/backfill-payroll.test.ts` |
| 4 | `StaffPaymentSchedule` table exists with correct columns; no cron implementation yet | `T10`, `T23` | **PASS** | `prisma/schema.prisma` defines `StaffPaymentSchedule` with `staffAccountId`, `paydayWeekday`, `time`, `timezone`, `active`, plus future-facing timestamps. `app/api/staff/users/[userId]/payday-config/route.ts` reads/writes related staff payday config; no cron runner is present in this phase. | `npx prisma validate` |
| 5 | `IPaymentAdapter` is defined; at least one stub adapter is registered and callable | `T14`, `T15`, `T16`, `T27` | **PASS** | `lib/payroll/adapters/IPaymentAdapter.ts` defines the interface; `lib/payroll/adapters/ManualDispatchAdapter.ts` is the stub adapter; `lib/payroll/adapters/registry.ts` registers supported adapter types; `tests/payroll/adapter-registry.test.ts` verifies registry behavior. | `npx vitest run tests/payroll/adapter-registry.test.ts` |
| 6 | Foreign keys and indexes are in place, including `staffAccountId`, `periodStart/periodEnd`, and `idempotencyKey` unique per school | `T04`, `T05`, `T06`, `T07`, `T10`, `T11`, `T12`, `T17`, `T30`, `T31` | **PARTIAL** | Core FKs and indexes are present in `prisma/schema.prisma`, including `StaffAccount.paymentModelId`, entry relations, `@@unique([staffAccountId, periodStart, periodEnd])`, and indexes on `staffAccountId` / `periodStart`. But `StaffPayrollEntry` currently has only `@@index([idempotencyKey])`; there is **no unique-per-school idempotency constraint** implemented in schema. | `npx prisma validate`; `npx vitest run tests/api/staff-payroll-payment-methods.test.ts tests/api/staff-payroll-payment-models.test.ts` |

## Task Coverage Reference

| Task | Covered by current repo evidence |
|---|---|
| `T01` | `Currency` model in `prisma/schema.prisma` |
| `T02` | `StaffPaymentModel` model in `prisma/schema.prisma` |
| `T03` | `StaffPaymentMethod` model in `prisma/schema.prisma` |
| `T04` | `defaultPaymentMethodId` FK in `StaffPaymentModel` |
| `T05` | `StaffAccount` payroll columns in `prisma/schema.prisma` |
| `T06` | `StaffPayrollEntry` model in `prisma/schema.prisma` |
| `T07` | Credit ledger entry model + unique event key in `prisma/schema.prisma` |
| `T08` | `StaffPayrollBonus` model in `prisma/schema.prisma` |
| `T09` | `StaffUnavailabilityRequest.status` in `prisma/schema.prisma` |
| `T10` | `StaffPaymentSchedule` model in `prisma/schema.prisma` |
| `T11` | `StaffPayrollAudit` model in `prisma/schema.prisma` + `lib/payroll/audit.ts` |
| `T12` | `StaffNotification` model in `prisma/schema.prisma` |
| `T13` | Currency seed data in `prisma/seed.ts` (`ARS`, `USD`) |
| `T14` | Shared payroll types in `lib/payroll/types.ts` |
| `T15` | Adapter contract + stub in `lib/payroll/adapters/IPaymentAdapter.ts` and `ManualDispatchAdapter.ts` |
| `T16` | Adapter registry in `lib/payroll/adapters/registry.ts` |
| `T17` | Audit helper in `lib/payroll/audit.ts` |
| `T18` | Backfill script in `scripts/backfill-payroll-from-clerk.ts` |
| `T19` | Dual-read bridge in `lib/security/staff-account-sync.ts` |
| `T20` | Owner helper in `lib/security/staff-portal-auth.ts` |
| `T21` | Payment methods API in `app/api/staff/payroll/payment-methods/**` |
| `T22` | Payment models API in `app/api/staff/payroll/payment-models/**` |
| `T23` | Payday config API in `app/api/staff/users/[userId]/payday-config/route.ts` |
| `T24` | Payroll model assignment API in `app/api/staff/users/[userId]/payroll-model/route.ts` |
| `T25` | Owner payroll config UI in `components/front/staff/payroll/StaffPaymentMethodConfigPanel.tsx` |
| `T26` | Panel wired into `components/front/staff/StaffUsersAdminClient.tsx` |
| `T27` | `tests/payroll/adapter-registry.test.ts` |
| `T28` | `tests/payroll/audit.test.ts` |
| `T29` | `tests/payroll/backfill-payroll.test.ts` |
| `T30` | `tests/api/staff-payroll-payment-methods.test.ts` |
| `T31` | `tests/api/staff-payroll-payment-models.test.ts` |

## Final Review Notes

Phase 1 is close, but this checklist should NOT be treated as a full green sign-off until these gaps are resolved:

1. Decide whether `StaffCreditLedger` must exist as a separate Prisma model or whether the spec should be updated to reflect the implemented append-only `StaffCreditLedgerEntry` approach.
2. Remove the remaining Clerk payroll fallback from `lib/security/staff-account-sync.ts` once backfill is verified.
3. Add checksum-style verification to the backfill flow if the spec requirement remains unchanged.
4. Implement the missing unique-per-school idempotency constraint, or update the spec/design if the intended scope is different.
