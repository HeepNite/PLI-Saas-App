# International Tablet Phone Entry - Requirements

## Status

`READY FOR IMPLEMENTATION`

This file is the behavioral source of truth for international phone entry in tablet flows. When another document conflicts with it, this file and `resolve.md` govern this feature.

## Objective

Allow new and returning students to enter any valid country-backed international phone number supported by the selected phone metadata, while preserving the existing US experience and preventing malformed or conflicting contact data from creating, linking, or reusing the wrong identity.

## Scope

### In scope

- Every tablet phone-entry surface used by:
  - new-student enrollment;
  - returning-student identification;
  - SMS sign-in or verification reached from either flow;
  - supervised recovery drafts created from tablet enrollment.
- A searchable country selector and national-number entry experience.
- Canonical E.164 validation and transport.
- Exact Clerk, local-user, and purchase matching, with a narrowly bounded compatibility rule for legacy US rows stored without the leading `1`.
- Explicit email/phone identity-conflict handling.
- Existing terminal authorization, throttling, SMS cooldown, recovery, checkout, and audit boundaries.

### Out of scope

- Non-tablet profile, staff, or marketing forms, except where an existing shared server boundary must remain compatible.
- A database schema migration or backfill.
- A new API endpoint; existing endpoints MUST be reused unless implementation evidence proves that an acceptance criterion cannot be met safely through them.
- Changes to SMS provider, Clerk configuration, pricing, attendance, payment, PIN, or recovery authorization policy.
- A broad enrollment or check-in refactor.
- Adding `react-phone-number-input` or replacing the kiosk keypad and established tablet visual language.
- Non-geographic service numbers that do not resolve to a concrete supported country, including global toll-free, satellite, and international-network numbering plans. This feature covers personal numbers associated with a selectable country.

## Terms

| Term | Meaning |
| --- | --- |
| Selected country | A country or territory returned by the shared `libphonenumber-js/max` country catalog. |
| National input | The number entered without the selected country's international calling prefix. Formatting characters may be displayed. |
| Canonical phone | A strictly parsed, valid E.164 value such as `+14155552671`. |
| Canonical digits | The canonical phone without `+`, matching the repository's current `User.phone` storage convention. |
| Identity mutation | Clerk or local-user creation, update, linking, reuse, or any write derived from the submitted contact. |
| Legacy US row | An existing US local or purchase phone stored as the exact 10-digit national number instead of canonical digits beginning with `1`. |

## Functional Requirements

### R1. Global country support

1. The country selector MUST be generated from the complete country metadata exposed by `getCountries()` from `libphonenumber-js/max`; US, Mexico, Ecuador, Peru, Argentina, and Chile are examples, not an allowlist.
2. A phone MUST be accepted when strict whole-input parsing for the selected country succeeds and `.isValid()` is true under the installed metadata.
3. Regex length checks, a fixed list of countries, or a generic 8-to-15-digit rule MUST NOT be the authoritative validity boundary.
4. The accepted canonical value MUST be `phone.number` from the parser, not a manually concatenated calling code and digit string.
5. An accepted personal number MUST resolve to one concrete country returned by `getCountries()`. A parsed non-geographic number or a canonical value whose country is unresolved MUST fail closed for this feature.

### R2. Country selection and search

1. An empty phone entry MUST default to the United States.
2. A prefilled canonical phone MUST derive its concrete country when the metadata can do so and MUST NOT be overwritten by the US default.
3. The selector MUST support search by country name, ISO country code, and calling code, case-insensitively and without requiring punctuation.
4. Search results MUST display a textual country name, ISO code, and `+` calling code. Emoji flags MUST NOT be required.
5. A no-results state MUST explain that no country matches and MUST leave the current selection unchanged.
6. Closing the selector without choosing a country MUST leave the phone draft unchanged.
7. The user's explicit country selection MUST disambiguate countries that share a calling code during national-number entry; calling code alone MUST NOT change the selected country.
8. If a canonical prefill cannot resolve to one concrete supported country, the system MUST NOT guess or apply the US default. It MUST clear canonical validity, show a non-sensitive re-entry message, and require explicit country selection and national-number re-entry.

