# International Tablet Phone Entry - Analysis

## Purpose

This analysis records current implementation evidence and risks. It is not the behavioral source of truth; see `requirements.md` and `resolve.md`.

## Current Flow Map

### New-student tablet enrollment

1. `components/front/courses/EnrollModal.tsx` initializes phone state to `+1 ` and reformats prefilled phones with `formatUSPhone`.
2. `components/front/courses/enroll/steps/EnrollInfoStep.tsx` displays a fixed `US` badge, US placeholder, `formatUSPhoneOnChange`, `isCompleteUSPhone`, and the existing kiosk keypad.
3. `components/front/courses/enroll/hooks/useEnrollNavigationActions.ts` appends at most ten US digits, clears to `+1 `, and gates new-student verification with `isCompleteUSPhone`.
4. `components/front/courses/hooks/useNewStudentVerification.ts` posts phone and email to `/api/checkin/qr/new-student/verify`.
5. Account preparation is requested before `EmbeddedSignIn` can prepare a phone-code attempt. The current flow therefore requires a valid identity boundary before any Clerk/local preparation.
6. `components/front/auth/EmbeddedSignIn.tsx` imports the US formatter, `toE164Phone`, and `isCompleteUSPhone`, and emits `Enter a valid US phone number.` for non-US input.

### Returning-student tablet identification

1. `components/front/checkin/KioskPinModal.tsx` collects exactly ten digits, labels the requirement as `10-digit US phone number`, and formats only `(XXX) XXX-XXXX`.
2. `components/front/checkin/useKioskPinFlow.ts` caps input at ten digits and sends the raw value to `/api/checkin/phone/identify-and-bootstrap`.
3. `app/api/checkin/phone/identify-and-bootstrap/route.ts` strips non-digits, then constructs `[phone, phone without leading 1]` or `[phone, 1 + phone]` and performs an exact `in` query. The rule is not country-aware and therefore cannot safely generalize to international input.

### New-student eligibility and purchase lookup

`app/api/checkin/qr/new-student/verify/route.ts` currently:

- strips to digits through the generic `normalizePhone` helper;
- creates last-ten, ten-digit, leading-`1`, and `+1` variants;
- adds both equality and `contains` Prisma filters for each variant;
- uses `findFirst` for local identity and completed-purchase lookup;
- constructs a Clerk phone as `+1` when the submitted input lacks `+`.

This can cross-match unrelated countries that share a suffix and can select one of multiple identities without detecting conflict.

### Identity creation and conflict behavior

- `lib/checkout.ts` accepts any digit string that passes the generic `normalizePhone` minimum and can proceed into Clerk lookup/creation and `upsertUserByIdentifiers`.
- `lib/clerk-users.ts#findClerkUserByIdentifiers` performs email and phone queries but returns the email result first when they resolve to different users.
- `lib/users.ts#upsertUserByIdentifiers` searches by email and phone and has safeguards for an existing different Clerk ID, but it can still select a match rather than represent every cross-identifier conflict explicitly.
- `lib/checkout/special-class-identity.ts` already demonstrates the safer pattern: parallel email/phone lookup, different-user detection, local multi-match detection, and fail-closed handling. This is reusable behavior evidence, not a reason to couple tablet checkout to that feature module.

### Persistence and external boundaries

- `prisma/schema.prisma` defines `User.phone` as nullable and unique. Current local upserts store digits through `normalizePhone`.
- Clerk helpers accept `+`-prefixed E.164-like input and pass that value to Clerk.
- `app/api/staff/students/route.ts#normalizeStaffPhone` already accepts an explicit international `+` value and canonicalizes it to `+` plus digits. It also preserves ten-digit US entry as `+1...`.
- No reusable country selector, country catalog, or phone-number-plan dependency is present in `package.json` or the searched source.

### Recovery

`app/api/checkin/qr/new-student/recovery-draft/route.ts` calls the digits-only `normalizePhone` and stores that result through `issueRecoveryDraft`. The leading `+` is lost, while staff creation expects an E.164 value for the international path. This creates a recovery mismatch for non-US students.

## Prior Contract Conflict

`openspec/changes/kiosk-info-sequential-focus/*` defines the phone phase in US-only terms:

| Prior statement | Conflict |
| --- | --- |
| Continue is enabled when `isCompleteUSPhone` returns true. | International plans have country-specific lengths and validity rules. |
| Phone reaches ten digits. | Ten digits is not a global validity rule. |
| No new dependencies. | Reliable global number-plan validation requires maintained metadata, not regex. |
| US formatter and keypad assumptions remain implicit. | The approved behavior requires a country selector and national entry on every tablet phone surface. |

The prior phase order, footer-driven progression, inline keypad intent, and non-tablet isolation remain compatible. Only its US-only phone contract is superseded.

## Deployment Compatibility Finding

The current connected clients do not all send the same representation: enrollment commonly sends formatted `+1` input, while returning identification sends ten raw US digits. Connecting the international UI before the server accepts canonical global E.164 would create a deployment-order outage. Conversely, keeping the existing suffix/substring matching until after UI activation would expose international payloads to cross-country collisions.

