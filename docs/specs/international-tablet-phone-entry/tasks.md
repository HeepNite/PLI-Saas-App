# International Phone Entry Implementation Plan

## Preconditions

- Re-read this specification and use CodeGraph against the implementation branch before each work unit.
- Write failing focused tests before implementation and keep tests with the changed behavior.
- Do not activate a UI surface before its server validation/identity boundary is deployed and verified.
- Do not add a migration, endpoint, or dependency beyond the resolved parser without returning to this specification.

## Work Unit 1 — Special Salsa reservation phone entry (priority: this Sunday)

**Goal:** Deliver the first end-to-end country-aware phone slice at the actual Special Salsa route.

1. Add or integrate the shared strict `lib/phone` domain and metadata dependency only if the selected implementation base does not already contain the verified foundation.
2. Replace the reservation dialog phone field in `components/front/special-salsa-class/SpecialSalsaClassLanding.tsx` with the shared selector/national-entry UI, US default, and US/MX/AR coverage.
3. Route canonical E.164 through the existing special checkout request and `lib/checkout/special-class-identity.ts`; replace prefix-regex/digits-only acceptance with strict parse plus exact conflict-safe resolution.
4. Preserve special checkout idempotency, capacity, price, Stripe redirect, guest sessionlessness, existing video/autoplay behavior, and all dialog focus behavior.
5. Add domain, component, checkout-route, and identity tests proving zero mutation/hold on invalid or conflicting input.

**Required tests:** US default without typed `+1`; MX/AR E.164 submission; strict-paste rejection; exact Clerk/local resolution; conflict; US legacy read-only candidate; no invalid parser-error mutation; existing Special Salsa reservation and reduced-motion/video regressions.

**Deployment gate:** Deploy and manually verify a US, MX, and AR reservation path in the target environment before Sunday. If the shared foundation is unmerged, integrate it as part of this work unit rather than assuming its branch state.

## Work Unit 2 — Shared server transition and lookup safety

1. Make every identified server input boundary accept canonical E.164 plus only the current raw/formatted US compatibility forms.
2. Replace substring, suffix, last-ten, and implicit-prefix lookup with exact candidates in new-student verification and returning identify-and-bootstrap.
3. Prove invalid input precedes lookup, terminal miss accounting, SMS preparation, and mutation.

**Required tests:** formatted/raw/canonical US, canonical MX/AR, suffix non-match, no non-US bare-digit inference, exact legacy US, parser failure, and no legacy rewrite.

## Work Unit 3 — Checkout, Clerk, recovery, and QR hardening

1. Route `/api/checkout/intent`, every `prepareCheckoutAccount` path, QR/new-student verification, and recovery draft creation through shared validation and conflict policy.
2. Preserve canonical E.164 in Clerk and recovery; use exact local/purchase candidates.
3. Verify email/phone disagreements and concurrent uniqueness re-reads fail closed before all mutation mocks.

**Required tests:** checkout/Clerk/local conflict matrix, recovery E.164 preservation, QR route rejection before mutation, and existing authorization/rate-limit regressions.

## Work Unit 4 — Reusable field and enrollment/SMS activation

1. Complete the controlled field's search, keyboard/keypad, busy, focus, target-size, and error behavior.
2. Replace `formatUSPhone`, `isCompleteUSPhone`, hard-coded `+1`, and ten-digit gates in enrollment and `EmbeddedSignIn` callers.
3. Store/transport canonical E.164 without changing enrollment phases or SMS cooldown/factor behavior.

**Required tests:** field behavior, US/MX/AR enrollment, SMS receives exact E.164, prefill/switch/paste, accessibility, busy duplicate prevention, and US regression.

## Work Unit 5 — Returning kiosk/QR activation and complete inventory closure

1. Replace `KioskPinModal` US-only display and ten-digit completion with the shared field and canonical submit.
2. Verify kiosk/QR identify behavior, miss throttling, terminal auth, session creation, and no cross-country suffix match.
3. Use CodeGraph and the repository inventory to enumerate every remaining customer phone-entry surface; migrate it or record evidence-based exclusion in `analysis.md` before declaring complete.

**Required tests:** US legacy and international identification, invalid input does not consume a miss, double-submit makes one request, QR regressions, and an inventory completion check.

## Work Unit 6 — Cross-flow verification and rollout

1. Execute focused unit/route/component tests, affected API suite, typecheck, lint, and tablet/mobile E2E coverage.
2. Verify deployment order and document non-PII evidence for US/MX/AR entry across Special Salsa, enrollment, and returning identification.
3. Keep compatibility adapters until all connected clients use canonical E.164; remove only with caller evidence and regression coverage.

## Completion checklist

- [ ] Work Unit 1 is delivered before broader activation and preserves Special Salsa non-phone behavior.
- [ ] All discovered customer phone-entry surfaces have an evidence-backed outcome.
- [ ] No malformed or conflicting phone reaches identity, recovery, SMS, checkout, or hold mutation.
- [ ] Exact international matching and US legacy compatibility are tested.
- [ ] US/MX/AR selector and national-entry flows are tested end to end.
