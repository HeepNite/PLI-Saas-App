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
| Visibility | Show a public label when potentially applicable. In ordinary public booking, an `everyone` final price may use an anonymous payment-free authoritative quote, while a restricted final price requires exact identity and entitlement validation. On `/client-profile`, eligible authenticated users see the authoritative promotion quote before Continue/payment on selected Drop-in, Summary, and Payment surfaces. |
| Public booking authority | Derive the public-booking channel from a dedicated server route/context, never from a client body or query claim; profile and trusted-kiosk boundaries remain separate. |
| Quote | Ordinary public booking and `/client-profile` receive separate read-only, payment-free quotes that create no Stripe intent or session, purchase, reservation, or payment state. Public `everyone` quotes may be anonymous; restricted audiences and all profile eligibility use the authenticated Clerk identity, never submitted email or phone. The profile quote validates the authoritative occurrence, profile channel, checkout shape, identity/entitlement, and package precedence. Explicit package selection suppresses the profile Drop-in quote; package option and pricing data are unchanged. Each response exposes only the caller's applied quote, not account or entitlement lookup details, and is display state—not payment authority. |
| Profile quote presentation | Date/day tiles retain their current presentation and never receive personalized prices. For a quote-eligible profile Drop-in, EnrollModal uses its existing authenticated profile quote request as the sole source and delays Packages until it resolves; its first visible Drop-in and Summary prices are the authoritative quote. Modal-level loading is permitted, but Packages/Summary must not show `Updating price`. On failure, EnrollModal presents a retryable modal-level error; retry follows the same request path, permits no parallel request, and keeps existing stale-result and unmount safety. Package, ineligible-profile, public, and kiosk paths render normally. `ProfilePageClient` has no duplicate quote logic. |
| Payment authority | Create the final PaymentIntent and trusted `/api/profile/checkout/session` only after independently re-evaluating authoritative course, date, identity, entitlement, package, and booking shape; state changes after a quote use this fresh result, and client quote and amount values are ignored. Trusted public contexts accept only USD (used as `usd`) and require a strict real date, valid time, and refreshed scheduled occurrence before payment state. |
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
- Restricted audiences retain exact-phone ownership and existing identity gates before their promotional price applies; `/client-profile` eligibility requires its authenticated Clerk identity and cannot be granted by submitted contact fields.
- Applicable packages reserve without Stripe and consume credit only on completed attendance; explicit package selection suppresses the profile Drop-in quote without changing package option or pricing data.
- Public, trusted-kiosk, and mobile hosted-session flows remain separate; coupon, addon, multi-participant, and consecutive-class exclusions remain in force.
- Ordinary remote public booking hides cash and the server rejects remote public cash attempts; trusted kiosk cash keeps its existing authority.
- Country-pin acquisition and delivery remain separate from generic course promotion authoring.
