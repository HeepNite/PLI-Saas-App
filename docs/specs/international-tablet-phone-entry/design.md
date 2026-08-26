# International Tablet Phone Entry - Technical Design

## Intent

Introduce one environment-neutral phone domain and one repository-native tablet field, then route all affected tablet and server paths through those boundaries. The design changes phone interpretation and identity safety without refactoring unrelated enrollment, check-in, recovery, or checkout behavior.

## Architecture Overview

```text
Country search + national keypad input
  -> shared phone-entry controller
  -> shared phone domain (libphonenumber-js/max)
       -> valid: canonical E.164 + canonical digits + national display
       -> invalid: typed non-sensitive reason
  -> existing tablet flow action
  -> existing API route validates again
  -> exact Clerk/local/purchase identity resolution
       -> no match: existing create/verification path
       -> one coherent match: existing reuse path
       -> conflict: fail closed before mutation
```

## Shared Phone Domain

Create a focused module under `lib/phone/` that is safe to import from client and server code. It MUST have no React, Prisma, Clerk, or route dependencies.

### Responsibilities

- expose the complete selectable country catalog from `getCountries()`;
- expose calling codes through `getCountryCallingCode()`;
- strictly parse national input with an explicit selected country and `extract: false`;
- strictly parse canonical E.164 input with `extract: false`;
- return `phone.number` as canonical E.164 and a plus-free canonical-digits value;
- provide parser-backed national display formatting;
- build exact lookup candidates, including the bounded legacy US candidate;
- provide discriminated results so callers cannot confuse incomplete, invalid, and valid input.

### Suggested contract

```ts
import type { CountryCode } from "libphonenumber-js/max"

export type ParsedPhone = {
  country: CountryCode
  callingCode: string
  nationalNumber: string
  nationalDisplay: string
  e164: string
  digits: string
}

export type PhoneParseResult =
  | { ok: true; phone: ParsedPhone }
  | { ok: false; reason: "empty" | "incomplete" | "invalid" | "unsupported_country" | "unresolved_country" | "non_geographic" }

export function parseNationalPhone(input: string, country: CountryCode): PhoneParseResult
export function parseCanonicalPhone(input: string): PhoneParseResult
export function formatNationalDraft(input: string, country: CountryCode): string
export function buildExactPhoneLookup(phone: ParsedPhone): {
  e164: string
  digitCandidates: string[]
}
```

`buildExactPhoneLookup()` returns `[phone.digits]` for every country. It may append `phone.nationalNumber` only when `phone.country === "US"` and the national number is exactly the parser-derived US national value. It MUST never slice the last ten digits of an arbitrary number.

Every successful `ParsedPhone` requires a concrete `phone.country` present in the supported country catalog. Non-geographic service numbers and canonical values with unresolved country are typed failures for this personal-number feature.

### Import and metadata discipline

- Import from `libphonenumber-js/max` only inside `lib/phone/` and the smallest formatter adapter needed by the field.
- Do not expose library-specific objects outside the domain contract.
- Do not import metadata through unrelated checkout or layout modules.
- Keep the dependency and lockfile update in a dedicated foundational work unit with domain tests.

## Tablet UI Boundary

Create one controlled `InternationalPhoneField` (final name may follow nearby component naming) used by both enrollment and returning identification.

### Component responsibilities

- render a persistent phone label;
- render a country trigger and searchable country selector;
- render the national-number display/input;
- reuse `KioskNumericKeypad` for digit, backspace, and clear actions;
- expose selected country, national draft, canonical E.164 or `null`, touched state, and validation state through explicit callbacks;
- retain input across loading and retry errors;
- implement accessible focus and error associations.

### Component non-responsibilities

- no Clerk calls;
- no API calls;
- no database candidate generation;
- no user lookup or conflict policy;
- no enrollment phase transitions;
- no returning-student miss counting.

### State flow

