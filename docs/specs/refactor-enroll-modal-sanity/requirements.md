# Refactor EnrollModal Sanity — Requirements

## Goal
Reduce `components/front/courses/EnrollModal.tsx` complexity without changing enrollment, check-in, kiosk, payment, or visual behavior.

## Requirements
- Preserve the existing public `EnrollModal` props and exported helper names.
- Preserve current desktop, mobile, kiosk-terminal, QR checkout, check-in-new, and check-in-existing behavior.
- Client-profile booking may skip the contact / “Your Information” step because the user is already booking from their own authenticated account.
- Extract pure model logic before extracting UI or async effects.
- Add tests for each extracted pure model seam.
- Keep changes reviewable and localized; do not mix unrelated profile, kiosk, payroll, or rate-limit work.

## Acceptance Criteria
- Existing enroll/check-in tests continue to pass.
- `npm run typecheck` passes.
- `EnrollModal.tsx` delegates at least pricing, validation, calendar link generation, or checkout payload construction to tested model helpers.
