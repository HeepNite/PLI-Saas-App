# Analysis - Staff Panel Charge Collected On A Tablet M2 Reader

Codebase findings on `main` (base `1c617830` + later main commits) mapped against
`requirements.md` D1–D7. Paths are repository-relative.

## Existing M2 pipeline (reused unchanged)

- `issuePreparedNativePurchase({ purchaseId, terminalId, sessionId })`
  (`lib/stripe/prepared-native-purchase.ts:32`) issues a single-use reference, 5-minute
  TTL, bound to one Purchase (`PreparedNativePurchase.purchaseId @unique`).
- The native app consumes it in `prepareInternalPurchase` "prepared-attempt"
  (`apps/backend/src/terminal/internal-purchase.service.ts:296-312`); the Purchase must
  be `pending`, have an `idempotencyKey`, and flat string metadata (≤32 keys, ≤4 KB,
  `lib/stripe/prepared-native-payment.ts:62-72`).
- `fulfillPreparedNativePaymentIntent` (`app/api/stripe/webhook/route.ts:915-1000`)
  fulfils exactly one Purchase per PaymentIntent.
- Web side: `runNativePreparedCheckout`
  (`components/front/courses/enroll/native-prepared-checkout.ts:33`),
  `handOffPreparedPurchase` / `pollPreparedPurchaseState`
  (`components/front/courses/enroll/effects/native-payment-bridge.ts:184,197`).

## Conflicts and gaps

1. **D1 credit priority is not met today.** Package selection runs in four places with
   different orders: `app/api/checkin/qr/package/route.ts:426-460`,
   `app/api/checkin/qr/client-phone/route.ts:257-268`, `lib/packages.ts:229-247`,
   `lib/checkin/qr-decision.ts:100-120`. None distinguishes drop-in credits from real
   packages. A shared comparator is required.
2. **Drop-in credits can reuse `PackagePurchase`.** Precedent: `INTERNAL_GENERAL_CREDIT`
   (`app/api/stripe/webhook/route.ts:708-715`). Sync always creates a `PackagePlan`, so
   credits must be course-bound (`courseSlug` of the drop-in). `AssignClassesCard` already
   lists course-bound packages with remaining credits (`ProfilePageClient.tsx:514`).
3. **Guest friend (D2).** `Purchase.participants` only multiplies checkout price; nothing
   downstream reads it. A separate guest Purchase under the payer with no attendance and
   no PackagePurchase is the least-code shape.
4. **Outstanding items (FR3).** Debt = `isOpenPurchase`
   (`app/api/staff/payments/shared.ts:219-236`); the board also shows synthetic
   attendance-debt rows `att-<attendanceId>` with no Purchase. `mark_paid` side effects
   live in `applyCashSettlementSideEffects` (`app/api/staff/payments/[purchaseId]/route.ts:62`);
   bulk is one transaction per row, not atomic.
5. **Multi-line fulfilment.** `Purchase.parentPurchaseId` is `@@unique`
   (`prisma/schema.prisma`), so parent/children cannot model N line items.
6. **Payroll (D7).** Payroll is hours × rate only (`lib/payroll/hours.ts`); no Purchase
   feeds payroll. The monthly report sums every Purchase amount
   (`app/api/staff/reports/monthly/route.ts:94-117`), so a carrier Purchase would be
   double-counted unless excluded.
7. **Terminal identity.** `StaffTerminalSession` is cookie based; sign-in deletes other
   sessions of the same terminal (`app/api/staff/terminal/session/route.ts:74-81`).
   `/staff/terminal` has no server polling today (`StaffTerminalShell.tsx:192-239`).
8. **Roles (D4).** No helper matches owner/admin/front_desk/manager exactly
   (`lib/security/staff-access.ts:99,111`). Managers only get the `profile` portal section
   today (`lib/security/staff-access.ts:24-52`), so they cannot reach the payments board.
9. **Reader mapping.** `INTERNAL_PURCHASE_LIVE_TERMINALS` (env) must list both tablets.

## Risk register

- R1. Changing package priority touches every check-in path (high risk, item 6 if
  untested; needs regression tests per path).
- R2. One PaymentIntent fanning out to N records: idempotency, partial failure,
  refunds/disputes (`classifyInternalReversal` assumes one Purchase).
- R3. Carrier double counting in reports and the payments board.
- R4. Expiry/cancel racing an in-progress tap.
- R5. New tables (schema change) — migration drift on prod `_prisma_migrations` must be
  handled surgically.