```text
digit/paste/country selection
  -> update { selectedCountry, nationalInput }
  -> format draft through phone domain
  -> parse strict national phone
  -> emit canonical E.164 only when valid
  -> parent enables or disables its existing action
```

When country changes, retain the national digit sequence, reformat it, and clear stale canonical state before revalidation. For national entry under a shared calling code, the explicit selected country is authoritative. For canonical prefill, parse first, derive one concrete supported country, and initialize the national display. If a non-empty prefill is valid as E.164 but has no concrete supported country, fail closed: do not guess, do not default to US, clear canonical validity, show re-entry guidance, and require explicit country selection plus national-number re-entry. Default to US only for a genuinely empty entry.

### Country search

- Build options from `getCountries()` and `getCountryCallingCode()`.
- Resolve an English display name with `Intl.DisplayNames` at the UI boundary, falling back to ISO code if unavailable.
- Normalize searchable text for case and diacritics.
- Match country name, ISO code, calling code with or without `+`.
- Preserve explicit selected country for shared calling codes; never infer or switch solely from calling code.

### Accessibility and touch

- Use an accessible combobox or dialog/listbox implementation with programmatic label, active option, selected option, escape handling, and focus restoration.
- Ensure the country trigger, country options, and keypad actions provide at least 44 by 44 CSS-pixel targets, with at least 8 CSS pixels between adjacent interactive targets where layout permits, plus visible focus.
- Associate inline errors with the number field and set `aria-invalid`.
- Use polite, aggregated announcements for selection/validity changes.
- Respect reduced motion and keep tap/click behavior primary.

## Enrollment Integration

Replace tablet callers' reliance on `formatUSPhone`, `isCompleteUSPhone`, hard-coded `+1`, and ten-digit keypad helpers with the controlled field result.

The existing parent remains responsible for:

- `kioskInfoPhase` and footer transitions;
- contact state;
- new-student verification action;
- account preparation;
- recovery action;
- checkout continuation.

The phone phase is complete only when the field emits a valid canonical E.164. Store that canonical value in `contact.phone` at the parent boundary so downstream existing calls transport one representation.

## Returning-Student Integration

`KioskPinModal` renders the same shared field rather than its US-only `PhoneDisplay` and ten-digit cap. `useKioskPinFlow` owns the canonical value and submits it to the existing identify-and-bootstrap endpoint.

The endpoint:

1. validates canonical E.164 through the shared domain before throttle miss lookup;
2. converts to exact digit candidates;
3. queries all matching local users, not `findFirst`;
4. accepts exactly one coherent match;
5. treats zero matches through the existing miss/throttle behavior;
6. treats multiple matches as a non-sensitive conflict without selecting one.

Invalid input returns `400` before terminal miss mutation. Existing auth, block checks, successful kiosk session creation, package bootstrap, and response contracts remain.

## New-Student Verification and Purchase Lookup

Replace `buildPhoneVariants()` and `buildPhoneQueryFilters()` with shared exact candidates.

### Exact rules

| Store | Query |
| --- | --- |
| Clerk | Exact canonical E.164. |
| `User.phone` | Exact canonical digits; additionally exact parser-derived ten-digit national value for US only. |
| `Purchase.phone` or equivalent stored phone | Same exact digit candidates; no substring filters. |
| Email | Existing case-insensitive exact email behavior. |

Fetch enough matching IDs to detect ambiguity. Do not use `findFirst` where multiple identity candidates are possible.

A legacy US compatibility match is read-only compatibility evidence. The matching path MUST carry the existing stored phone through unchanged and MUST NOT schedule an update merely because the ten-digit fallback matched. A later explicit, independently authorized profile correction may normalize the row, but lookup itself cannot.

## Identity Conflict Boundary

Create or extract a small identity-resolution policy that compares lookup results before writes. It may follow the proven shape in `lib/checkout/special-class-identity.ts`, but it must live in a neutral identity/phone boundary rather than importing a special-class feature.