The safe transition is therefore server first: deploy shared parsing and exact lookup while accepting canonical E.164 plus only the current formatted/raw US representations. Then harden `/api/checkout/intent`, `prepareCheckoutAccount`, and their Clerk/local identity resolution so invalid phones and email-phone conflicts stop before mutation. Verify both server slices in deployment, remove suffix/substring matching, and only then connect enrollment and returning UI to send canonical international E.164. The server compatibility adapter remains during rollout so UI rollback is safe.

## Reuse Findings

| Existing asset | Reuse decision |
| --- | --- |
| `KioskNumericKeypad` | Reuse its visual and touch interaction; remove phone-specific universal ten-digit assumptions from callers. |
| Enrollment phased form | Preserve phase order and footer ownership; replace only phone validity/state boundaries. |
| Existing verify, recovery, checkout, and identify endpoints | Reuse; no new endpoint is currently unavoidable. |
| Terminal auth, miss throttling, and kiosk sessions | Preserve without behavioral changes. |
| Recovery draft/ticket model | Preserve schema and authorization model; fix canonical phone serialization. |
| Staff international parsing precedent | Reuse as evidence that downstream Clerk/admin paths accept E.164, but centralize tablet parsing in the new shared phone domain. |
| Special-class explicit conflict detection | Reuse the policy shape through a shared tablet identity resolver, not feature-to-feature imports. |

## UX Research Applied

The required non-persistent UI/UX searches were run for an education SaaS tablet kiosk, country-selector accessibility, Next.js, and React form behavior. Relevant findings:

- persistent form labels and visible focus are high-priority requirements;
- touch targets should be at least 44 by 44 pixels with approximately 8 pixels between targets;
- inline errors need a recovery path and must appear near the field;
- submit actions need loading and error feedback;
- primary interactions cannot depend on hover;
- controlled state should avoid unnecessary broad subscriptions or expensive work on each render.

The generated visual design-system suggestion was not persisted and is not adopted as a new product theme. The current kiosk visual language remains authoritative.

## Dependency Evidence

The official `libphonenumber-js` documentation confirms:

- `libphonenumber-js/max` contains complete metadata and is approximately 145 kB;
- `.isValid()` with `max` performs strict digit-pattern validation beyond length;
- `parsePhoneNumber(..., { extract: false })` requires the whole input to be a phone;
- `PhoneNumber.number` is E.164;
- `getCountries()`, `getCountryCallingCode()`, and `AsYouType` support the required catalog and formatting behavior;
- strict validity depends on metadata remaining current, so dependency updates are operationally relevant.

Context7 documentation lookup was attempted but its monthly quota was exhausted. The official project README was used as the fallback source.

## Risks

| Risk | Evidence | Consequence if unaddressed |
| --- | --- | --- |
| Cross-country suffix collision | New-student verification uses last-ten variants and `contains`. | Wrong student or purchase can be selected. |
| Cross-identifier collision | Clerk helper prefers email when email and phone disagree. | An email identity can receive another identity's phone or local link. |
| Pre-mutation validation gap | Generic digit normalization accepts structurally invalid numbers. | Invalid contact can reach Clerk/local identity preparation. |
| Recovery representation mismatch | Recovery route removes `+`. | International staff recovery can fail or create a different interpretation. |
| Metadata drift | Strict validity reflects installed metadata. | Newly allocated ranges can be rejected when dependency updates lag. |
| Client bundle growth | `max` metadata is about 145 kB. | Unscoped imports can increase unrelated routes' bundles. |
| Shared calling codes | Calling code alone is not always a unique country. | Selector state must remain explicit; calling-code inference alone is unsafe. |
| Unresolved/non-geographic canonical prefill | Some canonical values do not resolve to one selectable country. | Guessing a country can silently change interpretation; fail closed and require explicit re-entry. |
| Deployment-order mismatch | Existing clients send formatted/raw US while new UI sends canonical international E.164, and checkout preparation can mutate identity. | UI-first rollout can break identification, retain unsafe broad matching, or send new payloads through unhardened account mutation. |
| Regression breadth | US helpers have many callers and tests. | A broad replacement could affect non-tablet profile/QR behavior. |

## Architecture Constraints

- Keep the international parsing policy environment-neutral and independently testable.
- Do not alter the database schema.
- Do not introduce a new endpoint based on current evidence.
- Do not replace all repository phone utilities in one broad refactor; migrate the tablet and affected server boundaries deliberately.
- Preserve exact US legacy behavior only where current rows require it.
- Keep identity conflict detection ahead of mutation.
- Deploy both the backward-compatible exact-lookup transition and checkout/account conflict hardening before connecting any international tablet UI.
- Treat user-selected country as authoritative for shared calling codes; reject unresolved or non-geographic canonical prefills for this personal-number feature.

## Recommended Next Focus

Implement the shared domain and exact candidate policy first, then the reusable tablet field, then integrate enrollment and returning identification in bounded slices. Tests must accompany each slice because the dominant risk is divergent normalization between surfaces.
