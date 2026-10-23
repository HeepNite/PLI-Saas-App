# Analysis - new-student-native-m2

## Status
ANALYSIS - spec phase only. No source changes. Verified against origin/main cfe0b91f (2026-10-23).

## Objective
A new student ("I am new" on /staff/terminal inside the Android PLI app) must be able to pay by card on the Stripe Reader M2, like identified existing customers (live since 2026-10-22).

## 1. Current new-student kiosk flow
| # | Step | Code | Data created |
|---|---|---|---|
| 1 | "I am new" opens EnrollModal flowVariant="checkin-new" with kioskSessionToken={kioskPinSessionToken \|\| undefined} -> empty for new students. | components/front/checkin/CheckInQrOverlays.tsx:197-215 (:208) | none |
| 2 | Continue with service new-student on kiosk calls verify. | components/front/courses/enroll/hooks/useEnrollNavigationActions.ts:125-130; components/front/courses/hooks/useNewStudentVerification.ts:142-195 | none |
| 3 | Verify (read-only): known identity -> existing_user; else requires_sms_verification. Rate limit 30/min/IP. | app/api/checkin/qr/new-student/verify/route.ts:59-69, 177-198, 239-255 | none |
| 4 | existing_user on kiosk -> existing-customer mode. | lib/checkin/enroll-flow.ts:188-203; components/front/checkin/hooks/useEntryModeRouter.ts:190-197 | none |
| 5 | sms_pending -> requestAccountPreparation(): prepareOnly + paymentSurface "embedded". | useEnrollNavigationActions.ts:147-160; components/front/courses/enroll/hooks/useEnrollPaymentActions.ts:290-313 | see 6 |
| 6 | resolveCheckoutPreparation(deferUserCreation:false). No kiosk token -> fallback (fallbackReason missing_kiosk_session). Clerk user created + DB user upserted BEFORE SMS (required for Clerk phone_code sign-in). | app/api/checkout/intent/route.ts:216-238; lib/checkout.ts:680-703, 536-552, 324-367 | Clerk user (unverified) + DB User |
| 7 | EmbeddedSignIn code entry; on kiosk the Clerk session is NOT activated (activateSessionOnSuccess={isQrMobileCompactFlow}); session id only registered for cleanup. Clerk phone becomes verified. | components/front/courses/EnrollModal.tsx:1726-1743; lib/checkin/enroll-flow.ts:205-215; components/front/checkin/useKioskCustomerSession.ts:49-69 | Clerk phone verified |
| 8 | Photo / packages / promo / payments steps. | useEnrollNavigationActions.ts:193-230 | photo |
| 9a | Cash: fallback prep; enforceNewStudentRules reads hasVerifiedPhone(clerkUser) from fresh Clerk lookup -> works. | app/api/checkout/cash/route.ts:99-156 | pending cash Purchase |
| 9b | Card, no native bridge (plain browser): kiosk QR hosted checkout. | useEnrollPaymentActions.ts:457-478, 377-426 | Stripe Checkout Session |
| 9c | Card, Android app with bridge: runNativePreparedCheckout -> refresh with refreshKioskPreparedContext:true -> 400 "Kiosk session required for prepared context refresh" -> refresh_failed; M2 never reached. | useEnrollPaymentActions.ts:691-714; components/front/courses/enroll/native-prepared-checkout.ts:33-45; route.ts:163-178 | none |
| 9d | Card, Android app without bridge: error "Card reader connection is unavailable..."; no QR fallback in WebView. | useEnrollPaymentActions.ts:457-463, 716-721 | none |

## 2. Existing-customer native path (reference)
1. Phone identify mints a DB KioskIdentificationSession (credentialKind "phone", terminal-bound, 15 min sliding, one per terminal). app/api/checkin/phone/identify-and-bootstrap/route.ts:339-342; lib/checkin/kiosk-session.ts:8, 33-57; token stored at components/front/checkin/useKioskPinFlow.ts:205.
2. Final Confirm refresh writes PreparedCheckoutContext with userId = kioskSession.session.user.id (DB id), TTL 60 s. route.ts:248-273; lib/checkout/prepared-context.ts:8, 74-106.
3. native_m2_prepare requires kiosk context, source "prepared", preparedContextId, userId, terminal auth (terminal id + session id); runs enforceNewStudentRules; creates pending Purchase (idempotent) + prepared reference. route.ts:304-315, 369-403; lib/checkout/native-prepared-purchase.ts:102-139.
4. payment_intent.succeeded -> purchase paid, package + attendance sync. app/api/stripe/webhook/route.ts:883-969.
5. Reconciliation /api/checkout/native-attempt-state requires the same kiosk session. app/api/checkout/native-attempt-state/route.ts:23-25.

