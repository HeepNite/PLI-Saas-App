# Design: Profile Booking Consecutive Promo

## Flow

```mermaid
sequenceDiagram
  participant User
  participant ProfilePageClient
  participant EnrollModal
  participant OfferAPI as consecutive-offer API
  participant Checkout

  User->>ProfilePageClient: Select class from profile booking
  ProfilePageClient->>EnrollModal: Open with profile-booking date/time + isPackageHolder
  EnrollModal->>OfferAPI: GET courseSlug/date/time
  OfferAPI-->>EnrollModal: Later linked class offer or null
  EnrollModal->>User: Show promo step when offer exists
  User->>EnrollModal: Accept or decline
  EnrollModal->>Checkout: Submit existing payload fields
```

## Implementation Notes

- `ProfilePageClient` computes `profileHasUsablePackage` from `packagesData`.
- `EnrollModal` fetch gate becomes QR mobile OR check-in OR profile booking.
- Existing `effectiveIsPackageHolder` handles pricing once `isPackageHolder` is passed.

## Security / Validation

- No new auth path.
- Existing checkout validation remains authoritative for submitted primary and consecutive fields.
- Consecutive offer lookup remains non-mutating.

## Rollback

- Revert the `EnrollModal` fetch-gate change and `ProfilePageClient` prop wiring.
