# Heritage Pin Campaign — Design

## Design Principles

- Server authority for payment channel, entitlement, dates, and price.
- One bounded campaign module rather than scattered October checks.
- Purchase metadata as the no-migration entitlement record.
- Existing phone/account identity as the user key.
- Existing Stripe and kiosk boundaries remain intact.
- Campaign UI remains removable after expiry.

## 1. Campaign Domain Module

Create a focused module under `lib/campaigns/heritage-pin.ts` that owns:

- campaign key;
- New York timezone;
- bounded acquisition and benefit start/end dates;
- normalized country-code validation/display;
- purchase-window and class-window decisions;
- Sunday/Monday eligibility;
- fixed price (`1500` cents);
- metadata parsing and status resolution;
- non-stacking decision helpers.

Configuration reads documented environment overrides with safe ISO-date validation and bounded defaults. Domain functions accept `Date`/date-key parameters for deterministic tests.

## 2. Booking Acquisition Context

The public booking page adds a campaign announcement and a country-selection step. The selected occurrence and normalized country code travel through the existing booking URL as acquisition intent, not authority.

The public booking source is explicitly tagged so checkout metadata can record origin. Direct callers may reproduce the tag, but they receive no free value: the server still requires a real settled card payment during the active window and awards at most one entitlement.

The booking page should avoid asking for another country when a known signed-in user already has a pending/delivered entitlement. Anonymous visitors may still see campaign messaging before identity is resolved; the server remains authoritative.

## 3. Branded QR Booking Shell

Unify `qrBooking=1` rendering across mobile and desktop:

- show an immediate full-screen PLI transition;
- keep logo, selected class, date/time, and campaign summary visible;
- mount the existing `CourseAsideRight`/`EnrollModal` without exposing the generic course layout;
- retain existing Clerk readiness and eligibility checks behind the branded shell;
- update route loading behavior so server navigation never reveals the generic course skeleton for this handoff.

No alternate enrollment or checkout implementation is introduced.

## 4. Entitlement Creation

The checkout payload carries normalized campaign country/source intent. The checkout session route validates format and adds admitted fields to Stripe metadata.

On a paid Stripe event, after the purchase is upserted and associated with the resolved user:

1. verify card settlement;
2. convert the event timestamp to New York campaign date;
3. verify campaign source and country;
4. search for an existing user entitlement in purchase metadata;
5. if none exists, attach pending entitlement metadata to the source purchase;
6. preserve all unrelated metadata and remain idempotent under event replay.

Failed, pending, cash, or out-of-window payments never award an entitlement.

## 5. Entitlement Lookup

A shared repository/helper loads the user's earliest/current qualifying entitlement from purchase metadata and resolves:

- `none`;
- `pending` with country/source purchase;
- `delivered` with country/source/delivery audit fields.

Lookup is user-based, so future entry by verified phone/account finds the same benefit. No billing-country field is repurposed.

## 6. Staff Delivery

Extend the staff student search aggregate with a separate `heritagePin` object. Add a guarded mutation scoped to the source purchase/user that:

- verifies pending campaign metadata;
- confirms the purchase belongs to the requested user;
- merges `delivered`, timestamp, and staff actor into metadata;
- is idempotent if already delivered;
- writes a student-data audit event;
- applies existing staff rate limiting and role boundaries.

The student card renders a dedicated badge and a `Mark delivered` control only for pending state.

## 7. Pricing Decision

Campaign pricing runs after server identity resolution and before Stripe/cash persistence.

Eligibility requires:

- a delivered entitlement for the resolved user;
- class date inside the configured benefit window;
- Sunday or Monday in New York calendar semantics;
- one drop-in participant;
- no package, coupon, new-student service, consecutive add-on, or other promotional price.

If eligible, server checkout uses exactly 1500 cents and records campaign pricing metadata. The UI may pre-display eligibility after identity resolution, but the checkout route independently recalculates it.

If another promotion is selected, the campaign price is not combined. The flow presents one authorized rule and prevents misleading stacked totals.

## 8. Payment-Channel Gate

Introduce a shared decision that permits onsite/cash only with trusted kiosk authority. UI behavior:

- public remote booking: show card/wallet only and preselect it where appropriate;
- actual kiosk terminal/session: preserve current cash/card choices.

Server behavior:

- `/api/checkout/cash` rejects campaign/public remote requests without validated terminal/session authority;
- query flags and client `photoContext` alone are insufficient;
- existing kiosk session resolution remains the trust source.

This gate is localized to personal remote booking and does not remove staff cash tools.

## 9. Testing Strategy

### Domain

- inclusive acquisition/benefit boundaries in New York;
- DST-independent weekday calculations;
- configured extension through November;
- country normalization;
- metadata parsing and one-entitlement selection;
- pending versus delivered pricing;
- non-stacking decisions.

### API

- Stripe paid event awards once and preserves metadata;
- replay remains idempotent;
- cash/failed/out-of-window events do not award;
- delivery mutation authorization, audit, idempotency, and ownership checks;
- checkout accepts US$15 only for an eligible delivered holder/date;
- forged amount/entitlement rejected;
- remote cash rejected and trusted kiosk cash accepted.

### UI

- campaign announcement and country selector;
- staff pending/delivered badge and control;
- remote card-only versus kiosk payment choices;
- branded booking shell with class context.

### Browser

- `/booking` → country → branded form without generic page flash;
- successful/canceled path keeps existing auth and redirect behavior;
- 390px and desktop layouts.

## Rollback Boundary

All campaign decisions are centralized. Disabling the campaign configuration stops new awards and promotional pricing without deleting historical entitlement metadata. UI surfaces tolerate historical records after expiry.
