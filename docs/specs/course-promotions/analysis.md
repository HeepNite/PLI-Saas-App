# Course Promotions — Analysis

## Current State

- `StaffCoursePricingStep` mixes base prices with one hard-coded `specialDiscount` selector.
- Valentine, Christmas, or custom values persist under `CourseCatalog.scheduleRules.specialDiscount` and appear in preview, but booking and checkout never consume them.
- The live development catalog currently has no non-`none` legacy special discount.
- Public booking and profile use `/api/checkout/session` for paid checkout, after public package routing gets the first chance to reserve a package.
- Checkout already resolves authoritative course/service prices and exact identity before Stripe creation.
- Heritage lookup already resolves pending or delivered state from trusted purchase metadata.

## Gap

The singleton cannot express multiple campaigns, date basis, audiences, channels, percentage discounts, or safe conflict resolution. Applying it directly would turn an unbounded display field into pricing authority.

## Reuse

| Existing contract | Reuse |
| --- | --- |
| `CourseCatalog.scheduleRules` JSON | Store bounded `promotions` without a schema migration. |
| Staff course authorization and revision | Protect promotion authoring. |
| Checkout validation and exact identity | Supply trusted base price, occurrence, and audience identity. |
| Heritage entitlement parser | Verify delivered-pin eligibility. |
| Package reservation | Remain ahead of paid promotional checkout. |

## Risks

- Malformed JSON, caller-provided channels, or client prices could underprice checkout unless normalization fails closed.
- Date bases can diverge around midnight unless both use New York.
- Percentage pricing can produce unsupported sub-minimum amounts.
- Legacy configuration must not activate unexpectedly.
- New course slugs must be added to package plans.
- Public labels must not promise restricted prices before identity resolution.

## Review Boundaries

Deliver small dependent slices: domain/API, wizard UI, checkout/presentation, then catalog rollout. Remote catalog changes remain outside source commits and require backup, dry-run, rollback material, and fresh authorization.
