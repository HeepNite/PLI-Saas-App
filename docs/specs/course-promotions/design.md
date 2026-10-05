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
| Checkout | Derive channel, load course rules, resolve identity/entitlement, compare authorized candidates, emit Stripe amount and metadata. |

## Pricing Flow

1. Resolve exact booking identity and authoritative selected course/session.
2. Let package routing complete before paid checkout.
3. Resolve the existing authoritative service price.
4. Normalize the course promotion list.
5. Filter by active state, trusted channel, date basis/window, single drop-in shape, and audience.
6. Calculate valid promotional candidates from the regular drop-in base.
7. Compare authorized existing and promotional candidates; choose one lowest price.
8. Create Stripe checkout with the chosen amount and server-generated reason metadata.

## Trust Boundaries

- Course promotion configuration is staff-authorized input, but still normalized on every write and read.
- The client may carry course/date/time context only; it cannot select a promotion or amount.
- Public-booking and profile channels derive from existing trusted source context.
- Kiosk derives only from validated terminal/session authority.
- Delivered Heritage status comes from structured purchase metadata resolved against exact identity.

## Compatibility

- No Prisma schema migration is required.
- Existing schedule rules remain valid when `promotions` is absent.
- Legacy `specialDiscount` remains parseable for editor migration but has no checkout authority.
- Medal audiences can be added as new validated enum members only after their authoritative source is specified.

## Delivery Slices

1. Specification and promotion domain/API contract.
2. Dedicated wizard step.
3. Checkout and label integration.
4. Heritage data rollout and live verification.

Each PR targets `codex/develop`, stays below 400 changed lines, links `#539`, and carries exactly one `type:*` label.