## 3. Gaps blocking M2
| ID | Gap | Evidence |
|---|---|---|
| G1 | No kiosk session is ever minted for a new student. | createKioskIdentificationSession only at app/api/checkin/phone/identify/route.ts:96 and identify-and-bootstrap/route.ts:339; CheckInQrOverlays.tsx:208 |
| G2 | Refresh requires kiosk token; native prepare requires source "prepared" + DB userId. Fallback prep returns auth userId (Clerk/staff) or null. | route.ts:175-177, 370-381; lib/checkout.ts:598-600 |
| G3 | With a kiosk session, verification snapshot is false (kiosk-session branch returns clerkUser null) -> 409 "Phone verification required for new student price." | lib/checkout.ts:248-289 (:279), 730-749, 626-632; route.ts:260-269, 304-315 |
| G4 | Client cannot adopt a token minted mid-flow (static prop). | useEnrollPaymentActions.ts:155-205 (:169); CheckInQrOverlays.tsx:208 |
| G5 | Reconciliation needs the same session, else fails closed payment_unresolved. | useEnrollPaymentActions.ts:260-275; native-attempt-state/route.ts:23-25 |
| G6 | Native PI must have receipt_email null -> no Stripe receipt (embedded/QR set it). | lib/stripe/prepared-native-payment.ts:175; route.ts:125-131 |
| G7 | enrollStudentPinForCheckout exists but is never called -> no PIN on any path today. | lib/checkout.ts:768-833 |

Not a gap: pricing. Native charges promotionPricing.effectiveAmountCents from the same server code as embedded/cash incl. new-student promotions (route.ts:317-352; lib/promotions/course-promotion-checkout.ts:29); display via #728 helper (lib/promotions/course-display-prices.ts:16-64). Keep parity.

## 4. Security boundaries
- Terminal auth on every kiosk-session read/mint and native prepare (lib/checkin/kiosk-session.ts:114-121; route.ts:249-251, 375-377).
- Kiosk session minting today: existing customers by phone alone (no SMS), with terminal auth, miss throttle, 30/min limit (app/api/checkin/phone/identify/route.ts:18-113). Minting deletes other sessions on the terminal (kiosk-session.ts:43-45).
- SMS verification (mandatory owner rule): proof = Clerk phone verified, read server-side (lib/checkout.ts:35-39). Client SMS_VERIFIED state is not proof.
- Account created before SMS at prepareOnly (route.ts:230-235) - existing, required by Clerk.
- Staff identity isolation in new-student flows (lib/checkout.ts:380-399, 513-520, 594-596) must be preserved.
- Eligibility: 1 participant, verified phone, no prior successful purchase by Clerk id/email/phone (lib/checkout.ts:612-660); pending/failed rows do not block retry (lib/purchase-status.ts:1).
- Rate limits: checkout:intent 30/min/IP (route.ts:140-150); verify 30/min/IP; identify 30/min per terminal session+IP + miss throttle; Clerk SMS limits.
- Native binding: purchase bound to prepared context + selection; attempt TTL 5 min (lib/stripe/prepared-native-payment.ts:12); reversals -> manual resolution (webhook/route.ts:1003-1037).

## 5. Failure / recovery cases
| Case | Current behavior | Concern |
|---|---|---|
| Declined / reader unresolved after account created | Account exists; pending native_m2_prepare Purchase without PI; visible error, no auto retry/fallback (native-prepared-checkout.ts:28-32; useEnrollPaymentActions.ts:708-714). | Uncharged native preparations excluded from outstanding balance (app/api/staff/payments/shared.ts:268-276) vs "never hide money rows" (OQ6). |
| Abandoned after step 6/7 | Clerk + DB user persist; next "I am new" -> existing_user -> existing mode, first-class price path lost (verify/route.ts:177-198; useEntryModeRouter.ts:190-197). | Pre-existing (OQ3). |
| Duplicate phone/email | existing_user; 2 DB matches -> 409 (verify/route.ts:118-125). | Unchanged. |
| SMS not delivered | Staff recovery code (docs/specs/new-student-verification-recovery; EnrollModal.tsx:1744-1760). | Out of scope. |
| Bridge unavailable in app | Error, cash still selectable (useEnrollPaymentActions.ts:457-463). | OQ7. |
| Session expires (15 min) | Refresh 401 -> refresh_failed. | OQ2. |
| Another identify on same terminal | Previous session deleted (kiosk-session.ts:43-45). | Must not cross-bind. |

## 6. Conflicts with in-flight work
- Booking/QR agent (uncommitted in main checkout): components/front/courses/utils/phone.ts, lib/checkin/numeric-keypad.ts, components/front/staff/StaffTerminalShell.tsx, docs/specs/shareable-web-booking, app/booking, lib/checkin/shareable-booking.ts. Shared surfaces: EnrollModal, useEnrollPaymentActions (QR start :377-426, fallback :457-478), phone parsing, keypad. Do not edit QR; rebase after it lands; QR behavior must stay identical.
- openspec/changes/kiosk-international-phone-support: may change isCompleteUSPhone gate (useEnrollNavigationActions.ts:126).
- openspec/changes/native-kiosk-m2-self-service: excludes student identity creation; plans optional receipt-only email (align OQ5).
- docs/specs/native-m2-live-preparation: owns W3p10 refresh and W3p11 reconciliation contracts; do not alter.
- docs/specs/new-student-cash-package: no overlap expected.

## 7. Indicative minimal surface
Mint a terminal-bound kiosk session for the just-verified new student (server-side SMS proof), pass the token into the open EnrollModal, and snapshot real verified-phone state in the kiosk-session prep branch. Reuse prepared context, native prepare, webhook, reconciliation unchanged.
