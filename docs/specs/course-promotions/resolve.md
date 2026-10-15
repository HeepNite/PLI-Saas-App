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
| Conflict | Package first; otherwise exactly one lowest authorized price wins. |
| Stacking | No promotion-to-promotion, coupon, addon, or consecutive stacking. |
| Visibility | Show a public label when potentially applicable; reveal final restricted price only after server validation. |
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
- Exact-phone ownership is still required before pricing and payment.
- Applicable packages reserve without Stripe and consume credit only on completed attendance.
- Remote cash remains disabled; trusted kiosk cash keeps its existing authority.
- Country-pin acquisition and delivery remain separate from generic course promotion authoring.