### R3. National-number entry and country switching

1. The visible number field MUST accept and display the national number for the selected country.
2. Tablet flows MUST reuse the current numeric keypad interaction. The keypad MUST no longer impose a universal ten-digit maximum.
3. Formatting MAY use `AsYouType` or an equivalent parser-backed national formatter and MUST NOT change the underlying sequence of entered digits.
4. Backspace MUST remove one entered digit even when the visible trailing character is formatter-generated punctuation.
5. Clear MUST remove the national number while retaining the selected country.
6. On country switch, the existing national digits MUST remain visible, MUST be reformatted for the new country, and MUST be revalidated immediately. Any canonical value derived under the previous country MUST be discarded until the new combination is valid.
7. Pasting a complete `+` E.164 phone MAY update both country and national input when strict parsing succeeds. Otherwise, the paste MUST remain invalid and MUST NOT be silently reduced to an extracted phone substring.

### R4. Canonicalization and validation

1. Client validation MUST provide immediate guidance, but every server route that can identify or mutate a user MUST independently parse the submitted phone through the shared domain boundary.
2. Strict parsing MUST use the selected country for national input and `extract: false` so surrounding text cannot be accepted by extraction.
3. A valid submission MUST transport canonical E.164 between client, API routes, Clerk, SMS verification, checkout preparation, and recovery.
4. Local persistence MAY continue storing canonical digits to preserve the existing schema contract.
5. Empty, incomplete, impossible, invalid, or unparseable input MUST NOT enable Continue or Verify.
6. Invalid phone input MUST be rejected before any identity mutation, checkout identity preparation, SMS attempt, purchase lookup, or recovery-draft creation.
7. Deployment MUST be backward compatible: before any connected tablet UI sends new international payloads, shared/server parsing MUST accept both canonical E.164 and the current formatted or raw US client representation.
8. The compatibility transition MUST remove unsafe suffix, last-ten, and substring matching before global UI activation. Bare non-US digits MUST NOT be guessed as an international country during this transition.
9. Before global UI activation, `/api/checkout/intent` and every path through `prepareCheckoutAccount` MUST use the shared phone boundary, compare Clerk and local email/phone matches explicitly, reject conflicts, and reject invalid phones before any Clerk/local mutation.
10. The exact-lookup transition and checkout/account conflict hardening MUST both be implemented, tested, deployed, and verified before enrollment, `EmbeddedSignIn`, or returning-identification UI sends canonical international payloads.

### R5. New-student enrollment

1. The tablet enrollment phone phase MUST use the shared international entry behavior.
2. The phase Continue action MUST be enabled by valid canonical phone state, not `isCompleteUSPhone` or a ten-digit count.
3. The verified canonical phone MUST remain unchanged through new-student outcome verification, account preparation, SMS, checkout, and completion.
4. Existing US numbers entered with the default US selection MUST continue to format and canonicalize successfully.
5. Changing name or email after phone entry MUST NOT alter the canonical phone.

### R6. Returning-student identification

1. The returning-student tablet modal MUST use the same country selector, national entry rules, keypad behavior, validation states, and canonicalization boundary as enrollment.
2. Identification MUST submit canonical E.164, while the server MAY convert it to canonical digits for exact local lookup.
3. Existing terminal miss throttling, blocked-terminal behavior, and successful kiosk-session creation MUST remain unchanged.
4. An invalid phone MUST be rejected without consuming an identification miss or reaching identity lookup.

### R7. SMS sign-in and verification

1. `EmbeddedSignIn` and every tablet caller MUST accept canonical international phones and MUST NOT reformat or validate them as US-only.
2. Clerk phone-code preparation MUST receive the canonical E.164 value.
3. Existing cooldown, resend, retry, already-signed-in, not-found, and code-verification behavior MUST remain intact.
4. A malformed phone MUST fail locally and at the server boundary before account preparation or SMS dispatch.
5. A provider or network failure MUST preserve the entered country and national number so the student can retry.

### R8. Exact matching and legacy US compatibility

