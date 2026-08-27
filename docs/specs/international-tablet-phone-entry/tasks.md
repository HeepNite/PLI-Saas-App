# International Tablet Phone Entry - Tasks

## Delivery Preconditions

- [ ] Re-read `requirements.md`, `resolve.md`, and `design.md` before implementation.
- [ ] Re-run CodeGraph exploration for every symbol in the selected work unit because the index and branch may have moved.
- [ ] Do not implement a schema migration or new endpoint without returning to spec resolution.
- [ ] Keep tests in the same work unit as the behavior they verify.
- [ ] Normalize source before review; each review slice should remain at or below 400 authored changed lines where realistically possible.
- [ ] Do not activate connected international UI until Work Units 2, 3A, and 3B are implemented, tested, deployed, and verified.

## Review Workload Forecast

| Field | Forecast |
| --- | --- |
| Estimated authored changed lines | **2,080-2,865** additions plus deletions, exactly equal to the sum of all eight Work Units (1, 2, 3A, 3B, and 4-7), including tests and lockfile but excluding generated artifacts |
| Estimated affected files | 24-36 |
| 400-line budget risk | High for a single PR; Work Units 2 and 3B are High at 320-400 and 300-400; other slices are Low-to-Medium |
| Chained PRs recommended | Yes, because the exact total substantially exceeds 400 lines and the work has dependency-safe review boundaries |
| Suggested review time | 30-60 minutes per slice |
| Size exception | Not justified by current evidence |

### Forecast arithmetic

| Work unit | Range |
| --- | ---: |
| 1. Phone domain and metadata | 220-340 |
| 2. Backward-compatible exact server transition | 320-400 |
| 3A. Identity resolution and mutation-safety primitives | 260-360 |
| 3B. Checkout, kiosk, and recovery integration | 300-400 |
| 4. Reusable tablet phone field | 300-390 |
| 5. Enrollment and Embedded SMS integration | 320-395 |
| 6. Returning-student UI integration | 240-340 |
| 7. Cross-flow acceptance verification | 120-240 |
| **Exact total** | **2,080-2,865** |

Arithmetic: minimum `220 + 320 + 260 + 300 + 300 + 320 + 240 + 120 = 2,080`; maximum `340 + 400 + 360 + 400 + 390 + 395 + 340 + 240 = 2,865`.

If Work Unit 2 cannot remain at or below 400 authored lines with tests, split it into consecutive new-student and returning-identification server slices, deploy both before Work Unit 3A, and recalculate this table before implementation. Do not hide the overage.

```text
1. Phone domain and metadata
   -> 2. Backward-compatible exact server transition [DEPLOY]
      -> 3A. Identity resolution and mutation-safety primitives [DEPLOY]
         -> 3B. Checkout, kiosk, and recovery integration [DEPLOY]
            -> 4. Reusable tablet phone field (disconnected until 2+3A+3B deployed)
               -> 5. Enrollment and Embedded SMS activation
               -> 6. Returning-student UI activation
                  -> 7. Cross-flow acceptance verification
```

## Work Unit 1 - Phone Domain and Metadata

**Goal:** Establish one environment-neutral source of phone validity, canonicalization, formatting, concrete country resolution, and exact lookup candidates.

**Estimated changed lines:** 220-340.

**Dependencies:** None.

- [ ] Add `libphonenumber-js` and lockfile changes without adding a UI phone library.
- [ ] Create the shared `lib/phone/` contract described in `design.md` using `libphonenumber-js/max`.
- [ ] Implement strict national and canonical parsing with `extract: false`.
- [ ] Return parser-owned E.164 and canonical digits only when a personal number resolves to one concrete supported country.
- [ ] Treat non-geographic and unresolved-country canonical values as typed failures.
- [ ] Implement global country/calling-code catalog and national draft formatting.
- [ ] Implement exact lookup candidates with the US-only legacy candidate.
- [ ] Add table-driven tests for global valid numbers, invalid input, strict extraction, shared calling codes, unresolved/non-geographic input, and legacy US candidates.

**Focused verification:**

```bash
npm run test -- tests/phone.test.ts tests/phone-domain.test.ts
npm run typecheck
```

**Rollback boundary:** Remove the new dependency, lockfile entries, shared module, and tests; no production caller should depend on it before Work Unit 2.

## Work Unit 2 - Backward-Compatible Exact Server Transition

**Goal:** Make verification and returning lookup safe for current US clients and future canonical international clients before connected UI changes.

**Estimated changed lines:** 320-400. High cap risk; split as described above if code plus tests exceed 400.

