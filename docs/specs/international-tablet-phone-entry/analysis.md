# International Phone Entry Analysis

## Main-based evidence

| Area | Current source | Finding |
| --- | --- | --- |
| Special Salsa route | `app/special-salsa-class/page.tsx` | Renders `SpecialSalsaClassExperience`, then the reservation landing. |
| Special Salsa phone UI | `components/front/special-salsa-class/SpecialSalsaClassLanding.tsx` | Requires a `+`-prefixed regex phone and submits it to the existing checkout-session route. |
| Special Salsa identity | `lib/checkout/special-class-identity.ts` | Uses digit normalization and raw-prefix detection; must use strict canonical parsing. |
| Special Salsa reservation | `lib/checkout/special-class-reservation.ts` | Persists `phone` while capacity/idempotency are independent of phone interpretation. |
| General entry | `components/front/courses/utils/phone.ts` | Hard-codes US `+1`, ten digits, and US completion. |
| Kiosk | `components/front/checkin/KioskPinModal.tsx` | Uses US-only display and ten-digit gate. |
| Embedded SMS | `components/front/auth/EmbeddedSignIn.tsx` | Imports US phone helpers and initializes a US-formatted draft. |
| Server paths | `lib/shared.ts`, check-in, checkout, Clerk, recovery routes | Digits-only normalizer is broadly used and cannot be the international authority. |

## Existing-spec/worktree evidence

The existing dedicated worktree has the same `international-tablet-phone-entry` folder with requirements, resolution, design, tasks, and a partially implemented foundation. It is not `origin/main`; this specification preserves the folder identity and makes no claim that its code is deployed.

## Special Salsa autoplay disposition

The main-based landing source already uses reduced-motion detection before requesting playback, has `autoPlay`, `muted`, `loop`, `playsInline`, plus visible play/pause and sound controls. Its existing Special Salsa specification already defines that behavior. Therefore this plan intentionally does not modify the Special Salsa autoplay contract.

## Inventory rule

The implementation inventory must be generated again against the selected implementation commit because CodeGraph establishes broad blast radius but cannot substitute for current branch evidence. Any newly discovered phone entry must be added here before it is changed.