### Resolution matrix

| Email result | Phone result | Local linkage | Result |
| --- | --- | --- | --- |
| none | none | none | Continue existing new-identity path. |
| user A | none | none/coherent A | Reuse A under existing policy. |
| none | user A | none/coherent A | Reuse A under existing policy. |
| user A | user A | coherent A | Reuse A. |
| user A | user B | any | Conflict; no mutation. |
| user A | user A | linked to B | Conflict; no mutation. |
| any | any | multiple exact local rows | Conflict; no mutation. |

The conflict result should map to an existing API error shape where possible, with a stable non-sensitive code such as `CONTACT_DETAILS_UNAVAILABLE`. Clients show correction/staff-assistance guidance without identifier-specific disclosure.

Concurrent Clerk or Prisma uniqueness failures trigger one exact re-read. The re-read may return the now-coherent identity or conflict; it may not choose a first result.

## Mutation and SMS Ordering

Client validity is advisory. The relevant existing server route MUST parse and validate before calling any function capable of Clerk/local creation, update, link, reuse, SMS preparation, purchase lookup, or recovery creation.

The existing account-preparation sequence may remain where Clerk requires an account for phone-code sign-in, but only after:

1. strict phone validation;
2. exact email and phone lookup;
3. explicit conflict detection.

`EmbeddedSignIn` receives canonical E.164, removes the US-only formatter/gate, and preserves existing code-factor, cooldown, retry, and verification behavior.

## Safe Deployment Sequence

The server/shared transition MUST be independently deployable before connected UI changes:

1. Add shared strict parsing and a transitional server input adapter.
2. The adapter accepts strict `+` E.164 for every supported country and the current formatted/raw US representations for backward compatibility. Only the backward-compatible bare representation may default to US; arbitrary bare international digits are rejected.
3. Replace new-student and returning lookup with exact canonical digits plus the parser-derived exact US legacy candidate. Remove `contains`, suffix, and last-ten matching in this same server transition.
4. In a second server-only slice, route `/api/checkout/intent` and all `prepareCheckoutAccount` paths through strict shared phone validation and explicit Clerk/local email-phone conflict resolution before any account create, update, link, reuse, or SMS preparation.
5. Prove current US clients still work, canonical international route inputs are accepted, invalid checkout phones reach no mutation, and different email/phone identities fail closed.
6. Deploy and verify both server slices.
7. Only then connect enrollment, `EmbeddedSignIn`, and returning-identification UI to the new canonical payload.

This ordering makes server-first deployment safe and preserves UI rollback: the transitioned server accepts both old US clients and new canonical clients, while checkout/account preparation is already conflict-safe. UI activation MUST NOT precede either deployed server boundary.

## Recovery

The existing recovery-draft endpoint validates with `parseCanonicalPhone()` and passes `phone.e164` into `issueRecoveryDraft`. Do not route it through the digits-only generic normalizer. No schema or recovery state-machine change is required because recovery phone columns are strings.

Staff review and final creation keep the leading `+`; existing staff international input remains compatible.

## Existing Helpers and Migration Boundary

Do not delete US helpers globally in the first implementation. Migrate only affected tablet and server callers. Keep non-tablet callers stable unless their route is part of the exact identity boundary. Once no affected caller relies on `isCompleteUSPhone`, dead helper cleanup may occur in the same bounded work unit that proves no remaining use.

## Failure Handling

| Failure | Behavior |
| --- | --- |
| Incomplete/invalid national input | Inline actionable error; action disabled; no request. |
| Server rejects canonical phone | `400`, retain input, no mutation. |
| Country search has no result | Empty state; preserve selection and input. |
| Identity conflict | Stable non-sensitive conflict response; no mutation; staff/correction guidance. |
| SMS/network/provider failure | Preserve input; existing retry/cooldown behavior. |
| Metadata/parser exception | Generic retryable error; fail closed before mutation. |
| Multiple legacy/canonical local rows | Conflict, never `findFirst`. |
| Canonical prefill has no concrete supported country | Do not guess; invalidate canonical state and require explicit country selection plus re-entry. |

