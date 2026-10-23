# Analysis - payment-attempt-visibility

Read from origin/main (2026-10-23). See requirements.md for decisions.

## 1. Where attempts are recorded today
- Purchase.status is a free-form string (prisma/schema.prisma:84): pending, paid, failed, expired, canceled/cancelled, refunded, reversed. pending at native prepare (lib/checkout/native-prepared-purchase.ts:111) and cash settlement (app/api/staff/payments/[purchaseId]/route.ts:82, bulk/route.ts:213); failed at app/api/stripe/webhook/route.ts:672; expired at webhook/route.ts:1142 and lib/checkout/special-class-reservation.ts:140; paid at webhook/route.ts:910.
- Native M2: native_m2_prepare (app/api/checkout/intent/route.ts:180,385-398) creates a pending Purchase without PaymentIntent (metadata.paymentSurface, preparedContextId) and a PreparedNativePurchase row. The PaymentIntent is bound only on payment_intent.succeeded (webhook/route.ts:908-910); a never-succeeded prepared row keeps stripePaymentIntentId null. handleReservedPreparedNativePaymentEvent (webhook/route.ts:971-978) acks payment_failed/canceled with a log only — no reason stored. getNativeAttemptState (lib/checkout/native-attempt-state.ts:16-21) derives a coarse state, stores nothing.
- Embedded card: handlePaymentIntentFailure (webhook/route.ts:659-676) sets failed and merges metadata.stripeFailure; no Purchase exists before the PaymentIntent is finalized.
- Kiosk QR: handleCheckoutSessionTerminal (webhook/route.ts:1129-1146) sets expired/failed with stripeFailure (event type, timestamp, ids only).
- Cash pending: status pending + metadata.settlementStatus; isPendingProcessablePurchase (app/api/staff/payments/shared.ts:239).
- Reason storage: metadata.stripeFailure allowlisted contract (lib/stripe-failure.ts:9-45) from last_payment_error, exposed at payments-row.ts:279 and paymentTimelineTransforms.ts:98-104. Nothing records Terminal/reader outcomes.

## 2. Staff surfaces
- Today: createdAt in NY-day window OR metadata.date == todayNY (payments-query.ts:70-80); history by metadata.date range (:60-67); userHistory by userId, 100 rows (:46-58, :84). Pulse (pulse/route.ts:44-56) uses the same window.
- Loader: normalizeConsecutivePurchases -> enrichPurchases -> dedupEnrichedPurchasesBySlot (payments-loader-purchase.ts:210-256, 306-327). Dedup keeps the completed purchase per (user, course, classStartsAt): a failed/expired/uncharged-prepared row for a slot with a later paid row is silently dropped — main hide.
- shared.ts:268-276 skips uncharged native preparations from the balance only (rows remain, unlabeled).
- Existing helpers: isNeverCompletedCardAttemptStatus (shared.ts:177-180), isTerminalUnpaidCardAttempt (:196), staffPaymentCardPresentation.ts:35 labels never-completed card attempts.
- Student "Edit info": components/front/staff/cards/PaymentStudentCard.tsx:489, ProfileStudentCard.tsx:201; can reuse mode=userHistory.

## 3. Outstanding balance
- buildOutstandingBalanceByUser (shared.ts:271-286) sums open purchases (shared.ts:232-235). Failed/expired/cancelled card rows count as debt today (unless a sibling class completed, :280); only uncharged native preparations are skipped (:276). Used at payments-loader.ts:199 and students/search/route.ts:526; buildLatestOpenPurchaseByUser (:290).
- D1 implementation: one predicate isNonDebtCardAttempt = isTerminalUnpaidCardAttempt || isUnchargedNativeM2Preparation applied to balance and latest-open; rows stay visible. NOTE: making failed/expired card rows non-debt changes current behavior (comment shared.ts:190-195) and must match the owner decision.

## 4. Reason capture
- Stripe decline: reuse stripeFailure; handle payment_failed/canceled in the reserved native path, resolving the Purchase via metadata.purchaseId (as at :1006-1010), only while pending; do not bind stripePaymentIntentId unless validation passes.
- stripeFailure.card.last4/brand are card data: conflicts with "no card data" (decision pending).
- Terminal/Android outcomes: no endpoint today; add a terminal-session-authenticated POST with enum reader_unavailable | reader_timeout | cancelled_by_customer | declined writing metadata.attemptOutcome {code, at}.
- QR expiry already captured; label "Timed out".
- Schema: no migration needed (metadata.stripeFailure + metadata.attemptOutcome; label derived at read time).
- Risk: assertExactPurchase compares full metadata (native-prepared-purchase.ts:96) — failure metadata would break idempotent reuse on retry (409). Compare only fulfillment keys.
- Privacy: persist codes, label keys, timestamps; cap/allowlist any provider message.

## 5. 24 h window
- Window in payments-time.ts:13-23 (NY day), applied at payments-query.ts:70-80 and pulse/route.ts:44-56. Add an OR clause createdAt >= now-24h for non-debt attempts, in query and pulse together. Take limits still apply.

## 6. Slices
1. Predicate + balance (~150): shared.ts, payments-loader.ts, students/search/route.ts.
2. Labels + no-hide dedup (~250): dedupEnrichedPurchasesBySlot keeps attempts visible; label helper ("Attempt, no charge", "Card declined", "Timed out", "Reader did not respond").
3. Webhook reserved-path failure capture (~250): webhook/route.ts:971-978, lib/stripe-failure.ts, assertExactPurchase relaxation; retry-after-decline test.
4. 24 h rolling window (~120): payments-query.ts, pulse/route.ts, payments-time.ts.
5. Terminal outcome endpoint (~300 + Android).
6. Per-student history in Edit info (~350), reusing userHistory.
Risks: exclude attempts from revenue totals; paid row keeps slot ownership for attendance; existing tests asserting hidden rows / ack-only must be updated; cash pending unchanged.
