# Staff Heritage Pin Medallion

## Goal

Replace the oversized Heritage pin status and delivery rows with a compact medallion over the student avatar. Pending pins appear gray with the country flag and expose the delivery action on hover or keyboard focus. Delivered pins remain active on the avatar. Moving the earned insignia beside the student name is deferred until the campaign closes.

## Tasks

- [x] Define the avatar-medallion interaction and accessibility contract.
- [x] Replace payment-card pin rows with the avatar medallion.
- [x] Apply the same medallion to profile-backed cards and remove duplicate pin rows.
- [ ] Run focused verification, native review, and delivery.

## Evidence

- The current payment-backed card renders a full-width pending-status row plus a full-width red delivery button.
- The user explicitly requested removing both red rows and using one compact badge over the profile image.
- Pending pins now render as gray flag medallions; authorized staff receive a hover/focus delivery action, unauthorized staff receive status only, and delivered pins remain full-color over the avatar.
- Both card variants reuse the same medallion and no longer render duplicate full-width campaign rows.
- Focused medallion, profile presentation, staff card, payment projection, and delivery API tests: 105 passed.
- Typecheck, scoped ESLint, and `git diff --check` passed; candidate size before task evidence is 246 changed lines.