1. Canonical international phones MUST match Clerk by exact E.164 and local users or purchases by exact canonical digits.
2. Substring, `contains`, suffix, last-ten, or inferred `+1` matching MUST NOT be used for non-US phones.
3. For a valid canonical US phone only, local-user and purchase lookup MAY additionally compare the exact 10-digit national number to support legacy rows missing the leading `1`.
4. The US compatibility candidate MUST be the parser-derived US national number. It MUST NOT be generated by slicing an arbitrary international phone.
5. Matching more than one local identity across canonical and legacy candidates MUST be treated as an identity conflict, not resolved with `findFirst`.
6. Existing rows MUST NOT be rewritten merely because they were matched through the compatibility rule.

### R9. Duplicate and cross-identity conflict prevention

1. Email and phone lookups MUST be performed and compared explicitly when both are supplied.
2. If email and phone resolve to different Clerk users, different local users, or incompatible Clerk/local links, the operation MUST stop before mutation.
3. A conflict MUST NOT choose the email result, phone result, oldest row, or first query result implicitly.
4. The client MUST show a recoverable, non-sensitive message directing the student to staff assistance or correction without revealing which identifier belongs to an account.
5. Concurrent uniqueness failures MUST be re-read through the same exact conflict rules; they MUST NOT silently attach one identifier to the other identity.

### R10. Recovery integrity

1. Recovery drafts MUST store and return the canonical E.164 phone, including `+`.
2. Recovery lookup, staff review, and final staff creation MUST preserve the same canonical phone.
3. The existing two-stage recovery authorization, expiry, one-time ticket, role, audit, and non-leakage requirements remain unchanged.
4. An invalid phone MUST not create a recovery draft.

### R11. Consistent error and loading behavior

1. Invalid or incomplete input MUST show an inline error associated with the number field after interaction or attempted continuation.
2. The error MUST distinguish actionable input problems from a network/provider failure, but MUST NOT expose parser internals, account existence, or raw Clerk errors.
3. Busy states MUST prevent duplicate Continue, Verify, and country-selection actions without clearing input.
4. If metadata-backed validation fails unexpectedly, the operation MUST fail closed with a retryable generic error and no identity mutation.

### R12. Accessibility and tablet interaction

1. Country and phone controls MUST have persistent programmatic labels; placeholders are supplementary only.
2. The country trigger and keypad actions MUST provide at least 44 by 44 CSS-pixel touch targets with at least 8 pixels between adjacent targets where layout permits.
3. The country selector MUST implement an accessible searchable combobox or dialog/listbox pattern with visible focus, keyboard navigation, selection announcement, and focus return to the trigger when closed.
4. Validation state MUST use text and programmatic state such as `aria-invalid` and an associated error description; color alone is insufficient.
5. Number changes and canonical validity MAY be announced through a polite live region, but MUST NOT announce every formatting character as a separate disruptive event.
6. Primary interaction MUST work by tap/click and keyboard and MUST NOT depend on hover.
7. Motion MUST respect `prefers-reduced-motion`; no interaction may require animation to understand state.

## Security and Data Rules

- Treat phone and email as untrusted identity inputs at every route boundary.
- Preserve terminal authorization and rate limiting on existing endpoints.
- Reject invalid phones before Clerk/local writes and before recovery creation.
- Use exact normalized identity queries; never broaden queries to compensate for malformed input.
- Do not log raw phone, email, SMS codes, recovery credentials, or Clerk errors beyond existing approved observability policy.
- Preserve `User.phone` uniqueness and surface conflicts rather than bypassing it.

## Acceptance Scenarios

### Scenario A: US default remains familiar

- GIVEN a student opens an empty tablet phone step
- WHEN the step renders
- THEN United States is selected
- AND the existing numeric keypad remains available
- AND entering a valid US national number produces its canonical `+1` E.164 value

### Scenario B: Examples are not an allowlist

- GIVEN the selector is open
- WHEN the student searches for Mexico, Ecuador, Peru, Argentina, Chile, or another country returned by metadata
- THEN that country can be selected
- AND a valid national number for that country can pass the same canonical validation

### Scenario C: Search by calling code