## Affected Areas

Likely focused areas, subject to implementation-time CodeGraph verification:

- `lib/phone/*` - new environment-neutral domain.
- `package.json` and lockfile - `libphonenumber-js`.
- `components/front/checkin/KioskNumericKeypad.tsx` or a narrow phone controller adapter.
- `components/front/courses/enroll/steps/EnrollInfoStep.tsx`.
- `components/front/courses/enroll/hooks/useEnrollNavigationActions.ts` and related validation/init helpers.
- `components/front/courses/EnrollModal.tsx` prefill/default handling.
- `components/front/checkin/KioskPinModal.tsx` and `useKioskPinFlow.ts`.
- `components/front/auth/EmbeddedSignIn.tsx`.
- `app/api/checkin/qr/new-student/verify/route.ts`.
- `app/api/checkin/phone/identify-and-bootstrap/route.ts`.
- `app/api/checkin/qr/new-student/recovery-draft/route.ts`.
- `app/api/checkout/intent/route.ts` and its existing checkout preparation callers.
- `lib/checkout.ts`, `lib/clerk-users.ts`, and/or a neutral resolver extracted from them.
- Existing focused unit, route, component, and E2E tests.

## Test Strategy

### Domain unit tests

- Valid examples from US, Mexico, Ecuador, Peru, Argentina, Chile, and at least one additional metadata country.
- Invalid, incomplete, impossible, surrounding-text, and overlong values.
- Canonical E.164 and digits output.
- Shared calling-code behavior with explicit country.
- Non-geographic and unresolved-country canonical input fails closed.
- Country switch revalidation.
- Exact candidate generation and US-only legacy candidate.
- `AsYouType`/backspace/clear behavior without a universal length cap.

Use test numbers valid under installed metadata and avoid real personal numbers.

### Component tests

- US default, resolvable canonical prefill, unresolved-prefill re-entry, searchable selector, no-results state, keyboard/focus flow, minimum 44-by-44 touch targets, minimum 8-pixel adjacent spacing, inline errors, country switch, paste, and keypad behavior.
- Enrollment and returning surfaces emit the same canonical phone for the same input.
- Busy state prevents duplicate country changes and duplicate parent actions while preserving draft input; network errors also preserve input.

### Route and identity tests

- Server rejects malformed phones before all mutation mocks.
- Exact international local/purchase lookup cannot cross-match a shared suffix.
- Exact legacy US row matches only a US canonical phone.
- A legacy US fallback match performs no phone update merely because it matched.
- Multiple exact matches and email/phone disagreement return conflict.
- Concurrent uniqueness re-read remains coherent or conflicts.
- Returning invalid input does not consume a terminal miss.
- Recovery stores canonical E.164 including `+`.
- Forced parser/metadata exceptions return a generic failure before every mutation mock.
- `/api/checkout/intent` and `prepareCheckoutAccount` reject invalid phone and Clerk/local email-phone disagreement before every identity mutation mock.

### Integration/E2E tests

- Tablet new-student enrollment with a valid non-US phone through SMS handoff.
- Returning-student identification with a valid international phone.
- Existing US tablet flow regression.
- Selector and keypad operation at tablet viewport with keyboard-accessible fallback, measured 44-by-44 minimum targets, and at least 8 pixels between adjacent interactive targets where layout permits.

## Rollout and Maintenance

- No data migration or feature-wide schema rollout is required.
- Keep dependency updates visible because strict validity follows metadata currency.
- Monitor non-sensitive rates of invalid input, conflict responses, SMS preparation failures, and returning identification misses by category, not raw PII.
- Roll back by reverting the bounded UI/domain/route work units; stored phone representation remains unchanged.