**Dependencies:** Work Unit 1.

- [ ] Add a transitional server adapter accepting strict canonical `+` E.164 plus current formatted/raw US representations.
- [ ] Default only the current bare ten-digit representation to US; reject arbitrary bare non-US digits.
- [ ] Replace new-student `contains`, suffix, last-ten, and inferred-`+1` matching with exact canonical digits plus the exact parser-derived US legacy candidate.
- [ ] Apply the exact candidate policy to returning identify-and-bootstrap.
- [ ] Preserve route authorization, rate limits, terminal miss behavior, purchase outcomes, and response shapes.
- [ ] Fail invalid input and forced parser/metadata exceptions before identity lookup, terminal miss mutation, or purchase lookup.
- [ ] Keep a legacy US fallback match read-only; do not rewrite or normalize the stored row merely because it matched.
- [ ] Test current formatted US, raw US, canonical US, canonical non-US, suffix non-match, substring removal, invalid input, parser exception, exact legacy match, and no fallback-triggered update.

**Focused verification:**

```bash
npm run test -- tests/api/checkin-qr-new-student-verify.test.ts tests/api/checkin-phone-identify-and-bootstrap.test.ts tests/phone-domain.test.ts
npm run test:api
npm run typecheck
npm run lint -- app/api/checkin/qr/new-student/verify app/api/checkin/phone lib/phone tests/api
```

**Deployment gate:** Deploy and verify this slice before Work Unit 3A and before any UI activation. Keep the compatibility adapter through UI rollout.

**Rollback boundary:** Revert route integration and tests while leaving the unused shared domain intact. Roll back Work Units 3B and 3A first if present; do not activate international UI against the pre-transition server.

## Work Unit 3A - Identity Resolution and Mutation-Safety Primitives

**Goal:** Establish pure exact identity resolution and mutation-safe account primitives before route integration.

**Estimated changed lines:** 260-360.

**Dependencies:** Work Units 1-2; Work Unit 2 MUST be deployed and verified first.

- [ ] Create or extract a pure exact Clerk/local identity resolver that consumes complete email and phone snapshots and returns new, coherent reuse, or conflict without writing.
- [ ] Fetch complete exact Clerk email and phone matches plus all exact local canonical/legacy candidates; reject multiple, split, or incompatible Clerk/local identities without choosing a first result.
- [ ] Reuse one coherent local-linked Clerk identity with zero Clerk or database writes.
- [ ] Provide a safe Clerk ensure/create/update entry that cannot perform an email-only mutation before a complete exact email-and-phone conflict re-read.
- [ ] Apply the same resolver after Clerk and Prisma uniqueness races, validating the actual Clerk ensure/create return identity and the actual Prisma upsert return identity before success.
- [ ] Add parser, conflict, coherent-reuse, and concurrency tests at resolver/account-helper level, including conflict injected inside the real Clerk ensure/create window and the real Prisma upsert return window, with explicit zero-mutation assertions.
- [ ] Keep checkout routes, kiosk-session behavior, recovery drafts, and all UI integration out of this unit.

**Focused verification:**

```bash
npm run test -- tests/checkout-identity.test.ts
npm run typecheck
npm run lint -- lib/checkout.ts lib/clerk-users.ts lib/users.ts lib/phone tests/checkout-identity.test.ts
```

**Deployment gate:** Deploy and verify this primitive slice after Work Unit 2 and before Work Unit 3B. It is not sufficient for UI activation by itself.

**Rollback boundary:** Before Work Unit 3B, revert only the resolver/account-helper primitives and their tests. After Work Unit 3B, roll back 3B first; no route or UI activation may remain dependent on removed primitives.

## Work Unit 3B - Checkout, Kiosk, and Recovery Integration

**Goal:** Integrate Work Unit 3A across checkout, kiosk, and recovery paths and prove mutation safety at real route and persistence windows.

**Estimated changed lines:** 300-400.

**Dependencies:** Work Units 1-3A; Work Units 2 and 3A MUST be deployed and verified first.