- GIVEN the country selector is open
- WHEN the student searches for `+54` or `54`
- THEN matching countries are listed with country name, ISO code, and calling code
- AND selecting Argentina closes the selector and moves focus predictably to number entry

### Scenario D: Country switch invalidates stale canonical state

- GIVEN a phone is valid under the current country
- WHEN the student chooses a different country
- THEN the entered national digits remain available and are reformatted
- AND the prior canonical value is discarded
- AND Continue stays disabled until the new country-number pair is valid

### Scenario E: Invalid text is not extracted

- GIVEN the student pastes `Call me at +52 55 1234 5678`
- WHEN validation runs
- THEN strict whole-input parsing rejects the value
- AND no identity lookup or mutation occurs

### Scenario F: New-student SMS uses canonical international phone

- GIVEN a new student enters a valid non-US national number and valid email
- WHEN they continue to SMS verification
- THEN outcome verification, account preparation, Clerk, and SMS receive the same canonical E.164 phone
- AND US-only reformatting does not modify it

### Scenario G: Returning student is found by exact international phone

- GIVEN a returning student's local phone is stored as canonical digits
- WHEN the student submits the corresponding valid international number
- THEN identification matches that exact digits value
- AND a phone in another country sharing the same suffix does not match

### Scenario H: Legacy US row still matches narrowly

- GIVEN a valid US canonical phone is submitted
- AND the existing local row stores exactly its 10-digit national number without `1`
- WHEN returning identification or purchase detection runs
- THEN that exact legacy row may match
- AND the same fallback is not applied to any non-US phone
- AND the stored legacy phone remains unchanged merely because the fallback matched

### Scenario I: Email and phone identify different people

- GIVEN an email resolves to one identity and the phone resolves to another
- WHEN verification or checkout preparation runs
- THEN the operation stops before Clerk/local mutation
- AND the UI shows a non-sensitive correction or staff-assistance message

### Scenario J: Recovery preserves E.164

- GIVEN an international student reaches the approved recovery action
- WHEN a draft is created and later reviewed by authorized staff
- THEN the phone retains its leading `+` and exact E.164 value throughout the handoff

### Scenario K: SMS or network failure is recoverable

- GIVEN a valid canonical phone has been entered
- WHEN SMS preparation or the network fails
- THEN country and national input remain populated
- AND a retry action is available under existing cooldown rules
- AND no second identity is created

### Scenario L: All tablet surfaces are consistent

- GIVEN the same valid country and national number
- WHEN entered in enrollment, returning identification, or tablet SMS sign-in
- THEN each surface reaches the same canonical E.164 result and validity decision

### Scenario M: Shared calling code uses explicit country

- GIVEN two supported countries share a calling code
- WHEN the student selects one country and enters a valid national number for that country
- THEN validation uses the explicitly selected country
- AND the system does not switch countries based on calling code alone

### Scenario N: Unresolved canonical prefill fails closed

- GIVEN a canonical prefill parses without one concrete supported country
- WHEN the tablet phone field initializes
- THEN the system does not guess a country or default to US
- AND canonical validity remains empty
- AND the student must explicitly select a country and re-enter the national number

### Scenario O: Server-first compatibility transition

- GIVEN the server transition is deployed before the global tablet UI
- WHEN the current client submits its existing formatted or raw US phone
- THEN the server accepts and canonicalizes it as US
- AND exact canonical or exact legacy-US lookup is used without substring matching
- AND a later canonical international payload can be accepted without an additional server deployment
- AND checkout intent/account preparation has already been hardened to reject invalid or conflicting email-phone identity before mutation

## Definition of Done

- [ ] All acceptance scenarios are covered by automated tests at the appropriate layer.
- [ ] New-student and returning-student tablet flows use the shared domain and UI boundaries.
- [ ] No substring international identity lookup remains in affected paths.
- [ ] Malformed phones cannot reach identity mutation, SMS, or recovery creation.
- [ ] Legacy US compatibility is exact, parser-derived, and test-bounded.
- [ ] Accessibility and touch requirements are verified on a tablet-sized viewport.
- [ ] No schema migration or new endpoint is introduced without first updating this spec with evidence.

## Open Questions

None. Approved behavior is complete enough for implementation planning.
