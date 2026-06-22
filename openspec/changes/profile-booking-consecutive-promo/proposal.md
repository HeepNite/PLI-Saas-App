# Proposal: Profile Booking Consecutive Promo

## Intent

Enable profile booking to offer the linked second-class/consecutive promo, matching the already-supported check-in/enroll flow. Users booking from their profile should see the promo before checkout when a later linked class is available.

## Scope

### In Scope
- Enable consecutive promo lookup for profile booking flow.
- Use package-holder promo price automatically when the signed-in profile user has an active usable package.
- Preserve existing checkout split-purchase behavior for cash/card promo purchases.
- Add focused tests for profile booking promo/no-promo/package-holder pricing.

### Out of Scope
- Manual class selector for simultaneous rooms/classes.
- New Prisma models or migrations.
- Staff fast-action promo changes.

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `profile-booking`: profile booking gains consecutive second-class promo behavior.

## Approach

Reuse the existing `EnrollModal` consecutive step and `/api/checkin/terminal/consecutive-offer` contract. Extend the offer-fetch gate to include profile booking, and ensure package-holder pricing is determined from active package state for the signed-in user.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `components/front/courses/EnrollModal.tsx` | Modified | Enable consecutive offer in profile booking flow. |
| `components/front/profile/ProfilePageClient.tsx` | Modified | Pass/package active package context if missing. |
| `app/api/checkin/terminal/consecutive-offer/route.ts` | Modified | Verify pricing supports profile package-holder context. |
| `components/front/courses/enroll/model/checkout-payload.ts` | Modified | Confirm promo fields are preserved from profile booking. |
| `tests/**` | Modified | Add focused regression coverage. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Existing endpoint name is terminal/check-in specific | Med | Reuse first, rename/extract later only if necessary. |
| Wrong promo price for package holders | Med | Add explicit tests for active-package profile user. |
| Duplicate promo purchase edge cases | Low | Reuse existing checkout validation and split purchase flow. |

## Rollback Plan

Revert the profile booking gate/context changes and tests. No schema migration or data cleanup is required.

## Dependencies

- Existing active `CourseLink` records with consecutive prices.
- Existing EnrollModal consecutive step and checkout split purchase support.

## Success Criteria

- [ ] Profile booking shows a consecutive promo when a later linked class exists.
- [ ] Active package holders see package-holder promo price, e.g. `$10` when configured.
- [ ] Users can decline and book only the primary class.
- [ ] Users can accept and checkout primary + promo class through existing payment flow.
- [ ] No promo step appears when no linked later class exists.
