# Course Promotions — Resolved Decisions

## Decisions

| Topic | Decision |
| --- | --- |
| Ownership | Promotions belong to one course and are stored with its schedule rules. |
| Quantity | Up to 12 promotions per course. |
| Pricing | Fixed final price or percentage off authoritative regular drop-in. |
| Window | Inclusive New York dates, based on class date or purchase date per promotion. |
| Audiences | `everyone` and `heritage_pin_delivered` in the first version. |
| Channels | Public booking, profile, and trusted kiosk are independently selectable. |
| Conflict | Package first; otherwise exactly one lowest authorized price wins. Explicit package selection goes to the existing package reservation/handling flow; paid quote and intent do not probe ownership or auto-divert, while the separate reservation endpoint keeps its auto-detection. |
| Stacking | No promotion-to-promotion, coupon, addon, or consecutive stacking. |
| Visibility | Show a public label when potentially applicable; in ordinary public booking, an `everyone` final price may use an anonymous payment-free authoritative quote, while a restricted final price requires exact identity and entitlement validation. Profile retains its existing authenticated authoritative checkout-session path. |
| Public booking authority | Derive the public-booking channel from a dedicated server route/context, never from a client body or query claim; profile and trusted-kiosk boundaries remain separate. |
| Quote | Only ordinary public booking receives a read-only quote; it creates no Stripe intent or session, purchase, reservation, or payment state. `everyone` quotes may be anonymous; restricted audiences receive only an optional authenticated Clerk user ID, never submitted email or phone. The response exposes only the caller's applied public quote, not account or entitlement lookup details. Profile retains its existing authenticated authoritative checkout-session path. |
| PaymentIntent | Create the final PaymentIntent only after independently re-evaluating authoritative course, date, identity, entitlement, package, and booking shape; state changes after a quote use this fresh result, and client quote and amount values are ignored. Trusted public contexts accept only USD (used as `usd`) and require a strict real date, valid time, and refreshed scheduled occurrence before payment state. |
| Legacy discount | Read as an inactive draft; never silently activate it. |
| Medals | Keep the audience model extensible, but add no medal authority now. |
| Free checkout | Out of scope; promotional prices must remain payment-processor compatible. |

## Heritage Preset

- Label: `Heritage pin benefit`
- Active window: October 1–31, 2026
- Date basis: class date
- Audience: delivered Heritage pin
- Channels: public booking and profile
- Price: fixed US$15
- Courses: Thursday 21:10 `bachata-beginners`; Sunday 17:00 `salsa-cubana-absolute-beginners`

## Existing Behavior Preserved

- Verified first-time pricing remains independently server-authoritative.
- Restricted audiences retain exact-phone ownership and existing identity gates before their promotional price applies.
- Applicable packages reserve without Stripe and consume credit only on completed attendance.
- Ordinary remote public booking hides cash and the server rejects remote public cash attempts; trusted kiosk cash keeps its existing authority.
- Country-pin acquisition and delivery remain separate from generic course promotion authoring.
