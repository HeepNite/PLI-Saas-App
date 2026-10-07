# Course Promotions — Design

## Design Summary

Add a bounded promotion contract to course schedule JSON, normalize it through one shared domain module, edit it in a dedicated wizard step, and resolve prices only inside trusted server checkout code.

## Stored Shape

```ts
type CoursePromotion = {
  id: string
  label: string
  active: boolean
  pricing: { kind: "fixed"; amountCents: number }
    | { kind: "percentage"; percentOff: number }
  window: {
    basis: "class_date" | "purchase_date"
    startDate: string
    endDate: string
  }
  audience: "everyone" | "heritage_pin_delivered"
  channels: Array<"public_booking" | "profile" | "trusted_kiosk">
}
```

`CourseCatalog.scheduleRules.promotions` is the persistence location. A shared parser bounds lengths, counts, dates, values, enum members, and duplicate IDs. Unknown or malformed entries are discarded.

## Components

| Area | Responsibility |
| --- | --- |
| Promotion domain module | Types, normalization, date/channel checks, candidate-price calculation, lowest-price selection. |
| Staff course API | Normalize promotions on write and return persisted JSON under existing staff authorization. |
| Wizard state | Edit a promotion list and migrate a legacy singleton into an inactive draft. |
| Promotions step | Add/edit/remove rules and explain server-authoritative behavior. |
| Catalog presentation | Expose only safe public labels for potentially applicable occurrences. |
| Public booking quote | Only through the dedicated public-booking server route/context, return an `everyone` quote anonymously or resolve exact authenticated identity and entitlement for restricted audiences, without creating payment state. |
| Profile quote | On `/client-profile`, return separate read-only display state for eligible authenticated users before Continue/payment on selected Drop-in, Summary, and Payment surfaces. Validate authoritative occurrence, profile channel, checkout shape, authenticated Clerk identity/entitlement, and package precedence; submitted contact fields have no eligibility authority. Explicit package selection suppresses the Drop-in quote without changing package option or pricing data. |
| Checkout | Derive trusted channel, load course rules, re-resolve identity/entitlement and booking state, compare authorized candidates, then emit the Stripe amount and metadata. |

## Pricing Flow

1. The dedicated public-booking server route/context establishes the public channel; profile and trusted kiosk retain their existing distinct trusted contexts. A client body or query channel claim has no authority.
2. Resolve the authoritative selected course/session. `everyone` may proceed anonymously; restricted audiences resolve exact authenticated identity from the optional Clerk user ID only, never submitted email or phone.
3. Let an explicit package selection complete through the existing package reservation/handling flow before paid checkout. Do not probe ownership or automatically divert paid quote/intent requests; the separate reservation endpoint retains auto-detection.
4. Resolve the existing authoritative service price and normalize the course promotion list.
5. Filter by active state, trusted channel, date basis/window, single drop-in shape, and audience.
6. Calculate valid promotional candidates from the regular drop-in base.
7. Compare authorized existing and promotional candidates; choose one lowest price.
8. For ordinary public booking, after refreshed validation require USD (used as `usd`), a strict real date, valid time, and an authoritative scheduled occurrence; then return this result as a read-only quote. On `/client-profile`, separately return the read-only profile quote as display state before Continue/payment on selected Drop-in, Summary, and Payment surfaces. Neither quote creates a Stripe intent or session, purchase, reservation, or payment state.
9. When creating a final PaymentIntent or trusted `/api/profile/checkout/session`, repeat steps 2–7 against current authoritative course, date, identity, entitlement, package, and booking-shape state. If any of those change after a quote, the freshly revalidated result wins. Never trust a client quote or amount.
10. Create Stripe checkout with the freshly chosen amount and server-generated reason metadata.

## Trust Boundaries

- Course promotion configuration is staff-authorized input, but still normalized on every write and read.
- The client may carry course/date/time context only; it cannot select a promotion, amount, quote, channel, or identity. Public quote identity is the optional authenticated Clerk user ID only; profile quote eligibility requires the authenticated Clerk identity and never submitted contact fields.
- Public booking derives its channel only from the dedicated server route/context; profile derives from its existing trusted source context. Quotes are display state only, never payment authority; `/api/profile/checkout/session` independently revalidates and wins.
- Kiosk derives only from validated terminal/session authority.
- Ordinary remote public booking hides cash and its server path rejects cash; trusted kiosk cash retains its existing authority.
- Delivered Heritage status comes from structured purchase metadata resolved against exact identity.

## Compatibility

- No Prisma schema migration is required.
- Existing schedule rules remain valid when `promotions` is absent.
- Legacy `specialDiscount` remains parseable for editor migration but has no checkout authority.
- Medal audiences can be added as new validated enum members only after their authoritative source is specified.
- Public, trusted-kiosk, and mobile hosted-session flows remain separate; coupon, addon, multi-participant, and consecutive-class exclusions remain unchanged.

## Delivery Slices

1. Specification and promotion domain/API contract.
2. Dedicated wizard step.
3. Payment-free public-booking quote, fresh PaymentIntent revalidation, cash-boundary enforcement, and label integration.
4. Heritage data rollout and live verification.

Each PR targets `codex/develop`, stays below 400 changed lines, links `#539`, and carries exactly one `type:*` label.