- [ ] Route `/api/checkout/intent`, `prepareCheckoutAccount`, and every reachable new-student path through strict shared phone validation and the Work Unit 3A resolver, including authenticated `qr_phone`.
- [ ] Validate stored kiosk-session phone input through transitional parsing without blindly prepending `+`; preserve compatibility only for exact parser-confirmed legacy US input.
- [ ] Resolve kiosk sessions without touch, validate complete Clerk/local identity coherence, and touch the session only after successful validation and resolution.
- [ ] Update recovery draft creation to preserve canonical E.164 including `+` and fail before recovery mutation on invalid input or parser failure.
- [ ] Preserve stable non-sensitive errors plus existing authorization, rate limits, SMS policy, checkout behavior, and recovery security boundaries.
- [ ] Add route-level checkout intent and reachable new-student tests that exercise the actual Clerk ensure/create and Prisma upsert return windows, with explicit zero-mutation assertions.
- [ ] Prove a conflict injected inside the real Clerk ensure/create window and the real Prisma upsert return window cannot produce success or mutation after conflict detection.
- [ ] Prove a coherent local-linked Clerk identity is reused with zero writes; invalid or conflicting stored kiosk identity causes zero session touch; and valid parser-confirmed US legacy stored identity remains compatible.
- [ ] Prove parser exception, invalid input, and non-geographic input cause zero Clerk, database, checkout, SMS, and recovery mutation.
- [ ] Keep all connected international UI activation out of this unit.

**Focused verification:**

```bash
npm run test -- tests/checkin/checkout-api-adapter.test.ts tests/checkout-identity.test.ts tests/api/student-recovery.test.ts tests/lib/student-recovery.test.ts
npm run test:api
npm run typecheck
npm run lint -- app/api/checkout/intent app/api/checkin/qr lib/checkout.ts lib/clerk-users.ts lib/users.ts lib/phone tests/api tests/lib tests/checkin
```

**Deployment gate:** Deploy and verify this slice after Work Unit 3A and before Work Unit 4 is connected to a live flow or any Work Unit 5+ UI activation. Evidence MUST cover every learned acceptance case above. Work Units 2, 3A, and 3B MUST all remain deployed and verified before UI activation.

**Rollback boundary:** Revert checkout, kiosk-session, recovery integration, and route-level tests while leaving Work Unit 3A primitives and Work Unit 2 compatibility deployed. Do not activate international UI unless Work Units 2, 3A, and 3B remain deployed.

## Work Unit 4 - Reusable Tablet Phone Field

**Goal:** Provide the country search and national keypad UX without identity or flow behavior.

**Estimated changed lines:** 300-390.

**Dependencies:** Work Units 1-3B. It may be reviewed before deployment completes but MUST remain disconnected until Work Units 2, 3A, and 3B are deployed and verified.

- [ ] Create the controlled repository-native international phone field.
- [ ] Generate searchable country options supporting name, ISO, and calling-code search.
- [ ] Implement empty-only US default, resolvable prefill, fail-closed unresolved prefill, shared calling-code selection, country switch, paste, digit, backspace, and clear.
- [ ] Reuse `KioskNumericKeypad` without a universal phone-length cap.
- [ ] Block duplicate country selection/change events while busy without changing the draft.
- [ ] Implement labels, combobox/dialog-listbox semantics, focus, error association, reduced motion, 44-by-44 targets, and 8-pixel adjacent spacing.
- [ ] Test search, selection, focus restoration, shared calling codes, unresolved prefill, keypad, busy duplicate prevention, target sizing/spacing, and parser failure.

**Focused verification:**

```bash
npm run test -- tests/checkin/numeric-keypad.test.ts tests/checkin/international-phone-field.test.tsx
npm run typecheck
npm run lint -- components/front/checkin lib/phone tests/checkin/international-phone-field.test.tsx
```

**Runtime harness:** At 768x1024, measure 44-by-44 minimum targets and 8-pixel adjacent spacing; verify tap, keyboard, focus return, busy behavior, and no overflow.

**Rollback boundary:** Remove only the field/adapter and tests; Work Units 1-3B remain independently safe for current clients.

## Work Unit 5 - Enrollment and Embedded SMS Activation

**Goal:** Connect tablet enrollment and sign-in only after all server boundaries are deployed.

**Estimated changed lines:** 320-395.

**Dependencies:** Work Units 1-4; Work Units 2, 3A, and 3B MUST be deployed and verified before activation.

- [ ] Integrate the shared field into tablet `EnrollInfoStep` while preserving phase order, footer ownership, and keypad layout.
- [ ] Replace `+1 ` initialization, US-only prefill, `isCompleteUSPhone`, and ten-digit assumptions in affected enrollment state.
- [ ] Store canonical E.164 in `contact.phone` and use shared valid state for navigation.
- [ ] Prevent duplicate Continue/Verify account-preparation actions while busy without clearing input.
- [ ] Update `EmbeddedSignIn` for canonical international phones while preserving cooldown, retry, factor, and code behavior.
- [ ] Test US regression, non-US enrollment, unresolved prefill, country switch, malformed preflight, retention, busy duplication, parser failure, and exact SMS E.164.

**Focused verification:**

```bash
npm run test -- tests/phone.test.ts tests/checkin/use-enroll-navigation-actions.test.tsx tests/checkin/use-enroll-init.test.tsx tests/checkin/use-enroll-effects.test.tsx tests/checkin/EmbeddedSignIn.test.tsx
npm run typecheck
npm run lint -- components/front/courses components/front/auth tests/checkin
```

**Runtime harness:** Exercise US and non-US enrollment through SMS; double-tap while busy and verify one request, exact E.164, and retained input after error.

**Rollback boundary:** Revert enrollment/sign-in integration; deployed Work Units 2-3B continue accepting the restored current US client.

## Work Unit 6 - Returning-Student UI Activation

**Goal:** Connect returning identification only after all server boundaries are deployed.

**Estimated changed lines:** 240-340.

**Dependencies:** Work Units 1-4; Work Units 2, 3A, and 3B MUST be deployed and verified before activation.

- [ ] Replace `KioskPinModal`'s US-only display with the shared field.
- [ ] Update `useKioskPinFlow` to submit canonical E.164.
- [ ] Prevent duplicate Continue/country actions while busy and retain the draft.
- [ ] Preserve auth, rate limits, throttling, kiosk-session creation, and bootstrap behavior.
- [ ] Test US/non-US submission, unresolved prefill, busy duplication, parser failure before request, retention, and throttle regression.

**Focused verification:**

```bash
npm run test -- tests/checkin/numeric-keypad.test.ts tests/checkin/kiosk-phone-flow.test.tsx tests/api/checkin-phone-identify-and-bootstrap.test.ts
npm run typecheck
npm run lint -- components/front/checkin tests/checkin tests/api
```

**Runtime harness:** Identify US legacy and canonical international fixtures; verify one request under double-tap, no suffix cross-match, and no legacy-row rewrite.

**Rollback boundary:** Revert returning UI/hook changes; deployed Work Units 2-3B continue accepting the restored raw US client.

## Work Unit 7 - Cross-Flow Acceptance Verification

**Goal:** Prove complete behavior and deployment dependencies across tablet surfaces.

**Estimated changed lines:** 120-240.

**Dependencies:** Work Units 1-6; deployed evidence for Work Units 2, 3A, and 3B is mandatory.

- [ ] Cover current US compatibility, US/non-US enrollment and SMS, and international returning identification.
- [ ] Verify identical canonical E.164 across tablet flows, shared calling codes, and unresolved-prefill failure.
- [ ] Verify 44-by-44 targets, 8-pixel spacing, keyboard operation, errors, and reduced motion at 768x1024.
- [ ] Verify busy state prevents duplicate country, Continue, Verify, identification, and checkout/account-preparation actions.
- [ ] Verify invalid phone, conflict, and parser exception fail before all identity/recovery mutation spies.
- [ ] Verify legacy fallback does not rewrite stored phone and suffix conflicts disclose no account existence.
- [ ] Record exact commands, deployment evidence, measured dimensions, fixtures, and residual metadata risk.

**Final verification:**

```bash
npm run test
npm run typecheck
npm run lint
npm run test:e2e -- e2e/international-tablet-phone-entry.spec.ts
```

Run `npm run build` only where documented prerequisites exist; it invokes `prisma generate` and MUST NOT run a migration.

**Rollback boundary:** Revert acceptance-only tests independently; production rollback follows Work Units 6 through 1. Keep Work Units 2, 3A, and 3B deployed until connected UI is rolled back.

## Completion Checklist

- [ ] Every requirement and acceptance scenario has a test reference.
- [ ] Work Units 2, 3A, and 3B were implemented, tested, deployed, and verified before connected international UI activation.
- [ ] `/api/checkout/intent` and `prepareCheckoutAccount` reject invalid/conflicting identity before mutation.
- [ ] Work-unit arithmetic remains exactly 2,080-2,865.
- [ ] No slice exceeds 400 authored lines without explicit approval.
- [ ] No production route uses international substring matching.
- [ ] No malformed, conflicting, or parser-failed phone reaches identity mutation.
- [ ] Existing US behavior and legacy matching pass without fallback-triggered rewrite.
- [ ] Touch targets/spacing and busy-state duplicate prevention pass.
- [ ] No schema migration, dependency beyond `libphonenumber-js`, or new endpoint was introduced.
